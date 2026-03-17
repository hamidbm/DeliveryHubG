import { NextResponse } from 'next/server';
import { getAuthUserFromCookies } from '../../../../../services/visibility';
import { getLatestOptimizationAppliedRunRecord } from '../../../../../server/db/repositories/optimizationRunsRepo';

export async function GET(request: Request) {
  const user = await getAuthUserFromCookies();
  if (!user?.userId) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const scopeType = (searchParams.get('scopeType') || '').trim();
  const scopeId = (searchParams.get('scopeId') || '').trim();
  const planId = (searchParams.get('planId') || '').trim();

  const query: any = {};
  if (planId) {
    query.planId = planId;
  } else if (scopeType && scopeId) {
    query.scopeType = scopeType.toUpperCase();
    query.scopeId = scopeId;
  }

  const item = await getLatestOptimizationAppliedRunRecord(query);

  return NextResponse.json({ item: item || null });
}
