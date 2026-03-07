import type { DeliveryPlanMilestoneRecord, DeliveryPlanSprintRecord, NormalizedPlanInput } from '../types';
import { milestoneDateHelpers } from './milestonePlanner';

const { addDays, diffDays } = milestoneDateHelpers;

export const generateSprints = (normalized: NormalizedPlanInput): DeliveryPlanSprintRecord[] => {
  const { overallStart, goLive, sprintDurationWeeks, warnings } = normalized;
  const sprints: DeliveryPlanSprintRecord[] = [];
  let idx = 1;
  let cursor = new Date(overallStart.getTime());
  const durationDays = sprintDurationWeeks * 7;
  while (cursor.getTime() < goLive.getTime()) {
    const end = addDays(cursor, durationDays);
    sprints.push({
      name: `Sprint ${idx}`,
      startDate: cursor.toISOString(),
      endDate: end.toISOString()
    });
    cursor = end;
    idx += 1;
  }
  const remainder = diffDays(cursor, goLive);
  if (remainder > 0) {
    warnings.push('Sprint cadence does not evenly divide the delivery window.');
  }
  return sprints;
};

export const assignSprintsToMilestones = (
  sprints: DeliveryPlanSprintRecord[],
  milestones: DeliveryPlanMilestoneRecord[]
): DeliveryPlanSprintRecord[] => {
  return sprints.map((sprint) => {
    const start = new Date(sprint.startDate);
    const end = new Date(sprint.endDate);
    const mid = new Date(start.getTime() + (end.getTime() - start.getTime()) / 2);
    const match = milestones.find((m) => mid.getTime() >= new Date(m.startDate).getTime() && mid.getTime() <= new Date(m.endDate).getTime());
    return { ...sprint, milestoneIndex: match?.index };
  });
};

export const summarizeMilestoneSprintCounts = (sprints: DeliveryPlanSprintRecord[]) => {
  const counts: Record<number, number> = {};
  sprints.forEach((sprint) => {
    if (sprint.milestoneIndex == null) return;
    const key = Number(sprint.milestoneIndex);
    counts[key] = (counts[key] || 0) + 1;
  });
  return counts;
};
