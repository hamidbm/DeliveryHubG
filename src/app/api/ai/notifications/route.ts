import { NextResponse } from 'next/server';
import { getAuthUserFromCookies } from '../../../../services/visibility';
import { listNotificationsForUser } from '../../../../services/ai/notificationEngine';

export async function GET() {
  const authUser = await getAuthUserFromCookies();
  const userId = String(authUser?.userId || '');
  if (!userId) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });

  const notifications = await listNotificationsForUser(userId);
  return NextResponse.json({ status: 'success', notifications });
}
