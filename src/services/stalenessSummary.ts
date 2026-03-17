import { evaluateWorkItemStaleness } from '../lib/staleness';
import { getServerDb } from '../server/db/client';
import { enqueueNotificationDigestItem, getNotificationDigestQueueItem } from '../server/db/repositories/notificationPlatformRepo';
import { computeMilestoneCriticalPath } from './criticalPath';
import { WorkItemStatus } from '../types';
import { getDeliveryPolicy, getEffectivePolicyForBundle, getStrictestPolicyForBundles } from './policy';

const buildCriticalIdSet = async (milestoneIds: string[]) => {
  const criticalIds = new Set<string>();
  for (const msId of milestoneIds) {
    if (!msId) continue;
    try {
      const critical = await computeMilestoneCriticalPath(msId);
      (critical?.criticalPath?.nodes || []).forEach((node: any) => {
        if (node?.id) criticalIds.add(String(node.id));
        if (node?.key) criticalIds.add(String(node.key));
      });
    } catch {}
  }
  return criticalIds;
};

const resolveAssigneeTokens = (user: any) => {
  const tokens = new Set<string>();
  if (user?.email) tokens.add(String(user.email));
  if (user?.name) tokens.add(String(user.name));
  if (user?.username) tokens.add(String(user.username));
  return Array.from(tokens);
};

export const buildStaleSummaryForUser = async (db: any, user: any) => {
  if (!user?._id) return null;
  const userId = String(user._id);
  const tokens = resolveAssigneeTokens(user);

  const assigneeQuery: any[] = [{ assigneeUserIds: userId }];
  if (tokens.length) {
    assigneeQuery.push({ assignedTo: { $in: tokens } });
  }

  const items = await db.collection('workitems').find({
    status: { $ne: WorkItemStatus.DONE },
    $or: assigneeQuery
  }, {
    projection: {
      _id: 1,
      id: 1,
      key: 1,
      status: 1,
      assignedTo: 1,
      assigneeUserIds: 1,
      updatedAt: 1,
      createdAt: 1,
      milestoneIds: 1,
      milestoneId: 1,
      bundleId: 1,
      github: 1,
      isBlocked: 1
    }
  }).toArray();

  if (!items.length) return null;

  const milestoneIds = new Set<string>();
  const bundleIds = new Set<string>();
  items.forEach((item: any) => {
    (item.milestoneIds || []).forEach((id: any) => { if (id) milestoneIds.add(String(id)); });
    if (item.milestoneId) milestoneIds.add(String(item.milestoneId));
    if (item.bundleId) bundleIds.add(String(item.bundleId));
  });

  const criticalSet = await buildCriticalIdSet(Array.from(milestoneIds));
  const bundleList = Array.from(bundleIds).filter(Boolean);
  const policyRef = bundleList.length === 0
    ? { effective: await getDeliveryPolicy() }
    : (bundleList.length === 1 ? await getEffectivePolicyForBundle(bundleList[0]) : await getStrictestPolicyForBundles(bundleList));
  const policy = policyRef.effective;
  if (!policy?.staleness?.digest?.includeStaleSummary) return null;

  let staleCount = 0;
  let criticalStaleCount = 0;
  let blockedStaleCount = 0;
  let unassignedStaleCount = 0;
  let githubStaleCount = 0;

  items.forEach((item: any) => {
    const itemId = String(item._id || item.id || '');
    const isCritical = (itemId && criticalSet.has(itemId)) || (item?.key && criticalSet.has(String(item.key)));
    const staleness = evaluateWorkItemStaleness(item, { isCritical, policy });
    if (staleness.stale) staleCount += 1;
    if (staleness.criticalStale) criticalStaleCount += 1;
    if (staleness.blockedStale) blockedStaleCount += 1;
    if (staleness.unassignedStale) unassignedStaleCount += 1;
    if (staleness.githubStale) githubStaleCount += 1;
  });

  const total = staleCount + criticalStaleCount + blockedStaleCount + unassignedStaleCount + githubStaleCount;
  if (total === 0) return null;
  if ((policy?.staleness?.digest?.minCriticalStaleToInclude ?? 0) > criticalStaleCount) return null;

  return {
    counts: {
      staleCount,
      criticalStaleCount,
      blockedStaleCount,
      unassignedStaleCount,
      githubStaleCount
    },
    total
  };
};

export const queueStaleSummaryForUser = async (db: any, user: any, dateKey: string) => {
  if (!user?._id) return null;
  const userId = String(user._id);
  const resolvedDb = db || await getServerDb();
  const existing = await getNotificationDigestQueueItem({ userId, type: 'workitem.stale.summary', dateKey });
  if (existing) return null;

  const summary = await buildStaleSummaryForUser(resolvedDb, user);
  if (!summary) return null;

  const counts = summary.counts;
  const parts = [
    counts.criticalStaleCount ? `${counts.criticalStaleCount} critical` : null,
    counts.blockedStaleCount ? `${counts.blockedStaleCount} blocked` : null,
    counts.unassignedStaleCount ? `${counts.unassignedStaleCount} unassigned` : null,
    counts.githubStaleCount ? `${counts.githubStaleCount} GitHub` : null,
    counts.staleCount ? `${counts.staleCount} stale` : null
  ].filter(Boolean);
  const body = parts.length ? `Stale items: ${parts.join(', ')}.` : 'Stale work items need attention.';

  await enqueueNotificationDigestItem({
    userId,
    type: 'workitem.stale.summary',
    title: 'Stale work items summary',
    body,
    link: '/work-items?view=milestone-plan',
    createdAt: new Date().toISOString(),
    dateKey
  });

  return summary;
};
