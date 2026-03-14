import type {
  DeliveryPlanInput,
  DeliveryPlanMilestoneDraft,
  DeliveryPlanMilestoneRecord,
  DeliveryPlanPreview,
  NormalizedPlanInput,
  PlanScope
} from '../types';
import { generateArtifacts } from './backlogPlanner';
import { applyMilestoneTargetCapacity, buildCapacitySummary, resolveSprintCapacity, SprintCapacityResult } from './capacityPlanner';
import { generateMilestones, normalizePlanInput } from './milestonePlanner';
import { assignSprintsToMilestones, generateSprints, summarizeMilestoneSprintCounts } from './sprintPlanner';

const generateRoadmapPhases = (input: DeliveryPlanInput, normalized: NormalizedPlanInput, milestoneCount: number) => {
  const { overallStart, goLive, stabilizationEnd } = normalized;
  let phaseNames: string[] = [];
  switch (input.deliveryPattern) {
    case 'STANDARD_PHASED':
      phaseNames = ['Foundation', 'Build', 'Integration', 'UAT / Hardening', 'Cutover / Launch'];
      break;
    case 'PRODUCT_INCREMENT':
      phaseNames = Array.from({ length: milestoneCount }, (_, i) => `Increment ${i + 1}`);
      break;
    case 'MIGRATION':
      phaseNames = ['Foundation', 'Migration Wave 1', 'Migration Wave 2', 'Cutover'];
      break;
    case 'COMPLIANCE':
      phaseNames = ['Assessment', 'Remediation', 'Validation', 'Signoff'];
      break;
    default:
      phaseNames = Array.from({ length: milestoneCount }, (_, i) => `Phase ${i + 1}`);
  }

  const totalMs = goLive.getTime() - overallStart.getTime();
  const slice = totalMs / Math.max(phaseNames.length, 1);
  const phases = phaseNames.map((name, idx) => {
    const start = new Date(overallStart.getTime() + idx * slice);
    const end = new Date(overallStart.getTime() + (idx + 1) * slice);
    return {
      name,
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      milestoneIndexes: []
    };
  });

  if (stabilizationEnd && stabilizationEnd.getTime() > goLive.getTime()) {
    phases.push({
      name: 'Stabilization',
      startDate: goLive.toISOString(),
      endDate: stabilizationEnd.toISOString(),
      milestoneIndexes: []
    });
  }

  return phases;
};

const applyThemes = (milestones: DeliveryPlanMilestoneDraft[], input: DeliveryPlanInput, assumptions: string[]) => {
  milestones.forEach((ms) => {
    const entry = input.themesByMilestone?.find((t) => Number(t.milestoneIndex) === ms.index);
    ms.themes = entry?.themes?.length ? entry.themes : [];
    if (!ms.themes.length) {
      ms.themes = [`Milestone ${ms.index} Delivery`];
      assumptions.push(`No themes for Milestone ${ms.index}; using generic label.`);
    }
  });
};

export type PreviewBuilderOptions = {
  previewId: string;
  scope: PlanScope;
  getBundleCapacity: (bundleId?: string | null) => Promise<{ unit: 'POINTS_PER_SPRINT' | 'POINTS_PER_WEEK'; value: number } | null>;
  suggestMilestoneOwner?: (args: {
    scopeType: PlanScope['scopeType'];
    scopeId: string;
    bundleId?: string;
  }) => Promise<{ userId?: string; email?: string; reason?: string } | null>;
};

export const buildDeliveryPlanPreview = async (
  input: DeliveryPlanInput,
  options: PreviewBuilderOptions
) => {
  const normalized = normalizePlanInput(input);
  const milestones = generateMilestones(input, normalized);
  applyThemes(milestones, input, normalized.assumptions);
  const roadmap = generateRoadmapPhases(input, normalized, milestones.length);
  const sprints = generateSprints(normalized);
  const artifacts = generateArtifacts(milestones, input);

  const milestoneRecords: DeliveryPlanMilestoneRecord[] = milestones.map((ms) => ({
    index: ms.index,
    name: ms.name,
    startDate: ms.startDate,
    endDate: ms.endDate,
    themes: ms.themes,
    sprintCount: 0
  }));

  const sprintRecords = assignSprintsToMilestones(
    sprints.map((s) => ({ ...s, milestoneIndex: undefined })),
    milestoneRecords
  );
  const sprintCounts = summarizeMilestoneSprintCounts(sprintRecords);
  milestoneRecords.forEach((ms) => {
    ms.sprintCount = sprintCounts[ms.index] || 0;
  });

  const capacityResult: SprintCapacityResult = await resolveSprintCapacity({
    input,
    scopeBundleId: options.scope.bundleId,
    sprintDurationWeeks: normalized.sprintDurationWeeks,
    getBundleCapacity: options.getBundleCapacity
  });
  if (capacityResult.warnings.length) {
    normalized.warnings.push(...capacityResult.warnings);
  }
  applyMilestoneTargetCapacity(milestoneRecords, capacityResult.sprintCapacity);

  if (options.suggestMilestoneOwner) {
    for (const ms of milestoneRecords) {
      const suggestion = await options.suggestMilestoneOwner({
        scopeType: options.scope.scopeType,
        scopeId: options.scope.scopeId,
        bundleId: options.scope.bundleId
      });
      if (suggestion) {
        ms.suggestedOwner = { userId: suggestion.userId, email: suggestion.email, reason: suggestion.reason };
      }
    }
  }

  const counts = {
    roadmapPhases: roadmap.length,
    milestones: milestoneRecords.length,
    sprints: sprintRecords.length,
    epics: input.scopeType === 'BUNDLE'
      ? (artifacts.length ? 1 : 0)
      : artifacts.reduce((sum, a) => sum + a.epicCount, 0),
    features: artifacts.reduce((sum, a) => sum + a.featureCount, 0),
    stories: artifacts.reduce((sum, a) => sum + a.storyCount, 0),
    tasks: artifacts.reduce((sum, a) => sum + a.taskCount, 0)
  };

  const preview: DeliveryPlanPreview = {
    previewId: options.previewId,
    counts,
    roadmap,
    milestones: milestoneRecords,
    sprints: sprintRecords,
    artifacts,
    derived: {
      milestoneDurationDays: normalized.derivedMilestoneDurationDays ?? null,
      milestoneDurationWeeks: normalized.derivedMilestoneDurationWeeks ?? null
    },
    capacitySummary: buildCapacitySummary(milestoneRecords, capacityResult),
    warnings: normalized.warnings,
    assumptions: normalized.assumptions
  };

  return { preview, normalized, capacityResult };
};
