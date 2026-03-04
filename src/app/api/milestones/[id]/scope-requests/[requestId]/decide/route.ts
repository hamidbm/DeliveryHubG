import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { ObjectId } from 'mongodb';
import { getDb, computeMilestoneRollup, ensureScopeChangeRequestIndexes, emitEvent, fetchUsersByIds } from '../../../../../../../services/db';
import { canOverrideCapacity, isAdminOrCmo } from '../../../../../../../services/authz';
import { evaluateCapacity } from '../../../../../../../services/milestoneGovernance';
import { createNotificationsForEvent } from '../../../../../../../services/notifications';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'nexus_super_secret_key_123');

const getUser = async () => {
  const testToken = process.env.NODE_ENV === 'test' ? (globalThis as any).__testToken : null;
  const cookieStore = testToken ? null : await cookies();
  const token = testToken || cookieStore?.get('nexus_auth_token')?.value;
  if (!token) return null;
  const { payload } = await jwtVerify(token, JWT_SECRET);
  return {
    userId: String((payload as any).id || (payload as any).userId || ''),
    role: String((payload as any).role || ''),
    email: (payload as any).email ? String((payload as any).email) : undefined,
    name: (payload as any).name ? String((payload as any).name) : undefined
  };
};

const resolveMilestone = async (db: any, id: string) => {
  if (ObjectId.isValid(id)) {
    return await db.collection('milestones').findOne({ _id: new ObjectId(id) });
  }
  return await db.collection('milestones').findOne({ $or: [{ id }, { name: id }] });
};

export async function POST(request: Request, { params }: { params: Promise<{ id: string; requestId: string }> }) {
  try {
    const { id, requestId } = await params;
    const user = await getUser();
    if (!user?.userId) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });

    const body = await request.json();
    const decision = String(body?.decision || '').toUpperCase();
    const reason = body?.reason ? String(body.reason) : undefined;
    if (!['APPROVE', 'REJECT', 'CANCEL'].includes(decision)) {
      return NextResponse.json({ error: 'Invalid decision' }, { status: 400 });
    }

    const db = await getDb();
    await ensureScopeChangeRequestIndexes(db);
    const milestone = await resolveMilestone(db, id);
    if (!milestone) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const scopeRequest = ObjectId.isValid(requestId)
      ? await db.collection('scope_change_requests').findOne({ _id: new ObjectId(requestId) })
      : await db.collection('scope_change_requests').findOne({ _id: requestId as any });
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
      await db.collection('scope_change_requests').updateOne(
        { _id: scopeRequest._id },
        { $set: { status, decidedBy: user.userId, decidedAt: now, decisionReason: reason } }
      );

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

      return NextResponse.json({ request: { ...scopeRequest, status, decidedBy: user.userId, decidedAt: now, decisionReason: reason } });
    }

    if (scopeRequest.allowOverCapacity && !(await canOverrideCapacity(user))) {
      return NextResponse.json({ error: 'FORBIDDEN_CAPACITY_OVERRIDE' }, { status: 403 });
    }

    const milestoneId = String(milestone._id || milestone.id || id);
    const workItemIds = Array.isArray(scopeRequest.workItemIds) ? scopeRequest.workItemIds.map(String) : [];
    const objectIds = workItemIds.filter(ObjectId.isValid).map((itemId) => new ObjectId(itemId));
    const items = await db.collection('workitems').find({
      $or: [
        { _id: { $in: objectIds } },
        { id: { $in: workItemIds } },
        { key: { $in: workItemIds } }
      ]
    }).toArray();

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

    const updateFilter = {
      $or: [
        { _id: { $in: objectIds } },
        { id: { $in: workItemIds } },
        { key: { $in: workItemIds } }
      ]
    };
    if (scopeRequest.action === 'ADD_ITEMS') {
      await db.collection('workitems').updateMany(
        updateFilter,
        { $addToSet: { milestoneIds: milestoneId }, $set: { updatedAt: now } }
      );
    } else {
      await db.collection('workitems').updateMany(
        updateFilter,
        { $pull: { milestoneIds: milestoneId }, $set: { updatedAt: now }, $unset: { milestoneId: '' } } as any
      );
    }

    const afterRollup = await computeMilestoneRollup(milestoneId);
    const afterSnapshot = {
      committedPoints: afterRollup?.capacity?.committedPoints || 0,
      targetCapacity
    };

    await db.collection('scope_change_requests').updateOne(
      { _id: scopeRequest._id },
      { $set: { status: 'APPROVED', decidedBy: user.userId, decidedAt: now, decisionReason: reason, after: afterSnapshot } }
    );

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

    return NextResponse.json({ request: { ...scopeRequest, status: 'APPROVED', decidedBy: user.userId, decidedAt: now, decisionReason: reason, after: afterSnapshot } });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to decide scope request' }, { status: 500 });
  }
}
