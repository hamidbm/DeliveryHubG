import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { addWatcher, removeWatcher, listWatchersByUser } from '../../../services/watchers';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'nexus_super_secret_key_123');

const getUser = async () => {
  const testToken = process.env.NODE_ENV === 'test' ? (globalThis as any).__testToken : null;
  const cookieStore = testToken ? null : await cookies();
  const token = testToken || cookieStore?.get('nexus_auth_token')?.value;
  if (!token) return null;
  const { payload } = await jwtVerify(token, JWT_SECRET);
  return {
    userId: String(payload.id || payload.userId || ''),
    role: payload.role ? String(payload.role) : undefined,
    email: payload.email ? String(payload.email) : undefined
  };
};

export async function GET(request: Request) {
  try {
    const user = await getUser();
    if (!user?.userId) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
    const { searchParams } = new URL(request.url);
    const scopeType = searchParams.get('scopeType') || undefined;
    const items = await listWatchersByUser(user.userId, scopeType as any);
    return NextResponse.json({ items });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to load watchers' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getUser();
    if (!user?.userId) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
    const body = await request.json();
    const scopeType = String(body?.scopeType || '').toUpperCase();
    const scopeId = String(body?.scopeId || '');
    if (!scopeType || !scopeId) return NextResponse.json({ error: 'scopeType and scopeId required' }, { status: 400 });
    await addWatcher(user.userId, scopeType as any, scopeId, user.userId);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to watch' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await getUser();
    if (!user?.userId) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
    const body = await request.json();
    const scopeType = String(body?.scopeType || '').toUpperCase();
    const scopeId = String(body?.scopeId || '');
    if (!scopeType || !scopeId) return NextResponse.json({ error: 'scopeType and scopeId required' }, { status: 400 });
    await removeWatcher(user.userId, scopeType as any, scopeId);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to unwatch' }, { status: 500 });
  }
}
