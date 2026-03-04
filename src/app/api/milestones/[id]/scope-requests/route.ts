import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { ObjectId } from 'mongodb';
import { getDb, computeMilestoneRollup, ensureScopeChangeRequestIndexes, emitEvent } from '../../../../../services/db';
import { canEditCommittedMilestoneScope, canOverrideCapacity } from '../../../../../services/authz';
import { createNotificationsForEvent } from '../../../../../services/notifications';

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

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await getUser();
    if (!user?.userId) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });

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

    const db = await getDb();
    await ensureScopeChangeRequestIndexes(db);
    const milestone = await resolveMilestone(db, id);
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

    const result = await db.collection('scope_change_requests').insertOne(doc);

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
    const user = await getUser();
    if (!user?.userId) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });

    const db = await getDb();
    await ensureScopeChangeRequestIndexes(db);
    const milestone = await resolveMilestone(db, id);
    if (!milestone) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const statusParam = new URL(request.url).searchParams.get('status');
    const query: any = { milestoneId: String(milestone._id || milestone.id || id) };
    if (statusParam) query.status = statusParam.toUpperCase();

    const canViewAll = await canEditCommittedMilestoneScope(user, milestone);
    if (!canViewAll) {
      query.requestedBy = user.userId;
    }

    const items = await db.collection('scope_change_requests').find(query).sort({ requestedAt: -1 }).toArray();
    return NextResponse.json({ items });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to fetch scope requests' }, { status: 500 });
  }
}
