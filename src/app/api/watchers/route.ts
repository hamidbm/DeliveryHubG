import { NextResponse } from 'next/server';
import { addWatcher, removeWatcher, listWatchersByUser } from '../../../services/watchers';
import { requireStandardUser, requireUser } from '../../../shared/auth/guards';

export async function GET(request: Request) {
  try {
    const auth = await requireUser(request);
    if (!auth.ok) return auth.response;
    const { searchParams } = new URL(request.url);
    const scopeType = searchParams.get('scopeType') || undefined;
    const items = await listWatchersByUser(auth.principal.userId, scopeType as any);
    return NextResponse.json({ items });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to load watchers' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireStandardUser(request);
    if (!auth.ok) return auth.response;
    const body = await request.json();
    const scopeType = String(body?.scopeType || '').toUpperCase();
    const scopeId = String(body?.scopeId || '');
    if (!scopeType || !scopeId) return NextResponse.json({ error: 'scopeType and scopeId required' }, { status: 400 });
    await addWatcher(auth.principal.userId, scopeType as any, scopeId, auth.principal.userId);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to watch' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const auth = await requireStandardUser(request);
    if (!auth.ok) return auth.response;
    const body = await request.json();
    const scopeType = String(body?.scopeType || '').toUpperCase();
    const scopeId = String(body?.scopeId || '');
    if (!scopeType || !scopeId) return NextResponse.json({ error: 'scopeType and scopeId required' }, { status: 400 });
    await removeWatcher(auth.principal.userId, scopeType as any, scopeId);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to unwatch' }, { status: 500 });
  }
}
