import { NextResponse } from 'next/server';
import { evaluateMilestoneReadiness } from '../../../../../services/milestoneGovernance';
import { computeMilestoneRollup } from '../../../../../services/rollupAnalytics';
import { deriveWorkItemLinkSummary } from '../../../../../services/workItemsService';
import { createVisibilityContext, getAuthUserFromCookies } from '../../../../../services/visibility';
import { getEffectivePolicyForMilestone } from '../../../../../services/policy';
import { getMilestoneByRef } from '../../../../../server/db/repositories/milestonesRepo';
import {
  listBlockingWorkItemRecordsForTargetRefs,
  listWorkItemRecordsByMilestoneRefs
} from '../../../../../server/db/repositories/workItemsRepo';

const buildMilestoneKey = (m: any) => String(m._id || m.id || m.name);

const getMilestoneCandidates = (m: any) => {
  const set = new Set<string>();
  if (m?._id) set.add(String(m._id));
  if (m?.id) set.add(String(m.id));
  if (m?.name) set.add(String(m.name));
  return Array.from(set);
};

const computeLists = async (milestone: any, visibility: ReturnType<typeof createVisibilityContext>) => {
  const candidates = getMilestoneCandidates(milestone);
  const items = await listWorkItemRecordsByMilestoneRefs(candidates);
  const visibleItems = await visibility.filterVisibleWorkItems(items as any[]);
  const enriched = await deriveWorkItemLinkSummary(visibleItems as any[]);
  await visibility.redactWorkItemLinks(enriched as any[]);

  const now = Date.now();

  const blockedItems = enriched
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
  enriched.forEach((item: any) => {
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

  const highRisks = enriched
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

  const overdueOpen = enriched
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
  const blockers = await listBlockingWorkItemRecordsForTargetRefs(candidates);
  for (const blocker of blockers) {
    const canViewBlocker = await visibility.canViewBundle(String(blocker.bundleId || ''));
    if (!canViewBlocker) continue;
    const blockerId = String(blocker._id || blocker.id || '');
    const blockerMilestoneId = blocker.milestoneIds?.[0] || blocker.milestoneId || null;
    (blocker.links || []).filter((l: any) => String(l.type) === 'BLOCKS').forEach((link: any) => {
      if (!candidates.includes(String(link.targetId))) return;
      if (blockerMilestoneId && String(blockerMilestoneId) === String(milestone._id || milestone.id || milestone.name)) return;
      crossMilestoneBlocks.push({
        blockedId: String(link.targetId),
        blockedKey: link.targetKey,
        blockerId,
        blockerKey: blocker.key,
        blockerMilestoneId,
        blockedMilestoneId: String(milestone._id || milestone.id || milestone.name)
      });
    });
  }

  return { topBlockers, blockedItems, highRisks, overdueOpen, crossMilestoneBlocks };
};

export async function GET(request: Request) {
  const authUser = await getAuthUserFromCookies();
  if (!authUser?.userId) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  const visibility = createVisibilityContext(authUser);
  const { searchParams } = new URL(request.url);
  const milestoneId = searchParams.get('milestoneId');
  if (!milestoneId) return NextResponse.json({ error: 'milestoneId required' }, { status: 400 });
  const bundleId = searchParams.get('bundleId');
  const applicationId = searchParams.get('applicationId');

  const milestone = await getMilestoneByRef(milestoneId);

  if (!milestone) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!(await visibility.canViewBundle(String(milestone.bundleId || '')))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  if (bundleId && String(milestone.bundleId || '') !== String(bundleId)) {
    return NextResponse.json({ milestone, rollup: null, readiness: null, lists: {} });
  }
  if (applicationId && String(milestone.applicationId || '') !== String(applicationId)) {
    return NextResponse.json({ milestone, rollup: null, readiness: null, lists: {} });
  }

  const rollup = await computeMilestoneRollup(String(milestone._id || milestone.id || milestone.name || milestoneId));
  const policyRef = await getEffectivePolicyForMilestone(String(milestone._id || milestone.id || milestone.name || ''));
  const readiness = rollup ? await evaluateMilestoneReadiness(rollup, policyRef.effective) : null;
  const lists = await computeLists(milestone, visibility);

  return NextResponse.json({ milestone, rollup, readiness, lists });
}
