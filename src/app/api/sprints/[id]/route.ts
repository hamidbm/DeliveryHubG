import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { ObjectId } from 'mongodb';
import { getDb, computeSprintRollups, emitEvent } from '../../../../services/db';
import { canManageSprints } from '../../../../services/authz';
import { evaluateSprintReadiness } from '../../../../services/sprintGovernance';
import { getDeliveryPolicy, getEffectivePolicyForBundle } from '../../../../services/policy';
import { createNotificationsForEvent } from '../../../../services/notifications';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'nexus_super_secret_key_123');

const getUser = async () => {
  const testToken = process.env.NODE_ENV === 'test' ? (globalThis as any).__testToken : null;
  const cookieStore = testToken ? null : await cookies();
  const token = testToken || cookieStore?.get('nexus_auth_token')?.value;
  if (!token) return null;
  const { payload } = await jwtVerify(token, JWT_SECRET);
  return {
    userId: String(payload.id || payload.userId || ''),
    role: payload.role ? String(payload.role) : undefined,
    email: payload.email ? String(payload.email) : undefined,
    name: payload.name ? String(payload.name) : undefined
  };
};

const findSprint = async (db: any, id: string) => {
  if (ObjectId.isValid(id)) {
    return await db.collection('workitems_sprints').findOne({ _id: new ObjectId(id) });
  }
  return await db.collection('workitems_sprints').findOne({ $or: [{ id }, { name: id }] });
};

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await getUser();
    if (!user?.userId) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
    if (!(await canManageSprints(user))) return NextResponse.json({ error: 'FORBIDDEN_SPRINT_STATUS' }, { status: 403 });

    const body = await request.json();
    const nextStatus = body?.status ? String(body.status).toUpperCase() : undefined;
    const allowOverride = Boolean(body?.allowOverride);
    const overrideReason = body?.overrideReason ? String(body.overrideReason) : '';

    const db = await getDb();
    const sprint = await findSprint(db, id);
    if (!sprint) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const currentStatus = String(sprint.status || 'DRAFT').toUpperCase();
    if (!nextStatus) return NextResponse.json({ error: 'Missing status' }, { status: 400 });

    const validTransition = (from: string, to: string) => {
      if (from === 'DRAFT' && to === 'ACTIVE') return true;
      if (from === 'ACTIVE' && to === 'CLOSED') return true;
      if (from === 'CLOSED' && to === 'ARCHIVED') return true;
      return false;
    };

    if (!validTransition(currentStatus, nextStatus)) {
      return NextResponse.json({ error: 'INVALID_SPRINT_TRANSITION' }, { status: 400 });
    }

    let rollup = null;
    let readiness: any = null;

    if (currentStatus === 'ACTIVE' && nextStatus === 'CLOSED') {
      const rollups = await computeSprintRollups({ sprintIds: [String(sprint._id || sprint.id || sprint.name)] });
      rollup = rollups[0] || null;
      const policyRef = sprint.bundleId ? await getEffectivePolicyForBundle(String(sprint.bundleId)) : { effective: await getDeliveryPolicy() };
      readiness = await evaluateSprintReadiness(rollup, policyRef.effective);
      if (!readiness.canClose && !allowOverride) {
        try {
          await createNotificationsForEvent({
            type: 'sprint.close.blocked',
            actor: { userId: user.userId, displayName: user.name, email: user.email, role: user.role },
            payload: { sprint, readiness }
          });
        } catch {}
        return NextResponse.json({ error: 'SPRINT_CLOSE_BLOCKED', readiness, rollup }, { status: 409 });
      }
      if (allowOverride && !overrideReason) {
        return NextResponse.json({ error: 'OVERRIDE_REASON_REQUIRED' }, { status: 400 });
      }
    }

    const now = new Date().toISOString();
    const update: any = { status: nextStatus, updatedAt: now, updatedBy: user.userId };
    if (nextStatus === 'ACTIVE') update.startedAt = now;
    if (nextStatus === 'CLOSED') update.closedAt = now;
    if (allowOverride && overrideReason) update.overrideReason = overrideReason;

    await db.collection('workitems_sprints').updateOne({ _id: sprint._id }, { $set: update });
    const updated = await findSprint(db, id);

    const actor = { userId: user.userId, displayName: user.name, email: user.email, role: user.role };
    try {
      await emitEvent({
        ts: now,
        type: 'sprints.sprint.statuschanged',
        actor,
        resource: { type: 'sprints.sprint', id: String(sprint._id || sprint.id || id), title: sprint.name || sprint.id || id },
        payload: { from: currentStatus, to: nextStatus, sprintId: String(sprint._id || sprint.id || id) }
      });
      if (allowOverride && overrideReason) {
        await emitEvent({
          ts: now,
          type: 'sprints.sprint.override',
          actor,
          resource: { type: 'sprints.sprint', id: String(sprint._id || sprint.id || id), title: sprint.name || sprint.id || id },
          payload: { from: currentStatus, to: nextStatus, overrideReason, readiness }
        });
      }
    } catch {}

    try {
      await createNotificationsForEvent({
        type: 'sprint.status.changed',
        actor,
        payload: { sprint: updated || sprint, from: currentStatus, to: nextStatus }
      });
    } catch {}

    return NextResponse.json({ sprint: updated || sprint, rollup, readiness });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to update sprint' }, { status: 500 });
  }
}
