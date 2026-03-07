import { NextResponse } from 'next/server';
import { getAuthUserFromCookies } from '../../../../../services/visibility';
import { getPlanForecast } from '../../../../../services/forecastingEngine';

export async function GET(request: Request, { params }: { params: Promise<{ planId: string }> }) {
  const user = await getAuthUserFromCookies();
  if (!user?.userId) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  const { planId } = await params;
  const result = await getPlanForecast(planId, user);
  if (!result) return NextResponse.json({ error: 'Plan not found' }, { status: 404 });
  return NextResponse.json(result);
}
