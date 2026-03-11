import { NextResponse } from 'next/server';
import { getAuthUserFromCookies } from '../../../../../services/visibility';
import {
  getApplicationEnvironmentStrategy,
  upsertApplicationEnvironmentStrategy
} from '../../../../../services/applicationPortfolio';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUserFromCookies();
  if (!user?.userId) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  const { id } = await params;
  const strategy = await getApplicationEnvironmentStrategy(id);
  if (!strategy) return NextResponse.json({ error: 'Application not found' }, { status: 404 });
  return NextResponse.json({ strategy });
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUserFromCookies();
    if (!user?.userId) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const strategy = await upsertApplicationEnvironmentStrategy(id, body || {});
    return NextResponse.json({ strategy });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to save environment strategy' }, { status: 400 });
  }
}
