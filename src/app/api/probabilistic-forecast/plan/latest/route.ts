import { NextResponse } from 'next/server';
import { getAuthUserFromCookies } from '../../../../../services/visibility';
import { resolveLatestPlanId, getPlanProbabilisticForecast } from '../../../../../services/probabilisticForecastingEngine';

export async function GET(request: Request) {
  const user = await getAuthUserFromCookies();
  if (!user?.userId) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  const { searchParams } = new URL(request.url);
  const scopeType = searchParams.get('scopeType') || '';
  const scopeId = searchParams.get('scopeId') || '';
  const seed = searchParams.get('seed') || undefined;
  const sampleCount = searchParams.get('sampleCount') ? Number(searchParams.get('sampleCount')) : undefined;
  if (!scopeType || !scopeId) {
    return NextResponse.json({ error: 'scopeType and scopeId are required' }, { status: 400 });
  }
  const planId = await resolveLatestPlanId(scopeType, scopeId);
  if (!planId) return NextResponse.json({ planId: null, milestoneForecasts: [], summary: null });
  const result = await getPlanProbabilisticForecast(planId, user, { seed, sampleCount });
  if (!result) return NextResponse.json({ planId: null, milestoneForecasts: [], summary: null });
  return NextResponse.json({ planId, ...result });
}
