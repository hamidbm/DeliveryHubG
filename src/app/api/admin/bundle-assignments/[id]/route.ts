import { NextResponse } from 'next/server';
import { patchBundleAssignment } from '../../../../../server/db/repositories/bundleAssignmentsRepo';
import { requireAdmin } from '../../../../../shared/auth/guards';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return auth.response;
    const { id } = await params;
    const body = await request.json();
    const result = await patchBundleAssignment(id, body, auth.principal.userId);
    return NextResponse.json({ success: true, result });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to update bundle assignment' }, { status: 500 });
  }
}
