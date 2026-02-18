import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { fetchBundleAssignments, isAdmin, upsertBundleAssignment } from '../../../../services/db';
import { AssignmentType } from '../../../../types';

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

export async function GET(request: Request) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: auth.status });
    const { searchParams } = new URL(request.url);
    const bundleId = searchParams.get('bundleId') || undefined;
    const userId = searchParams.get('userId') || undefined;
    const assignmentType = (searchParams.get('type') || undefined) as AssignmentType | undefined;
    const activeParam = searchParams.get('active');
    const active = activeParam === null ? undefined : activeParam === 'true';

    const data = await fetchBundleAssignments({ bundleId, userId, assignmentType, active });
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to fetch bundle assignments' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: auth.status });
    const body = await request.json();
    const result = await upsertBundleAssignment(body, auth.userId || undefined);
    return NextResponse.json({ success: true, result });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to save bundle assignment' }, { status: 500 });
  }
}
