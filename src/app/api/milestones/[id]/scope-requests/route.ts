import { NextResponse } from 'next/server';
import { emitEvent } from '../../../../../shared/events/emitEvent';
import { computeMilestoneRollup } from '../../../../../services/rollupAnalytics';
import { canEditCommittedMilestoneScope, canOverrideCapacity } from '../../../../../services/authz';
import { createNotificationsForEvent } from '../../../../../services/notifications';
import { requireStandardUser, requireUser } from '../../../../../shared/auth/guards';
import { getMilestoneByRef } from '../../../../../server/db/repositories/milestonesRepo';
import {
  insertScopeChangeRequestRecord,
  listScopeChangeRequestRecords
} from '../../../../../server/db/repositories/scopeRequestsRepo';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
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
    const action = body?.action;
    const workItemIds = Array.isArray(body?.workItemIds) ? body.workItemIds.map(String).filter(Boolean) : [];
    const allowOverCapacity = Boolean(body?.allowOverCapacity);

    if (!action || !['ADD_ITEMS', 'REMOVE_ITEMS'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
    if (!workItemIds.length) {
      return NextResponse.json({ error: 'Missing workItemIds' }, { status: 400 });
    }

    const milestone = await getMilestoneByRef(id);
    if (!milestone) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const status = String(milestone.status || '').toUpperCase();
    if (status !== 'COMMITTED') {
      return NextResponse.json({ error: 'MILESTONE_NOT_COMMITTED' }, { status: 409 });
    }

    if (allowOverCapacity && !(await canOverrideCapacity(user))) {
      return NextResponse.json({ error: 'FORBIDDEN_CAPACITY_OVERRIDE' }, { status: 403 });
    }

    const rollup = await computeMilestoneRollup(String(milestone._id || milestone.id || id));
    const before = {
      committedPoints: rollup?.capacity?.committedPoints || 0,
      targetCapacity: typeof milestone.targetCapacity === 'number' ? milestone.targetCapacity : undefined
    };

    const now = new Date().toISOString();
    const doc = {
      milestoneId: String(milestone._id || milestone.id || id),
      action,
      workItemIds,
      requestedBy: user.userId,
      requestedAt: now,
      status: 'PENDING',
      allowOverCapacity: allowOverCapacity || undefined,
      before
    };

    const result = await insertScopeChangeRequestRecord(doc);

    const actor = { userId: user.userId, displayName: user.name, email: user.email, role: user.role };
    try {
      await emitEvent({
        ts: now,
        type: 'milestones.scope.requested',
        actor,
        resource: { type: 'milestones.milestone', id: String(milestone._id || milestone.id || id), title: milestone.name || milestone.id || id },
        context: { bundleId: milestone.bundleId },
        payload: { requestId: String(result.insertedId), action, workItemIds }
      });
    } catch {}

    try {
      await createNotificationsForEvent({
        type: 'milestone.scope.requested',
        actor,
        payload: { milestone, requester: { userId: user.userId, name: user.name, email: user.email } }
      });
    } catch {}

    return NextResponse.json({ request: { _id: result.insertedId, ...doc } });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to create scope request' }, { status: 500 });
  }
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const auth = await requireUser(request);
    if (!auth.ok) return auth.response;
    const user = {
      userId: auth.principal.userId,
      role: String(auth.principal.role || ''),
      email: auth.principal.email,
      name: auth.principal.fullName,
      accountType: auth.principal.accountType
    };

    const milestone = await getMilestoneByRef(id);
    if (!milestone) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const statusParam = new URL(request.url).searchParams.get('status');
    const query: any = { milestoneId: String(milestone._id || milestone.id || id) };
    if (statusParam) query.status = statusParam.toUpperCase();

    const canViewAll = await canEditCommittedMilestoneScope(user, milestone);
    if (!canViewAll) {
      query.requestedBy = user.userId;
    }

    const items = await listScopeChangeRequestRecords(query);
    return NextResponse.json({ items });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to fetch scope requests' }, { status: 500 });
  }
}
