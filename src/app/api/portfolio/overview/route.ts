import { NextResponse } from 'next/server';
import { getAuthUserFromCookies } from '../../../../services/visibility';
import { getPortfolioOverview } from '../../../../services/portfolioAnalytics';

export async function GET() {
  const user = await getAuthUserFromCookies();
  if (!user?.userId) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  const overview = await getPortfolioOverview(user);
  return NextResponse.json({ overview });
}
