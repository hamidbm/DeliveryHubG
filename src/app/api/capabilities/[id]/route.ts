
import { NextRequest, NextResponse } from 'next/server';
import { deleteCapabilityRecord } from '../../../../server/db/repositories/architectureRepo';
import { requireStandardUser } from '../../../../shared/auth/guards';

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireStandardUser(request);
    if (!auth.ok) return auth.response;
    const { id } = await params;
    await deleteCapabilityRecord(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Delete failed' }, { status: 500 });
  }
}
