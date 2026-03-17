import type { WorkItem, Milestone } from '../../types';

export type RoadmapMilestoneVM = {
  id: string;
  name: string;
  startDate?: string;
  endDate?: string;
  sprintCount?: number;
  targetCapacity?: number | null;
  applicationId?: string;
  applicationLabel?: string;
  bundleId?: string;
  bundleLabel?: string;
  ownerEmail?: string;
  goal?: string;
  themeLabel?: string;
  readinessBand?: string;
  confidenceBand?: string;
  confidenceScore?: number | null;
  intelligence?: MilestoneIntelligence;
  status?: string;
};

export type RoadmapSprintVM = {
  id: string;
  name: string;
  startDate?: string;
  endDate?: string;
  milestoneId?: string;
  status?: string;
};

export type RoadmapDependencyEdge = {
  fromMilestoneId: string;
  toMilestoneId: string;
  count: number;
  blockerCount: number;
  blockedCount: number;
};

export type RoadmapViewModel = {
  milestones: RoadmapMilestoneVM[];
  sprints: RoadmapSprintVM[];
  dependencies: RoadmapDependencyEdge[];
  items: WorkItem[];
  intelligenceByMilestone: Record<string, MilestoneIntelligence>;
};

export type MilestoneIntelligence = {
  milestoneId: string;
  readiness: 'NOT_READY' | 'PARTIAL' | 'READY';
  confidence: 'LOW' | 'MEDIUM' | 'HIGH';
  targetCapacity: number | null;
  committedLoad: number;
  remainingLoad: number;
  utilizationPercent: number | null;
  utilizationState: 'UNDERFILLED' | 'HEALTHY' | 'AT_RISK' | 'OVERLOADED';
  blockedItemCount: number;
  dependencyInbound: number;
  dependencyOutbound: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  overflow: boolean;
};

const safeDate = (value?: string) => {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
};

const getMilestoneKey = (milestone: any) => String(milestone?._id || milestone?.id || milestone?.name || '');

const getItemMilestoneId = (item: any) => {
  const ids = item?.milestoneIds || [];
  const legacy = item?.milestoneId;
  return ids?.length ? String(ids[0]) : (legacy ? String(legacy) : null);
};

const getItemIdCandidates = (item: any) => {
  const candidates = new Set<string>();
  if (item?._id) candidates.add(String(item._id));
  if (item?.id) candidates.add(String(item.id));
  if (item?.key) candidates.add(String(item.key));
  return Array.from(candidates);
};

export const transformRawRoadmapData = ({
  milestones,
  items,
  roadmapIntel,
  sprintCache
}: {
  milestones: Milestone[];
  items: WorkItem[];
  roadmapIntel: any[];
  sprintCache: Record<string, any[]>;
}): RoadmapViewModel => {
  const intelByMilestone: Record<string, any> = {};
  roadmapIntel.forEach((entry) => {
    const key = String(entry?.milestone?._id || entry?.milestone?.id || entry?.milestone?.name || entry?.milestoneId || '');
    if (key) intelByMilestone[key] = entry;
  });

  const milestoneMap = new Map<string, RoadmapMilestoneVM>();
  const milestoneItems: Record<string, WorkItem[]> = {};
  milestones.forEach((milestone) => {
    const id = getMilestoneKey(milestone);
    const intel = intelByMilestone[id] || {};
    const rollup = intel?.rollup || {};
    const readiness = intel?.readiness || {};
    const confidence = rollup?.confidence || {};

    milestoneMap.set(id, {
      id,
      name: milestone.name || id,
      startDate: milestone.startDate,
      endDate: milestone.endDate,
      sprintCount: (milestone as any).sprintCount || (milestone as any).sprintsCount,
      targetCapacity: typeof milestone.targetCapacity === 'number' ? milestone.targetCapacity : (rollup?.capacity?.targetCapacity ?? null),
      applicationId: milestone.applicationId ? String(milestone.applicationId) : undefined,
      bundleId: milestone.bundleId ? String(milestone.bundleId) : undefined,
      ownerEmail: milestone.ownerEmail,
      goal: milestone.goal,
      themeLabel: milestone.goal || milestone.name || id,
      readinessBand: readiness.band,
      confidenceBand: confidence.band,
      confidenceScore: confidence.score ?? null,
      status: milestone.status
    });
    milestoneItems[id] = [];
  });

  const sprints: RoadmapSprintVM[] = [];
  Object.entries(sprintCache || {}).forEach(([milestoneId, rollups]) => {
    (rollups || []).forEach((rollup: any) => {
      sprints.push({
        id: String(rollup._id || rollup.id || rollup.name || `${milestoneId}-${rollup.name}`),
        name: rollup.name || 'Sprint',
        startDate: rollup.startDate,
        endDate: rollup.endDate,
        milestoneId,
        status: rollup.status
      });
    });
  });

  const itemToMilestone = new Map<string, string>();
  items.forEach((item) => {
    const milestoneId = getItemMilestoneId(item);
    if (!milestoneId) return;
    getItemIdCandidates(item).forEach((id) => itemToMilestone.set(id, milestoneId));
    if (!milestoneItems[milestoneId]) milestoneItems[milestoneId] = [];
    milestoneItems[milestoneId].push(item);
  });

  const edgeMap = new Map<string, RoadmapDependencyEdge>();
  items.forEach((item) => {
    const sourceMilestone = getItemMilestoneId(item);
    if (!sourceMilestone) return;
    const links = (item as any).links || [];
    links.filter((link: any) => String(link.type) === 'BLOCKS').forEach((link: any) => {
      const targetMilestone = itemToMilestone.get(String(link.targetId)) || itemToMilestone.get(String(link.targetKey));
      if (!targetMilestone || targetMilestone === sourceMilestone) return;
      const key = `${sourceMilestone}::${targetMilestone}`;
      const existing = edgeMap.get(key) || {
        fromMilestoneId: sourceMilestone,
        toMilestoneId: targetMilestone,
        count: 0,
        blockerCount: 0,
        blockedCount: 0
      };
      existing.count += 1;
      existing.blockerCount += 1;
      existing.blockedCount += 1;
      edgeMap.set(key, existing);
    });
  });

  const dependencyPressure = computeDependencyPressure(Array.from(edgeMap.values()));
  const intelligenceByMilestone: Record<string, MilestoneIntelligence> = {};
  milestoneMap.forEach((milestone) => {
    const scopedItems = milestoneItems[milestone.id] || [];
    const deps = dependencyPressure[milestone.id] || { inbound: 0, outbound: 0 };
    const targetCapacity = milestone.targetCapacity ?? null;
    const intelligence = computeMilestoneIntelligence({
      milestone,
      items: scopedItems,
      dependencyInbound: deps.inbound,
      dependencyOutbound: deps.outbound
    });
    milestone.intelligence = intelligence;
    intelligenceByMilestone[milestone.id] = intelligence;
  });

  return {
    milestones: Array.from(milestoneMap.values()),
    sprints,
    dependencies: Array.from(edgeMap.values()),
    items,
    intelligenceByMilestone
  };
};

export const groupMilestonesByPhase = (milestones: RoadmapMilestoneVM[]) => {
  if (!milestones.length) return [];
  const sorted = [...milestones].sort((a, b) => (safeDate(a.startDate)?.getTime() || 0) - (safeDate(b.startDate)?.getTime() || 0));
  const buckets: { id: string; label: string; milestones: RoadmapMilestoneVM[] }[] = [];
  sorted.forEach((milestone) => {
    const date = safeDate(milestone.startDate);
    const label = date ? `${date.getFullYear()} Q${Math.floor(date.getMonth() / 3) + 1}` : 'Unscheduled';
    const bucket = buckets.find((b) => b.label === label);
    if (bucket) {
      bucket.milestones.push(milestone);
    } else {
      buckets.push({ id: label, label, milestones: [milestone] });
    }
  });
  return buckets;
};

export const groupItemsByMilestone = (items: WorkItem[]) => {
  const map: Record<string, WorkItem[]> = {};
  items.forEach((item) => {
    const milestoneId = getItemMilestoneId(item);
    if (!milestoneId) return;
    if (!map[milestoneId]) map[milestoneId] = [];
    map[milestoneId].push(item);
  });
  return map;
};

export const buildTimelineRows = (milestones: RoadmapMilestoneVM[]) => {
  if (!milestones.length) return { min: null, max: null, rows: [] as any[] };
  const dates = milestones.flatMap((m) => [safeDate(m.startDate), safeDate(m.endDate)]).filter(Boolean) as Date[];
  const min = new Date(Math.min(...dates.map((d) => d.getTime())));
  const max = new Date(Math.max(...dates.map((d) => d.getTime())));
  const range = Math.max(max.getTime() - min.getTime(), 1);
  const rows = milestones.map((m) => {
    const start = safeDate(m.startDate) || min;
    const end = safeDate(m.endDate) || max;
    const left = ((start.getTime() - min.getTime()) / range) * 100;
    const width = Math.max(((end.getTime() - start.getTime()) / range) * 100, 2);
    return { ...m, left, width };
  });
  return { min, max, rows };
};

export const buildSwimlaneRows = (milestones: RoadmapMilestoneVM[]) => {
  const buckets = groupMilestonesByPhase(milestones);
  return buckets.map((bucket) => ({
    id: bucket.id,
    label: bucket.label,
    milestones: bucket.milestones
  }));
};

export const buildDependencyGraph = (dependencies: RoadmapDependencyEdge[], milestones: RoadmapMilestoneVM[]) => {
  const nodes = milestones.map((m) => ({ id: m.id, label: m.name }));
  return { nodes, edges: dependencies };
};

export const computeCapacityUtilization = (committedLoad: number, targetCapacity: number | null) => {
  if (!targetCapacity || targetCapacity <= 0) {
    return { utilizationPercent: null, state: 'UNDERFILLED' as const };
  }
  const utilizationPercent = committedLoad / targetCapacity;
  let state: 'UNDERFILLED' | 'HEALTHY' | 'AT_RISK' | 'OVERLOADED' = 'UNDERFILLED';
  if (utilizationPercent < 0.7) state = 'UNDERFILLED';
  else if (utilizationPercent <= 1) state = 'HEALTHY';
  else if (utilizationPercent <= 1.2) state = 'AT_RISK';
  else state = 'OVERLOADED';
  return { utilizationPercent, state };
};

export const computeRiskScore = ({
  utilizationPercent,
  blockedItemCount,
  dependencyInbound,
  readiness,
  startDate
}: {
  utilizationPercent: number | null;
  blockedItemCount: number;
  dependencyInbound: number;
  readiness: MilestoneIntelligence['readiness'];
  startDate?: string;
}) => {
  let score = 0;
  if (utilizationPercent != null && utilizationPercent > 1.1) score += 2;
  if (blockedItemCount > 3) score += 2;
  if (dependencyInbound > 2) score += 1;
  if (startDate) {
    const start = safeDate(startDate);
    if (start) {
      const daysToStart = (start.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
      if (daysToStart <= 7 && readiness !== 'READY') score += 2;
    }
  }
  return score;
};

export const computeDependencyPressure = (edges: RoadmapDependencyEdge[]) => {
  const map: Record<string, { inbound: number; outbound: number }> = {};
  edges.forEach((edge) => {
    if (!map[edge.fromMilestoneId]) map[edge.fromMilestoneId] = { inbound: 0, outbound: 0 };
    if (!map[edge.toMilestoneId]) map[edge.toMilestoneId] = { inbound: 0, outbound: 0 };
    map[edge.fromMilestoneId].outbound += edge.count;
    map[edge.toMilestoneId].inbound += edge.count;
  });
  return map;
};

export const computeMilestoneIntelligence = ({
  milestone,
  items,
  dependencyInbound,
  dependencyOutbound
}: {
  milestone: RoadmapMilestoneVM;
  items: WorkItem[];
  dependencyInbound: number;
  dependencyOutbound: number;
}): MilestoneIntelligence => {
  const openItems = items.filter((item) => String(item.status || '').toUpperCase() !== 'DONE');
  const committedLoad = items.reduce((sum, item) => sum + (item.storyPoints || 0), 0);
  const remainingLoad = openItems.reduce((sum, item) => sum + (item.storyPoints || 0), 0);
  const blockedItemCount = items.filter((item) => item.isBlocked || String(item.status || '').toUpperCase() === 'BLOCKED').length;
  const missingEstimates = openItems.filter((item) => item.storyPoints === undefined || item.storyPoints === null).length;
  const missingSprints = openItems.filter((item) => !item.sprintId).length;
  let readiness: MilestoneIntelligence['readiness'] = 'READY';
  if (openItems.length === 0) {
    readiness = 'READY';
  } else if (missingEstimates === 0 && missingSprints === 0) {
    readiness = 'READY';
  } else {
    const ratio = Math.max(missingEstimates, missingSprints) / Math.max(openItems.length, 1);
    readiness = ratio > 0.5 ? 'NOT_READY' : 'PARTIAL';
  }

  const { utilizationPercent, state } = computeCapacityUtilization(committedLoad, milestone.targetCapacity ?? null);
  const riskScore = computeRiskScore({
    utilizationPercent,
    blockedItemCount,
    dependencyInbound,
    readiness,
    startDate: milestone.startDate
  });
  const riskLevel: MilestoneIntelligence['riskLevel'] = riskScore >= 4 ? 'HIGH' : riskScore >= 2 ? 'MEDIUM' : 'LOW';
  const overflow = utilizationPercent != null ? utilizationPercent > 1.2 : false;
  let confidence: MilestoneIntelligence['confidence'] = 'HIGH';
  if (riskLevel === 'HIGH' || overflow) confidence = 'LOW';
  else if (riskLevel === 'MEDIUM') confidence = 'MEDIUM';

  return {
    milestoneId: milestone.id,
    readiness,
    confidence,
    targetCapacity: milestone.targetCapacity ?? null,
    committedLoad,
    remainingLoad,
    utilizationPercent,
    utilizationState: state,
    blockedItemCount,
    dependencyInbound,
    dependencyOutbound,
    riskLevel,
    overflow
  };
};

export const buildRoadmapIntelligence = (roadmap: RoadmapViewModel) => ({
  milestones: roadmap.milestones,
  intelligenceByMilestone: roadmap.intelligenceByMilestone
});

export const generateSimulationViewModel = (
  baselinePreview: { milestones: Array<{ index: number; endDate: string; targetCapacity?: number | null }>; artifacts: Array<{ milestoneIndex: number; storyCount: number }> },
  scenarioPreview: { milestones: Array<{ index: number; endDate: string; targetCapacity?: number | null }>; artifacts: Array<{ milestoneIndex: number; storyCount: number }> }
) => {
  const getLoad = (preview: any, milestoneIndex: number) => {
    const artifact = preview.artifacts.find((a: any) => a.milestoneIndex === milestoneIndex);
    return artifact?.storyCount || 0;
  };
  const utilization = (load: number, target?: number | null) => (target && target > 0 ? load / target : null);
  return baselinePreview.milestones.map((baselineMs) => {
    const scenarioMs = scenarioPreview.milestones.find((m) => m.index === baselineMs.index) || baselineMs;
    const baselineUtil = utilization(getLoad(baselinePreview, baselineMs.index), baselineMs.targetCapacity ?? null);
    const scenarioUtil = utilization(getLoad(scenarioPreview, baselineMs.index), scenarioMs.targetCapacity ?? null);
    return {
      milestoneId: baselineMs.index,
      baselineEndDate: baselineMs.endDate,
      scenarioEndDate: scenarioMs.endDate,
      baselineUtil,
      scenarioUtil
    };
  });
};
