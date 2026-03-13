import { NextResponse } from 'next/server';
import { getAuthUserFromCookies } from '../../../../../services/visibility';
import { deleteWatcherForUser, updateWatcherForUser } from '../../../../../services/ai/notificationEngine';

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

  const ok = await updateWatcherForUser(userId, String(id), {
    enabled: typeof body?.enabled === 'boolean' ? body.enabled : undefined,
    targetId: typeof body?.targetId === 'string' ? body.targetId : undefined,
    condition: body?.condition && typeof body.condition === 'object' ? body.condition : undefined
  });

  if (!ok) return NextResponse.json({ error: 'Watcher not found or no changes applied' }, { status: 404 });
  return NextResponse.json({ status: 'success' });
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const authUser = await getAuthUserFromCookies();
  const userId = String(authUser?.userId || '');
  if (!userId) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });

  const { id } = await context.params;
  const ok = await deleteWatcherForUser(userId, String(id));
  if (!ok) return NextResponse.json({ error: 'Watcher not found' }, { status: 404 });
  return NextResponse.json({ status: 'success' });
}
