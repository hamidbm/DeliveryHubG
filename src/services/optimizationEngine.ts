import { ObjectId } from 'mongodb';
import { emitEvent } from '../shared/events/emitEvent';
import { computeMilestoneRollups } from './rollupAnalytics';
import { evaluateMilestoneReadiness } from './milestoneGovernance';
import { getEffectivePolicyForMilestone } from './policy';
import { getPlanningMetadataByScope } from './applicationPlanningMetadata';
import {
  getLatestWorkDeliveryPlanRunRecord,
  getWorkDeliveryPlanRunRecord,
  getWorkPlanPreviewRecord,
  updateWorkPlanPreviewRecord
} from '../server/db/repositories/workPlansRepo';
import { insertOptimizationAppliedRunRecord } from '../server/db/repositories/optimizationRunsRepo';
import { patchMilestoneRecordById } from '../server/db/repositories/milestonesRepo';
import type {
  OptimizationApplyRequest,
  OptimizationApplyResult,
  OptimizationConstraints,
  OptimizationObjectiveWeights,
  OptimizationPlanRequest,
  OptimizationVariant,
  OptimizationVariantMetrics,
  PlanOptimizationResult,
  PortfolioOptimizationResult,
  PortfolioOptimizationPlanSummary,
  WorkItem
} from '../types';
import { getCreatedPlanExecutionData, getPreviewPlanExecutionData, parsePlanExecutionId } from './planExecutionData';

type MilestoneState = {
  milestoneId: string;
  name: string;
  startDate?: string;
  endDate?: string;
  targetCapacity: number | null;
  committedPoints: number;
  blockedCount: number;
  dependencyInbound: number;
  readinessBand: 'high' | 'medium' | 'low';
};

type PlanOptimizationContext = {
  planId: string;
  source: 'CREATED_PLAN' | 'PREVIEW';
  scopeType?: string;
  scopeId?: string;
  milestones: MilestoneState[];
  environmentBounds?: { minDate?: string; maxDate?: string };
};

const DEFAULT_WEIGHTS: OptimizationObjectiveWeights = {
  onTime: 0.4,
  riskReduction: 0.3,
  capacityBalance: 0.2,
  slippageMinimization: 0.1
};

const DEFAULT_CONSTRAINTS: OptimizationConstraints = {
  environmentBounds: true
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const toDate = (value?: string | null) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
};

const addDays = (value?: string, days = 0) => {
  const date = toDate(value);
  if (!date) return value;
  const shifted = new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
  return shifted.toISOString();
};

const normalizeWeights = (weights?: Partial<OptimizationObjectiveWeights>): OptimizationObjectiveWeights => {
  const merged = {
    ...DEFAULT_WEIGHTS,
    ...(weights || {})
  };
  const sum = Object.values(merged).reduce((acc, value) => acc + (Number.isFinite(value) ? Number(value) : 0), 0);
  if (sum <= 0) return { ...DEFAULT_WEIGHTS };
  return {
    onTime: merged.onTime / sum,
    riskReduction: merged.riskReduction / sum,
    capacityBalance: merged.capacityBalance / sum,
    slippageMinimization: merged.slippageMinimization / sum
  };
};

const normalizeConstraints = (constraints?: OptimizationConstraints): OptimizationConstraints => ({
  ...DEFAULT_CONSTRAINTS,
  ...(constraints || {})
});

const computeDependencyInbound = (items: WorkItem[]) => {
  const itemToMilestone = new Map<string, string>();
  items.forEach((item) => {
    const ids = ((item as any).milestoneIds || []).map(String);
    const legacy = (item as any).milestoneId ? String((item as any).milestoneId) : null;
    const milestoneId = ids.length ? ids[0] : legacy;
    if (!milestoneId) return;
    if (item._id) itemToMilestone.set(String(item._id), milestoneId);
    if (item.id) itemToMilestone.set(String(item.id), milestoneId);
    if ((item as any).key) itemToMilestone.set(String((item as any).key), milestoneId);
  });

  const inbound: Record<string, number> = {};
  items.forEach((item) => {
    const sourceIds = ((item as any).milestoneIds || []).map(String);
    const sourceLegacy = (item as any).milestoneId ? String((item as any).milestoneId) : null;
    const sourceMilestone = sourceIds.length ? sourceIds[0] : sourceLegacy;
    if (!sourceMilestone) return;
    const links = ((item as any).links || []).filter((link: any) => String(link.type) === 'BLOCKS');
    links.forEach((link: any) => {
      const targetMilestone = itemToMilestone.get(String(link.targetId)) || itemToMilestone.get(String(link.targetKey));
      if (!targetMilestone || targetMilestone === sourceMilestone) return;
      inbound[targetMilestone] = (inbound[targetMilestone] || 0) + 1;
    });
  });

  return inbound;
};

const computeEnvironmentBounds = async (scopeType?: string, scopeId?: string) => {
  if (!scopeType || !scopeId) return undefined;
  const normalizedScope = String(scopeType).toUpperCase();
  let metadata: any = null;
  if (normalizedScope === 'BUNDLE') metadata = await getPlanningMetadataByScope('bundle', String(scopeId));
  if (normalizedScope === 'APPLICATION') metadata = await getPlanningMetadataByScope('application', String(scopeId));

  const rows = Array.isArray(metadata?.environments) ? metadata.environments : [];
  const dates: Date[] = [];
  rows.forEach((row: any) => {
    const start = toDate(row?.startDate || row?.plannedStart || null);
    const end = toDate(row?.endDate || row?.plannedEnd || null);
    if (start) dates.push(start);
    if (end) dates.push(end);
  });
  const goLive = toDate(metadata?.goLive?.planned || null);
  if (goLive) dates.push(goLive);
  if (!dates.length) return undefined;

  dates.sort((a, b) => a.getTime() - b.getTime());
  return {
    minDate: dates[0].toISOString(),
    maxDate: dates[dates.length - 1].toISOString()
  };
};

const riskScoreOfMilestone = (milestone: MilestoneState) => {
  const util = milestone.targetCapacity && milestone.targetCapacity > 0
    ? milestone.committedPoints / milestone.targetCapacity
    : null;
  let score = 1;
  if (util != null) {
    if (util > 1.2) score += 2;
    else if (util > 1) score += 1;
    else if (util < 0.6) score += 0.2;
  }
  score += milestone.blockedCount * 0.15;
  score += milestone.dependencyInbound * 0.1;
  if (milestone.readinessBand === 'low') score += 1.2;
  else if (milestone.readinessBand === 'medium') score += 0.5;
  return score;
};

const utilizationOf = (milestone: MilestoneState) => {
  if (!milestone.targetCapacity || milestone.targetCapacity <= 0) return null;
  return milestone.committedPoints / milestone.targetCapacity;
};

const stdDev = (values: number[]) => {
  if (!values.length) return 0;
  const mean = values.reduce((acc, value) => acc + value, 0) / values.length;
  const variance = values.reduce((acc, value) => acc + (value - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
};

const computeMetrics = (milestones: MilestoneState[]): OptimizationVariantMetrics => {
  if (!milestones.length) {
    return {
      onTimeProbability: 0,
      expectedSlippageDays: 0,
      riskScore: 0,
      readinessScore: 0,
      averageUtilization: null
    };
  }

  const riskScores = milestones.map(riskScoreOfMilestone);
  const avgRisk = riskScores.reduce((acc, value) => acc + value, 0) / riskScores.length;
  const readinessMap = { high: 1, medium: 0.65, low: 0.35 } as const;
  const readinessScore = milestones.reduce((acc, milestone) => acc + readinessMap[milestone.readinessBand], 0) / milestones.length;
  const utilizations = milestones.map(utilizationOf).filter((value): value is number => value != null);
  const averageUtilization = utilizations.length
    ? utilizations.reduce((acc, value) => acc + value, 0) / utilizations.length
    : null;

  const slippage = milestones.reduce((acc, milestone) => {
    const util = utilizationOf(milestone) || 0;
    const utilPenalty = util > 1 ? (util - 1) * 12 : 0;
    const dependencyPenalty = milestone.dependencyInbound * 0.8;
    const blockedPenalty = milestone.blockedCount * 0.5;
    const readinessPenalty = milestone.readinessBand === 'low' ? 4 : milestone.readinessBand === 'medium' ? 2 : 0;
    return acc + utilPenalty + dependencyPenalty + blockedPenalty + readinessPenalty;
  }, 0) / milestones.length;

  const onTimeProbability = clamp(1 - (avgRisk * 0.12) - (slippage * 0.01) + (readinessScore * 0.15), 0.05, 0.98);

  return {
    onTimeProbability,
    expectedSlippageDays: Math.max(0, Math.round(slippage)),
    riskScore: Number(avgRisk.toFixed(2)),
    readinessScore: Number((readinessScore * 100).toFixed(1)),
    averageUtilization: averageUtilization == null ? null : Number(averageUtilization.toFixed(2))
  };
};

const cloneMilestones = (milestones: MilestoneState[]): MilestoneState[] => milestones.map((m) => ({ ...m }));

const enforceDateConstraints = (
  milestone: MilestoneState,
  constraints: OptimizationConstraints,
  bounds?: { minDate?: string; maxDate?: string }
) => {
  if (!milestone.startDate && !milestone.endDate) return;

  const minDate = constraints.noChangeBeforeDate || bounds?.minDate;
  const maxDate = bounds?.maxDate;

  const start = toDate(milestone.startDate);
  const end = toDate(milestone.endDate);
  if (!start && !end) return;

  let nextStart = start;
  let nextEnd = end;

  const min = toDate(minDate);
  const max = toDate(maxDate);

  if (min && nextStart && nextStart.getTime() < min.getTime()) {
    const delta = min.getTime() - nextStart.getTime();
    nextStart = new Date(min.getTime());
    if (nextEnd) nextEnd = new Date(nextEnd.getTime() + delta);
  }

  if (min && nextEnd && nextEnd.getTime() < min.getTime()) {
    nextEnd = new Date(min.getTime());
  }

  if (constraints.environmentBounds && max && nextEnd && nextEnd.getTime() > max.getTime()) {
    const delta = nextEnd.getTime() - max.getTime();
    nextEnd = new Date(max.getTime());
    if (nextStart) nextStart = new Date(nextStart.getTime() - delta);
  }

  if (constraints.environmentBounds && max && nextStart && nextStart.getTime() > max.getTime()) {
    nextStart = new Date(max.getTime());
  }

  milestone.startDate = nextStart?.toISOString();
  milestone.endDate = nextEnd?.toISOString();
};

const buildChanges = (before: MilestoneState[], after: MilestoneState[]) => {
  const beforeById = new Map(before.map((m) => [m.milestoneId, m]));
  return after.flatMap((current) => {
    const previous = beforeById.get(current.milestoneId);
    if (!previous) return [];
    const changedSchedule = (previous.startDate || '') !== (current.startDate || '') || (previous.endDate || '') !== (current.endDate || '');
    const changedCapacity = (previous.targetCapacity || null) !== (current.targetCapacity || null);
    if (!changedSchedule && !changedCapacity) return [];

    return [{
      milestoneId: current.milestoneId,
      milestoneName: current.name,
      oldStartDate: previous.startDate,
      newStartDate: current.startDate,
      oldEndDate: previous.endDate,
      newEndDate: current.endDate,
      oldTargetCapacity: previous.targetCapacity,
      newTargetCapacity: current.targetCapacity,
      category: changedSchedule ? ('SCHEDULE' as const) : ('CAPACITY' as const)
    }];
  });
};

const buildExplanation = (
  variantName: string,
  baseline: OptimizationVariantMetrics,
  optimized: OptimizationVariantMetrics
) => {
  const reasoning = [] as OptimizationVariant['explanations'];
  const onTimeDelta = optimized.onTimeProbability - baseline.onTimeProbability;
  if (onTimeDelta > 0.001) {
    reasoning.push({
      type: 'OnTimeProbability',
      description: `${variantName} improves predicted on-time probability by ${(onTimeDelta * 100).toFixed(1)} percentage points.`,
      impact: { onTimeProbability: Number(onTimeDelta.toFixed(4)) }
    });
  }

  const slipDelta = baseline.expectedSlippageDays - optimized.expectedSlippageDays;
  if (slipDelta > 0) {
    reasoning.push({
      type: 'ScheduleSlip',
      description: `${variantName} reduces expected slippage by ${slipDelta} days.`,
      impact: { expectedSlippageDays: slipDelta }
    });
  }

  const riskDelta = baseline.riskScore - optimized.riskScore;
  if (riskDelta > 0.01) {
    reasoning.push({
      type: 'RiskReduction',
      description: `${variantName} reduces aggregate risk score by ${riskDelta.toFixed(2)}.`,
      impact: { riskScore: Number(riskDelta.toFixed(2)) }
    });
  }

  if (!reasoning.length) {
    reasoning.push({
      type: 'Stability',
      description: `${variantName} keeps risk and schedule stable while balancing milestone load.`
    });
  }

  return reasoning;
};

const scoreVariant = (
  baseline: OptimizationVariantMetrics,
  candidate: OptimizationVariantMetrics,
  baselineUtilStdDev: number,
  candidateUtilStdDev: number,
  weights: OptimizationObjectiveWeights
) => {
  const onTimeGain = candidate.onTimeProbability - baseline.onTimeProbability;
  const riskGain = baseline.riskScore - candidate.riskScore;
  const slippageGain = baseline.expectedSlippageDays - candidate.expectedSlippageDays;
  const balanceGain = baselineUtilStdDev - candidateUtilStdDev;

  const score =
    weights.onTime * onTimeGain * 100 +
    weights.riskReduction * riskGain * 10 +
    weights.slippageMinimization * slippageGain * 5 +
    weights.capacityBalance * balanceGain * 20;

  return Number(score.toFixed(3));
};

const applyStrategy = (
  name: string,
  baseMilestones: MilestoneState[],
  constraints: OptimizationConstraints,
  bounds: { minDate?: string; maxDate?: string } | undefined,
  intensity: number,
  mode: 'on_time' | 'risk' | 'balance'
): MilestoneState[] => {
  const milestones = cloneMilestones(baseMilestones);
  const overUtilized = milestones.filter((m) => (utilizationOf(m) || 0) > 1).sort((a, b) => (utilizationOf(b) || 0) - (utilizationOf(a) || 0));
  const underUtilized = milestones.filter((m) => {
    const util = utilizationOf(m);
    return util != null && util < 0.8;
  }).sort((a, b) => (utilizationOf(a) || 0) - (utilizationOf(b) || 0));

  if (mode === 'balance' && overUtilized.length && underUtilized.length) {
    overUtilized.slice(0, Math.max(1, Math.round(overUtilized.length * intensity))).forEach((target, index) => {
      const donor = underUtilized[index % underUtilized.length];
      const donorCap = donor.targetCapacity || 0;
      const donorMove = Math.max(1, Math.round(donorCap * 0.05 * intensity));
      if (donorCap > donorMove + donor.committedPoints) {
        donor.targetCapacity = donorCap - donorMove;
        target.targetCapacity = (target.targetCapacity || target.committedPoints || 1) + donorMove;
      }
    });
  }

  const risky = milestones
    .slice()
    .sort((a, b) => riskScoreOfMilestone(b) - riskScoreOfMilestone(a))
    .slice(0, Math.max(1, Math.round(milestones.length * intensity)));

  risky.forEach((milestone) => {
    if (mode === 'on_time' || mode === 'risk') {
      const shiftDays = Math.max(1, Math.round((mode === 'on_time' ? 3 : 2) * intensity));
      milestone.startDate = addDays(milestone.startDate, -shiftDays);
      milestone.endDate = addDays(milestone.endDate, -shiftDays);
    }

    if (mode !== 'on_time') {
      const cap = milestone.targetCapacity || milestone.committedPoints || 1;
      milestone.targetCapacity = Math.round(cap * (1 + 0.08 * intensity));
    }

    if (milestone.readinessBand === 'low') milestone.readinessBand = 'medium';
    else if (milestone.readinessBand === 'medium' && mode === 'risk') milestone.readinessBand = 'high';

    if (milestone.blockedCount > 0) milestone.blockedCount = Math.max(0, milestone.blockedCount - Math.round(1 * intensity));
    if (milestone.dependencyInbound > 0) milestone.dependencyInbound = Math.max(0, milestone.dependencyInbound - Math.round(1 * intensity));
  });

  milestones.forEach((milestone) => enforceDateConstraints(milestone, constraints, bounds));

  return milestones;
};

const collectUtilizations = (milestones: MilestoneState[]) => milestones
  .map(utilizationOf)
  .filter((value): value is number => value != null);

const loadOptimizationContext = async (
  planId: string,
  user: { userId?: string; role?: string } | null
): Promise<PlanOptimizationContext | null> => {
  const parsed = parsePlanExecutionId(planId);
  if (!parsed) return null;

  if (parsed.source === 'PREVIEW') {
    const previewData = await getPreviewPlanExecutionData(parsed.id);
    if (!previewData?.preview) return null;
    const preview = previewData.preview;
    const data = preview.preview || {};
    const loadByMilestone = new Map<number, number>();
    (data.artifacts || []).forEach((artifact: any) => {
      loadByMilestone.set(Number(artifact.milestoneIndex), Number(artifact.storyCount || 0));
    });

    const milestones: MilestoneState[] = (data.milestones || []).map((milestone: any) => ({
      milestoneId: String(milestone.index),
      name: String(milestone.name || `Milestone ${milestone.index}`),
      startDate: milestone.startDate,
      endDate: milestone.endDate,
      targetCapacity: typeof milestone.targetCapacity === 'number' ? milestone.targetCapacity : null,
      committedPoints: loadByMilestone.get(Number(milestone.index)) || 0,
      blockedCount: 0,
      dependencyInbound: 0,
      readinessBand: 'medium'
    }));

    return {
      planId,
      source: parsed.source,
      scopeType: preview.scopeType,
      scopeId: preview.scopeId,
      milestones,
      environmentBounds: await computeEnvironmentBounds(preview.scopeType, preview.scopeId)
    };
  }

  const run = await getWorkDeliveryPlanRunRecord(parsed.id);
  if (!run) return null;
  const runData = await getCreatedPlanExecutionData(parsed.id, user);
  if (!runData) return null;
  const visibleMilestones = runData.visibleMilestones as any[];

  const milestoneKeys = visibleMilestones.map((m) => String(m._id || m.id || m.name));
  const rollups = await computeMilestoneRollups(milestoneKeys);
  const rollupById = new Map<string, any>();
  rollups.forEach((rollup: any) => rollupById.set(String(rollup.milestoneId), rollup));

  const dependencyInbound = computeDependencyInbound(runData.enrichedItems as WorkItem[]);

  const milestones: MilestoneState[] = [];
  for (const milestone of visibleMilestones) {
    const milestoneId = String(milestone._id || milestone.id || milestone.name);
    const rollup = rollupById.get(milestoneId) || {};
    const policyRef = await getEffectivePolicyForMilestone(milestoneId);
    const readiness = await evaluateMilestoneReadiness(rollup, policyRef.effective);
    milestones.push({
      milestoneId,
      name: String(milestone.name || milestoneId),
      startDate: milestone.startDate,
      endDate: milestone.endDate,
      targetCapacity: typeof milestone.targetCapacity === 'number' ? milestone.targetCapacity : (rollup?.capacity?.targetCapacity ?? null),
      committedPoints: Number(rollup?.capacity?.committedPoints || 0),
      blockedCount: Number(rollup?.totals?.blockedDerived || 0),
      dependencyInbound: Number(dependencyInbound[milestoneId] || 0),
      readinessBand: readiness?.band || 'medium'
    });
  }

  return {
    planId,
    source: parsed.source,
    scopeType: run.scopeType,
    scopeId: run.scopeId,
    milestones,
    environmentBounds: await computeEnvironmentBounds(run.scopeType, run.scopeId)
  };
};

export const optimizePlan = async (
  planId: string,
  user: { userId?: string; role?: string } | null,
  request?: OptimizationPlanRequest
): Promise<PlanOptimizationResult | null> => {
  const started = Date.now();
  const context = await loadOptimizationContext(planId, user);
  if (!context) return null;

  const objectiveWeights = normalizeWeights(request?.objectiveWeights);
  const constraints = normalizeConstraints(request?.constraints);
  const maxVariants = clamp(Number(request?.options?.maxVariants || 5), 1, 10);

  const baselineMetrics = computeMetrics(context.milestones);
  const baselineUtilStdDev = stdDev(collectUtilizations(context.milestones));

  const candidateBlueprints = [
    { name: 'On-time Focus', mode: 'on_time' as const, intensity: 1.0 },
    { name: 'Risk Reduction Focus', mode: 'risk' as const, intensity: 1.0 },
    { name: 'Capacity Balance Focus', mode: 'balance' as const, intensity: 1.0 },
    { name: 'Balanced Tradeoff', mode: 'balance' as const, intensity: 0.7 },
    { name: 'Conservative Adjustment', mode: 'on_time' as const, intensity: 0.55 },
    { name: 'Aggressive Recovery', mode: 'risk' as const, intensity: 1.35 }
  ];

  const variants: OptimizationVariant[] = candidateBlueprints
    .slice(0, Math.max(maxVariants + 1, 4))
    .map((blueprint, index) => {
      const optimizedMilestones = applyStrategy(
        blueprint.name,
        context.milestones,
        constraints,
        context.environmentBounds,
        blueprint.intensity,
        blueprint.mode
      );
      const metrics = computeMetrics(optimizedMilestones);
      const changes = buildChanges(context.milestones, optimizedMilestones);
      const candidateUtilStdDev = stdDev(collectUtilizations(optimizedMilestones));
      const score = scoreVariant(baselineMetrics, metrics, baselineUtilStdDev, candidateUtilStdDev, objectiveWeights);
      const explanations = buildExplanation(blueprint.name, baselineMetrics, metrics);

      return {
        variantId: `opt-${index + 1}`,
        name: blueprint.name,
        description: `Auto-generated ${blueprint.mode.replace('_', ' ')} strategy variant.`,
        score,
        changes,
        metrics,
        explanations
      };
    })
    .filter((variant) => variant.changes.length > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxVariants);

  return {
    planId,
    baselinePlan: {
      planId,
      source: context.source,
      generatedAt: new Date().toISOString(),
      summary: baselineMetrics
    },
    objectiveWeights,
    constraints,
    optimizedVariants: variants,
    recommendedVariantId: variants[0]?.variantId,
    durationMs: Date.now() - started
  };
};

export const optimizePortfolio = async (
  planIds: string[],
  user: { userId?: string; role?: string } | null,
  request?: OptimizationPlanRequest
): Promise<PortfolioOptimizationResult> => {
  const objectiveWeights = normalizeWeights(request?.objectiveWeights);
  const constraints = normalizeConstraints(request?.constraints);
  const planSummaries: PortfolioOptimizationPlanSummary[] = [];

  for (const planId of planIds) {
    const result = await optimizePlan(planId, user, request);
    if (!result) continue;
    const best = result.optimizedVariants[0];
    const baseline = result.baselinePlan.summary;
    const optimized = best?.metrics;
    planSummaries.push({
      planId,
      bestVariantId: best?.variantId,
      baseline,
      optimized,
      delta: {
        onTimeProbability: Number(((optimized?.onTimeProbability || baseline.onTimeProbability) - baseline.onTimeProbability).toFixed(4)),
        expectedSlippageDays: (optimized?.expectedSlippageDays ?? baseline.expectedSlippageDays) - baseline.expectedSlippageDays,
        riskScore: Number(((optimized?.riskScore ?? baseline.riskScore) - baseline.riskScore).toFixed(2)),
        readinessScore: Number(((optimized?.readinessScore ?? baseline.readinessScore) - baseline.readinessScore).toFixed(1))
      }
    });
  }

  return {
    plansAnalyzed: planSummaries.length,
    planSummaries,
    objectiveWeights,
    constraints,
    generatedAt: new Date().toISOString()
  };
};

const getPlanSourceInfo = async (planId: string) => {
  const parsed = parsePlanExecutionId(planId);
  if (!parsed) return null;
  if (parsed.source === 'PREVIEW') {
    const preview = await getWorkPlanPreviewRecord(parsed.id);
    if (!preview) return null;
    return {
      parsed,
      scopeType: preview.scopeType,
      scopeId: preview.scopeId
    };
  }
  const run = await getWorkDeliveryPlanRunRecord(parsed.id);
  if (!run) return null;
  return {
    parsed,
    scopeType: run.scopeType,
    scopeId: run.scopeId
  };
};

const applyVariantToPreviewPlan = async (previewId: string, variant: OptimizationVariant) => {
  const doc = await getWorkPlanPreviewRecord(previewId);
  if (!doc) return 0;
  const preview = doc.preview || {};
  const milestones = Array.isArray(preview.milestones) ? [...preview.milestones] : [];
  const byIndex = new Map<number, any>();
  milestones.forEach((milestone: any) => {
    const index = Number(milestone.index);
    if (Number.isFinite(index)) byIndex.set(index, milestone);
  });

  let appliedCount = 0;
  (variant.changes || []).forEach((change) => {
    const index = Number(change.milestoneId);
    if (!Number.isFinite(index)) return;
    const milestone = byIndex.get(index);
    if (!milestone) return;
    if (change.newStartDate) milestone.startDate = change.newStartDate;
    if (change.newEndDate) milestone.endDate = change.newEndDate;
    if (typeof change.newTargetCapacity === 'number') milestone.targetCapacity = change.newTargetCapacity;
    appliedCount += 1;
  });

  if (!appliedCount) return 0;
  await updateWorkPlanPreviewRecord(previewId, {
    preview: {
      ...preview,
      milestones
    },
    updatedAt: new Date().toISOString()
  });
  return appliedCount;
};

const applyVariantToCreatedPlan = async (runId: string, variant: OptimizationVariant, user: { userId?: string; email?: string }) => {
  const run = await getWorkDeliveryPlanRunRecord(runId);
  if (!run) return 0;
  const allowedIds = new Set((run.milestoneIds || []).map((id: any) => String(id)));

  let appliedCount = 0;
  for (const change of variant.changes || []) {
    const milestoneId = String(change.milestoneId || '');
    if (!milestoneId || !allowedIds.has(milestoneId) || !ObjectId.isValid(milestoneId)) continue;
    const update: any = {
      updatedAt: new Date().toISOString(),
      updatedBy: String(user.userId || user.email || 'system')
    };
    if (change.newStartDate) update.startDate = change.newStartDate;
    if (change.newEndDate) {
      update.endDate = change.newEndDate;
      update.dueDate = change.newEndDate;
    }
    if (typeof change.newTargetCapacity === 'number') update.targetCapacity = change.newTargetCapacity;
    if (Object.keys(update).length <= 2) continue;
    await patchMilestoneRecordById(milestoneId, update);
    appliedCount += 1;
  }
  return appliedCount;
};

export const applyOptimizationVariant = async (
  planId: string,
  user: { userId?: string; role?: string; email?: string } | null,
  request: OptimizationApplyRequest
): Promise<OptimizationApplyResult | null> => {
  if (!user?.userId) throw new Error('Unauthenticated');
  if (!request?.variantId) throw new Error('variantId is required');

  const sourceInfo = await getPlanSourceInfo(planId);
  if (!sourceInfo) return null;
  const { parsed, scopeType, scopeId } = sourceInfo;
  const optimizationRequest: OptimizationPlanRequest = {
    objectiveWeights: request.objectiveWeights,
    constraints: request.constraints,
    options: request.options
  };

  const fresh = await optimizePlan(planId, user, optimizationRequest);
  if (!fresh) return null;
  const variant = fresh.optimizedVariants.find((entry) => entry.variantId === request.variantId) || request.variant;
  if (!variant) throw new Error('Variant not found');
  if (!Array.isArray(variant.changes) || !variant.changes.length) {
    throw new Error('Variant has no applicable changes');
  }

  let appliedChanges = 0;
  if (parsed.source === 'PREVIEW') {
    appliedChanges = await applyVariantToPreviewPlan(parsed.id, variant);
  } else {
    appliedChanges = await applyVariantToCreatedPlan(parsed.id, variant, user);
  }

  if (!appliedChanges) throw new Error('No changes applied');

  const scheduleChanges = variant.changes.filter((change) => change.category === 'SCHEDULE').length;
  const capacityChanges = variant.changes.filter((change) => change.category === 'CAPACITY').length;
  const appliedAt = new Date().toISOString();
  const baseline = fresh.baselinePlan?.summary;
  const optimized = variant.metrics;
  const expectedImpact = {
    onTimeProbabilityDelta: Number(((optimized.onTimeProbability || 0) - (baseline?.onTimeProbability || 0)).toFixed(4)),
    expectedSlippageDaysDelta: Number(((optimized.expectedSlippageDays || 0) - (baseline?.expectedSlippageDays || 0)).toFixed(1)),
    riskScoreDelta: Number(((optimized.riskScore || 0) - (baseline?.riskScore || 0)).toFixed(2)),
    readinessScoreDelta: Number(((optimized.readinessScore || 0) - (baseline?.readinessScore || 0)).toFixed(1))
  };

  const auditRecord = {
    planId,
    source: parsed.source,
    scopeType: scopeType ? String(scopeType).toUpperCase() : undefined,
    scopeId: scopeId ? String(scopeId) : undefined,
    acceptedVariantId: variant.variantId,
    acceptedVariantName: variant.name,
    acceptedVariantScore: variant.score,
    objectiveWeights: fresh.objectiveWeights,
    expectedImpact,
    appliedAt,
    appliedBy: String(user.userId),
    summary: {
      totalChanges: variant.changes.length,
      scheduleChanges,
      capacityChanges
    },
    changes: variant.changes
  };

  const auditInsert = await insertOptimizationAppliedRunRecord(auditRecord);

  try {
    await emitEvent({
      ts: appliedAt,
      type: 'workitems.optimization.applied',
      actor: {
        userId: String(user.userId),
        displayName: user.email || String(user.userId),
        email: user.email
      },
      resource: {
        type: 'workitems.plan',
        id: planId,
        title: `Optimization applied ${planId}`
      },
      context: {
        bundleId: scopeType === 'BUNDLE' ? String(scopeId || '') : undefined,
        appId: scopeType === 'APPLICATION' ? String(scopeId || '') : undefined
      },
      payload: {
        acceptedVariantId: variant.variantId,
        objectiveWeights: fresh.objectiveWeights,
        summary: auditRecord.summary,
        expectedImpact
      }
    });
  } catch {
    // Applying the variant and audit persistence are primary; event emission is best-effort.
  }

  return {
    planId,
    applied: true,
    source: parsed.source,
    variant,
    appliedAt,
    summary: auditRecord.summary,
    auditId: String(auditInsert.insertedId)
  };
};
