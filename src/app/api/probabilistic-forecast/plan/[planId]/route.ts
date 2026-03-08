import { NextResponse } from 'next/server';
import { getAuthUserFromCookies } from '../../../../../services/visibility';
import { getPlanProbabilisticForecast } from '../../../../../services/probabilisticForecastingEngine';

export async function GET(request: Request, { params }: { params: Promise<{ planId: string }> }) {
  const user = await getAuthUserFromCookies();
  if (!user?.userId) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  const { planId } = await params;
  const { searchParams } = new URL(request.url);
  const seed = searchParams.get('seed') || undefined;
  const sampleCount = searchParams.get('sampleCount') ? Number(searchParams.get('sampleCount')) : undefined;
  const result = await getPlanProbabilisticForecast(planId, user, { seed, sampleCount });
  if (!result) return NextResponse.json({ error: 'Plan not found' }, { status: 404 });
  return NextResponse.json(result);
}
