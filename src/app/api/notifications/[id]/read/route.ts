
import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '../../../../../shared/auth/guards';
import { markUnifiedNotificationReadForPrincipal } from '../../../../../server/db/repositories/notificationsRepo';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireUser(request);
    if (!auth.ok) return auth.response;
    const { id } = await params;
    let read = true;
    try {
      const body = await request.json();
      if (typeof body?.read === 'boolean') read = body.read;
    } catch {}
    const ok = await markUnifiedNotificationReadForPrincipal(auth.principal, id, read);
    if (!ok) return NextResponse.json({ error: 'Notification not found' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update notification' }, { status: 500 });
  }
}
