import { NextResponse } from 'next/server';
import { deleteAdminRecord } from '../../../../../server/db/repositories/adminsRepo';
import { requireAdmin } from '../../../../../shared/auth/guards';

export async function DELETE(request: Request, { params }: { params: Promise<{ userId: string }> }) {
  try {
    const auth = await requireAdmin(request);
    if (!auth.ok) return auth.response;
    const { userId } = await params;
    await deleteAdminRecord(String(userId));
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to remove admin' }, { status: 500 });
  }
}
