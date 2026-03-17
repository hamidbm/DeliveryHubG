import { WorkItemStatus } from '../types';
import {
  deriveWorkItemLinkSummary,
  listWorkItemsForScope
} from '../server/db/repositories/workItemsRepo';
import { listMilestonesForScope } from '../server/db/repositories/milestonesRepo';

export type WorkItemScope = {
  scopeType: 'BUNDLE' | 'APPLICATION' | 'GLOBAL';
  scopeId: string;
};

export type WorkItemTreeFilters = {
  bundleId?: string | null;
  applicationId?: string | null;
  milestoneId?: string | null;
  sprintId?: string | null;
  parentId?: string | null;
  epicId?: string | null;
  q?: string | null;
  quickFilter?: string | null;
  types?: string | null;
  priorities?: string | null;
  health?: string | null;
  includeArchived?: boolean;
  treeMode?: 'hierarchy' | 'milestone' | string;
  currentUser?: string | null;
  currentUserId?: string | null;
  currentUserName?: string | null;
  currentUserEmail?: string | null;
  currentUsername?: string | null;
};

type WorkItemTreeCachePayload = {
  scopeKey: string;
  generatedAt: number;
  sourceVersion: string | number | null;
  items: any[];
  milestones: any[];
  indexes: {
    byId: Record<string, any>;
    childrenByParentId: Record<string, string[]>;
    parentById: Record<string, string | null>;
    rootIds: string[];
  };
  stats: {
    total: number;
    epics: number;
    features: number;
    stories: number;
    tasks: number;
  };
};

type WorkItemTreeCacheEntry = {
  key: string;
  payload: WorkItemTreeCachePayload;
  createdAt: number;
  lastAccessedAt: number;
  expiresAt: number;
};

type WorkItemTreeCacheReadResult = {
  payload: WorkItemTreeCachePayload;
  cacheStatus: 'hit' | 'miss';
  cacheBuildMs: number;
};

const CACHE_TTL_MS = 60_000;
const MAX_SCOPE_ENTRIES = 50;
const workItemTreeCache = new Map<string, WorkItemTreeCacheEntry>();

const toArray = (value?: string | null) => String(value || '').split(',').map((v) => v.trim()).filter(Boolean);
const isAll = (value?: string | null) => !value || value === 'all';
const norm = (value: any) => String(value || '').trim();
const normLower = (value: any) => norm(value).toLowerCase();

const toScopeKey = (scope: WorkItemScope) => `workitems:${scope.scopeType}:${scope.scopeId}`;
export const getWorkItemScopeKey = toScopeKey;

const toScopeFromFilters = (filters: WorkItemTreeFilters): WorkItemScope => {
  if (filters.applicationId && filters.applicationId !== 'all') {
    return { scopeType: 'APPLICATION', scopeId: String(filters.applicationId) };
  }
  if (filters.bundleId && filters.bundleId !== 'all') {
    return { scopeType: 'BUNDLE', scopeId: String(filters.bundleId) };
  }
  return { scopeType: 'GLOBAL', scopeId: 'all' };
};

const pruneCacheIfNeeded = () => {
  if (workItemTreeCache.size <= MAX_SCOPE_ENTRIES) return;
  const sorted = Array.from(workItemTreeCache.values()).sort((a, b) => a.lastAccessedAt - b.lastAccessedAt);
  const excess = workItemTreeCache.size - MAX_SCOPE_ENTRIES;
  for (let i = 0; i < excess; i += 1) {
    const entry = sorted[i];
    if (entry) workItemTreeCache.delete(entry.key);
  }
};

const loadWorkItemsForTreeFromDb = async (scope: WorkItemScope) => {
  const scopeFilters = {
    bundleId: scope.scopeType === 'BUNDLE' ? scope.scopeId : null,
    applicationId: scope.scopeType === 'APPLICATION' ? scope.scopeId : null
  };
  const rawItems = await listWorkItemsForScope(scopeFilters);
  const items = await deriveWorkItemLinkSummary(rawItems as any[]);
  const milestones = await listMilestonesForScope(scopeFilters);

  return { items, milestones };
};

const buildTreePayload = (scope: WorkItemScope, items: any[], milestones: any[]): WorkItemTreeCachePayload => {
  const normalizedItems = items.map((item: any) => ({
    ...item,
    _searchText: [
      item?.title,
      item?.key,
      item?.assignedTo,
      item?.status,
      item?.type
    ].filter(Boolean).join(' ').toLowerCase()
  }));
  const byId: Record<string, any> = {};
  const parentById: Record<string, string | null> = {};
  const childrenByParentId: Record<string, string[]> = {};

  const rootIds: string[] = [];

  for (const item of normalizedItems) {
    const id = String(item._id || item.id || '');
    if (!id) continue;
    byId[id] = item;
    const parentIdRaw = item.parentId ? String(item.parentId) : '';
    const parentId = parentIdRaw || null;
    parentById[id] = parentId;
    if (parentId) {
      if (!childrenByParentId[parentId]) childrenByParentId[parentId] = [];
      childrenByParentId[parentId].push(id);
    }
  }

  for (const id of Object.keys(byId)) {
    const parentId = parentById[id];
    if (!parentId || !byId[parentId]) rootIds.push(id);
  }

  const stats = {
    total: normalizedItems.length,
    epics: normalizedItems.filter((i) => String(i.type) === 'EPIC').length,
    features: normalizedItems.filter((i) => String(i.type) === 'FEATURE').length,
    stories: normalizedItems.filter((i) => String(i.type) === 'STORY').length,
    tasks: normalizedItems.filter((i) => String(i.type) === 'TASK').length
  };

  return {
    scopeKey: toScopeKey(scope),
    generatedAt: Date.now(),
    sourceVersion: null,
    items: normalizedItems,
    milestones,
    indexes: {
      byId,
      childrenByParentId,
      parentById,
      rootIds
    },
    stats
  };
};

export const getWorkItemTreeDataWithMeta = async (scope: WorkItemScope): Promise<WorkItemTreeCacheReadResult> => {
  const key = toScopeKey(scope);
  const now = Date.now();
  const cached = workItemTreeCache.get(key);

  if (cached && cached.expiresAt > now) {
    cached.lastAccessedAt = now;
    console.info('[workItemCache] hit', {
      key,
      count: cached.payload.items.length,
      ageMs: Date.now() - cached.createdAt
    });
    return { payload: cached.payload, cacheStatus: 'hit', cacheBuildMs: 0 };
  }

  console.info('[workItemCache] miss', { key });
  const start = Date.now();
  const { items, milestones } = await loadWorkItemsForTreeFromDb(scope);
  const payload = buildTreePayload(scope, items, milestones);

  workItemTreeCache.set(key, {
    key,
    payload,
    createdAt: now,
    lastAccessedAt: now,
    expiresAt: now + CACHE_TTL_MS
  });
  pruneCacheIfNeeded();
  console.info('[workItemCache] rebuild', { key, count: items.length, ms: Date.now() - start });

  return { payload, cacheStatus: 'miss', cacheBuildMs: Date.now() - start };
};

export const getWorkItemTreeData = async (scope: WorkItemScope): Promise<WorkItemTreeCachePayload> => {
  const result = await getWorkItemTreeDataWithMeta(scope);
  return result.payload;
};

const isMyMatch = (item: any, filters: WorkItemTreeFilters) => {
  const candidates = [filters.currentUserName, filters.currentUsername, filters.currentUserEmail, filters.currentUser]
    .map((v) => normLower(v))
    .filter(Boolean);
  const assignedTo = normLower(item.assignedTo);
  const assigneeIds = Array.isArray(item.assigneeUserIds) ? item.assigneeUserIds.map((v: any) => norm(v)) : [];
  if (filters.currentUserId && assigneeIds.includes(norm(filters.currentUserId))) return true;
  if (assignedTo && candidates.includes(assignedTo)) return true;
  return false;
};

const itemMatchesFilters = (item: any, filters: WorkItemTreeFilters) => {
  if (!filters.includeArchived && item.isArchived) return false;

  if (!isAll(filters.bundleId) && norm(item.bundleId) !== norm(filters.bundleId)) return false;
  if (!isAll(filters.applicationId) && norm(item.applicationId) !== norm(filters.applicationId)) return false;

  if (!isAll(filters.sprintId) && norm(item.sprintId) !== norm(filters.sprintId)) return false;

  if (!isAll(filters.parentId || filters.epicId)) {
    const targetParent = norm(filters.parentId || filters.epicId);
    if (norm(item.parentId) !== targetParent) return false;
  }

  if (!isAll(filters.milestoneId)) {
    const target = norm(filters.milestoneId);
    const ids = Array.isArray(item.milestoneIds) ? item.milestoneIds.map((v: any) => norm(v)) : [];
    const legacy = norm(item.milestoneId);
    if (!ids.includes(target) && legacy !== target) return false;
  }

  const types = toArray(filters.types);
  if (types.length && !types.includes(String(item.type))) return false;

  const priorities = toArray(filters.priorities);
  if (priorities.length && !priorities.includes(String(item.priority || ''))) return false;

  const health = toArray(filters.health);
  if (health.length) {
    const isBlocked = item.status === WorkItemStatus.BLOCKED || Boolean(item.isBlocked);
    const isFlagged = Boolean(item.isFlagged);
    const healthMatch = (health.includes('BLOCKED') && isBlocked) || (health.includes('FLAGGED') && isFlagged);
    if (!healthMatch) return false;
  }

  if (filters.quickFilter === 'my' && !isMyMatch(item, filters)) return false;

  if (filters.quickFilter === 'updated') {
    const threshold = Date.now() - (7 * 24 * 60 * 60 * 1000);
    const updatedTs = new Date(item.updatedAt || item.createdAt || 0).getTime();
    if (!updatedTs || updatedTs < threshold) return false;
  }

  if (filters.quickFilter === 'blocked') {
    const blocked = Boolean(item.isFlagged) || item.status === WorkItemStatus.BLOCKED || Boolean(item.isBlocked);
    if (!blocked) return false;
  }

  if (filters.q) {
    const q = String(filters.q).toLowerCase();
    const searchText = String(item._searchText || '').toLowerCase();
    if (!searchText.includes(q)) return false;
  }

  return true;
};

const collectVisibleNodeIds = (payload: WorkItemTreeCachePayload, matchIds: Set<string>) => {
  const visible = new Set<string>(matchIds);
  for (const id of matchIds) {
    let parentId = payload.indexes.parentById[id];
    while (parentId) {
      if (visible.has(parentId)) break;
      visible.add(parentId);
      parentId = payload.indexes.parentById[parentId];
    }
  }
  return visible;
};

const toTreeNode = (item: any, children: any[]) => {
  let completion = 0;
  if (children.length > 0) {
    const done = children.filter((c) => c.status === WorkItemStatus.DONE).length;
    completion = Math.round((done / children.length) * 100);
  }

  return {
    id: String(item._id || item.id || ''),
    key: item.key,
    label: item.title,
    type: item.type,
    status: item.status,
    isFlagged: item.isFlagged,
    links: item.links || [],
    linkSummary: item.linkSummary,
    isBlocked: item.isBlocked,
    bundleId: item.bundleId,
    workItemId: String(item._id || item.id || ''),
    nodeType: 'WORK_ITEM',
    completion,
    children
  };
};

const buildHierarchyTree = (payload: WorkItemTreeCachePayload, visibleIds: Set<string>) => {
  const visited = new Set<string>();

  const build = (parentId: string | null): any[] => {
    const children = (payload.indexes.childrenByParentId[parentId || ''] || [])
      .filter((id) => visibleIds.has(id))
      .map((id) => payload.indexes.byId[id])
      .filter(Boolean)
      .sort((a, b) => {
        const ar = typeof a.rank === 'number' ? a.rank : Number.MAX_SAFE_INTEGER;
        const br = typeof b.rank === 'number' ? b.rank : Number.MAX_SAFE_INTEGER;
        if (ar !== br) return ar - br;
        return String(a.title || '').localeCompare(String(b.title || ''));
      })
      .map((item) => {
        const id = String(item._id || item.id || '');
        visited.add(id);
        const nodeChildren = build(id);
        return toTreeNode(item, nodeChildren);
      });
    return children;
  };

  const roots = payload.indexes.rootIds
    .filter((id) => visibleIds.has(id))
    .map((id) => payload.indexes.byId[id])
    .filter(Boolean)
    .sort((a, b) => {
      const ar = typeof a.rank === 'number' ? a.rank : Number.MAX_SAFE_INTEGER;
      const br = typeof b.rank === 'number' ? b.rank : Number.MAX_SAFE_INTEGER;
      if (ar !== br) return ar - br;
      return String(a.title || '').localeCompare(String(b.title || ''));
    })
    .map((item) => {
      const id = String(item._id || item.id || '');
      visited.add(id);
      return toTreeNode(item, build(id));
    });

  // Promote visible orphans with missing parent linkage to root as a safety fallback.
  for (const id of visibleIds) {
    if (visited.has(id)) continue;
    const item = payload.indexes.byId[id];
    if (!item) continue;
    roots.push(toTreeNode(item, build(id)));
    visited.add(id);
  }

  return roots;
};

const buildMilestoneTree = (payload: WorkItemTreeCachePayload, visibleIds: Set<string>, filters: WorkItemTreeFilters) => {
  const targetMilestoneId = isAll(filters.milestoneId) ? null : norm(filters.milestoneId);
  const milestones = (payload.milestones || [])
    .filter((m: any) => !targetMilestoneId || norm(m._id || m.id || m.name) === targetMilestoneId)
    .map((m: any) => {
      const mId = norm(m._id || m.id || m.name);
      const children = payload.items
        .filter((item: any) => {
          const id = String(item._id || item.id || '');
          if (!visibleIds.has(id)) return false;
          const ids = Array.isArray(item.milestoneIds) ? item.milestoneIds.map((v: any) => norm(v)) : [];
          const legacy = norm(item.milestoneId);
          return ids.includes(mId) || legacy === mId;
        })
        .sort((a: any, b: any) => {
          const ar = typeof a.rank === 'number' ? a.rank : Number.MAX_SAFE_INTEGER;
          const br = typeof b.rank === 'number' ? b.rank : Number.MAX_SAFE_INTEGER;
          if (ar !== br) return ar - br;
          return String(a.title || '').localeCompare(String(b.title || ''));
        })
        .map((item: any) => toTreeNode(item, []));

      return {
        id: `ms-node-${mId}`,
        label: m.name,
        type: 'MILESTONE',
        status: m.status,
        bundleId: m.bundleId,
        children
      };
    })
    .filter((m: any) => m.children.length > 0 || targetMilestoneId);

  return milestones;
};

export const filterWorkItemTreeData = (payload: WorkItemTreeCachePayload, filters: WorkItemTreeFilters) => {
  const matchingIds = new Set<string>();
  for (const item of payload.items || []) {
    const id = String(item._id || item.id || '');
    if (!id) continue;
    if (itemMatchesFilters(item, filters)) matchingIds.add(id);
  }

  const visibleIds = collectVisibleNodeIds(payload, matchingIds);
  if ((filters.treeMode || 'hierarchy') === 'milestone') {
    return buildMilestoneTree(payload, visibleIds, filters);
  }
  return buildHierarchyTree(payload, visibleIds);
};

export const invalidateWorkItemScope = async (scope: WorkItemScope, reason = 'write') => {
  const key = toScopeKey(scope);
  workItemTreeCache.delete(key);
  console.info('[workItemCache] invalidate', { key, reason });
};

export const invalidateWorkItemScopesFromCandidates = async (
  candidates: Array<{ bundleId?: string | null; applicationId?: string | null }>,
  reason = 'write'
) => {
  const seen = new Set<string>();
  for (const c of candidates) {
    if (c.bundleId) {
      const scope = { scopeType: 'BUNDLE' as const, scopeId: String(c.bundleId) };
      const key = toScopeKey(scope);
      if (!seen.has(key)) {
        seen.add(key);
        await invalidateWorkItemScope(scope, reason);
      }
    }
    if (c.applicationId) {
      const scope = { scopeType: 'APPLICATION' as const, scopeId: String(c.applicationId) };
      const key = toScopeKey(scope);
      if (!seen.has(key)) {
        seen.add(key);
        await invalidateWorkItemScope(scope, reason);
      }
    }
  }
};

export const invalidateAllWorkItemCaches = async (reason = 'global') => {
  workItemTreeCache.clear();
  console.info('[workItemCache] invalidateAll', { reason });
};

export const primeWorkItemScope = async (scope: WorkItemScope) => {
  await getWorkItemTreeData(scope);
};

export const resolveWorkItemScopeFromFilters = toScopeFromFilters;

export const getWorkItemCacheDiagnostics = () => {
  return Array.from(workItemTreeCache.values()).map((entry) => ({
    key: entry.key,
    createdAt: entry.createdAt,
    lastAccessedAt: entry.lastAccessedAt,
    expiresAt: entry.expiresAt,
    items: entry.payload?.stats?.total || 0
  }));
};
