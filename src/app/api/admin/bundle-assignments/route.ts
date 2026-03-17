import { NextResponse } from 'next/server';
import { saveBundleAssignment, listBundleAssignments } from '../../../../server/db/repositories/bundleAssignmentsRepo';
import { requireAdmin } from '../../../../shared/auth/guards';
import { AssignmentType } from '../../../../types';

export async function GET(request: Request) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return auth.response;
    const { searchParams } = new URL(request.url);
    const bundleId = searchParams.get('bundleId') || undefined;
    const userId = searchParams.get('userId') || undefined;
    const assignmentType = (searchParams.get('type') || undefined) as AssignmentType | undefined;
    const activeParam = searchParams.get('active');
    const active = activeParam === null ? undefined : activeParam === 'true';

    const data = await listBundleAssignments({ bundleId, userId, assignmentType, active });
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to fetch bundle assignments' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return auth.response;
    const body = await request.json();
    const result = await saveBundleAssignment(body, auth.principal.userId);
    return NextResponse.json({ success: true, result });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to save bundle assignment' }, { status: 500 });
  }
}
