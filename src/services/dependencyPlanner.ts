import type { DeliveryPlanArtifact } from '../types';

export type DependencySkeletonPair = {
  fromMilestoneIndex: number;
  toMilestoneIndex: number;
  fromEpicName: string;
  toEpicName: string;
};

export const getDependencySkeletonPairs = (artifacts: DeliveryPlanArtifact[]): DependencySkeletonPair[] => {
  const pairs: DependencySkeletonPair[] = [];
  const ordered = [...artifacts].sort((a, b) => a.milestoneIndex - b.milestoneIndex);
  for (let i = 0; i < ordered.length - 1; i += 1) {
    const current = ordered[i];
    const next = ordered[i + 1];
    const currentEpic = current?.epics?.[0]?.name;
    const nextEpic = next?.epics?.[0]?.name;
    if (!currentEpic || !nextEpic) continue;
    pairs.push({
      fromMilestoneIndex: current.milestoneIndex,
      toMilestoneIndex: next.milestoneIndex,
      fromEpicName: currentEpic,
      toEpicName: nextEpic
    });
  }
  return pairs;
};
