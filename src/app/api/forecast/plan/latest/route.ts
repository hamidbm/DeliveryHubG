import { NextResponse } from 'next/server';
import { getAuthUserFromCookies } from '../../../../../services/visibility';
import { resolveLatestPlanId, getPlanForecast } from '../../../../../services/forecastingEngine';

export async function GET(request: Request) {
  const user = await getAuthUserFromCookies();
  if (!user?.userId) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  const { searchParams } = new URL(request.url);
  const scopeType = searchParams.get('scopeType') || '';
  const scopeId = searchParams.get('scopeId') || '';
  if (!scopeType || !scopeId) {
    return NextResponse.json({ error: 'scopeType and scopeId are required' }, { status: 400 });
  }
  const planId = await resolveLatestPlanId(scopeType, scopeId);
  if (!planId) return NextResponse.json({ planId: null, milestoneForecasts: [], summary: null });
  const result = await getPlanForecast(planId, user);
  if (!result) return NextResponse.json({ planId: null, milestoneForecasts: [], summary: null });
  return NextResponse.json({ planId, ...result });
}
