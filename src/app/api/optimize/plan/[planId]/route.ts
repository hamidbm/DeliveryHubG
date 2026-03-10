import { NextResponse } from 'next/server';
import { getAuthUserFromCookies } from '../../../../../services/visibility';
import { optimizePlan } from '../../../../../services/optimizationEngine';

const parseWeightsFromSearch = (searchParams: URLSearchParams) => {
  const keys = ['onTime', 'riskReduction', 'capacityBalance', 'slippageMinimization'] as const;
  const weights: Record<string, number> = {};
  keys.forEach((key) => {
    const raw = searchParams.get(key);
    if (raw == null) return;
    const value = Number(raw);
    if (Number.isFinite(value)) weights[key] = value;
  });
  return Object.keys(weights).length ? weights : undefined;
};

export async function GET(request: Request, { params }: { params: Promise<{ planId: string }> }) {
  try {
    const user = await getAuthUserFromCookies();
    if (!user?.userId) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
    const { planId } = await params;
    const { searchParams } = new URL(request.url);
    const objectiveWeights = parseWeightsFromSearch(searchParams);
    const constraints = {
      noChangeBeforeDate: searchParams.get('noChangeBeforeDate') || undefined,
      environmentBounds: searchParams.get('environmentBounds') != null
        ? searchParams.get('environmentBounds') === 'true'
        : undefined
    };
    const options = {
      maxVariants: searchParams.get('maxVariants') ? Number(searchParams.get('maxVariants')) : undefined,
      timeoutMs: searchParams.get('timeoutMs') ? Number(searchParams.get('timeoutMs')) : undefined
    };

    const result = await optimizePlan(planId, user, { objectiveWeights, constraints, options });
    if (!result) return NextResponse.json({ error: 'Plan not found' }, { status: 404 });
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to optimize plan' }, { status: 400 });
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ planId: string }> }) {
  try {
    const user = await getAuthUserFromCookies();
    if (!user?.userId) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
    const { planId } = await params;
    const body = await request.json().catch(() => ({}));
    const result = await optimizePlan(planId, user, body || {});
    if (!result) return NextResponse.json({ error: 'Plan not found' }, { status: 404 });
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to optimize plan' }, { status: 400 });
  }
}
