
import { NextResponse } from 'next/server';
import { deleteInterface } from '../../../../../services/db';

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    await deleteInterface(params.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Delete failed' }, { status: 500 });
  }
}
