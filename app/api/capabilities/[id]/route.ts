
import { NextResponse } from 'next/server';
import { deleteCapability } from '../../../../services/db';

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    await deleteCapability(params.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Delete failed' }, { status: 500 });
  }
}
