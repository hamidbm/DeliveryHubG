
import { NextResponse } from 'next/server';
import { deleteArchitectureDiagram } from '../../../../../services/db';

export async function DELETE(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    await deleteArchitectureDiagram(params.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Delete failed' }, { status: 500 });
  }
}
