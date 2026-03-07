import { ObjectId } from 'mongodb';
import { getDb } from './db';
import { buildDeliveryPlanPreview } from './planningEngine';
import type {
  DeliveryPlanInput,
  DeliveryPlanPreview,
  SimulationOverride,
  SimulationRequest,
  SimulationResult,
  SimulationComparison,
  MilestoneComparison,
  SimulationSummary,
  PlanScope
} from '../types';

const resolveScope = async (input: DeliveryPlanInput): Promise<PlanScope> => {
  const db = await getDb();
  const scopeType = input.scopeType;
  const scopeId = String(input.scopeId || '');
  if (scopeType === 'PROGRAM') {
    return {
      scopeType,
      scopeId: scopeId || 'program',
      scopeName: 'Program',
      scopeRef: { type: 'initiative', id: 'program', name: 'Program' }
    };
  }

  if (scopeType === 'BUNDLE') {
    const bundle = ObjectId.isValid(scopeId)
      ? await db.collection('bundles').findOne({ _id: new ObjectId(scopeId) })
      : await db.collection('bundles').findOne({ $or: [{ id: scopeId }, { key: scopeId }] });
    const name = bundle?.name || bundle?.key || scopeId;
    return {
      scopeType,
      scopeId,
      scopeName: name,
      bundleId: bundle?._id ? String(bundle._id) : scopeId,
      scopeRef: { type: 'bundle', id: bundle?._id ? String(bundle._id) : scopeId, name }
    };
  }

  const app = ObjectId.isValid(scopeId)
    ? await db.collection('applications').findOne({ _id: new ObjectId(scopeId) })
    : await db.collection('applications').findOne({ $or: [{ id: scopeId }, { key: scopeId }, { aid: scopeId }] });
  const name = app?.name || app?.key || scopeId;
  const bundleId = app?.bundleId ? String(app.bundleId) : undefined;
  return {
    scopeType,
    scopeId,
    scopeName: name,
    bundleId,
    applicationId: app?._id ? String(app._id) : scopeId,
    scopeRef: { type: 'application', id: app?._id ? String(app._id) : scopeId, name }
  };
};

const getBundleCapacity = async (bundleId?: string | null) => {
  if (!bundleId) return null;
  const db = await getDb();
  const record = await db.collection('bundle_capacity').findOne({ bundleId: String(bundleId) });
  if (!record) return null;
  return {
    unit: record.unit as 'POINTS_PER_SPRINT' | 'POINTS_PER_WEEK',
    value: Number(record.value || 0)
  };
};

const shiftDate = (value?: string, shiftDays?: number) => {
  if (!value || typeof shiftDays !== 'number') return value;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const shifted = new Date(date.getTime() + shiftDays * 24 * 60 * 60 * 1000);
  return shifted.toISOString();
};

const applyMilestoneDateShifts = (
  preview: DeliveryPlanPreview,
  overrides: SimulationOverride[]
) => {
  const shifts = overrides.filter((o) => o.type === 'DATE_SHIFT');
  if (!shifts.length) return preview;
  const milestoneIdSet = new Map<string, number>();
  preview.milestones.forEach((m) => {
    milestoneIdSet.set(String(m.index), m.index);
    milestoneIdSet.set(String(m.name), m.index);
  });
  const shiftByIndex = new Map<number, number>();
  shifts.forEach((shift) => {
    const id = String(shift.params?.milestoneId || '');
    const shiftDays = Number(shift.params?.shiftDays || 0);
    const index = milestoneIdSet.get(id);
    if (!index || !shiftDays) return;
    shiftByIndex.set(index, (shiftByIndex.get(index) || 0) + shiftDays);
  });
  if (!shiftByIndex.size) return preview;
  const next = { ...preview };
  next.milestones = preview.milestones.map((m) => {
    const delta = shiftByIndex.get(m.index);
    if (!delta) return m;
    return {
      ...m,
      startDate: shiftDate(m.startDate, delta) as string,
      endDate: shiftDate(m.endDate, delta) as string
    };
  });
  return next;
};

export const applyScenarioOverrides = (
  baselineInput: DeliveryPlanInput,
  overrides: SimulationOverride[]
): DeliveryPlanInput => {
  let next: DeliveryPlanInput = { ...baselineInput };
  overrides.forEach((override) => {
    switch (override.type) {
      case 'CAPACITY_SHIFT': {
        const delta = Number(override.params?.deltaCapacity || 0);
        if (next.capacityMode === 'DIRECT_SPRINT_CAPACITY') {
          next = { ...next, directSprintCapacity: (next.directSprintCapacity || 0) + delta };
        } else {
          next = {
            ...next,
            capacityMode: 'TEAM_VELOCITY',
            sprintVelocityPerTeam: (next.sprintVelocityPerTeam || 0) + delta
          };
        }
        break;
      }
      case 'VELOCITY_ADJUSTMENT': {
        const deltaVelocity = Number(override.params?.deltaVelocity || 0);
        next = {
          ...next,
          capacityMode: 'TEAM_VELOCITY',
          sprintVelocityPerTeam: (next.sprintVelocityPerTeam || 0) + deltaVelocity
        };
        break;
      }
      case 'SCOPE_GROWTH': {
        const percent = Number(override.params?.percentIncrease || 0);
        const multiplier = 1 + percent / 100;
        const stories = next.storiesPerFeatureTarget ? Math.max(1, Math.round(next.storiesPerFeatureTarget * multiplier)) : undefined;
        const features = next.featuresPerMilestoneTarget ? Math.max(1, Math.round(next.featuresPerMilestoneTarget * multiplier)) : undefined;
        next = {
          ...next,
          storiesPerFeatureTarget: stories ?? next.storiesPerFeatureTarget,
          featuresPerMilestoneTarget: features ?? next.featuresPerMilestoneTarget
        };
        break;
      }
      case 'DATE_SHIFT': {
        // milestone-specific shifts are applied to the scenario preview after generation
        break;
      }
      default:
        break;
    }
  });
  return next;
};

const estimateCommittedLoad = (preview: DeliveryPlanPreview, milestoneIndex: number) => {
  const artifact = preview.artifacts.find((a) => a.milestoneIndex === milestoneIndex);
  if (!artifact) return 0;
  return artifact.storyCount || 0;
};

const computeUtilization = (committedLoad: number, targetCapacity?: number | null) => {
  if (!targetCapacity || targetCapacity <= 0) return null;
  return committedLoad / targetCapacity;
};

const riskFromUtilization = (utilization: number | null) => {
  if (utilization == null) return 'LOW';
  if (utilization > 1.2) return 'HIGH';
  if (utilization > 1.0) return 'MEDIUM';
  return 'LOW';
};

export const comparePreviews = (
  baseline: DeliveryPlanPreview,
  scenario: DeliveryPlanPreview
): SimulationComparison => {
  const milestoneComparisons: MilestoneComparison[] = baseline.milestones.map((baselineMs) => {
    const scenarioMs = scenario.milestones.find((m) => m.index === baselineMs.index) || baselineMs;
    const baselineLoad = estimateCommittedLoad(baseline, baselineMs.index);
    const scenarioLoad = estimateCommittedLoad(scenario, baselineMs.index);
    const baselineUtil = computeUtilization(baselineLoad, baselineMs.targetCapacity ?? null);
    const scenarioUtil = computeUtilization(scenarioLoad, scenarioMs.targetCapacity ?? null);
    const baselineRisk = riskFromUtilization(baselineUtil);
    const scenarioRisk = riskFromUtilization(scenarioUtil);
    return {
      milestoneId: String(baselineMs.index),
      baselineEndDate: baselineMs.endDate,
      scenarioEndDate: scenarioMs.endDate,
      baselineCapacityUtilization: baselineUtil,
      scenarioCapacityUtilization: scenarioUtil,
      baselineRisk,
      scenarioRisk
    };
  });

  const totalMilestones = milestoneComparisons.length;
  const milestonesSlipped = milestoneComparisons.filter((m) => new Date(m.scenarioEndDate).getTime() > new Date(m.baselineEndDate).getTime()).length;
  const riskOrder = { LOW: 0, MEDIUM: 1, HIGH: 2 } as const;
  const riskIncreaseCount = milestoneComparisons.filter((m) => riskOrder[m.scenarioRisk as keyof typeof riskOrder] > riskOrder[m.baselineRisk as keyof typeof riskOrder]).length;
  const utilizationDiffs = milestoneComparisons
    .map((m) => (m.scenarioCapacityUtilization != null && m.baselineCapacityUtilization != null)
      ? m.scenarioCapacityUtilization - m.baselineCapacityUtilization
      : null)
    .filter((v): v is number => v !== null);
  const averageUtilizationDiff = utilizationDiffs.length
    ? utilizationDiffs.reduce((sum, v) => sum + v, 0) / utilizationDiffs.length
    : null;

  const summary: SimulationSummary = {
    totalMilestones,
    milestonesSlipped,
    riskIncreaseCount,
    averageUtilizationDiff
  };

  return { milestoneComparisons, summary };
};

export const runSimulation = async (simulationRequest: SimulationRequest): Promise<SimulationResult> => {
  const scope = await resolveScope(simulationRequest.baselineInput);
  const baselinePreviewId = String(new ObjectId());
  const scenarioPreviewId = String(new ObjectId());
  const baselinePreview = (await buildDeliveryPlanPreview(simulationRequest.baselineInput, {
    previewId: baselinePreviewId,
    scope,
    getBundleCapacity
  })).preview;

  const scenarioInput = applyScenarioOverrides(simulationRequest.baselineInput, simulationRequest.scenario.overrides || []);
  const scenarioPreview = (await buildDeliveryPlanPreview(scenarioInput, {
    previewId: scenarioPreviewId,
    scope,
    getBundleCapacity
  })).preview;

  const shiftedScenarioPreview = applyMilestoneDateShifts(scenarioPreview, simulationRequest.scenario.overrides || []);
  const comparison = comparePreviews(baselinePreview, shiftedScenarioPreview);

  return {
    scenario: simulationRequest.scenario,
    baselinePreview,
    scenarioPreview: shiftedScenarioPreview,
    comparison
  };
};
