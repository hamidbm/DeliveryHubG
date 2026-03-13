import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { isAdminOrCmo } from '../../../../../../services/authz';
import { dispatchNotification } from '../../../../../../services/ai/notificationDispatcher';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'nexus_super_secret_key_123');

const getUser = async () => {
  const cookieStore = await cookies();
  const token = cookieStore.get('nexus_auth_token')?.value;
  if (!token) return null;
  const { payload } = await jwtVerify(token, JWT_SECRET);
  return {
    userId: String(payload.id || payload.userId || ''),
    role: payload.role ? String(payload.role) : undefined,
    email: payload.email ? String(payload.email) : undefined
  };
};

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await getUser();
    if (!user?.userId) {
      return NextResponse.json({ error: 'Unauthenticated', code: 'UNAUTHENTICATED' }, { status: 401 });
    }
    const allowed = await isAdminOrCmo(user);
    if (!allowed) {
      return NextResponse.json({ error: 'Forbidden', code: 'ADMIN_ONLY' }, { status: 403 });
    }

    const { id } = await context.params;
    await dispatchNotification(String(id), { forceDeliver: true });
    return NextResponse.json({ status: 'success' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Force delivery failed' }, { status: 500 });
  }
}
