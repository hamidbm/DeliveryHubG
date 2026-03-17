import { ObjectId } from 'mongodb';
import { emitEvent } from '../shared/events/emitEvent';
import { getEffectivePolicyForMilestone } from './policy';
import { createVisibilityContext } from './visibility';
import { getMilestoneByRef } from '../server/db/repositories/milestonesRepo';
import { getMilestoneBaselineRecord, insertMilestoneBaselineRecord } from '../server/db/repositories/commitmentRepo';
import { listWorkItemScopeRecordsByMilestoneRefs, listWorkItemsByAnyRefs } from '../server/db/repositories/workItemsRepo';

type BaselineItem = {
  workItemId: string;
  key?: string;
  title?: string;
  storyPoints: number;
  status: string;
  bundleId?: string;
};

export type MilestoneBaseline = {
  milestoneId: string;
  baselineAt: string;
  baselineBy: string;
  policy: {
    strategy: string;
    globalVersion?: number;
    bundleVersions?: Array<{ bundleId: string; version: number }>;
  };
  items: BaselineItem[];
  totals: {
    itemCount: number;
    pointsTotal: number;
    pointsOpen: number;
  };
};

export type BaselineDelta = {
  milestoneId: string;
  baselineAt: string;
  baselineTotals: { count: number; pointsOpen: number };
  currentTotals: { count: number; pointsOpen: number };
  added: { count: number; points: number };
  removed: { count: number; points: number };
  estimateChanges: { count: number; pointsDelta: number };
  netScopeDeltaPoints: number;
  topChanges: Array<{ type: 'ADDED' | 'REMOVED' | 'ESTIMATE_CHANGED'; key?: string; title?: string; before?: number; after?: number }>;
};

const getMilestoneIdCandidates = (milestone: any) => {
  const candidates = new Set<string>();
  if (milestone?._id) candidates.add(String(milestone._id));
  if (milestone?.id) candidates.add(String(milestone.id));
  if (milestone?.name) candidates.add(String(milestone.name));
  return Array.from(candidates);
};

const isOpenStatus = (status?: string) => String(status || '').toUpperCase() !== 'DONE';

const fetchScopeItems = async (milestoneId: string) => {
  const milestone = await getMilestoneByRef(milestoneId);
  if (!milestone) return { milestone: null, items: [] };
  const candidates = getMilestoneIdCandidates(milestone);
  const items = await listWorkItemScopeRecordsByMilestoneRefs(candidates);
  return { milestone, items };
};

export const ensureMilestoneBaseline = async (milestoneId: string, actorId: string) => {
  const id = String(milestoneId || '');
  if (!id) return null;
  const existing = await getMilestoneBaselineRecord(id);
  if (existing) return existing as unknown as MilestoneBaseline;

  const { milestone, items } = await fetchScopeItems(id);
  if (!milestone) return null;

  const policyRef = await getEffectivePolicyForMilestone(String(milestone._id || milestone.id || milestone.name || id));
  const baselineItems: BaselineItem[] = items.map((item: any) => ({
    workItemId: String(item._id || item.id || ''),
    key: item.key ? String(item.key) : undefined,
    title: item.title ? String(item.title) : undefined,
    storyPoints: typeof item.storyPoints === 'number' ? item.storyPoints : 0,
    status: String(item.status || ''),
    bundleId: item.bundleId ? String(item.bundleId) : undefined
  }));

  let pointsTotal = 0;
  let pointsOpen = 0;
  baselineItems.forEach((item) => {
    pointsTotal += item.storyPoints || 0;
    if (isOpenStatus(item.status)) pointsOpen += item.storyPoints || 0;
  });

  const baseline: MilestoneBaseline = {
    milestoneId: String(milestone._id || milestone.id || milestone.name || id),
    baselineAt: new Date().toISOString(),
    baselineBy: String(actorId || ''),
    policy: {
      strategy: policyRef.refs?.strategy || 'global',
      globalVersion: policyRef.refs?.globalVersion,
      bundleVersions: policyRef.refs?.bundleVersions
    },
    items: baselineItems,
    totals: {
      itemCount: baselineItems.length,
      pointsTotal: Number(pointsTotal.toFixed(2)),
      pointsOpen: Number(pointsOpen.toFixed(2))
    }
  };

  await insertMilestoneBaselineRecord(baseline);

  try {
    await emitEvent({
      ts: baseline.baselineAt,
      type: 'milestones.baseline.created',
      actor: { userId: String(actorId || ''), displayName: String(actorId || 'System') },
      resource: { type: 'milestones.milestone', id: baseline.milestoneId, title: milestone.name },
      payload: { baseline: { baselineAt: baseline.baselineAt, totals: baseline.totals } }
    });
  } catch {}

  return baseline;
};

export const getMilestoneBaseline = async (milestoneId: string) => {
  const found = await getMilestoneBaselineRecord(String(milestoneId || ''));
  return (found as unknown as MilestoneBaseline) || null;
};

type DeltaOptions = {
  visibilityContext?: ReturnType<typeof createVisibilityContext>;
  includeHidden?: boolean;
};

export const computeMilestoneBaselineDelta = async (milestoneId: string, options: DeltaOptions = {}): Promise<BaselineDelta | null> => {
  const id = String(milestoneId || '');
  if (!id) return null;
  const baseline = (await getMilestoneBaselineRecord(id)) as unknown as MilestoneBaseline | null;
  if (!baseline) return null;

  const { items: currentItems } = await fetchScopeItems(id);
  let visibleCurrent = currentItems;
  let visibleBaseline = baseline.items;

  if (!options.includeHidden && options.visibilityContext) {
    visibleCurrent = await options.visibilityContext.filterVisibleWorkItems(currentItems as any[]);
    const baselineIds = baseline.items.map((i) => i.workItemId).filter(Boolean);
    if (baselineIds.length) {
      const baselineDocs = await listWorkItemsByAnyRefs(baselineIds);
      const visibleBaselineDocs = await options.visibilityContext.filterVisibleWorkItems(baselineDocs as any[]);
      const allowedIds = new Set<string>();
      visibleBaselineDocs.forEach((doc: any) => {
        if (doc?._id) allowedIds.add(String(doc._id));
        if (doc?.id) allowedIds.add(String(doc.id));
        if (doc?.key) allowedIds.add(String(doc.key));
      });
      visibleBaseline = baseline.items.filter((item) => allowedIds.has(item.workItemId) || (item.key && allowedIds.has(item.key)));
    }
  }

  const baselineMap = new Map<string, BaselineItem>();
  visibleBaseline.forEach((item) => {
    const key = item.workItemId || item.key || '';
    if (key) baselineMap.set(key, item);
  });

  const currentMap = new Map<string, any>();
  visibleCurrent.forEach((item: any) => {
    const key = String(item._id || item.id || item.key || '');
    if (key) currentMap.set(key, item);
  });

  const addedItems: any[] = [];
  const removedItems: BaselineItem[] = [];
  const estimateChanges: Array<{ before: number; after: number; key?: string; title?: string }> = [];

  currentMap.forEach((item, key) => {
    if (!baselineMap.has(key)) {
      addedItems.push(item);
    } else {
      const base = baselineMap.get(key)!;
      const before = typeof base.storyPoints === 'number' ? base.storyPoints : 0;
      const after = typeof item.storyPoints === 'number' ? item.storyPoints : 0;
      if (before !== after) {
        estimateChanges.push({ before, after, key: item.key || base.key, title: item.title || base.title });
      }
    }
  });

  baselineMap.forEach((item, key) => {
    if (!currentMap.has(key)) {
      removedItems.push(item);
    }
  });

  const addedPoints = addedItems.reduce((sum, item) => sum + (typeof item.storyPoints === 'number' ? item.storyPoints : 0), 0);
  const removedPoints = removedItems.reduce((sum, item) => sum + (typeof item.storyPoints === 'number' ? item.storyPoints : 0), 0);
  const estimatePointsDelta = estimateChanges.reduce((sum, item) => sum + (item.after - item.before), 0);

  const currentTotals = {
    count: visibleCurrent.length,
    pointsOpen: visibleCurrent.reduce((sum: number, item: any) => sum + (isOpenStatus(item.status) ? (typeof item.storyPoints === 'number' ? item.storyPoints : 0) : 0), 0)
  };

  const baselineTotals = {
    count: visibleBaseline.length,
    pointsOpen: visibleBaseline.reduce((sum, item) => sum + (isOpenStatus(item.status) ? item.storyPoints : 0), 0)
  };

  const topChanges: BaselineDelta['topChanges'] = [];
  addedItems.slice(0, 5).forEach((item) => {
    topChanges.push({ type: 'ADDED', key: item.key, title: item.title, after: item.storyPoints });
  });
  removedItems.slice(0, 5).forEach((item) => {
    topChanges.push({ type: 'REMOVED', key: item.key, title: item.title, before: item.storyPoints });
  });
  estimateChanges.slice(0, 5).forEach((item) => {
    topChanges.push({ type: 'ESTIMATE_CHANGED', key: item.key, title: item.title, before: item.before, after: item.after });
  });

  const netScopeDeltaPoints = Number((addedPoints - removedPoints + estimatePointsDelta).toFixed(2));

  return {
    milestoneId: baseline.milestoneId,
    baselineAt: baseline.baselineAt,
    baselineTotals,
    currentTotals,
    added: { count: addedItems.length, points: Number(addedPoints.toFixed(2)) },
    removed: { count: removedItems.length, points: Number(removedPoints.toFixed(2)) },
    estimateChanges: { count: estimateChanges.length, pointsDelta: Number(estimatePointsDelta.toFixed(2)) },
    netScopeDeltaPoints,
    topChanges
  };
};
