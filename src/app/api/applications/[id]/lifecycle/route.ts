import { NextResponse } from 'next/server';
import { getAuthUserFromCookies } from '../../../../../services/visibility';
import { getApplicationLifecycle, upsertApplicationLifecycle } from '../../../../../services/applicationPortfolio';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUserFromCookies();
  if (!user?.userId) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  const { id } = await params;
  const lifecycle = await getApplicationLifecycle(id);
  if (!lifecycle) return NextResponse.json({ lifecycle: null });
  return NextResponse.json({ lifecycle });
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUserFromCookies();
    if (!user?.userId) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const lifecycle = await upsertApplicationLifecycle(id, body || {});
    return NextResponse.json({ lifecycle });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to save lifecycle' }, { status: 400 });
  }
}
