import { NextResponse } from 'next/server';
import { getAuthUserFromCookies } from '../../../../../services/visibility';
import { deleteInvestigation, updateInvestigation } from '../../../../../services/ai/investigationService';

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
  if (typeof body?.pinned !== 'boolean') {
    return NextResponse.json({ error: 'pinned boolean is required' }, { status: 400 });
  }

  const item = await updateInvestigation(userId, String(id), { pinned: Boolean(body.pinned) });
  if (!item) return NextResponse.json({ error: 'Investigation not found' }, { status: 404 });
  return NextResponse.json({ status: 'success', item });
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const authUser = await getAuthUserFromCookies();
  const userId = String(authUser?.userId || '');
  if (!userId) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  const { id } = await context.params;
  const ok = await deleteInvestigation(userId, String(id));
  if (!ok) return NextResponse.json({ error: 'Investigation not found' }, { status: 404 });
  return NextResponse.json({ status: 'success' });
}
