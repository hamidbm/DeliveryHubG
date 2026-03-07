import type { DeliveryPlanCapacitySummary, DeliveryPlanInput, DeliveryPlanMilestoneRecord } from '../types';

export type SprintCapacityResult = {
  mode: 'TEAM_VELOCITY' | 'DIRECT_SPRINT_CAPACITY' | 'BUNDLE_CAPACITY_FALLBACK' | 'NONE';
  sprintCapacity: number | null;
  warnings: string[];
};

export type BundleCapacityRecord = { unit: 'POINTS_PER_SPRINT' | 'POINTS_PER_WEEK'; value: number };

export const resolveSprintCapacity = async ({
  input,
  scopeBundleId,
  sprintDurationWeeks,
  getBundleCapacity
}: {
  input: DeliveryPlanInput;
  scopeBundleId?: string | null;
  sprintDurationWeeks: number;
  getBundleCapacity: (bundleId?: string | null) => Promise<BundleCapacityRecord | null>;
}): Promise<SprintCapacityResult> => {
  const warnings: string[] = [];

  if (input.capacityMode === 'TEAM_VELOCITY') {
    const teams = typeof input.deliveryTeams === 'number' ? input.deliveryTeams : 0;
    const velocity = typeof input.sprintVelocityPerTeam === 'number' ? input.sprintVelocityPerTeam : 0;
    if (teams > 0 && velocity > 0) {
      return { mode: 'TEAM_VELOCITY', sprintCapacity: teams * velocity, warnings };
    }
    warnings.push('Capacity mode TEAM_VELOCITY selected but delivery teams or sprint velocity per team is missing.');
  }

  if (input.capacityMode === 'DIRECT_SPRINT_CAPACITY') {
    const direct = typeof input.directSprintCapacity === 'number' ? input.directSprintCapacity : 0;
    if (direct > 0) {
      return { mode: 'DIRECT_SPRINT_CAPACITY', sprintCapacity: direct, warnings };
    }
    warnings.push('Capacity mode DIRECT_SPRINT_CAPACITY selected but sprint capacity is missing.');
  }

  const bundleCapacity = await getBundleCapacity(scopeBundleId);
  if (bundleCapacity) {
    const sprintCapacity = bundleCapacity.unit === 'POINTS_PER_SPRINT'
      ? bundleCapacity.value
      : bundleCapacity.value * sprintDurationWeeks;
    warnings.push('Using bundle capacity fallback because intake capacity was not fully provided.');
    return { mode: 'BUNDLE_CAPACITY_FALLBACK', sprintCapacity, warnings };
  }

  warnings.push('No capacity input or bundle capacity configured; milestone target capacity left empty.');
  return { mode: 'NONE', sprintCapacity: null, warnings };
};

export const applyMilestoneTargetCapacity = (
  milestones: DeliveryPlanMilestoneRecord[],
  sprintCapacity: number | null
) => {
  if (sprintCapacity == null) return milestones;
  milestones.forEach((ms) => {
    const sprintCount = ms.sprintCount || 0;
    ms.targetCapacity = sprintCount * sprintCapacity;
  });
  return milestones;
};

export const buildCapacitySummary = (
  milestones: DeliveryPlanMilestoneRecord[],
  capacityResult: SprintCapacityResult
): DeliveryPlanCapacitySummary => ({
  mode: capacityResult.mode,
  sprintCapacity: capacityResult.sprintCapacity,
  milestoneCapacities: milestones.map((ms) => ({
    milestoneIndex: ms.index,
    sprintCount: ms.sprintCount || 0,
    targetCapacity: ms.targetCapacity ?? null
  }))
});
