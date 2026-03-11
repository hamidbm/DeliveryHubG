import { NextResponse } from 'next/server';
import { getAuthUserFromCookies } from '../../../../services/visibility';
import { deleteApplicationDependency } from '../../../../services/applicationPortfolio';

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUserFromCookies();
    if (!user?.userId) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
    const { id } = await params;
    const deleted = await deleteApplicationDependency(id);
    if (!deleted) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to delete dependency' }, { status: 400 });
  }
}
