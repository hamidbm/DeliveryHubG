import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { fetchAdmins, fetchUsersByIds, isAdmin, upsertAdmin } from '../../../../services/db';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'nexus_super_secret_key_123');

const getUserId = async () => {
  const cookieStore = await cookies();
  const token = cookieStore.get('nexus_auth_token')?.value;
  if (!token) return null;
  const { payload } = await jwtVerify(token, JWT_SECRET);
  return String(payload.id || payload.userId || '');
};

const requireAdmin = async () => {
  const userId = await getUserId();
  if (!userId) return { ok: false, status: 401, userId: null };
  const allowed = await isAdmin(userId);
  if (!allowed) return { ok: false, status: 403, userId };
  return { ok: true, status: 200, userId };
};

export async function GET() {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: auth.status });
    const admins = await fetchAdmins();
    const userIds = admins.map((a: any) => String(a.userId));
    const users = await fetchUsersByIds(userIds);
    const userMap = new Map(users.map((u: any) => [String(u._id || u.id), u]));
    const payload = admins.map((a: any) => ({
      ...a,
      user: userMap.get(String(a.userId)) || null
    }));
    return NextResponse.json(payload);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to fetch admins' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: auth.status });
    const body = await request.json();
    if (!body?.userId) return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    const result = await upsertAdmin(String(body.userId), auth.userId || 'system');
    return NextResponse.json({ success: true, result });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to add admin' }, { status: 500 });
  }
}
