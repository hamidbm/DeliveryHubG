
import { NextResponse } from 'next/server';
import { emitEvent } from '../../../../shared/events/emitEvent';
import { fetchWorkItemById, saveWorkItem } from '../../../../services/workItemsService';
import { computeMilestoneRollup, computeSprintRollups } from '../../../../services/rollupAnalytics';
import { evaluateCapacity } from '../../../../services/milestoneGovernance';
import { canCreateBlocksDependency, canEditRiskSeverity, canOverrideCapacity, canRemoveBlocksDependency, isAdminOrCmo } from '../../../../services/authz';
import { createNotificationsForEvent } from '../../../../services/notifications';
import { createDecision } from '../../../../services/decisionLog';
import { createVisibilityContext, getAuthUserFromCookies } from '../../../../services/visibility';
import { invalidateWorkItemScopesFromCandidates } from '../../../../services/workItemCache';
import { requireStandardUser } from '../../../../shared/auth/guards';
import type { Principal } from '../../../../shared/auth/roles';
import { archiveWorkItemRecord, listWorkItemsByAnyRefs } from '../../../../server/db/repositories/workItemsRepo';
import { getMilestoneByRef, getSprintByRef } from '../../../../server/db/repositories/milestonesRepo';

const getPayloadField = (principal: Principal, key: string) => principal.rawPayload[key];

const buildActor = (principal: Principal) => ({
  userId: principal.userId || String(getPayloadField(principal, 'id') || getPayloadField(principal, 'userId') || getPayloadField(principal, 'email') || ''),
  displayName: principal.fullName || String(getPayloadField(principal, 'name') || getPayloadField(principal, 'displayName') || principal.email || 'Unknown'),
  email: principal.email || (getPayloadField(principal, 'email') ? String(getPayloadField(principal, 'email')) : undefined),
  role: principal.role || (getPayloadField(principal, 'role') ? String(getPayloadField(principal, 'role')) : undefined)
});

const isPrivilegedRole = (role?: string | null) =>
  new Set([
    'CMO Architect',
    'SVP Architect',
    'SVP PM',
    'SVP Engineer',
    'Director',
    'VP',
    'CIO'
  ]).has(String(role || ''));

const canManageRestrictedTransition = (principal: Principal, item: any) => {
  const userName = principal.fullName || String(getPayloadField(principal, 'name') || '');
  const isOwner = Boolean(userName && (item.assignedTo === userName || item.createdBy === userName));
  return isOwner || isPrivilegedRole(principal.role);
};

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const authUser = await getAuthUserFromCookies();
  if (!authUser?.userId) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  const item = await fetchWorkItemById(id);
  if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const visibility = createVisibilityContext(authUser);
  if (!(await visibility.canViewWorkItem(item))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  await visibility.redactWorkItemLinks([item]);
  return NextResponse.json(item);
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const auth = await requireStandardUser(request);
    if (!auth.ok) return auth.response;
    const payload = auth.principal.rawPayload;
    const itemData = await request.json();
    const criticalPathAction = itemData?.criticalPathAction;
    if (Object.prototype.hasOwnProperty.call(itemData, 'criticalPathAction')) {
      delete itemData.criticalPathAction;
    }
    const allowOverCapacity = !!itemData.allowOverCapacity;
    if (Object.prototype.hasOwnProperty.call(itemData, 'allowOverCapacity')) {
      delete itemData.allowOverCapacity;
    }
    const overrideReason = itemData?.overrideReason ? String(itemData.overrideReason) : '';
    if (Object.prototype.hasOwnProperty.call(itemData, 'overrideReason')) {
      delete itemData.overrideReason;
    }
    const authUser = {
      userId: auth.principal.userId,
      role: String(auth.principal.role || ''),
      team: String(auth.principal.team || ''),
      accountType: auth.principal.accountType
    };

    if (allowOverCapacity && !(await canOverrideCapacity(authUser))) {
      return NextResponse.json({ error: 'FORBIDDEN_CAPACITY_OVERRIDE' }, { status: 403 });
    }

    // 1. Fetch original state to calculate delta
    const originalItem = await fetchWorkItemById(id);
    if (!originalItem) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const visibility = createVisibilityContext({
      userId: auth.principal.userId,
      role: auth.principal.role || undefined,
      email: auth.principal.email
    });
    if (!(await visibility.canViewWorkItem(originalItem))) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const warnings: Array<{ code: string; message: string; details?: any }> = [];
    const capacityOverrides: Array<{ milestone: any; details: any }> = [];
    const sprintCapacityOverrides: Array<{ sprint: any; item: any; details: any }> = [];
    const directScopeChanges: Array<{ milestone: any; action: string }> = [];
    if (Array.isArray(itemData.milestoneIds)) {
      const milestoneIds = itemData.milestoneIds.map((m: any) => String(m)).filter(Boolean);
      const previousMilestones = Array.isArray(originalItem.milestoneIds)
        ? originalItem.milestoneIds.map((m: any) => String(m)).filter(Boolean)
        : [];
      const unionIds = Array.from(new Set([...milestoneIds, ...previousMilestones]));
      const adminDirect = await isAdminOrCmo(authUser);
      for (const milestoneId of unionIds) {
        const milestone = await getMilestoneByRef(milestoneId);
        if (!milestone) continue;

        const status = String(milestone.status || '').toUpperCase();
        const isCommitted = status === 'COMMITTED';
        const milestoneKey = String(milestone._id || milestone.id || milestone.name || milestoneId);
        const wasIn = previousMilestones.includes(milestoneKey);
        const willBeIn = milestoneIds.includes(milestoneKey);
        const changed = wasIn !== willBeIn;
        if (isCommitted && changed && !adminDirect) {
          return NextResponse.json({
            error: 'COMMITTED_SCOPE_REQUIRES_APPROVAL',
            milestoneId: milestoneKey,
            link: `/work-items?view=milestone-plan`
          }, { status: 409 });
        }
        if (isCommitted && changed && adminDirect) {
          directScopeChanges.push({ milestone, action: willBeIn ? 'ADD_ITEMS' : 'REMOVE_ITEMS' });
        }
        const targetCapacity = typeof milestone.targetCapacity === 'number' ? milestone.targetCapacity : undefined;

        const incomingPointsRaw = itemData.storyPoints !== undefined ? itemData.storyPoints : originalItem.storyPoints;
        const incomingPoints = typeof incomingPointsRaw === 'number' ? incomingPointsRaw : 0;
        const rollup = await computeMilestoneRollup(String(milestone._id || milestone.id || milestone.name || milestoneId));
        const committedPoints = rollup?.capacity?.committedPoints || 0;
        const existingPoints = typeof originalItem.storyPoints === 'number' ? originalItem.storyPoints : 0;
        const alreadyAssigned = Array.isArray(originalItem.milestoneIds) && originalItem.milestoneIds.map(String).includes(String(milestone._id || milestone.id || milestone.name || milestoneId));
        const existingPointsAssigned = alreadyAssigned ? existingPoints : 0;

        const capacityResult = evaluateCapacity({
          milestoneId: String(milestone._id || milestone.id || milestone.name || milestoneId),
          isCommitted,
          targetCapacity,
          committedPoints,
          incomingPoints,
          existingPoints: existingPointsAssigned,
          allowOverCapacity
        });

        if (!capacityResult.ok && capacityResult.error) {
          return NextResponse.json({
            error: capacityResult.error.code,
            message: capacityResult.error.message,
            details: capacityResult.error.details
          }, { status: 409 });
        }
        if (capacityResult.warning) {
          warnings.push({
            code: capacityResult.warning.code,
            message: capacityResult.warning.message,
            details: capacityResult.warning.details
          });
        }
        const wouldBe = Math.max(committedPoints - existingPointsAssigned, 0) + incomingPoints;
        const isOverCapacity = typeof targetCapacity === 'number' && wouldBe > targetCapacity;
        if (isCommitted && allowOverCapacity && isOverCapacity) {
          capacityOverrides.push({
            milestone,
            details: {
              milestoneId: String(milestone._id || milestone.id || milestone.name || milestoneId),
              targetCapacity,
              currentCommittedPoints: committedPoints,
              incomingItemPoints: incomingPoints,
              wouldBeCommittedPoints: wouldBe
            }
          });
        }
      }
    }

    if (itemData.sprintId !== undefined && itemData.sprintId !== null) {
      const sprintId = String(itemData.sprintId);
      const sprint = await getSprintByRef(sprintId);
      if (!sprint) return NextResponse.json({ error: 'SPRINT_NOT_FOUND' }, { status: 404 });

      const sprintStatus = String(sprint.status || '').toUpperCase();
      if (sprintStatus === 'ACTIVE') {
        const incomingPointsRaw = itemData.storyPoints !== undefined ? itemData.storyPoints : originalItem.storyPoints;
        const incomingHoursRaw = itemData.timeEstimate !== undefined ? itemData.timeEstimate : originalItem.timeEstimate;
        const incomingPoints = typeof incomingPointsRaw === 'number' ? incomingPointsRaw : (typeof incomingHoursRaw === 'number' ? incomingHoursRaw : 0);
        if (!Number.isFinite(incomingPoints) || incomingPoints <= 0) {
          return NextResponse.json({
            error: 'MISSING_ESTIMATE',
            message: 'Active sprints require story points or time estimates.',
            details: { sprintId: String(sprint._id || sprint.id || sprintId) }
          }, { status: 400 });
        }

        const rollups = await computeSprintRollups({ sprintIds: [String(sprint._id || sprint.id || sprintId)] });
        const rollup = rollups[0];
        const committedPoints = rollup?.capacity?.committedPoints || 0;
        const targetCapacity = typeof sprint.capacityPoints === 'number' ? sprint.capacityPoints : undefined;
        const existingPoints = typeof originalItem.storyPoints === 'number' ? originalItem.storyPoints : (typeof originalItem.timeEstimate === 'number' ? originalItem.timeEstimate : 0);
        const alreadyAssigned = String(originalItem.sprintId || '') === String(sprint._id || sprint.id || sprintId);
        const existingPointsAssigned = alreadyAssigned ? existingPoints : 0;
        const wouldBe = Math.max(committedPoints - existingPointsAssigned, 0) + incomingPoints;
        const isOverCapacity = typeof targetCapacity === 'number' && wouldBe > targetCapacity;

        if (isOverCapacity && !allowOverCapacity) {
          return NextResponse.json({
            error: 'OVER_CAPACITY',
            message: 'Sprint capacity exceeded.',
            details: {
              sprintId: String(sprint._id || sprint.id || sprintId),
              targetCapacity,
              currentCommittedPoints: committedPoints,
              incomingItemPoints: incomingPoints,
              wouldBeCommittedPoints: wouldBe
            }
          }, { status: 409 });
        }

        if (allowOverCapacity && isOverCapacity) {
          sprintCapacityOverrides.push({
            sprint,
            item: originalItem,
            details: {
              sprintId: String(sprint._id || sprint.id || sprintId),
              targetCapacity,
              currentCommittedPoints: committedPoints,
              incomingItemPoints: incomingPoints,
              wouldBeCommittedPoints: wouldBe
            }
          });
        }
      }
    }

    if (itemData.status && itemData.status !== originalItem.status) {
      const criticalStatuses = new Set(['DONE', 'BLOCKED', 'REVIEW']);
      if (criticalStatuses.has(itemData.status)) {
        if (!canManageRestrictedTransition(auth.principal, originalItem)) {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
      }
    }

    if (
      (itemData.priority && itemData.priority !== originalItem.priority) ||
      (itemData.assignedTo !== undefined && itemData.assignedTo !== originalItem.assignedTo)
    ) {
      if (!canManageRestrictedTransition(auth.principal, originalItem)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    if (itemData.risk?.severity && itemData.risk.severity !== originalItem.risk?.severity) {
      if (!(await canEditRiskSeverity(authUser, originalItem))) {
        return NextResponse.json({ error: 'FORBIDDEN_RISK_SEVERITY_EDIT' }, { status: 403 });
      }
    }

    // 2. Normalize links to avoid duplicates or self-links (canonical types only)
    let normalizedLinks = itemData.links;
    if (Array.isArray(itemData.links)) {
      const seen = new Set<string>();
      normalizedLinks = itemData.links
        .filter((l: any) => l && l.targetId && l.type)
        .filter((l: any) => ['BLOCKS', 'RELATES_TO', 'DUPLICATES'].includes(String(l.type)))
        .filter((l: any) => String(l.targetId) !== String(id))
        .filter((l: any) => {
          const key = `${l.type}:${l.targetId}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
    }

    // 2. Commit primary update
    const previousBlocks = new Set(
      Array.isArray(originalItem.links)
        ? originalItem.links.filter((l: any) => String(l?.type) === 'BLOCKS').map((l: any) => String(l.targetId))
        : []
    );
    const newBlocks = Array.isArray(normalizedLinks)
      ? normalizedLinks.filter((l: any) => String(l?.type) === 'BLOCKS' && l.targetId && !previousBlocks.has(String(l.targetId)))
      : [];
    const removedBlocks = Array.isArray(originalItem.links)
      ? originalItem.links.filter((l: any) => String(l?.type) === 'BLOCKS' && l.targetId && (!Array.isArray(normalizedLinks) || !normalizedLinks.find((n: any) => String(n?.type) === 'BLOCKS' && String(n?.targetId) === String(l.targetId))))
      : [];

    let targetMap = new Map<string, any>();
    if (newBlocks.length || removedBlocks.length) {
      const targets = [...newBlocks, ...removedBlocks].map((l: any) => String(l.targetId));
      const uniqueTargets = Array.from(new Set(targets));
      const targetDocs = await listWorkItemsByAnyRefs(uniqueTargets);
      targetDocs.forEach((t: any) => {
        if (t._id) targetMap.set(String(t._id), t);
        if (t.id) targetMap.set(String(t.id), t);
        if (t.key) targetMap.set(String(t.key), t);
      });

      const sourceItem = { ...originalItem, ...itemData };
      for (const link of newBlocks) {
        const target = targetMap.get(String(link.targetId));
        if (!(await canCreateBlocksDependency(authUser, sourceItem, target))) {
          return NextResponse.json({ error: 'FORBIDDEN_BLOCKS_DEPENDENCY' }, { status: 403 });
        }
      }
      for (const link of removedBlocks) {
        const target = targetMap.get(String(link.targetId));
        if (!(await canRemoveBlocksDependency(authUser, sourceItem, target))) {
          return NextResponse.json({ error: 'FORBIDDEN_BLOCKS_DEPENDENCY' }, { status: 403 });
        }
      }
    }

    const nowIso = new Date().toISOString();
    const assignChanged = Object.prototype.hasOwnProperty.call(itemData, 'assignedTo')
      ? itemData.assignedTo !== originalItem.assignedTo
      : false;
    const assigneeIdsChanged = Object.prototype.hasOwnProperty.call(itemData, 'assigneeUserIds')
      ? JSON.stringify(itemData.assigneeUserIds || []) !== JSON.stringify(originalItem.assigneeUserIds || [])
      : false;
    if (assignChanged || assigneeIdsChanged) {
      itemData.assignedAt = nowIso;
    }

    const result = await saveWorkItem({ ...itemData, links: normalizedLinks, _id: id }, payload);
    await invalidateWorkItemScopesFromCandidates(
      [
        { bundleId: originalItem?.bundleId, applicationId: originalItem?.applicationId },
        { bundleId: itemData?.bundleId, applicationId: itemData?.applicationId }
      ],
      'workitems.patch'
    );

    if (criticalPathAction?.type) {
      const actor = buildActor(auth.principal);
      await emitEvent({
        ts: new Date().toISOString(),
        type: 'criticalpath.action.executed',
        actor,
        resource: { type: 'workitems.workitem', id: String(originalItem._id || originalItem.id || id), title: originalItem.title || originalItem.key },
        context: { milestoneId: criticalPathAction.milestoneId, bundleId: originalItem.bundleId },
        payload: { actionType: criticalPathAction.type }
      });
    }

    if (directScopeChanges.length) {
      const actor = buildActor(auth.principal);
      const now = new Date().toISOString();
      await Promise.all(directScopeChanges.map(async (entry) => {
        try {
          const milestone = entry.milestone;
          await emitEvent({
            ts: now,
            type: 'milestones.scope.directchanged',
            actor,
            resource: { type: 'milestones.milestone', id: String(milestone._id || milestone.id || milestone.name), title: milestone.name || milestone.id },
            context: { bundleId: milestone.bundleId },
            payload: { itemId: String(originalItem._id || originalItem.id || id), action: entry.action }
          });
        } catch {}
      }));
    }

    if (allowOverCapacity && capacityOverrides.length && !overrideReason.trim()) {
      return NextResponse.json({ error: 'OVERRIDE_REASON_REQUIRED' }, { status: 400 });
    }

    if (capacityOverrides.length) {
      const actor = buildActor(auth.principal);
      await Promise.all(capacityOverrides.map(async (entry) => {
        try {
          await createNotificationsForEvent({
            type: 'milestone.capacity.override',
            actor,
            payload: {
              milestone: entry.milestone,
              item: { ...originalItem, ...itemData },
              details: entry.details
            }
          });
          await createDecision({
            createdAt: new Date().toISOString(),
            createdBy: { userId: actor.userId || '', email: actor.email || '', name: actor.displayName },
            source: 'AUTO',
            scopeType: 'MILESTONE',
            scopeId: String(entry.milestone?._id || entry.milestone?.id || entry.milestone?.name || entry.details?.milestoneId || ''),
            decisionType: 'CAPACITY_OVERRIDE',
            title: `Capacity override for ${entry.milestone?.name || entry.details?.milestoneId || 'milestone'}`,
            rationale: overrideReason?.trim() || `Capacity override accepted for ${originalItem.key || originalItem.title || 'work item'}.`,
            outcome: 'APPROVED',
            severity: 'warn',
            related: {
              milestoneId: String(entry.milestone?._id || entry.milestone?.id || entry.milestone?.name || entry.details?.milestoneId || ''),
              bundleId: entry.milestone?.bundleId ? String(entry.milestone.bundleId) : undefined,
              workItemIds: [String(originalItem._id || originalItem.id || '')].filter(Boolean)
            }
          });
        } catch {}
      }));
    }

    if (sprintCapacityOverrides.length) {
      const actor = buildActor(auth.principal);
      const seen = new Set<string>();
      await Promise.all(sprintCapacityOverrides.map(async (entry) => {
        try {
          const key = `${entry.item?._id || entry.item?.id || ''}:${entry.details?.sprintId || ''}`;
          if (seen.has(key)) return;
          seen.add(key);
          await createNotificationsForEvent({
            type: 'sprint.capacity.override',
            actor,
            payload: {
              sprint: entry.sprint,
              item: entry.item,
              details: entry.details
            }
          });
        } catch {}
      }));
    }

    if (newBlocks.length) {
      const actor = buildActor(auth.principal);
      await Promise.all(newBlocks.map(async (link: any) => {
        try {
          const targetId = String(link.targetId);
          const target = targetMap.get(targetId) || (await fetchWorkItemById(targetId));
          if (!target) return;
          const blockerBundle = originalItem.bundleId || itemData.bundleId;
          const blockedBundle = target.bundleId;
          const blockerMilestone = Array.isArray(originalItem.milestoneIds) ? originalItem.milestoneIds[0] : originalItem.milestoneId;
          const blockedMilestone = Array.isArray(target.milestoneIds) ? target.milestoneIds[0] : target.milestoneId;
          const isCrossBundle = blockerBundle && blockedBundle && String(blockerBundle) !== String(blockedBundle);
          const isCrossMilestone = blockerMilestone && blockedMilestone && String(blockerMilestone) !== String(blockedMilestone);
          if (!isCrossBundle && !isCrossMilestone) return;
          await createNotificationsForEvent({
            type: 'dependency.crossbundle.created',
            actor,
            payload: {
              blocker: { ...originalItem, ...itemData },
              blocked: target
            }
          });
        } catch {}
      }));
    }

    return NextResponse.json({ success: true, result, warnings });
  } catch (error: any) {
    console.error("Patch Error:", error);
    return NextResponse.json({ error: error.message || 'Update failed' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const auth = await requireStandardUser(request);
    if (!auth.ok) return auth.response;
    const payload = auth.principal.rawPayload;
    const item = await fetchWorkItemById(id);
    if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const userName = auth.principal.fullName || String(payload.name || '');
    if (!canManageRestrictedTransition(auth.principal, item)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { now } = await archiveWorkItemRecord(id, userName);
    await invalidateWorkItemScopesFromCandidates(
      [{ bundleId: item?.bundleId, applicationId: item?.applicationId }],
      'workitems.archive'
    );

    try {
      await emitEvent({
        ts: now,
        type: 'workitems.item.archived',
        actor: buildActor(auth.principal),
        resource: { type: 'workitems.item', id: String(item._id || item.id || id), title: item.title },
        context: { bundleId: item.bundleId, appId: item.applicationId }
      });
    } catch {}

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Archive failed' }, { status: 500 });
  }
}
