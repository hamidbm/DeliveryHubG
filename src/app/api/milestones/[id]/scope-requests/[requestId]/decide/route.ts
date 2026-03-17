import { NextResponse } from 'next/server';
import { emitEvent } from '../../../../../../../shared/events/emitEvent';
import { fetchUsersByIds } from '../../../../../../../services/userDirectory';
import { computeMilestoneRollup } from '../../../../../../../services/rollupAnalytics';
import { canOverrideCapacity, isAdminOrCmo } from '../../../../../../../services/authz';
import { evaluateCapacity } from '../../../../../../../services/milestoneGovernance';
import { createNotificationsForEvent } from '../../../../../../../services/notifications';
import { createDecision } from '../../../../../../../services/decisionLog';
import { requireStandardUser } from '../../../../../../../shared/auth/guards';
import { getMilestoneByRef } from '../../../../../../../server/db/repositories/milestonesRepo';
import {
  getScopeChangeRequestByRef,
  updateScopeChangeRequestRecord
} from '../../../../../../../server/db/repositories/scopeRequestsRepo';
import {
  listWorkItemsByAnyRefs,
  updateWorkItemsMilestoneAssignment
} from '../../../../../../../server/db/repositories/workItemsRepo';

export async function POST(request: Request, { params }: { params: Promise<{ id: string; requestId: string }> }) {
  try {
    const { id, requestId } = await params;
    const auth = await requireStandardUser(request);
    if (!auth.ok) return auth.response;
    const user = {
      userId: auth.principal.userId,
      role: String(auth.principal.role || ''),
      email: auth.principal.email,
      name: auth.principal.fullName,
      accountType: auth.principal.accountType
    };

    const body = await request.json();
    const decision = String(body?.decision || '').toUpperCase();
    const reason = body?.reason ? String(body.reason) : undefined;
    if (!['APPROVE', 'REJECT', 'CANCEL'].includes(decision)) {
      return NextResponse.json({ error: 'Invalid decision' }, { status: 400 });
    }
    if ((decision === 'APPROVE' || decision === 'REJECT') && !reason?.trim()) {
      return NextResponse.json({ error: 'DECISION_REASON_REQUIRED' }, { status: 400 });
    }

    const milestone = await getMilestoneByRef(id);
    if (!milestone) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const scopeRequest = await getScopeChangeRequestByRef(requestId);
    if (!scopeRequest) return NextResponse.json({ error: 'Request not found' }, { status: 404 });

    if (decision === 'CANCEL') {
      if (String(scopeRequest.requestedBy) !== String(user.userId)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    } else {
      if (!(await isAdminOrCmo(user))) {
        return NextResponse.json({ error: 'FORBIDDEN_SCOPE_DECISION' }, { status: 403 });
      }
    }

    if (scopeRequest.status !== 'PENDING') {
      return NextResponse.json({ error: 'REQUEST_NOT_PENDING' }, { status: 409 });
    }

    const now = new Date().toISOString();
    const requesterUser = scopeRequest.requestedBy
      ? (await fetchUsersByIds([String(scopeRequest.requestedBy)])).find(Boolean)
      : null;
    const requester = requesterUser ? { userId: String(requesterUser._id), name: requesterUser.name, email: requesterUser.email } : { userId: scopeRequest.requestedBy };

    if (decision === 'REJECT' || decision === 'CANCEL') {
      const status = decision === 'REJECT' ? 'REJECTED' : 'CANCELLED';
      await updateScopeChangeRequestRecord(String(scopeRequest._id), {
        status,
        decidedBy: user.userId,
        decidedAt: now,
        decisionReason: reason
      });

      const actor = { userId: user.userId, displayName: user.name, email: user.email, role: user.role };
      const eventType = status === 'REJECTED' ? 'milestones.scope.rejected' : 'milestones.scope.cancelled';
      try {
        await emitEvent({
          ts: now,
          type: eventType,
          actor,
          resource: { type: 'milestones.milestone', id: String(milestone._id || milestone.id || id), title: milestone.name || milestone.id || id },
          context: { bundleId: milestone.bundleId },
          payload: { requestId: String(scopeRequest._id), reason }
        });
      } catch {}

      try {
        await createNotificationsForEvent({
          type: status === 'REJECTED' ? 'milestone.scope.rejected' : 'milestone.scope.cancelled',
          actor,
          payload: { milestone, requester }
        });
      } catch {}

      if (status === 'REJECTED') {
        try {
          await createDecision({
            createdAt: now,
            createdBy: { userId: user.userId, email: user.email || '', name: user.name },
            source: 'AUTO',
            scopeType: 'MILESTONE',
            scopeId: String(milestone._id || milestone.id || id),
            decisionType: 'SCOPE_APPROVAL',
            title: `Scope change rejected for ${milestone.name || milestone.id || id}`,
            rationale: reason || 'Scope change rejected.',
            outcome: 'REJECTED',
            severity: 'warn',
            related: {
              milestoneId: String(milestone._id || milestone.id || id),
              bundleId: milestone.bundleId ? String(milestone.bundleId) : undefined,
              scopeRequestId: String(scopeRequest._id),
              workItemIds: Array.isArray(scopeRequest.workItemIds) ? scopeRequest.workItemIds.map(String) : []
            }
          });
        } catch {}
      }
      if (status === 'CANCELLED') {
        try {
          await createDecision({
            createdAt: now,
            createdBy: { userId: user.userId, email: user.email || '', name: user.name },
            source: 'AUTO',
            scopeType: 'MILESTONE',
            scopeId: String(milestone._id || milestone.id || id),
            decisionType: 'SCOPE_APPROVAL',
            title: `Scope change cancelled for ${milestone.name || milestone.id || id}`,
            rationale: reason || 'Scope change cancelled by requester.',
            outcome: 'ACKNOWLEDGED',
            severity: 'info',
            related: {
              milestoneId: String(milestone._id || milestone.id || id),
              bundleId: milestone.bundleId ? String(milestone.bundleId) : undefined,
              scopeRequestId: String(scopeRequest._id),
              workItemIds: Array.isArray(scopeRequest.workItemIds) ? scopeRequest.workItemIds.map(String) : []
            }
          });
        } catch {}
      }

      return NextResponse.json({ request: { ...scopeRequest, status, decidedBy: user.userId, decidedAt: now, decisionReason: reason } });
    }

    if (scopeRequest.allowOverCapacity && !(await canOverrideCapacity(user))) {
      return NextResponse.json({ error: 'FORBIDDEN_CAPACITY_OVERRIDE' }, { status: 403 });
    }

    const milestoneId = String(milestone._id || milestone.id || id);
    const workItemIds = Array.isArray(scopeRequest.workItemIds) ? scopeRequest.workItemIds.map(String) : [];
    const items = await listWorkItemsByAnyRefs(workItemIds);

    const rollup = await computeMilestoneRollup(milestoneId);
    const targetCapacity = typeof milestone.targetCapacity === 'number' ? milestone.targetCapacity : undefined;

    if (scopeRequest.action === 'ADD_ITEMS') {
      let incomingPointsTotal = 0;
      let existingPointsAssigned = 0;
      let missingEstimate = false;
      items.forEach((item: any) => {
        const alreadyAssigned = Array.isArray(item.milestoneIds) && item.milestoneIds.map(String).includes(milestoneId);
        const incomingPoints = typeof item.storyPoints === 'number' ? item.storyPoints : 0;
        if (!alreadyAssigned) {
          if (!Number.isFinite(incomingPoints) || incomingPoints <= 0) missingEstimate = true;
          incomingPointsTotal += incomingPoints;
        } else {
          existingPointsAssigned += incomingPoints;
        }
      });

      if (missingEstimate) {
        return NextResponse.json({ error: 'MISSING_ESTIMATE', message: 'Committed milestones require story point estimates.' }, { status: 409 });
      }

      const capacityResult = evaluateCapacity({
        milestoneId,
        isCommitted: true,
        targetCapacity,
        committedPoints: rollup?.capacity?.committedPoints || 0,
        incomingPoints: incomingPointsTotal,
        existingPoints: existingPointsAssigned,
        allowOverCapacity: Boolean(scopeRequest.allowOverCapacity)
      });

      if (!capacityResult.ok && capacityResult.error) {
        return NextResponse.json({
          error: capacityResult.error.code,
          message: capacityResult.error.message,
          details: capacityResult.error.details
        }, { status: 409 });
      }
    }

    await updateWorkItemsMilestoneAssignment({
      workItemRefs: workItemIds,
      milestoneId,
      action: scopeRequest.action === 'ADD_ITEMS' ? 'ADD_ITEMS' : 'REMOVE_ITEMS',
      updatedAt: now
    });

    const afterRollup = await computeMilestoneRollup(milestoneId);
    const afterSnapshot = {
      committedPoints: afterRollup?.capacity?.committedPoints || 0,
      targetCapacity
    };

    await updateScopeChangeRequestRecord(String(scopeRequest._id), {
      status: 'APPROVED',
      decidedBy: user.userId,
      decidedAt: now,
      decisionReason: reason,
      after: afterSnapshot
    });

    const actor = { userId: user.userId, displayName: user.name, email: user.email, role: user.role };
    try {
      await emitEvent({
        ts: now,
        type: 'milestones.scope.approved',
        actor,
        resource: { type: 'milestones.milestone', id: String(milestone._id || milestone.id || id), title: milestone.name || milestone.id || id },
        context: { bundleId: milestone.bundleId },
        payload: { requestId: String(scopeRequest._id), action: scopeRequest.action, workItemIds }
      });
    } catch {}

    try {
      await createNotificationsForEvent({
        type: 'milestone.scope.approved',
        actor,
        payload: { milestone, requester }
      });
    } catch {}

    try {
      await createDecision({
        createdAt: now,
        createdBy: { userId: user.userId, email: user.email || '', name: user.name },
        source: 'AUTO',
        scopeType: 'MILESTONE',
        scopeId: String(milestone._id || milestone.id || id),
        decisionType: 'SCOPE_APPROVAL',
        title: `Scope change approved for ${milestone.name || milestone.id || id}`,
        rationale: reason || 'Scope change approved.',
        outcome: 'APPROVED',
        severity: 'info',
        related: {
          milestoneId: String(milestone._id || milestone.id || id),
          bundleId: milestone.bundleId ? String(milestone.bundleId) : undefined,
          scopeRequestId: String(scopeRequest._id),
          workItemIds
        }
      });
    } catch {}

    return NextResponse.json({ request: { ...scopeRequest, status: 'APPROVED', decidedBy: user.userId, decidedAt: now, decisionReason: reason, after: afterSnapshot } });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to decide scope request' }, { status: 500 });
  }
}
