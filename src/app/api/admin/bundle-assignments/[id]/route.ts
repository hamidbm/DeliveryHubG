import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { isAdmin, updateBundleAssignment } from '../../../../../services/db';

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

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: auth.status });
    const { id } = await params;
    const body = await request.json();
    const result = await updateBundleAssignment(id, body, auth.userId || undefined);
    return NextResponse.json({ success: true, result });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to update bundle assignment' }, { status: 500 });
  }
}
