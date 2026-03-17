import { NextResponse } from 'next/server';
import { emitEvent } from '../../../../shared/events/emitEvent';
import { computeSprintRollups } from '../../../../services/rollupAnalytics';
import { canManageSprints } from '../../../../services/authz';
import { evaluateSprintReadiness } from '../../../../services/sprintGovernance';
import { getDeliveryPolicy, getEffectivePolicyForBundle } from '../../../../services/policy';
import { createNotificationsForEvent } from '../../../../services/notifications';
import { requireStandardUser } from '../../../../shared/auth/guards';
import { getSprintByRef, updateSprintRecordByRef } from '../../../../server/db/repositories/milestonesRepo';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const auth = await requireStandardUser(request);
    if (!auth.ok) return auth.response;
    const user = {
      userId: auth.principal.userId,
      role: auth.principal.role || undefined,
      email: auth.principal.email,
      name: auth.principal.fullName || undefined,
      accountType: auth.principal.accountType
    };
    if (!(await canManageSprints(user))) return NextResponse.json({ error: 'FORBIDDEN_SPRINT_STATUS' }, { status: 403 });

    const body = await request.json();
    const nextStatus = body?.status ? String(body.status).toUpperCase() : undefined;
    const allowOverride = Boolean(body?.allowOverride);
    const overrideReason = body?.overrideReason ? String(body.overrideReason) : '';

    const sprint = await getSprintByRef(id);
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

    await updateSprintRecordByRef(id, update);
    const updated = await getSprintByRef(id);

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
