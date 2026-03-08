import { ObjectId } from 'mongodb';
import { getDb, computeMilestoneRollups, deriveWorkItemLinkSummary } from './db';
import { evaluateMilestoneReadiness } from './milestoneGovernance';
import { getEffectivePolicyForMilestone } from './policy';
import { createVisibilityContext } from './visibility';
import type {
  WorkItem,
  DeliveryPlanPreview,
  MilestoneProbabilisticForecast,
  PlanProbabilisticForecastSummary,
  PortfolioProbabilisticForecastSummary
} from '../types';

const DEFAULT_SAMPLE_COUNT = 500;
const DEFAULT_SEED = 42;

const LOW_ON_TIME_PROBABILITY_THRESHOLD = 0.5;
const MEDIUM_ON_TIME_PROBABILITY_THRESHOLD = 0.8;
const LOW_UNCERTAINTY_SPREAD_DAYS = 5;
const MEDIUM_UNCERTAINTY_SPREAD_DAYS = 10;

type PlanIdParsed = { source: 'CREATED_PLAN' | 'PREVIEW'; id: string };

const parsePlanId = (value: string): PlanIdParsed | null => {
  if (!value) return null;
  const [prefix, raw] = value.split(':');
  if (!raw) return null;
  if (prefix === 'created') return { source: 'CREATED_PLAN', id: raw };
  if (prefix === 'preview') return { source: 'PREVIEW', id: raw };
  return null;
};

const toDate = (value?: string) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
};

const addDays = (value: Date, days: number) => {
  const next = new Date(value);
  next.setDate(next.getDate() + days);
  return next;
};

const daysBetween = (start?: string, end?: string) => {
  const s = toDate(start);
  const e = toDate(end);
  if (!s || !e) return 14;
  const delta = Math.max(1, Math.round((e.getTime() - s.getTime()) / (24 * 60 * 60 * 1000)));
  return delta;
};

const hashSeed = (seed?: number | string) => {
  if (seed === undefined || seed === null) return DEFAULT_SEED;
  if (typeof seed === 'number' && Number.isFinite(seed)) return seed;
  const str = String(seed);
  let hash = 0;
  for (let i = 0; i < str.length; i += 1) {
    hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
  }
  return hash || DEFAULT_SEED;
};

const mulberry32 = (seed: number) => {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), t | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
};

const computeRiskAdjustments = ({
  utilizationPercent,
  dependencyInbound,
  blockedItemCount,
  readinessBand,
  confidenceBand
}: {
  utilizationPercent: number | null;
  dependencyInbound: number;
  blockedItemCount: number;
  readinessBand: 'high' | 'medium' | 'low';
  confidenceBand: 'high' | 'medium' | 'low';
}) => {
  let spread = 0;
  if (utilizationPercent != null) {
    if (utilizationPercent > 1.2) spread += 6;
    else if (utilizationPercent > 1.0) spread += 3;
  }
  if (dependencyInbound > 6) spread += 5;
  else if (dependencyInbound > 3) spread += 2;
  if (blockedItemCount > 10) spread += 6;
  else if (blockedItemCount > 5) spread += 3;
  if (readinessBand === 'low') spread += 5;
  else if (readinessBand === 'medium') spread += 2;
  if (confidenceBand === 'low') spread += 4;
  else if (confidenceBand === 'medium') spread += 2;
  return spread;
};

const computeUncertaintyLevel = (spreadDays: number, onTimeProbability: number) => {
  if (onTimeProbability < LOW_ON_TIME_PROBABILITY_THRESHOLD || spreadDays >= MEDIUM_UNCERTAINTY_SPREAD_DAYS) {
    return 'HIGH' as const;
  }
  if (onTimeProbability < MEDIUM_ON_TIME_PROBABILITY_THRESHOLD || spreadDays >= LOW_UNCERTAINTY_SPREAD_DAYS) {
    return 'MEDIUM' as const;
  }
  return 'LOW' as const;
};

export const sampleMilestoneFinishDates = ({
  plannedEndDate,
  startDate,
  utilizationPercent,
  dependencyInbound,
  blockedItemCount,
  readinessBand,
  confidenceBand,
  sampleCount = DEFAULT_SAMPLE_COUNT,
  seed
}: {
  plannedEndDate: string;
  startDate?: string;
  utilizationPercent: number | null;
  dependencyInbound: number;
  blockedItemCount: number;
  readinessBand: 'high' | 'medium' | 'low';
  confidenceBand: 'high' | 'medium' | 'low';
  sampleCount?: number;
  seed?: number | string;
}) => {
  const end = toDate(plannedEndDate) || new Date();
  const duration = daysBetween(startDate, plannedEndDate);
  const baseSpreadDays = Math.max(2, Math.round(duration * 0.15));
  const riskAdjustments = computeRiskAdjustments({
    utilizationPercent,
    dependencyInbound,
    blockedItemCount,
    readinessBand,
    confidenceBand
  });
  const earlyMax = Math.max(1, Math.round(baseSpreadDays * 0.5));
  const lateMax = baseSpreadDays + riskAdjustments;
  const rng = mulberry32(hashSeed(seed));
  const dates: Date[] = [];
  for (let i = 0; i < Math.max(1, sampleCount); i += 1) {
    const u = rng();
    let offset = 0;
    if (u < 0.3) {
      offset = -Math.round(rng() * earlyMax);
    } else {
      offset = Math.round(rng() * lateMax);
    }
    dates.push(addDays(end, offset));
  }
  return dates;
};

const percentileDate = (dates: Date[], percentile: number) => {
  if (!dates.length) return new Date();
  const sorted = [...dates].sort((a, b) => a.getTime() - b.getTime());
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor((sorted.length - 1) * percentile)));
  return sorted[idx];
};

export const computeMilestoneProbabilisticForecast = ({
  milestoneId,
  plannedEndDate,
  startDate,
  utilizationPercent,
  dependencyInbound,
  blockedItemCount,
  readinessBand,
  confidenceBand,
  sampleCount,
  seed
}: {
  milestoneId: string;
  plannedEndDate: string;
  startDate?: string;
  utilizationPercent: number | null;
  dependencyInbound: number;
  blockedItemCount: number;
  readinessBand: 'high' | 'medium' | 'low';
  confidenceBand: 'high' | 'medium' | 'low';
  sampleCount?: number;
  seed?: number | string;
}): MilestoneProbabilisticForecast => {
  const dates = sampleMilestoneFinishDates({
    plannedEndDate,
    startDate,
    utilizationPercent,
    dependencyInbound,
    blockedItemCount,
    readinessBand,
    confidenceBand,
    sampleCount,
    seed
  });
  const planned = toDate(plannedEndDate) || new Date();
  const onTimeProbability = dates.length
    ? dates.filter((d) => d.getTime() <= planned.getTime()).length / dates.length
    : 0;
  const p50 = percentileDate(dates, 0.5);
  const p75 = percentileDate(dates, 0.75);
  const p90 = percentileDate(dates, 0.9);
  const spreadDays = Math.max(0, Math.round((p90.getTime() - p50.getTime()) / (24 * 60 * 60 * 1000)));
  const uncertaintyLevel = computeUncertaintyLevel(spreadDays, onTimeProbability);

  return {
    milestoneId,
    plannedEndDate: planned.toISOString(),
    p50Date: p50.toISOString(),
    p75Date: p75.toISOString(),
    p90Date: p90.toISOString(),
    onTimeProbability,
    uncertaintyLevel
  };
};

const buildDependencyInbound = (items: WorkItem[]) => {
  const itemToMilestone = new Map<string, string>();
  items.forEach((item) => {
    const ids = ((item as any).milestoneIds || []).map(String);
    const legacy = (item as any).milestoneId ? String((item as any).milestoneId) : null;
    const milestoneId = ids.length ? ids[0] : legacy;
    if (!milestoneId) return;
    if ((item as any)._id) itemToMilestone.set(String((item as any)._id), milestoneId);
    if ((item as any).id) itemToMilestone.set(String((item as any).id), milestoneId);
    if ((item as any).key) itemToMilestone.set(String((item as any).key), milestoneId);
  });

  const inbound: Record<string, number> = {};
  items.forEach((item) => {
    const ids = ((item as any).milestoneIds || []).map(String);
    const legacy = (item as any).milestoneId ? String((item as any).milestoneId) : null;
    const source = ids.length ? ids[0] : legacy;
    if (!source) return;
    const links = (item as any).links || [];
    links.filter((link: any) => String(link.type) === 'BLOCKS').forEach((link: any) => {
      const target = itemToMilestone.get(String(link.targetId)) || itemToMilestone.get(String(link.targetKey));
      if (!target || target === source) return;
      inbound[target] = (inbound[target] || 0) + 1;
    });
  });
  return inbound;
};

export const computePlanProbabilisticForecast = async ({
  planId,
  milestones,
  rollups,
  readinessByMilestone,
  dependencyInbound,
  sampleCount,
  seed
}: {
  planId: string;
  milestones: Array<{ id: string; startDate?: string; endDate?: string; targetCapacity?: number | null }>;
  rollups: Record<string, any>;
  readinessByMilestone: Record<string, any>;
  dependencyInbound: Record<string, number>;
  sampleCount?: number;
  seed?: number | string;
}): Promise<{ milestoneForecasts: MilestoneProbabilisticForecast[]; summary: PlanProbabilisticForecastSummary }> => {
  const forecasts: MilestoneProbabilisticForecast[] = [];
  for (const milestone of milestones) {
    const rollup = rollups[milestone.id];
    const readiness = readinessByMilestone[milestone.id];
    const readinessBand: 'high' | 'medium' | 'low' = readiness?.band || 'medium';
    const confidenceBand: 'high' | 'medium' | 'low' = rollup?.confidence?.band || 'medium';
    const capacity = rollup?.capacity || {};
    const utilizationPercent = typeof capacity.capacityUtilization === 'number'
      ? capacity.capacityUtilization
      : (capacity.targetCapacity && capacity.targetCapacity > 0 ? (capacity.committedPoints || 0) / capacity.targetCapacity : null);
    const blockedItemCount = rollup?.totals?.blockedDerived || 0;
    const forecast = computeMilestoneProbabilisticForecast({
      milestoneId: milestone.id,
      plannedEndDate: milestone.endDate || new Date().toISOString(),
      startDate: milestone.startDate,
      utilizationPercent,
      dependencyInbound: dependencyInbound[milestone.id] || 0,
      blockedItemCount,
      readinessBand,
      confidenceBand,
      sampleCount,
      seed
    });
    forecasts.push(forecast);
  }

  const avgOnTime = forecasts.length
    ? forecasts.reduce((sum, f) => sum + f.onTimeProbability, 0) / forecasts.length
    : 0;
  const avgP50SlipDays = forecasts.length
    ? Math.round(
      forecasts.reduce((sum, f) => {
        const planned = toDate(f.plannedEndDate) || new Date();
        const p50 = toDate(f.p50Date) || planned;
        return sum + Math.round((p50.getTime() - planned.getTime()) / (24 * 60 * 60 * 1000));
      }, 0) / forecasts.length
    )
    : 0;
  const avgP90SlipDays = forecasts.length
    ? Math.round(
      forecasts.reduce((sum, f) => {
        const planned = toDate(f.plannedEndDate) || new Date();
        const p90 = toDate(f.p90Date) || planned;
        return sum + Math.round((p90.getTime() - planned.getTime()) / (24 * 60 * 60 * 1000));
      }, 0) / forecasts.length
    )
    : 0;
  const lowConfidenceMilestones = forecasts.filter((f) => f.uncertaintyLevel === 'HIGH').length;

  return {
    milestoneForecasts: forecasts,
    summary: {
      planId,
      milestonesAnalyzed: forecasts.length,
      lowConfidenceMilestones,
      averageOnTimeProbability: avgOnTime,
      averageP50SlipDays: avgP50SlipDays,
      averageP90SlipDays: avgP90SlipDays
    }
  };
};

export const computePortfolioProbabilisticForecast = (
  planSummaries: PlanProbabilisticForecastSummary[],
  milestoneForecasts: MilestoneProbabilisticForecast[]
): PortfolioProbabilisticForecastSummary => {
  const milestonesAnalyzed = milestoneForecasts.length;
  const averageOnTimeProbability = milestonesAnalyzed
    ? milestoneForecasts.reduce((sum, f) => sum + f.onTimeProbability, 0) / milestonesAnalyzed
    : 0;
  const highUncertaintyMilestones = milestoneForecasts.filter((f) => f.uncertaintyLevel === 'HIGH').length;
  const averagePortfolioP90SlipDays = milestonesAnalyzed
    ? Math.round(
      milestoneForecasts.reduce((sum, f) => {
        const planned = toDate(f.plannedEndDate) || new Date();
        const p90 = toDate(f.p90Date) || planned;
        return sum + Math.round((p90.getTime() - planned.getTime()) / (24 * 60 * 60 * 1000));
      }, 0) / milestonesAnalyzed
    )
    : 0;
  return {
    plansAnalyzed: planSummaries.length,
    milestonesAnalyzed,
    averageOnTimeProbability,
    highUncertaintyMilestones,
    averagePortfolioP90SlipDays
  };
};

const getPlanData = async (planId: string, user: { userId?: string; role?: string } | null) => {
  const parsed = parsePlanId(planId);
  if (!parsed) return null;
  const db = await getDb();
  const visibility = createVisibilityContext(user);

  if (parsed.source === 'PREVIEW') {
    const preview = await db.collection('work_plan_previews').findOne({ _id: new ObjectId(parsed.id) });
    if (!preview) return null;
    const data = preview.preview as DeliveryPlanPreview;
    const milestones = data.milestones.map((m) => ({
      id: String(m.index),
      startDate: m.startDate,
      endDate: m.endDate,
      targetCapacity: m.targetCapacity ?? null
    }));
    const rollups: Record<string, any> = {};
    data.artifacts.forEach((artifact) => {
      const cap = data.milestones.find((m) => m.index === artifact.milestoneIndex);
      const targetCapacity = cap?.targetCapacity ?? null;
      const committedPoints = artifact.storyCount || 0;
      rollups[String(artifact.milestoneIndex)] = {
        capacity: {
          targetCapacity,
          committedPoints,
          capacityUtilization: targetCapacity && targetCapacity > 0 ? committedPoints / targetCapacity : null
        },
        totals: { blockedDerived: 0 },
        confidence: { band: 'medium' }
      };
    });
    const readinessByMilestone: Record<string, any> = {};
    milestones.forEach((m) => { readinessByMilestone[m.id] = { band: 'medium' }; });
    const dependencyInbound: Record<string, number> = {};
    return { milestones, rollups, readinessByMilestone, dependencyInbound };
  }

  const run = await db.collection('work_delivery_plan_runs').findOne({ _id: new ObjectId(parsed.id) });
  if (!run) return null;
  const milestoneIds = (run.milestoneIds || []).filter((id: any) => ObjectId.isValid(String(id))).map((id: any) => new ObjectId(String(id)));
  const milestonesRaw = await db.collection('milestones').find({ _id: { $in: milestoneIds } }).toArray();
  const visibleMilestones = [];
  for (const ms of milestonesRaw) {
    const canView = await visibility.canViewBundle(String(ms.bundleId || ''));
    if (canView) visibleMilestones.push(ms);
  }
  const milestones = visibleMilestones.map((m) => ({
    id: String(m._id || m.id || m.name),
    startDate: m.startDate,
    endDate: m.endDate,
    targetCapacity: typeof m.targetCapacity === 'number' ? m.targetCapacity : null
  }));
  const rollupList = await computeMilestoneRollups(milestones.map((m) => m.id));
  const rollups: Record<string, any> = {};
  rollupList.forEach((r: any) => { rollups[String(r.milestoneId)] = r; });
  const readinessByMilestone: Record<string, any> = {};
  for (const milestone of milestones) {
    const policyRef = await getEffectivePolicyForMilestone(milestone.id);
    const readiness = rollups[milestone.id] ? await evaluateMilestoneReadiness(rollups[milestone.id], policyRef.effective) : null;
    readinessByMilestone[milestone.id] = readiness || { band: 'medium' };
  }
  const itemIds = (run.workItemIds || []).filter((id: any) => ObjectId.isValid(String(id))).map((id: any) => new ObjectId(String(id)));
  const items = await db.collection('workitems').find({ _id: { $in: itemIds } }).toArray();
  const visibleItems = await visibility.filterVisibleWorkItems(items as unknown as WorkItem[]);
  const enriched = await deriveWorkItemLinkSummary(visibleItems as WorkItem[]);
  const dependencyInbound = buildDependencyInbound(enriched as WorkItem[]);

  return { milestones, rollups, readinessByMilestone, dependencyInbound };
};

export const getPlanProbabilisticForecast = async (
  planId: string,
  user: { userId?: string; role?: string } | null,
  options?: { seed?: number | string; sampleCount?: number }
) => {
  const data = await getPlanData(planId, user);
  if (!data) return null;
  return await computePlanProbabilisticForecast({
    planId,
    milestones: data.milestones,
    rollups: data.rollups,
    readinessByMilestone: data.readinessByMilestone,
    dependencyInbound: data.dependencyInbound,
    seed: options?.seed,
    sampleCount: options?.sampleCount
  });
};

export const getPortfolioProbabilisticForecast = async (
  planIds: string[],
  user: { userId?: string; role?: string } | null,
  options?: { seed?: number | string; sampleCount?: number }
) => {
  const planSummaries: PlanProbabilisticForecastSummary[] = [];
  const allMilestoneForecasts: MilestoneProbabilisticForecast[] = [];
  for (const planId of planIds) {
    const result = await getPlanProbabilisticForecast(planId, user, options);
    if (!result) continue;
    planSummaries.push(result.summary);
    allMilestoneForecasts.push(...result.milestoneForecasts);
  }
  const portfolioSummary = computePortfolioProbabilisticForecast(planSummaries, allMilestoneForecasts);
  return { planForecasts: planSummaries, portfolioSummary };
};

export const resolveLatestPlanId = async (scopeType: string, scopeId: string) => {
  const db = await getDb();
  if (!scopeType || !scopeId) return null;
  const run = await db.collection('work_delivery_plan_runs')
    .find({ scopeType, scopeId })
    .sort({ createdAt: -1 })
    .limit(1)
    .next();
  if (run?._id) return `created:${String(run._id)}`;
  return null;
};

export const getDefaultSampleCount = () => DEFAULT_SAMPLE_COUNT;
