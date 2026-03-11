import { NextResponse } from 'next/server';
import { getAuthUserFromCookies } from '../../../services/visibility';
import { createReleaseTrain, listReleaseTrains } from '../../../services/applicationPortfolio';

export async function GET(request: Request) {
  const user = await getAuthUserFromCookies();
  if (!user?.userId) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  const { searchParams } = new URL(request.url);
  const portfolioId = searchParams.get('portfolioId') || undefined;
  const items = await listReleaseTrains(portfolioId);
  return NextResponse.json({ items });
}

export async function POST(request: Request) {
  try {
    const user = await getAuthUserFromCookies();
    if (!user?.userId) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
    const body = await request.json().catch(() => ({}));
    const item = await createReleaseTrain(body || {});
    return NextResponse.json({ item }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to create release train' }, { status: 400 });
  }
}
