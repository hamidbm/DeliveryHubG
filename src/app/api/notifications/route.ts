
import { NextResponse } from 'next/server';
import { requireUser } from '../../../shared/auth/guards';
import { listUnifiedNotificationsForPrincipal } from '../../../server/db/repositories/notificationsRepo';

export async function GET(request: Request) {
  try {
    const auth = await requireUser(request);
    if (!auth.ok) return auth.response;
    const notifications = await listUnifiedNotificationsForPrincipal(auth.principal);
    
    return NextResponse.json(notifications);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch notifications' }, { status: 500 });
  }
}
