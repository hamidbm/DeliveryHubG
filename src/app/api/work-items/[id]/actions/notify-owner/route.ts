import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { fetchWorkItemById, emitEvent } from '../../../../../../services/db';
import { createNotificationsForEvent } from '../../../../../../services/notifications';
import { isAdminOrCmo } from '../../../../../../services/authz';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'nexus_super_secret_key_123');

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const testToken = process.env.NODE_ENV === 'test' ? (globalThis as any).__testToken : null;
    const cookieStore = testToken ? null : await cookies();
    const token = testToken || cookieStore?.get('nexus_auth_token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });

    const { payload } = await jwtVerify(token, JWT_SECRET);
    const authUser = {
      userId: String((payload as any).id || (payload as any).userId || ''),
      role: String((payload as any).role || ''),
      team: String((payload as any).team || '')
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
      userId: String((payload as any).id || (payload as any).userId || (payload as any).email || ''),
      displayName: String((payload as any).name || (payload as any).displayName || ''),
      email: (payload as any).email ? String((payload as any).email) : undefined,
      role: (payload as any).role ? String((payload as any).role) : undefined
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
