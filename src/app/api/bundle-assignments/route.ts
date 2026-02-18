import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { fetchBundleAssignments, fetchUsersByIds } from '../../../services/db';
import { AssignmentType } from '../../../types';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'nexus_super_secret_key_123');

const requireAuth = async () => {
  const cookieStore = await cookies();
  const token = cookieStore.get('nexus_auth_token')?.value;
  if (!token) return { ok: false, status: 401 };
  await jwtVerify(token, JWT_SECRET);
  return { ok: true, status: 200 };
};

export async function GET(request: Request) {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return NextResponse.json({ error: 'Unauthenticated' }, { status: auth.status });

    const { searchParams } = new URL(request.url);
    const bundleId = searchParams.get('bundleId') || undefined;
    const assignmentType = (searchParams.get('type') || undefined) as AssignmentType | undefined;
    const activeParam = searchParams.get('active');
    const active = activeParam === null ? true : activeParam === 'true';

    const assignments = await fetchBundleAssignments({ bundleId, assignmentType, active });
    const userIds = assignments.map((a: any) => String(a.userId));
    const users = await fetchUsersByIds(userIds);
    const userMap = new Map(users.map((u: any) => [String(u._id || u.id), u]));

    const payload = assignments.map((a: any) => ({
      ...a,
      user: userMap.get(String(a.userId)) || null
    }));

    return NextResponse.json(payload);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to fetch bundle assignments' }, { status: 500 });
  }
}
