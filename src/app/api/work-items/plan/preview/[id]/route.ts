import { NextResponse } from 'next/server';
import { getAuthUserFromCookies } from '../../../../../../services/visibility';
import { getPlanPreview } from '../../../../../../services/deliveryPlanGenerator';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUserFromCookies();
    if (!user?.userId) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
    const { id } = await params;
    const preview = await getPlanPreview(id);
    if (!preview) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ preview });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to fetch preview' }, { status: 500 });
  }
}
