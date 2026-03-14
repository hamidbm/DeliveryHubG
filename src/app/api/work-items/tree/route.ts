
import { NextResponse } from 'next/server';
import { fetchWorkItemTree } from '../../../../services/db';
import { jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { createVisibilityContext, getAuthUserFromCookies } from '../../../../services/visibility';
import { filterWorkItemTreeData, getWorkItemScopeKey, getWorkItemTreeDataWithMeta, resolveWorkItemScopeFromFilters } from '../../../../services/workItemCache';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'nexus_super_secret_key_123');

export async function GET(request: Request) {
  const t0 = Date.now();
  const timings: Record<string, number> = {};
  const mark = (name: string, start: number, end?: number) => {
    const now = end ?? Date.now();
    timings[name] = now - start;
  };

  let scopeKey = 'unknown';
  let itemCount = 0;
  let visibleCount = 0;

  const parseStart = Date.now();
  const { searchParams } = new URL(request.url);
  const authUser = await getAuthUserFromCookies();
  if (!authUser?.userId) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  const cookieStore = await cookies();
  const token = cookieStore.get('nexus_auth_token')?.value;
  
  let currentUser = null;
  let currentUserId = null;
  let currentUserName = null;
  let currentUserEmail = null;
  let currentUsername = null;
  if (token) {
    try {
      const { payload } = await jwtVerify(token, JWT_SECRET);
      currentUser = payload.name;
      currentUserId = payload.id || payload.userId || null;
      currentUserName = payload.name || payload.username || payload.email || null;
      currentUserEmail = payload.email || null;
      currentUsername = payload.username || null;
    } catch {}
  }

  const filters = {
    bundleId: searchParams.get('bundleId'),
    applicationId: searchParams.get('applicationId'),
    milestoneId: searchParams.get('milestoneId'),
    epicId: searchParams.get('epicId'),
    parentId: searchParams.get('parentId'),
    q: searchParams.get('q'),
    quickFilter: searchParams.get('quickFilter'),
    types: searchParams.get('types'),
    priorities: searchParams.get('priorities'),
    health: searchParams.get('health'),
    includeArchived: searchParams.get('includeArchived') === 'true',
    treeMode: searchParams.get('treeMode') || 'hierarchy',
    currentUser,
    currentUserId,
    currentUserName,
    currentUserEmail,
    currentUsername
  };
  mark('parseMs', parseStart);

  const scopeStart = Date.now();
  const scope = resolveWorkItemScopeFromFilters(filters);
  scopeKey = getWorkItemScopeKey(scope);
  mark('scopeResolutionMs', scopeStart);

  let tree: any[] = [];
  let cacheStatus: 'hit' | 'miss' | 'fallback' = 'fallback';
  let cacheBuildMs = 0;
  const cacheStart = Date.now();
  try {
    const result = await getWorkItemTreeDataWithMeta(scope);
    cacheStatus = result.cacheStatus;
    cacheBuildMs = result.cacheBuildMs;
    itemCount = result.payload.items.length;
    const filterStart = Date.now();
    tree = filterWorkItemTreeData(result.payload, filters);
    mark('filterMs', filterStart);
    timings.pruneMs = 0;
    mark('cacheLookupMs', cacheStart);
    timings.cacheBuildMs = result.cacheBuildMs;
  } catch (error) {
    console.error('[workItemCache] fallback-to-db', error);
    const fallbackStart = Date.now();
    tree = await fetchWorkItemTree(filters);
    itemCount = Array.isArray(tree) ? tree.length : 0;
    mark('cacheLookupMs', cacheStart);
    timings.cacheBuildMs = 0;
    mark('filterMs', fallbackStart);
    timings.pruneMs = 0;
  }
  const visibility = createVisibilityContext(authUser);
  const auxStart = Date.now();
  const bundleIds = new Set<string>();
  const collectBundleIds = (nodes: any[]) => {
    for (const node of nodes || []) {
      const b = String(node?.bundleId || '');
      if (b) bundleIds.add(b);
      if (node?.children?.length) collectBundleIds(node.children);
    }
  };
  collectBundleIds(Array.isArray(tree) ? tree : []);
  const visibilityMap = new Map<string, boolean>();
  await Promise.all(Array.from(bundleIds).map(async (bundleId) => {
    visibilityMap.set(bundleId, await visibility.canViewBundle(bundleId));
  }));
  mark('auxLookupMs', auxStart);

  const shapeStart = Date.now();
  const filterNodes = (nodes: any[]): any[] => {
    const results: any[] = [];
    for (const node of nodes || []) {
      const bundleId = String(node?.bundleId || '');
      const canView = bundleId ? visibilityMap.get(bundleId) !== false : true;
      if (!canView) continue;
      const children = filterNodes(node.children || []);
      results.push({ ...node, children });
    }
    return results;
  };
  const filtered = filterNodes(Array.isArray(tree) ? tree : []);
  const countNodes = (nodes: any[]): number => nodes.reduce((sum, n) => sum + 1 + countNodes(n.children || []), 0);
  visibleCount = countNodes(filtered);
  mark('shapeMs', shapeStart);

  const serializeStart = Date.now();
  const response = NextResponse.json(filtered);
  mark('serializeMs', serializeStart);

  const totalMs = Date.now() - t0;
  console.info('[workItemsTree] timings', {
    scopeKey,
    cacheStatus,
    cacheBuildMs,
    totalMs,
    stages: {
      parseMs: timings.parseMs || 0,
      scopeResolutionMs: timings.scopeResolutionMs || 0,
      cacheLookupMs: timings.cacheLookupMs || 0,
      cacheBuildMs: timings.cacheBuildMs || 0,
      filterMs: timings.filterMs || 0,
      pruneMs: timings.pruneMs || 0,
      auxLookupMs: timings.auxLookupMs || 0,
      shapeMs: timings.shapeMs || 0,
      serializeMs: timings.serializeMs || 0
    },
    filterInputs: {
      applicationId: filters.applicationId || null,
      milestoneId: filters.milestoneId || null,
      q: filters.q ? String(filters.q).slice(0, 64) : null,
      treeMode: filters.treeMode || null,
      quickFilter: filters.quickFilter || null
    },
    itemCount,
    visibleCount
  });

  return response;
}
