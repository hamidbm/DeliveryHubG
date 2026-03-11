import { NextResponse } from 'next/server';
import { getAuthUserFromCookies } from '../../../services/visibility';
import { createApplicationDependency, listApplicationDependencies } from '../../../services/applicationPortfolio';

export async function GET(request: Request) {
  const user = await getAuthUserFromCookies();
  if (!user?.userId) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  const { searchParams } = new URL(request.url);
  const applicationId = searchParams.get('applicationId') || undefined;
  const items = await listApplicationDependencies(applicationId);
  return NextResponse.json({ items });
}

export async function POST(request: Request) {
  try {
    const user = await getAuthUserFromCookies();
    if (!user?.userId) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
    const body = await request.json().catch(() => ({}));
    const item = await createApplicationDependency(body || {});
    return NextResponse.json({ item }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to create dependency' }, { status: 400 });
  }
}
