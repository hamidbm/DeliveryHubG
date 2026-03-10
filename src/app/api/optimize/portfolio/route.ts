import { NextResponse } from 'next/server';
import { listPortfolioPlans } from '../../../../services/portfolioAnalytics';
import { optimizePortfolio } from '../../../../services/optimizationEngine';
import { getAuthUserFromCookies } from '../../../../services/visibility';

export async function GET(request: Request) {
  try {
    const user = await getAuthUserFromCookies();
    if (!user?.userId) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const planIdsRaw = searchParams.get('planIds');
    const maxPlans = Math.min(Math.max(Number(searchParams.get('maxPlans') || '10'), 1), 25);

    let planIds: string[] = [];
    if (planIdsRaw) {
      planIds = planIdsRaw.split(',').map((value) => value.trim()).filter(Boolean);
    } else {
      const plans = await listPortfolioPlans(user);
      planIds = plans.slice(0, maxPlans).map((plan) => plan.id);
    }

    if (!planIds.length) {
      return NextResponse.json({
        plansAnalyzed: 0,
        planSummaries: [],
        objectiveWeights: undefined,
        constraints: undefined,
        generatedAt: new Date().toISOString()
      });
    }

    const result = await optimizePortfolio(planIds, user, {
      objectiveWeights: {
        onTime: searchParams.get('onTime') ? Number(searchParams.get('onTime')) : undefined,
        riskReduction: searchParams.get('riskReduction') ? Number(searchParams.get('riskReduction')) : undefined,
        capacityBalance: searchParams.get('capacityBalance') ? Number(searchParams.get('capacityBalance')) : undefined,
        slippageMinimization: searchParams.get('slippageMinimization') ? Number(searchParams.get('slippageMinimization')) : undefined
      },
      constraints: {
        noChangeBeforeDate: searchParams.get('noChangeBeforeDate') || undefined,
        environmentBounds: searchParams.get('environmentBounds') != null
          ? searchParams.get('environmentBounds') === 'true'
          : undefined
      },
      options: {
        maxVariants: searchParams.get('maxVariants') ? Number(searchParams.get('maxVariants')) : undefined,
        timeoutMs: searchParams.get('timeoutMs') ? Number(searchParams.get('timeoutMs')) : undefined
      }
    });

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to optimize portfolio' }, { status: 400 });
  }
}
