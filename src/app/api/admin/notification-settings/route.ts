import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { isAdminOrCmo } from '../../../../services/authz';
import { getNotificationSettings, saveNotificationSettings } from '../../../../services/notifications';

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

const requireAdmin = async () => {
  const user = await getUser();
  if (!user?.userId) return { ok: false, status: 401, user: null };
  const allowed = await isAdminOrCmo(user);
  if (!allowed) return { ok: false, status: 403, user };
  return { ok: true, status: 200, user };
};

export async function GET() {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return NextResponse.json({ error: 'Forbidden', code: 'ADMIN_ONLY' }, { status: auth.status });
    const settings = await getNotificationSettings();
    return NextResponse.json({ settings });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to fetch notification settings' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return NextResponse.json({ error: 'Forbidden', code: 'ADMIN_ONLY' }, { status: auth.status });
    const body = await request.json();
    const settings = await saveNotificationSettings(body, auth.user?.userId || 'system');
    return NextResponse.json({ settings });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to update notification settings' }, { status: 500 });
  }
}
