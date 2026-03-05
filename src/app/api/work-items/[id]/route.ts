
import { NextResponse } from 'next/server';
import { fetchWorkItemById, saveWorkItem, emitEvent, getDb, computeMilestoneRollup, computeSprintRollups } from '../../../../services/db';
import { jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { ObjectId } from 'mongodb';
import { evaluateCapacity } from '../../../../services/milestoneGovernance';
import { canCreateBlocksDependency, canEditRiskSeverity, canOverrideCapacity, canRemoveBlocksDependency, isAdminOrCmo } from '../../../../services/authz';
import { createNotificationsForEvent } from '../../../../services/notifications';
import { createDecision } from '../../../../services/decisionLog';
import { createVisibilityContext, getAuthUserFromCookies } from '../../../../services/visibility';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'nexus_super_secret_key_123');

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
    let token: string | undefined;
    if (process.env.NODE_ENV === 'test') {
      token = (globalThis as any).__testToken as string | undefined;
    } else {
      const cookieStore = await cookies();
      token = cookieStore.get('nexus_auth_token')?.value;
    }
    if (!token) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
    
    const { payload } = await jwtVerify(token, JWT_SECRET);
    const itemData = await request.json();
    const criticalPathAction = itemData?.criticalPathAction;
    if (Object.prototype.hasOwnProperty.call(itemData, 'criticalPathAction')) {
      delete itemData.criticalPathAction;
    }
    const allowOverCapacity = !!itemData.allowOverCapacity;
    if (Object.prototype.hasOwnProperty.call(itemData, 'allowOverCapacity')) {
      delete itemData.allowOverCapacity;
    }
    const authUser = {
      userId: String((payload as any).id || (payload as any).userId || ''),
      role: String((payload as any).role || ''),
      team: String((payload as any).team || '')
    };

    if (allowOverCapacity && !(await canOverrideCapacity(authUser))) {
      return NextResponse.json({ error: 'FORBIDDEN_CAPACITY_OVERRIDE' }, { status: 403 });
    }

    // 1. Fetch original state to calculate delta
    const originalItem = await fetchWorkItemById(id);
    if (!originalItem) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const visibility = createVisibilityContext({
      userId: String((payload as any).id || (payload as any).userId || ''),
      role: (payload as any).role ? String((payload as any).role) : undefined,
      email: (payload as any).email ? String((payload as any).email) : undefined
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
      const db = await getDb();
      const adminDirect = await isAdminOrCmo(authUser);
      for (const milestoneId of unionIds) {
        const milestone = ObjectId.isValid(milestoneId)
          ? await db.collection('milestones').findOne({ _id: new ObjectId(milestoneId) })
          : await db.collection('milestones').findOne({ $or: [{ id: milestoneId }, { name: milestoneId }] });
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
      const db = await getDb();
      const sprint = ObjectId.isValid(sprintId)
        ? await db.collection('workitems_sprints').findOne({ _id: new ObjectId(sprintId) })
        : await db.collection('workitems_sprints').findOne({ $or: [{ id: sprintId }, { name: sprintId }] });
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
        const userName = String(payload.name || '');
        const userRole = String((payload as any).role || '');
        const privilegedRoles = new Set([
          'CMO Architect',
          'SVP Architect',
          'SVP PM',
          'SVP Engineer',
          'Director',
          'VP',
          'CIO'
        ]);
        const isOwner = userName && (originalItem.assignedTo === userName || originalItem.createdBy === userName);
        if (!isOwner && !privilegedRoles.has(userRole)) {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
      }
    }

    if (
      (itemData.priority && itemData.priority !== originalItem.priority) ||
      (itemData.assignedTo !== undefined && itemData.assignedTo !== originalItem.assignedTo)
    ) {
      const userName = String(payload.name || '');
      const userRole = String((payload as any).role || '');
      const privilegedRoles = new Set([
        'CMO Architect',
        'SVP Architect',
        'SVP PM',
        'SVP Engineer',
        'Director',
        'VP',
        'CIO'
      ]);
      const isOwner = userName && (originalItem.assignedTo === userName || originalItem.createdBy === userName);
      if (!isOwner && !privilegedRoles.has(userRole)) {
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

    if (newBlocks.length || removedBlocks.length) {
      const db = await getDb();
      const targets = [...newBlocks, ...removedBlocks].map((l: any) => String(l.targetId));
      const uniqueTargets = Array.from(new Set(targets));
      const targetDocs = await db.collection('workitems').find({
        $or: [
          { _id: { $in: uniqueTargets.filter(ObjectId.isValid).map((id) => new ObjectId(id)) } },
          { id: { $in: uniqueTargets } },
          { key: { $in: uniqueTargets } }
        ]
      }).toArray();
      const targetMap = new Map<string, any>();
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

    if (criticalPathAction?.type) {
      const actor = {
        userId: String((payload as any).id || (payload as any).userId || (payload as any).email || ''),
        displayName: String((payload as any).name || (payload as any).displayName || ''),
        email: (payload as any).email ? String((payload as any).email) : undefined,
        role: (payload as any).role ? String((payload as any).role) : undefined
      };
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
      const actor = {
        userId: String((payload as any).id || (payload as any).userId || (payload as any).email || ''),
        displayName: String((payload as any).name || (payload as any).displayName || ''),
        email: (payload as any).email ? String((payload as any).email) : undefined,
        role: (payload as any).role ? String((payload as any).role) : undefined
      };
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

    if (capacityOverrides.length) {
      const actor = {
        userId: String((payload as any).id || (payload as any).userId || (payload as any).email || ''),
        displayName: String((payload as any).name || (payload as any).displayName || ''),
        email: (payload as any).email ? String((payload as any).email) : undefined,
        role: (payload as any).role ? String((payload as any).role) : undefined
      };
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
            scopeType: 'MILESTONE',
            scopeId: String(entry.milestone?._id || entry.milestone?.id || entry.milestone?.name || entry.details?.milestoneId || ''),
            decisionType: 'CAPACITY_OVERRIDE',
            title: `Capacity override for ${entry.milestone?.name || entry.details?.milestoneId || 'milestone'}`,
            rationale: `Capacity override accepted for ${originalItem.key || originalItem.title || 'work item'}.`,
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
      const actor = {
        userId: String((payload as any).id || (payload as any).userId || (payload as any).email || ''),
        displayName: String((payload as any).name || (payload as any).displayName || ''),
        email: (payload as any).email ? String((payload as any).email) : undefined,
        role: (payload as any).role ? String((payload as any).role) : undefined
      };
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
      const actor = {
        userId: String((payload as any).id || (payload as any).userId || (payload as any).email || ''),
        displayName: String((payload as any).name || (payload as any).displayName || ''),
        email: (payload as any).email ? String((payload as any).email) : undefined,
        role: (payload as any).role ? String((payload as any).role) : undefined
      };
      const db = await getDb();
      await Promise.all(newBlocks.map(async (link: any) => {
        try {
          const targetId = String(link.targetId);
          const target = ObjectId.isValid(targetId)
            ? await db.collection('workitems').findOne({ _id: new ObjectId(targetId) })
            : await db.collection('workitems').findOne({ $or: [{ id: targetId }, { key: targetId }] });
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
    const cookieStore = await cookies();
    const token = cookieStore.get('nexus_auth_token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });

    const { payload } = await jwtVerify(token, JWT_SECRET);
    const item = await fetchWorkItemById(id);
    if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const userName = String(payload.name || '');
    const userRole = String((payload as any).role || '');
    const privilegedRoles = new Set([
      'CMO Architect',
      'SVP Architect',
      'SVP PM',
      'SVP Engineer',
      'Director',
      'VP',
      'CIO'
    ]);
    const isOwner = userName && (item.assignedTo === userName || item.createdBy === userName);
    if (!isOwner && !privilegedRoles.has(userRole)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const now = new Date().toISOString();
    const db = await getDb();
    await db.collection('workitems').updateOne(
      { _id: new ObjectId(id) },
      { $set: { isArchived: true, archivedAt: now, archivedBy: userName, updatedAt: now } }
    );

    try {
      await emitEvent({
        ts: now,
        type: 'workitems.item.archived',
        actor: {
          userId: String((payload as any).id || (payload as any).userId || (payload as any).email || userName),
          displayName: String((payload as any).name || (payload as any).displayName || userName),
          email: (payload as any).email ? String((payload as any).email) : undefined
        },
        resource: { type: 'workitems.item', id: String(item._id || item.id || id), title: item.title },
        context: { bundleId: item.bundleId, appId: item.applicationId }
      });
    } catch {}

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Archive failed' }, { status: 500 });
  }
}
