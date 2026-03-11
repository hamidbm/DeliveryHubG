import { NextResponse } from 'next/server';
import { getAuthUserFromCookies } from '../../../../../services/visibility';
import { computeApplicationDeliveryImpact } from '../../../../../services/applicationPortfolio';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUserFromCookies();
  if (!user?.userId) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  const { id } = await params;
  const impact = await computeApplicationDeliveryImpact(id);
  if (!impact) return NextResponse.json({ error: 'Application not found' }, { status: 404 });
  return NextResponse.json(impact);
}
