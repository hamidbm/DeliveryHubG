import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { listWatchersForScope, canViewScopeWatchers } from '../../../../services/watchers';

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
    const scopeType = String(searchParams.get('scopeType') || '').toUpperCase();
    const scopeId = String(searchParams.get('scopeId') || '');
    if (!scopeType || !scopeId) return NextResponse.json({ error: 'scopeType and scopeId required' }, { status: 400 });
    const allowed = await canViewScopeWatchers(scopeType as any, scopeId, user);
    if (!allowed) return NextResponse.json({ error: 'Forbidden', code: 'ADMIN_ONLY' }, { status: 403 });
    const items = await listWatchersForScope(scopeType as any, scopeId);
    return NextResponse.json({ items });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to load watchers' }, { status: 500 });
  }
}
