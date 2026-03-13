import { NextResponse } from 'next/server';
import { getAuthUserFromCookies } from '../../../../../services/visibility';
import { updateNotificationReadState } from '../../../../../services/ai/notificationEngine';

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const authUser = await getAuthUserFromCookies();
  const userId = String(authUser?.userId || '');
  if (!userId) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });

  const { id } = await context.params;
  let body: any = null;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (typeof body?.read !== 'boolean') {
    return NextResponse.json({ error: 'read boolean is required' }, { status: 400 });
  }

  const ok = await updateNotificationReadState(userId, String(id), body.read);
  if (!ok) return NextResponse.json({ error: 'Notification not found' }, { status: 404 });

  return NextResponse.json({ status: 'success' });
}
