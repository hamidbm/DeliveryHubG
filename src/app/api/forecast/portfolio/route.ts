import { NextResponse } from 'next/server';
import { getAuthUserFromCookies } from '../../../../services/visibility';
import { getPortfolioForecast } from '../../../../services/forecastingEngine';

export async function POST(request: Request) {
  const user = await getAuthUserFromCookies();
  if (!user?.userId) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const planIds = Array.isArray(body?.planIds) ? body.planIds.filter((id: any) => typeof id === 'string') : [];
  if (!planIds.length) return NextResponse.json({ error: 'planIds is required' }, { status: 400 });
  const result = await getPortfolioForecast(planIds, user);
  return NextResponse.json(result);
}
