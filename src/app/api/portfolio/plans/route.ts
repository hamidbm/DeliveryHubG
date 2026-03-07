import { NextResponse } from 'next/server';
import { getAuthUserFromCookies } from '../../../../services/visibility';
import { listPortfolioPlans } from '../../../../services/portfolioAnalytics';

export async function GET() {
  const user = await getAuthUserFromCookies();
  if (!user?.userId) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  const plans = await listPortfolioPlans(user);
  return NextResponse.json({ plans });
}
