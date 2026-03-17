import { NextResponse } from 'next/server';
import { fetchUsersByIds } from '../../../services/userDirectory';
import { listBundleAssignments } from '../../../server/db/repositories/bundleAssignmentsRepo';
import { AssignmentType } from '../../../types';
import { requireUser } from '../../../shared/auth/guards';

export async function GET(request: Request) {
  try {
    const auth = await requireUser(request);
    if (!auth.ok) return auth.response;

    const { searchParams } = new URL(request.url);
    const bundleId = searchParams.get('bundleId') || undefined;
    const assignmentType = (searchParams.get('type') || undefined) as AssignmentType | undefined;
    const activeParam = searchParams.get('active');
    const active = activeParam === null ? true : activeParam === 'true';

    const assignments = await listBundleAssignments({ bundleId, assignmentType, active });
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
