import { NextResponse } from 'next/server';
import { fetchMilestones, computeMilestoneRollups, getDb, deriveWorkItemLinkSummary, emitEvent } from '../../../../services/db';
import { evaluateMilestoneReadiness } from '../../../../services/milestoneGovernance';
import { ObjectId } from 'mongodb';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { createVisibilityContext, getAuthUserFromCookies } from '../../../../services/visibility';
import { getEffectivePolicyForMilestone } from '../../../../services/policy';
import { snapshotCacheStats, diffCacheStats, summarizeCacheStats } from '../../../../services/perfStats';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'nexus_super_secret_key_123');

const buildMilestoneKey = (m: any) => String(m._id || m.id || m.name);

const getMilestoneCandidates = (m: any) => {
  const set = new Set<string>();
  if (m?._id) set.add(String(m._id));
  if (m?.id) set.add(String(m.id));
  if (m?.name) set.add(String(m.name));
  return Array.from(set);
};

const computeLists = async (milestones: any[], visibility: ReturnType<typeof createVisibilityContext>) => {
  const db = await getDb();
  const milestoneCandidates = new Map<string, string[]>();
  milestones.forEach((m) => milestoneCandidates.set(buildMilestoneKey(m), getMilestoneCandidates(m)));
  const allCandidateIds = Array.from(new Set(Array.from(milestoneCandidates.values()).flat()));
  if (!allCandidateIds.length) return new Map<string, any>();

  const objectIds = allCandidateIds.filter((id) => ObjectId.isValid(id)).map((id) => new ObjectId(id));
  const query = {
    $and: [
      { $or: [{ isArchived: { $exists: false } }, { isArchived: false }] },
      { $or: [
        { milestoneIds: { $in: allCandidateIds } },
        { milestoneIds: { $in: objectIds } },
        { milestoneId: { $in: allCandidateIds } },
        { milestoneId: { $in: objectIds } }
      ] }
    ]
  };

  const items = await db.collection('workitems').find(query).toArray();
  const visibleItems = await visibility.filterVisibleWorkItems(items as any[]);
  const enriched = await deriveWorkItemLinkSummary(visibleItems as any[]);
  await visibility.redactWorkItemLinks(enriched as any[]);

  const milestoneItemMap = new Map<string, any[]>();
  const itemToMilestone = new Map<string, string>();

  const addItem = (milestoneKey: string, item: any) => {
    if (!milestoneItemMap.has(milestoneKey)) milestoneItemMap.set(milestoneKey, []);
    milestoneItemMap.get(milestoneKey)!.push(item);
  };

  milestones.forEach((milestone) => {
    const key = buildMilestoneKey(milestone);
    const candidates = milestoneCandidates.get(key) || [];
    const scoped = enriched.filter((item: any) => {
      const ids = (item.milestoneIds || []).map(String);
      const legacy = item.milestoneId ? String(item.milestoneId) : '';
      return candidates.some((c) => ids.includes(c) || legacy === c);
    });
    scoped.forEach((item: any) => {
      addItem(key, item);
      const itemId = String(item._id || item.id || '');
      if (itemId) itemToMilestone.set(itemId, key);
      if (item.key) itemToMilestone.set(String(item.key), key);
    });
  });

  const listsByMilestone = new Map<string, any>();
  const now = Date.now();

  milestoneItemMap.forEach((scopedItems, milestoneKey) => {
    const blockedItems = scopedItems
      .filter((item: any) => item.isBlocked)
      .map((item: any) => ({
        id: String(item._id || item.id || ''),
        key: item.key,
        title: item.title,
        status: item.status,
        openBlockersCount: item.linkSummary?.openBlockersCount || 0
      }))
      .sort((a: any, b: any) => b.openBlockersCount - a.openBlockersCount)
      .slice(0, 10);

    const blockerCounts = new Map<string, number>();
    const blockerMeta = new Map<string, any>();
    scopedItems.forEach((item: any) => {
      if (item.status === 'DONE') return;
      const blockedBy = item.linkSummary?.blockedBy || [];
      blockedBy.forEach((blocker: any) => {
        const blockerId = String(blocker.targetId);
        blockerCounts.set(blockerId, (blockerCounts.get(blockerId) || 0) + 1);
        blockerMeta.set(blockerId, blocker);
      });
    });

    const topBlockers = Array.from(blockerCounts.entries())
      .map(([id, count]) => {
        const meta = blockerMeta.get(id) || {};
        return {
          id,
          key: meta.targetKey,
          title: meta.targetTitle,
          status: meta.targetStatus,
          blocksOpenCount: count
        };
      })
      .sort((a, b) => b.blocksOpenCount - a.blocksOpenCount)
      .slice(0, 10);

    const highRisks = scopedItems
      .filter((item: any) => item.type === 'RISK' && item.status !== 'DONE')
      .filter((item: any) => {
        const severity = item.risk?.severity || 'low';
        return severity === 'high' || severity === 'critical';
      })
      .map((item: any) => ({
        id: String(item._id || item.id || ''),
        key: item.key,
        title: item.title,
        severity: item.risk?.severity || 'high',
        status: item.status
      }))
      .slice(0, 10);

    const overdueOpen = scopedItems
      .filter((item: any) => item.status !== 'DONE' && item.dueAt)
      .filter((item: any) => new Date(item.dueAt).getTime() < now)
      .map((item: any) => ({
        id: String(item._id || item.id || ''),
        key: item.key,
        title: item.title,
        dueAt: item.dueAt,
        status: item.status
      }))
      .slice(0, 10);

    const crossMilestoneBlocks: any[] = [];
    scopedItems.forEach((item: any) => {
      const blockerId = String(item._id || item.id || '');
      const blockerMilestoneId = itemToMilestone.get(blockerId);
      if (!blockerMilestoneId) return;
      (item.links || []).filter((l: any) => String(l.type) === 'BLOCKS').forEach((link: any) => {
        const blockedMilestoneId = itemToMilestone.get(String(link.targetId));
        if (!blockedMilestoneId || blockedMilestoneId === blockerMilestoneId) return;
        crossMilestoneBlocks.push({
          blockedId: String(link.targetId),
          blockedKey: link.targetKey,
          blockerId,
          blockerKey: item.key,
          blockerMilestoneId,
          blockedMilestoneId
        });
      });
    });

    listsByMilestone.set(milestoneKey, {
      topBlockers,
      blockedItems,
      highRisks,
      overdueOpen,
      crossMilestoneBlocks
    });
  });

  return listsByMilestone;
};

const computeListCounts = async (milestones: any[], visibility: ReturnType<typeof createVisibilityContext>) => {
  const db = await getDb();
  const milestoneCandidates = new Map<string, string[]>();
  milestones.forEach((m) => milestoneCandidates.set(buildMilestoneKey(m), getMilestoneCandidates(m)));
  const allCandidateIds = Array.from(new Set(Array.from(milestoneCandidates.values()).flat()));
  const objectIds = allCandidateIds.filter((id) => ObjectId.isValid(id)).map((id) => new ObjectId(id));

  let items = await db.collection('workitems').find({
    $and: [
      { $or: [{ isArchived: { $exists: false } }, { isArchived: false }] },
      { $or: [
        { milestoneIds: { $in: allCandidateIds } },
        { milestoneIds: { $in: objectIds } },
        { milestoneId: { $in: allCandidateIds } },
        { milestoneId: { $in: objectIds } }
      ] }
    ]
  }, { projection: { _id: 1, id: 1, key: 1, milestoneIds: 1, milestoneId: 1, status: 1, links: 1, type: 1, risk: 1, dueAt: 1 } }).toArray();
  items = await visibility.filterVisibleWorkItems(items as any[]);

  const itemToMilestone = new Map<string, string>();
  const itemsByMilestone = new Map<string, any[]>();
  milestones.forEach((milestone) => {
    const key = buildMilestoneKey(milestone);
    const candidates = milestoneCandidates.get(key) || [];
    const scopedItems = items.filter((item: any) => {
      const ids = (item.milestoneIds || []).map(String);
      const legacy = item.milestoneId ? String(item.milestoneId) : '';
      return candidates.some((c) => ids.includes(c) || legacy === c);
    });
    itemsByMilestone.set(key, scopedItems);
    scopedItems.forEach((item: any) => {
      const itemId = String(item._id || item.id || '');
      if (itemId) itemToMilestone.set(itemId, key);
      if (item.key) itemToMilestone.set(String(item.key), key);
    });
  });

  const counts = new Map<string, any>();
  milestones.forEach((milestone) => {
    counts.set(buildMilestoneKey(milestone), {
      topBlockersCount: 0,
      blockedItemsCount: 0,
      highRisksCount: 0,
      overdueOpenCount: 0,
      crossMilestoneBlocksCount: 0
    });
  });

  const now = Date.now();
  const blockedByCount = new Map<string, number>();
  items.forEach((blocker: any) => {
    if (blocker.status === 'DONE') return;
    (blocker.links || []).filter((l: any) => String(l.type) === 'BLOCKS').forEach((link: any) => {
      const targetId = String(link.targetId || '');
      if (!targetId) return;
      blockedByCount.set(targetId, (blockedByCount.get(targetId) || 0) + 1);
    });
  });

  itemsByMilestone.forEach((scopedItems, milestoneKey) => {
    const entry = counts.get(milestoneKey);
    if (!entry) return;
    scopedItems.forEach((item: any) => {
      const isOpen = item.status !== 'DONE';
      const itemId = String(item._id || item.id || '');
      const itemKey = item.key ? String(item.key) : '';
      if ((itemId && blockedByCount.has(itemId)) || (itemKey && blockedByCount.has(itemKey))) {
        entry.blockedItemsCount += 1;
      }
      if (item.type === 'RISK' && isOpen) {
        const severity = item.risk?.severity || 'low';
        if (severity === 'high' || severity === 'critical') entry.highRisksCount += 1;
      }
      if (isOpen && item.dueAt) {
        const due = new Date(item.dueAt).getTime();
        if (!Number.isNaN(due) && due < now) entry.overdueOpenCount += 1;
      }
    });
  });

  // Cross-milestone blockers + top blocker counts
  items.forEach((blocker: any) => {
    if (blocker.status === 'DONE') return;
    const blockerId = String(blocker._id || blocker.id || '');
    const blockerKey = blocker.key ? String(blocker.key) : '';
    const blockerMilestoneId = itemToMilestone.get(blockerId) || (blockerKey ? itemToMilestone.get(blockerKey) : undefined);
    if (!blockerMilestoneId) return;
    (blocker.links || []).filter((l: any) => String(l.type) === 'BLOCKS').forEach((link: any) => {
      const blockedMilestoneId = itemToMilestone.get(String(link.targetId));
      if (!blockedMilestoneId) return;
      const blockerEntry = counts.get(blockerMilestoneId);
      if (blockerEntry) blockerEntry.topBlockersCount += 1;
      if (blockedMilestoneId !== blockerMilestoneId) {
        if (blockerEntry) blockerEntry.crossMilestoneBlocksCount += 1;
      }
    });
  });

  return counts;
};

export async function GET(request: Request) {
  const startTime = Date.now();
  const cacheBefore = snapshotCacheStats();
  const authUser = await getAuthUserFromCookies();
  if (!authUser?.userId) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  const visibility = createVisibilityContext(authUser);
  const { searchParams } = new URL(request.url);
  const includeLists = searchParams.get('includeLists') === 'true';
  const milestoneIds = searchParams.get('milestoneIds');

  let milestones: any[] = [];
  if (milestoneIds) {
    const ids = milestoneIds.split(',').map((id) => id.trim()).filter(Boolean);
    const objectIds = ids.filter((id) => ObjectId.isValid(id)).map((id) => new ObjectId(id));
    const db = await getDb();
    milestones = await db.collection('milestones').find({
      $or: [
        { _id: { $in: objectIds } },
        { id: { $in: ids } },
        { name: { $in: ids } }
      ]
    }).toArray();
  } else {
    milestones = await fetchMilestones({
      bundleId: searchParams.get('bundleId'),
      applicationId: searchParams.get('applicationId'),
      status: searchParams.get('status')
    });
  }

  if (milestones.length) {
    const visible = await Promise.all(milestones.map(async (m: any) => ({
      milestone: m,
      visible: await visibility.canViewBundle(String(m.bundleId || ''))
    })));
    milestones = visible.filter((m) => m.visible).map((m) => m.milestone);
  }

  if (!milestones.length) return NextResponse.json({ milestones: [] });

  const rollups = await computeMilestoneRollups(milestones.map(buildMilestoneKey));
  const rollupMap = new Map<string, any>();
  rollups.forEach((r: any) => rollupMap.set(String(r.milestoneId), r));

  const listsByMilestone = includeLists ? await computeLists(milestones, visibility) : new Map<string, any>();
  const listCountsByMilestone = includeLists ? new Map<string, any>() : await computeListCounts(milestones, visibility);

  const payload = await Promise.all(milestones.map(async (milestone) => {
    const key = buildMilestoneKey(milestone);
    const candidates = getMilestoneCandidates(milestone);
    const rollup = rollupMap.get(key) || candidates.map((c) => rollupMap.get(c)).find(Boolean);
    const policyRef = await getEffectivePolicyForMilestone(String(milestone._id || milestone.id || milestone.name || ''));
    const readiness = rollup ? await evaluateMilestoneReadiness(rollup, policyRef.effective) : null;
    const defaultCounts = {
      topBlockersCount: 0,
      blockedItemsCount: rollup?.totals?.blockedDerived || 0,
      highRisksCount: (rollup?.risks?.openBySeverity?.high || 0) + (rollup?.risks?.openBySeverity?.critical || 0),
      overdueOpenCount: rollup?.totals?.overdueOpen || 0,
      crossMilestoneBlocksCount: 0
    };
    return {
      milestone,
      rollup,
      readiness,
      lists: includeLists ? (listsByMilestone.get(key) || {}) : undefined,
      listCounts: includeLists ? undefined : { ...defaultCounts, ...(listCountsByMilestone.get(key) || {}) }
    };
  }));

  const durationMs = Date.now() - startTime;
  const cacheAfter = snapshotCacheStats();
  const cacheDelta = diffCacheStats(cacheBefore, cacheAfter);
  const cacheSummary = summarizeCacheStats(cacheDelta);
  console.info('[perf] roadmap-intel', {
    durationMs,
    milestones: milestones.length,
    includeLists
  });
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('nexus_auth_token')?.value;
    let actor: any = undefined;
    if (token) {
      const { payload: authPayload } = await jwtVerify(token, JWT_SECRET);
      actor = {
        userId: String((authPayload as any).id || (authPayload as any).userId || (authPayload as any).email || ''),
        displayName: String((authPayload as any).name || (authPayload as any).displayName || ''),
        email: (authPayload as any).email ? String((authPayload as any).email) : undefined
      };
    }
    await emitEvent({
      ts: new Date().toISOString(),
      type: 'perf.roadmap.intel',
      actor,
      resource: { type: 'workitems.roadmap', id: 'roadmap-intel', title: 'Roadmap Intel' },
      payload: {
        name: 'api.work-items.roadmap-intel',
        at: new Date().toISOString(),
        durationMs,
        ok: true,
        scope: {
          bundleId: searchParams.get('bundleId') || undefined,
          applicationId: searchParams.get('applicationId') || undefined
        },
        counts: {
          milestones: milestones.length,
          milestoneIdsCount: milestoneIds ? milestoneIds.split(',').filter(Boolean).length : milestones.length,
          includeLists: includeLists ? 1 : 0
        },
        cache: cacheSummary,
        cacheByName: cacheDelta
      }
    });
  } catch {}

  return NextResponse.json({ milestones: payload });
}
