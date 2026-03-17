import { NextResponse } from 'next/server';
import { emitEvent } from '../../../../shared/events/emitEvent';
import { createVisibilityContext, getAuthUserFromCookies } from '../../../../services/visibility';
import { evaluateWorkItemStaleness } from '../../../../lib/staleness';
import { computeMilestoneCriticalPath } from '../../../../services/criticalPath';
import { isAdminOrCmo } from '../../../../services/authz';
import { listWatcherUserIdsForScopes } from '../../../../services/watchers';
import { createNotificationsForEvent } from '../../../../services/notifications';
import { getDeliveryPolicy, getEffectivePolicyForBundle, getEffectivePolicyForMilestone } from '../../../../services/policy';
import { findActiveBundleOwnerAssignment } from '../../../../server/db/repositories/bundleAssignmentsRepo';
import { getMilestoneByRef, getSprintByRef } from '../../../../server/db/repositories/milestonesRepo';
import {
  getWorkItemByAnyRef,
  listActiveWorkItemsForScope
} from '../../../../server/db/repositories/workItemsRepo';
import {
  countRecentStalenessNudgesByUser,
  getRecentStalenessNudgeForWorkItem,
  insertStalenessNudgeRecord
} from '../../../../server/db/repositories/stalenessRepo';

const resolveMilestone = async (milestoneId?: string | null) => {
  const id = String(milestoneId || '');
  if (!id) return null;
  return await getMilestoneByRef(id);
};

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

const resolvePolicyRef = async (input: { milestoneId?: string | null; sprintId?: string | null; bundleId?: string | null }) => {
  if (input.milestoneId && input.milestoneId !== 'all') {
    return await getEffectivePolicyForMilestone(String(input.milestoneId));
  }
  if (input.sprintId && input.sprintId !== 'all') {
    const sprint = await getSprintByRef(String(input.sprintId));
    if (sprint?.bundleId) return await getEffectivePolicyForBundle(String(sprint.bundleId));
  }
  if (input.bundleId && input.bundleId !== 'all') {
    return await getEffectivePolicyForBundle(String(input.bundleId));
  }
  const global = await getDeliveryPolicy();
  return { effective: global, refs: { strategy: 'global', globalVersion: global.version }, hasOverrides: false };
};

const buildStaleReason = (input: {
  kind: string;
  staleness: ReturnType<typeof evaluateWorkItemStaleness>;
}) => {
  const { kind, staleness } = input;
  const reasons: Array<{ key: string; label: string; days?: number | null }> = [];
  if (staleness.criticalStale) reasons.push({ key: 'critical', label: 'Critical path stale', days: staleness.daysSinceUpdate });
  if (staleness.blockedStale) reasons.push({ key: 'blocked', label: 'Blocked with no update', days: staleness.daysSinceUpdate });
  if (staleness.unassignedStale) reasons.push({ key: 'unassigned', label: 'Unassigned for', days: staleness.daysSinceCreate });
  if (staleness.githubStale) {
    if (staleness.github.hasOpenPr) {
      reasons.push({ key: 'github', label: 'PR inactive for', days: staleness.github.daysSinceUpdate });
    } else {
      reasons.push({ key: 'github', label: 'In progress without PR for', days: staleness.github.daysSinceUpdate });
    }
  }
  if (staleness.stale) reasons.push({ key: 'stale', label: 'No updates for', days: staleness.daysSinceUpdate });

  const preferred = kind === 'all' ? reasons[0] : reasons.find((r) => r.key === kind);
  if (!preferred) {
    return { reason: 'Stale item', daysStale: staleness.daysSinceUpdate ?? null };
  }
  const days = typeof preferred.days === 'number' ? preferred.days : null;
  return {
    reason: days !== null ? `${preferred.label} ${days}d` : preferred.label,
    daysStale: days
  };
};

const canNudge = async (authUser: any, item: any, milestone: any, policy: any) => {
  if (!authUser?.userId) return false;

  const userId = String(authUser.userId || authUser.id || '');
  if (!userId) return false;

  const allowedRoles: string[] = Array.isArray(policy?.staleness?.nudges?.allowedRoles)
    ? policy.staleness.nudges.allowedRoles.map(String)
    : [];

  if (allowedRoles.includes('ADMIN') || allowedRoles.includes('CMO')) {
    if (await isAdminOrCmo(authUser)) return true;
  }

  if (allowedRoles.includes('BUNDLE_OWNER')) {
    if (milestone?.ownerUserId && String(milestone.ownerUserId) === userId) return true;
    if (item?.bundleId) {
      const assignment = await findActiveBundleOwnerAssignment(String(item.bundleId), userId);
      if (assignment) return true;
    }
  }

  if (allowedRoles.includes('WATCHER')) {
    const scopes: Array<{ scopeType: 'BUNDLE' | 'MILESTONE'; scopeId: string }> = [];
    if (item?.bundleId) scopes.push({ scopeType: 'BUNDLE', scopeId: String(item.bundleId) });
    const milestoneId = milestone?._id || milestone?.id || milestone?.name;
    if (milestoneId) scopes.push({ scopeType: 'MILESTONE', scopeId: String(milestoneId) });
    if (scopes.length) {
      const watcherIds = await listWatcherUserIdsForScopes(scopes);
      if (watcherIds.includes(userId)) return true;
    }
  }

  return false;
};

export async function GET(request: Request) {
  const authUser = await getAuthUserFromCookies();
  if (!authUser?.userId) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  const visibility = createVisibilityContext(authUser);
  const { searchParams } = new URL(request.url);
  const kind = (searchParams.get('kind') || 'all').toLowerCase();
  const milestoneId = searchParams.get('milestoneId');
  const sprintId = searchParams.get('sprintId');
  const bundleId = searchParams.get('bundleId');

  const policyRef = await resolvePolicyRef({ milestoneId, sprintId, bundleId });
  let items = await listActiveWorkItemsForScope({
    bundleIds: bundleId && bundleId !== 'all' ? [String(bundleId)] : undefined,
    sprintRefs: sprintId && sprintId !== 'all' ? [String(sprintId)] : undefined,
    milestoneRefs: milestoneId && milestoneId !== 'all' ? [String(milestoneId)] : undefined,
    projection: {
      _id: 1,
      id: 1,
      key: 1,
      title: 1,
      status: 1,
      assignedTo: 1,
      assigneeUserIds: 1,
      updatedAt: 1,
      createdAt: 1,
      milestoneIds: 1,
      milestoneId: 1,
      bundleId: 1,
      sprintId: 1,
      github: 1,
      isBlocked: 1
    }
  });

  items = await visibility.filterVisibleWorkItems(items as any[]);

  const criticalMilestones = new Set<string>();
  if (milestoneId && milestoneId !== 'all') {
    criticalMilestones.add(String(milestoneId));
  } else {
    items.forEach((item: any) => {
      (item.milestoneIds || []).forEach((id: any) => { if (id) criticalMilestones.add(String(id)); });
      if (item.milestoneId) criticalMilestones.add(String(item.milestoneId));
    });
  }
  const criticalIdSet = (kind === 'critical' || kind === 'all')
    ? await buildCriticalIdSet(Array.from(criticalMilestones))
    : new Set<string>();

  const rows = items.map((item: any) => {
    const itemId = String(item._id || item.id || '');
    const isCritical = criticalIdSet.has(itemId) || (item?.key && criticalIdSet.has(String(item.key)));
    const staleness = evaluateWorkItemStaleness(item, { isCritical, policy: policyRef.effective });
    return { item, staleness };
  }).filter(({ staleness }) => {
    if (kind === 'critical') return staleness.criticalStale;
    if (kind === 'blocked') return staleness.blockedStale;
    if (kind === 'unassigned') return staleness.unassignedStale;
    if (kind === 'github') return staleness.githubStale;
    if (kind === 'all') {
      return staleness.stale || staleness.criticalStale || staleness.blockedStale || staleness.unassignedStale || staleness.githubStale;
    }
    return staleness.stale;
  }).map(({ item, staleness }) => {
    const assignee = item.assignedTo || (Array.isArray(item.assigneeUserIds) ? item.assigneeUserIds[0] : null);
    const reason = buildStaleReason({ kind, staleness });
    return {
      id: String(item._id || item.id || ''),
      key: item.key,
      title: item.title,
      status: item.status,
      assignee,
      updatedAt: item.updatedAt || item.createdAt || null,
      daysStale: reason.daysStale,
      reason: reason.reason,
      github: {
        hasOpenPr: staleness.github.hasOpenPr,
        prNumber: staleness.github.prNumber,
        prTitle: staleness.github.prTitle,
        prUpdatedAt: staleness.github.prUpdatedAt,
        daysSinceUpdate: staleness.github.daysSinceUpdate
      }
    };
  });

  return NextResponse.json({
    items: rows,
    policy: {
      strategy: policyRef.refs.strategy,
      globalVersion: policyRef.refs.globalVersion,
      bundleVersions: (policyRef.refs as any).bundleVersions
    }
  });
}

export async function POST(request: Request) {
  const authUser = await getAuthUserFromCookies();
  if (!authUser?.userId) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  const visibility = createVisibilityContext(authUser);
  const body = await request.json().catch(() => ({}));
  const workItemId = String(body?.workItemId || body?.id || '');
  const workItemKey = String(body?.workItemKey || body?.key || '');

  if (!workItemId && !workItemKey) {
    return NextResponse.json({ error: 'Missing work item id' }, { status: 400 });
  }

  const rawItem = await getWorkItemByAnyRef(workItemId || workItemKey);
  if (!rawItem) return NextResponse.json({ error: 'Work item not found' }, { status: 404 });
  const item: any = {
    ...rawItem,
    _id: rawItem?._id ? String(rawItem._id) : undefined
  };

  const canView = await visibility.canViewWorkItem(item);
  if (!canView) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const milestoneId = (item.milestoneIds || [])[0] || item.milestoneId;
  const milestone = await resolveMilestone(milestoneId);
  const policyRef = await resolvePolicyRef({ milestoneId, bundleId: item.bundleId });
  const policy = policyRef.effective;
  const nudgesPolicy = policy?.staleness?.nudges;
  if (!nudgesPolicy?.enabled) {
    await emitEvent({
      ts: new Date().toISOString(),
      type: 'workitem.stale.blocked',
      actor: { userId: String(authUser.userId || authUser.id || ''), displayName: String(authUser.email || authUser.userId || authUser.id || 'User') },
      resource: { type: 'workitem', id: String(item._id || item.id || ''), title: item.title || item.key || 'Work Item' },
      payload: { reason: 'NUDGE_DISABLED' }
    });
    return NextResponse.json({ error: 'Nudges disabled', code: 'NUDGE_DISABLED' }, { status: 409 });
  }

  const allowed = await canNudge(authUser, item, milestone, policy);
  if (!allowed) {
    await emitEvent({
      ts: new Date().toISOString(),
      type: 'workitem.stale.blocked',
      actor: { userId: String(authUser.userId || authUser.id || ''), displayName: String(authUser.email || authUser.userId || authUser.id || 'User') },
      resource: { type: 'workitem', id: String(item._id || item.id || ''), title: item.title || item.key || 'Work Item' },
      payload: { reason: 'NUDGE_FORBIDDEN' }
    });
    return NextResponse.json({ error: 'Forbidden', code: 'NUDGE_FORBIDDEN' }, { status: 403 });
  }

  const nowTs = Date.now();
  const nowIso = new Date(nowTs).toISOString();
  const cooldownHours = Number(nudgesPolicy.cooldownHoursPerItem || 0);
  if (cooldownHours > 0) {
    const since = new Date(nowTs - cooldownHours * 60 * 60 * 1000).toISOString();
    const existing = await getRecentStalenessNudgeForWorkItem(String(item._id || item.id || ''), since);
    if (existing) {
      await emitEvent({
        ts: nowIso,
        type: 'workitem.stale.blocked',
        actor: { userId: String(authUser.userId || authUser.id || ''), displayName: String(authUser.email || authUser.userId || authUser.id || 'User') },
        resource: { type: 'workitem', id: String(item._id || item.id || ''), title: item.title || item.key || 'Work Item' },
        payload: { reason: 'NUDGE_COOLDOWN' }
      });
      return NextResponse.json({ error: 'Nudge cooldown active', code: 'NUDGE_COOLDOWN' }, { status: 409 });
    }
  }

  const maxPerDay = Number(nudgesPolicy.maxNudgesPerUserPerDay || 0);
  if (maxPerDay <= 0) {
    await emitEvent({
      ts: nowIso,
      type: 'workitem.stale.blocked',
      actor: { userId: String(authUser.userId || authUser.id || ''), displayName: String(authUser.email || authUser.userId || authUser.id || 'User') },
      resource: { type: 'workitem', id: String(item._id || item.id || ''), title: item.title || item.key || 'Work Item' },
      payload: { reason: 'NUDGE_LIMIT_REACHED' }
    });
    return NextResponse.json({ error: 'Nudge limit reached', code: 'NUDGE_LIMIT_REACHED' }, { status: 429 });
  }

  const sinceDay = new Date(nowTs - 24 * 60 * 60 * 1000).toISOString();
  const recentCount = await countRecentStalenessNudgesByUser(String(authUser.userId || authUser.id || ''), sinceDay);
  if (recentCount >= maxPerDay) {
    await emitEvent({
      ts: nowIso,
      type: 'workitem.stale.blocked',
      actor: { userId: String(authUser.userId || authUser.id || ''), displayName: String(authUser.email || authUser.userId || authUser.id || 'User') },
      resource: { type: 'workitem', id: String(item._id || item.id || ''), title: item.title || item.key || 'Work Item' },
      payload: { reason: 'NUDGE_LIMIT_REACHED' }
    });
    return NextResponse.json({ error: 'Nudge limit reached', code: 'NUDGE_LIMIT_REACHED' }, { status: 429 });
  }

  const itemId = String(item._id || item.id || '');
  const actor = {
    userId: String(authUser.userId || authUser.id || ''),
    displayName: String(authUser.email || authUser.userId || authUser.id || 'User'),
    email: authUser.email ? String(authUser.email) : undefined
  };

  await insertStalenessNudgeRecord({
    workItemId: itemId,
    nudgedBy: String(authUser.userId || authUser.id || ''),
    nudgedAt: nowIso,
    reason: body?.reason || 'Stale work item',
    kind: body?.kind || 'stale'
  });

  await emitEvent({
    ts: nowIso,
    type: 'workitem.stale.nudge',
    actor,
    resource: { type: 'workitem', id: itemId, title: item.title || item.key || itemId },
    payload: {
      workItem: {
        id: itemId,
        key: item.key,
        title: item.title,
        status: item.status,
        bundleId: item.bundleId
      },
      milestone: milestone
        ? { id: String(milestone._id || milestone.id || milestone.name || ''), name: milestone.name, bundleId: milestone.bundleId, ownerUserId: milestone.ownerUserId, ownerEmail: milestone.ownerEmail }
        : undefined,
      reason: body?.reason || 'Stale work item',
      kind: body?.kind || 'stale'
    }
  });

  await createNotificationsForEvent({
    type: 'workitem.stale.nudge',
    actor,
    payload: {
      item,
      milestone,
      reason: body?.reason || 'Stale work item',
      kind: body?.kind || 'stale'
    }
  });

  return NextResponse.json({ success: true });
}
