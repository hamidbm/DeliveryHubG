import { NextResponse } from 'next/server';
import { isAdminOrCmo } from '../../../../../../services/authz';
import { dispatchNotification } from '../../../../../../services/ai/notificationDispatcher';
import { requireStandardUser } from '../../../../../../shared/auth/guards';

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireStandardUser();
    if (!auth.ok) return auth.response;
    const allowed = await isAdminOrCmo({ userId: auth.principal.userId, role: auth.principal.role || undefined, email: auth.principal.email });
    if (!allowed) {
      return NextResponse.json({ error: 'Forbidden', code: 'ADMIN_ONLY' }, { status: 403 });
    }

    const { id } = await context.params;
    await dispatchNotification(String(id), { forceDeliver: true });
    return NextResponse.json({ status: 'success' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Force delivery failed' }, { status: 500 });
  }
}
