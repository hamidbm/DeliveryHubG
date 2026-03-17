import { getDeliveryPolicy, getEffectivePolicyForBundle, getStrictestPolicyForBundles } from './policy';
import { WorkItemStatus, WorkItemType } from '../types';
import { recordCacheHit, recordCacheMiss } from './perfStats';
import { getMilestoneByRef } from '../server/db/repositories/milestonesRepo';
import { listBlockingWorkItemRecordsForTargetRefs, listWorkItemRecordsByMilestoneRefs } from '../server/db/repositories/workItemsRepo';

const HOURS_PER_POINT = 4;
const CACHE_TTL_MS = 30_000;
const criticalPathCache = new Map<string, { ts: number; result: CriticalPathResult }>();

export type CriticalPathResult = {
  milestoneId: string;
  policy?: { strategy: string; globalVersion: number; bundleVersions?: Array<{ bundleId: string; version: number }> };
  cycleDetected: boolean;
  cycleNodes?: Array<{ id: string; key?: string; title?: string }>;
  criticalPath: {
    nodes: Array<{
      id: string;
      key?: string;
      title?: string;
      status?: string;
      remainingPoints: number;
      sprintId?: string;
      bundleId?: string;
      milestoneIds?: string[];
      assignee?: string;
      watchersCount?: number;
      scope: 'IN_MILESTONE' | 'EXTERNAL';
    }>;
    remainingPoints: number;
  };
  nearCritical: Array<{ id: string; key?: string; title?: string; slackPoints: number }>;
  externalBlockers: Array<{
    blockerId: string;
    blockerKey?: string;
    blockerTitle?: string;
    blockedId: string;
    blockedKey?: string;
    blockedTitle?: string;
    blockerMilestoneId?: string;
    blockerBundleId?: string;
  }>;
  external: { includedNodes: number; depthUsed: number };
  nodesByScope: { inMilestone: number; external: number };
  nodes?: Array<{
    id: string;
    key?: string;
    title?: string;
    status?: string;
    bundleId?: string;
    milestoneIds?: string[];
    remainingPoints: number;
    scope: 'IN_MILESTONE' | 'EXTERNAL';
    isCritical: boolean;
    isNearCritical: boolean;
  }>;
  edges?: Array<{ fromId: string; toId: string }>;
  topActions: Array<{
    type: 'UNBLOCK' | 'ASSIGN' | 'SET_ESTIMATE' | 'REQUEST_ESTIMATE' | 'NOTIFY_OWNER' | 'SCOPE_REDUCE';
    itemId: string;
    key?: string;
    title?: string;
    bundleId?: string;
    milestoneIds?: string[];
    reason: string;
  }>;
};

const isWorkItemOpen = (item: any) => String(item?.status || '') !== WorkItemStatus.DONE;

const getRemainingPoints = (item: any) => {
  if (!isWorkItemOpen(item)) return 0;
  if (typeof item.storyPoints === 'number') return item.storyPoints;
  const hours = typeof item.timeEstimateHours === 'number'
    ? item.timeEstimateHours
    : (typeof item.timeEstimate === 'number' ? item.timeEstimate : null);
  if (typeof hours === 'number') return Number((hours / HOURS_PER_POINT).toFixed(2));
  return 0;
};

const isMissingEstimate = (item: any) => {
  if (!isWorkItemOpen(item)) return false;
  const hasStory = typeof item.storyPoints === 'number';
  const hasHours = typeof item.timeEstimateHours === 'number' || typeof item.timeEstimate === 'number';
  return !hasStory && !hasHours;
};

const normalizeId = (item: any) => {
  const raw = item?._id || item?.id || '';
  return raw ? String(raw) : '';
};

const buildMilestoneCandidates = (milestone: any, fallbackId: string) => {
  const candidates = new Set<string>();
  if (fallbackId) candidates.add(String(fallbackId));
  if (milestone?._id) candidates.add(String(milestone._id));
  if (milestone?.id) candidates.add(String(milestone.id));
  if (milestone?.name) candidates.add(String(milestone.name));
  return Array.from(candidates);
};

export const computeMilestoneCriticalPath = async (
  milestoneId: string,
  options?: { includeExternal?: boolean; maxExternalDepth?: number; limit?: number }
): Promise<CriticalPathResult | null> => {
  const globalPolicy = await getDeliveryPolicy();
  const includeExternal = options?.includeExternal ?? globalPolicy.criticalPath.defaultIncludeExternal;
  const maxExternalDepth = typeof options?.maxExternalDepth === 'number' ? options!.maxExternalDepth : globalPolicy.criticalPath.defaultExternalDepth;
  const limit = typeof options?.limit === 'number' ? options!.limit : 50;
  const milestone = await getMilestoneByRef(milestoneId);
  if (!milestone) return null;

  const candidates = buildMilestoneCandidates(milestone, milestoneId);
  const allowedTypes = new Set([
    WorkItemType.EPIC,
    WorkItemType.FEATURE,
    WorkItemType.STORY,
    WorkItemType.TASK,
    WorkItemType.BUG,
    WorkItemType.SUBTASK,
    WorkItemType.DEPENDENCY,
    WorkItemType.RISK
  ]);

  const items = await listWorkItemRecordsByMilestoneRefs(candidates);

  const scopedItems = items.filter((item: any) => allowedTypes.has(item.type));
  const bundleIds = Array.from(new Set(scopedItems.map((i: any) => String(i.bundleId || '')).filter(Boolean)));
  if (milestone?.bundleId) bundleIds.push(String(milestone.bundleId));
  let policyRef: any = { effective: globalPolicy, refs: { strategy: 'global', globalVersion: globalPolicy.version }, hasOverrides: false };
  let policyStrategy: 'global' | 'bundle' | 'strictest' = 'global';
  let bundleVersionRefs: Array<{ bundleId: string; version: number }> | undefined = undefined;
  if (bundleIds.length === 1) {
    const bundleId = bundleIds[0];
    const bundleRef = await getEffectivePolicyForBundle(bundleId);
    policyRef = bundleRef;
    policyStrategy = 'bundle';
    if (bundleRef.refs.bundleVersion) {
      bundleVersionRefs = [{ bundleId, version: bundleRef.refs.bundleVersion }];
    }
  } else if (bundleIds.length > 1) {
    const strictRef = await getStrictestPolicyForBundles(bundleIds);
    policyRef = strictRef;
    policyStrategy = 'strictest';
    bundleVersionRefs = strictRef.refs.bundleVersions;
  }
  const policy = policyRef.effective;
  const policyKey = JSON.stringify({ strategy: policyStrategy, globalVersion: policyRef.refs.globalVersion, bundleVersions: bundleVersionRefs || [] });
  const cacheKey = `${milestoneId}:${includeExternal ? '1' : '0'}:${maxExternalDepth}:${limit}:${policyKey}`;
  const cached = criticalPathCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    recordCacheHit('criticalPath');
    return cached.result;
  }
  recordCacheMiss('criticalPath');
  const nodeMap = new Map<string, any>();
  const keyMap = new Map<string, string>();
  const scopeMap = new Map<string, 'IN_MILESTONE' | 'EXTERNAL'>();
  scopedItems.forEach((item: any) => {
    const id = normalizeId(item);
    if (id) {
      nodeMap.set(id, item);
      scopeMap.set(id, 'IN_MILESTONE');
    }
    if (item.key) keyMap.set(String(item.key), id);
  });

  let depthUsed = 0;
  if (includeExternal && maxExternalDepth > 0) {
    let frontier = Array.from(nodeMap.keys());
    for (let depth = 1; depth <= maxExternalDepth; depth += 1) {
      if (!frontier.length) break;
      const frontierIds = new Set(frontier);
      const frontierKeys = new Set<string>();
      frontier.forEach((id) => {
        const item = nodeMap.get(id);
        if (item?.key) frontierKeys.add(String(item.key));
      });
      const candidates = Array.from(new Set([...frontierIds, ...frontierKeys]));
      const blockers = await listBlockingWorkItemRecordsForTargetRefs(candidates);

      const nextFrontier: string[] = [];
      blockers.forEach((item: any) => {
        if (!allowedTypes.has(item.type)) return;
        if (!isWorkItemOpen(item)) return;
        const id = normalizeId(item);
        if (!id || nodeMap.has(id)) return;
        nodeMap.set(id, item);
        scopeMap.set(id, 'EXTERNAL');
        if (item.key) keyMap.set(String(item.key), id);
        nextFrontier.push(id);
      });
      if (!nextFrontier.length) break;
      depthUsed = depth;
      frontier = nextFrontier;
    }
  }

  const resolveTargetId = (targetId: string) => {
    if (!targetId) return '';
    if (nodeMap.has(targetId)) return targetId;
    if (keyMap.has(targetId)) return keyMap.get(targetId) || '';
    return '';
  };

  const nodeIds = Array.from(nodeMap.keys());
  const edges: Array<[string, string]> = [];
  const externalBlockers: CriticalPathResult['externalBlockers'] = [];

  const allItems = Array.from(nodeMap.values());
  allItems.forEach((item: any) => {
    const sourceId = normalizeId(item);
    if (!sourceId) return;
    (item.links || []).filter((l: any) => String(l.type) === 'BLOCKS').forEach((link: any) => {
      const rawTargetId = String(link.targetId || '');
      const targetId = resolveTargetId(rawTargetId);
      if (targetId) {
        edges.push([sourceId, targetId]);
      } else if (includeExternal && rawTargetId) {
        externalBlockers.push({
          blockerId: sourceId,
          blockerKey: item.key,
          blockerTitle: item.title,
          blockedId: rawTargetId,
          blockedKey: link.targetKey,
          blockedTitle: link.targetTitle,
          blockerMilestoneId: (item.milestoneIds || [])[0] ? String(item.milestoneIds[0]) : undefined,
          blockerBundleId: item.bundleId ? String(item.bundleId) : undefined
        });
      }
    });
  });

  const adj = new Map<string, string[]>();
  const preds = new Map<string, string[]>();
  const indegree = new Map<string, number>();
  nodeIds.forEach((id) => {
    adj.set(id, []);
    preds.set(id, []);
    indegree.set(id, 0);
  });

  edges.forEach(([from, to]) => {
    if (!adj.has(from) || !adj.has(to)) return;
    adj.get(from)!.push(to);
    preds.get(to)!.push(from);
    indegree.set(to, (indegree.get(to) || 0) + 1);
  });

  const queue: string[] = [];
  indegree.forEach((deg, id) => { if (deg === 0) queue.push(id); });

  const order: string[] = [];
  while (queue.length) {
    const id = queue.shift()!;
    order.push(id);
    (adj.get(id) || []).forEach((n) => {
      const next = (indegree.get(n) || 0) - 1;
      indegree.set(n, next);
      if (next === 0) queue.push(n);
    });
  }

  const cycleNodes: string[] = [];
  indegree.forEach((deg, id) => { if (deg > 0) cycleNodes.push(id); });
  const cycleDetected = cycleNodes.length > 0;

  const remainingMap = new Map<string, number>();
  const missingEstimateIds = new Set<string>();
  allItems.forEach((item: any) => {
    const id = normalizeId(item);
    if (!id) return;
    remainingMap.set(id, getRemainingPoints(item));
    if (isMissingEstimate(item)) missingEstimateIds.add(id);
  });

  const dp = new Map<string, number>();
  const back = new Map<string, string | null>();
  order.forEach((id) => {
    const base = remainingMap.get(id) || 0;
    const incoming = preds.get(id) || [];
    let best = 0;
    let bestPred: string | null = null;
    incoming.forEach((p) => {
      const val = dp.get(p) || 0;
      if (val >= best) {
        best = val;
        bestPred = p;
      }
    });
    dp.set(id, base + best);
    back.set(id, bestPred);
  });

  let maxNode: string | null = null;
  let maxValue = 0;
  dp.forEach((value, id) => {
    if (value > maxValue) {
      maxValue = value;
      maxNode = id;
    }
  });

  const criticalPathNodes: CriticalPathResult['criticalPath']['nodes'] = [];
  const criticalIdSet = new Set<string>();
  if (maxNode) {
    let current: string | null = maxNode;
    while (current) {
      const item = nodeMap.get(current);
      if (item) {
        criticalPathNodes.unshift({
          id: current,
          key: item.key,
          title: item.title,
          status: item.status,
          remainingPoints: remainingMap.get(current) || 0,
          sprintId: item.sprintId,
          bundleId: item.bundleId ? String(item.bundleId) : undefined,
          milestoneIds: Array.isArray(item.milestoneIds) ? item.milestoneIds.map(String) : (item.milestoneId ? [String(item.milestoneId)] : undefined),
          assignee: item.assignedTo || (Array.isArray(item.assigneeUserIds) ? item.assigneeUserIds[0] : undefined),
          watchersCount: Array.isArray(item.watcherUserIds) ? item.watcherUserIds.length : (Array.isArray(item.watchers) ? item.watchers.length : undefined),
          scope: scopeMap.get(current) || 'IN_MILESTONE'
        });
        criticalIdSet.add(current);
      }
      current = back.get(current) || null;
    }
  }

  const nearCritical: CriticalPathResult['nearCritical'] = [];
  const slackThreshold = policy.criticalPath.nearCriticalSlackPct ?? 0.1;
  if (maxValue > 0) {
    dp.forEach((value, id) => {
      if (criticalIdSet.has(id)) return;
      const slack = maxValue - value;
      if (slack >= 0 && slack <= maxValue * slackThreshold) {
        const item = nodeMap.get(id);
        if (item) {
          nearCritical.push({
            id,
            key: item.key,
            title: item.title,
            slackPoints: Number(slack.toFixed(2))
          });
        }
      }
    });
  }

  const topActions: CriticalPathResult['topActions'] = [];
  criticalPathNodes.forEach((node) => {
    const item = nodeMap.get(node.id);
    if (!item) return;
    const baseAction = {
      itemId: node.id,
      key: node.key,
      title: node.title,
      bundleId: item.bundleId ? String(item.bundleId) : undefined,
      milestoneIds: Array.isArray(item.milestoneIds) ? item.milestoneIds.map(String) : (item.milestoneId ? [String(item.milestoneId)] : undefined)
    };
    if (item.isBlocked || item.status === WorkItemStatus.BLOCKED) {
      topActions.push({ type: 'UNBLOCK', ...baseAction, reason: 'Critical path item is blocked.' });
    }
    if (missingEstimateIds.has(node.id)) {
      topActions.push({ type: 'SET_ESTIMATE', ...baseAction, reason: 'Critical path item missing estimate.' });
      topActions.push({ type: 'REQUEST_ESTIMATE', ...baseAction, reason: 'Request estimate for critical path item.' });
    }
    if (!item.assignedTo && (!Array.isArray(item.assigneeUserIds) || item.assigneeUserIds.length === 0)) {
      topActions.push({ type: 'ASSIGN', ...baseAction, reason: 'Critical path item is unassigned.' });
    }
    if (node.scope === 'EXTERNAL') {
      topActions.push({ type: 'NOTIFY_OWNER', ...baseAction, reason: 'External blocker on the critical path.' });
    }
  });

  nearCritical.forEach((node) => {
    const item = nodeMap.get(node.id);
    if (!item) return;
    const baseAction = {
      itemId: node.id,
      key: node.key,
      title: node.title,
      bundleId: item.bundleId ? String(item.bundleId) : undefined,
      milestoneIds: Array.isArray(item.milestoneIds) ? item.milestoneIds.map(String) : (item.milestoneId ? [String(item.milestoneId)] : undefined)
    };
    if (missingEstimateIds.has(node.id)) {
      topActions.push({ type: 'REQUEST_ESTIMATE', ...baseAction, reason: 'Near-critical item missing estimate.' });
    }
  });

  const inMilestoneCount = Array.from(scopeMap.values()).filter((v) => v === 'IN_MILESTONE').length;
  const externalCount = Array.from(scopeMap.values()).filter((v) => v === 'EXTERNAL').length;

  const nearCriticalSet = new Set(nearCritical.map((n) => n.id));
  const nodes = Array.from(nodeMap.entries()).map(([id, item]) => ({
    id,
    key: item?.key,
    title: item?.title,
    status: item?.status,
    bundleId: item?.bundleId ? String(item.bundleId) : undefined,
    milestoneIds: Array.isArray(item?.milestoneIds)
      ? item.milestoneIds.map(String)
      : (item?.milestoneId ? [String(item.milestoneId)] : undefined),
    remainingPoints: remainingMap.get(id) || 0,
    scope: scopeMap.get(id) || 'IN_MILESTONE',
    isCritical: criticalIdSet.has(id),
    isNearCritical: nearCriticalSet.has(id)
  }));

  const nodeIdSet = new Set(nodes.map((n) => n.id));
  const edgesOut = edges
    .filter(([from, to]) => nodeIdSet.has(from) && nodeIdSet.has(to))
    .map(([from, to]) => ({ fromId: from, toId: to }));

  const result: CriticalPathResult = {
    milestoneId: String(milestone._id || milestone.id || milestone.name || milestoneId),
    policy: {
      strategy: policyStrategy,
      globalVersion: policyRef.refs.globalVersion || policy.version,
      bundleVersions: bundleVersionRefs
    },
    cycleDetected,
    cycleNodes: cycleDetected ? cycleNodes.map((id) => {
      const item = nodeMap.get(id);
      return { id, key: item?.key, title: item?.title };
    }) : undefined,
    criticalPath: {
      nodes: criticalPathNodes.slice(0, limit),
      remainingPoints: Number(maxValue.toFixed(2))
    },
    nearCritical: nearCritical.slice(0, limit),
    externalBlockers: includeExternal ? externalBlockers.slice(0, limit) : [],
    external: { includedNodes: externalCount, depthUsed },
    nodesByScope: { inMilestone: inMilestoneCount, external: externalCount },
    nodes,
    edges: edgesOut,
    topActions: topActions.slice(0, limit)
  };

  criticalPathCache.set(cacheKey, { ts: Date.now(), result });
  return result;
};
