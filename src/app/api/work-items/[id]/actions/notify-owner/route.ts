import { NextResponse } from 'next/server';
import { emitEvent } from '../../../../../../shared/events/emitEvent';
import { fetchWorkItemById } from '../../../../../../server/db/repositories/workItemsRepo';
import { createNotificationsForEvent } from '../../../../../../services/notifications';
import { isAdminOrCmo } from '../../../../../../services/authz';
import { requireStandardUser } from '../../../../../../shared/auth/guards';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const auth = await requireStandardUser(request);
    if (!auth.ok) return auth.response;
    const authUser = {
      userId: auth.principal.userId,
      role: String(auth.principal.role || ''),
      team: String(auth.principal.team || '')
    };
    if (!(await isAdminOrCmo(authUser))) {
      return NextResponse.json({ error: 'FORBIDDEN_NOTIFY_OWNER' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const milestoneId = body?.milestoneId ? String(body.milestoneId) : undefined;
    const reason = body?.reason ? String(body.reason) : 'External blocker on critical path.';

    const item = await fetchWorkItemById(id);
    if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const actor = {
      userId: auth.principal.userId,
      displayName: auth.principal.fullName || auth.principal.email || 'Unknown',
      email: auth.principal.email,
      role: auth.principal.role || undefined
    };

    await createNotificationsForEvent({
      type: 'dependency.criticalpath.escalation',
      actor,
      payload: { item, milestoneId, reason }
    });

    await emitEvent({
      ts: new Date().toISOString(),
      type: 'criticalpath.action.executed',
      actor,
      resource: { type: 'workitems.workitem', id: String(item._id || item.id || id), title: item.title || item.key },
      context: { milestoneId, bundleId: item.bundleId },
      payload: { actionType: 'NOTIFY_OWNER', reason }
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to notify owners' }, { status: 500 });
  }
}
