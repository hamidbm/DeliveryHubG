import { ObjectId } from 'mongodb';
import { buildDeliveryPlanPreview } from './planningEngine';
import { getBundleCapacityForPlanning, resolvePlanScope } from './planScope';
import type {
  DeliveryPlanInput,
  DeliveryPlanPreview,
  SimulationOverride,
  SimulationRequest,
  SimulationResult,
  SimulationComparison,
  MilestoneComparison,
  SimulationSummary,
} from '../types';

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
  const scope = await resolvePlanScope(simulationRequest.baselineInput);
  const baselinePreviewId = String(new ObjectId());
  const scenarioPreviewId = String(new ObjectId());
  const baselinePreview = (await buildDeliveryPlanPreview(simulationRequest.baselineInput, {
    previewId: baselinePreviewId,
    scope,
    getBundleCapacity: getBundleCapacityForPlanning
  })).preview;

  const scenarioInput = applyScenarioOverrides(simulationRequest.baselineInput, simulationRequest.scenario.overrides || []);
  const scenarioPreview = (await buildDeliveryPlanPreview(scenarioInput, {
    previewId: scenarioPreviewId,
    scope,
    getBundleCapacity: getBundleCapacityForPlanning
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
