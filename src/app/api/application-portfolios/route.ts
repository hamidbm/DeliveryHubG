import { NextResponse } from 'next/server';
import { getAuthUserFromCookies } from '../../../services/visibility';
import { createApplicationPortfolio, listApplicationPortfolios } from '../../../services/applicationPortfolio';

export async function GET() {
  const user = await getAuthUserFromCookies();
  if (!user?.userId) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  const items = await listApplicationPortfolios();
  return NextResponse.json({ items });
}

export async function POST(request: Request) {
  try {
    const user = await getAuthUserFromCookies();
    if (!user?.userId) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
    const body = await request.json().catch(() => ({}));
    const item = await createApplicationPortfolio(body || {});
    return NextResponse.json({ item }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to create portfolio' }, { status: 400 });
  }
}
