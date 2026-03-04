import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { getNotificationSettings, getUserNotificationPrefs, saveUserNotificationPrefs } from '../../../../services/notifications';

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

export async function GET() {
  try {
    const user = await getUser();
    if (!user?.userId) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
    const prefs = await getUserNotificationPrefs(user.userId);
    const settings = await getNotificationSettings();
    const availableTypes = Object.keys(settings.enabledTypes || {}).sort();
    return NextResponse.json({ prefs, availableTypes });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to fetch notification preferences' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const user = await getUser();
    if (!user?.userId) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
    const body = await request.json();
    const prefs = await saveUserNotificationPrefs(user.userId, body || {});
    return NextResponse.json({ prefs });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to update notification preferences' }, { status: 500 });
  }
}
