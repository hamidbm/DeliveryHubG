import { NextResponse } from 'next/server';
import { getAuthUserFromCookies } from '../../../../services/visibility';
import { getPortfolioProbabilisticForecast } from '../../../../services/probabilisticForecastingEngine';

export async function POST(request: Request) {
  const user = await getAuthUserFromCookies();
  if (!user?.userId) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const planIds = Array.isArray(body?.planIds) ? body.planIds.filter((id: any) => typeof id === 'string') : [];
  if (!planIds.length) return NextResponse.json({ error: 'planIds is required' }, { status: 400 });
  const seed = body?.seed;
  const sampleCount = body?.sampleCount;
  const result = await getPortfolioProbabilisticForecast(planIds, user, { seed, sampleCount });
  return NextResponse.json(result);
}
