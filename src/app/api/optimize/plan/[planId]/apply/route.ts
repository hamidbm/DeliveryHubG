import { NextResponse } from 'next/server';
import { applyOptimizationVariant } from '../../../../../../services/optimizationEngine';
import { getAuthUserFromCookies } from '../../../../../../services/visibility';

export async function POST(request: Request, { params }: { params: Promise<{ planId: string }> }) {
  try {
    const user = await getAuthUserFromCookies();
    if (!user?.userId) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
    const { planId } = await params;
    const body = await request.json().catch(() => ({}));
    const result = await applyOptimizationVariant(planId, user, body || {});
    if (!result) return NextResponse.json({ error: 'Plan not found' }, { status: 404 });
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to apply optimization variant' }, { status: 400 });
  }
}
