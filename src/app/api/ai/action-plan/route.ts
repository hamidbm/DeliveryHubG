import { NextResponse } from 'next/server';
import { fetchAiAnalysisCache, saveAiAnalysisCache } from '../../../../services/aiPersistence';
import { getAuthUserFromCookies } from '../../../../services/visibility';
import { generateActionPlan } from '../../../../services/ai/actionRecommender';
import { loadStrategicAdvisorContext } from '../../../../services/ai/strategicAdvisor';

const CACHE_KEY = 'ai-action-plan';
const FRESH_WINDOW_MS = 24 * 60 * 60 * 1000;

const resolveFreshness = (generatedAt?: string) => {
  if (!generatedAt) return 'stale' as const;
  const age = Date.now() - new Date(generatedAt).getTime();
  return age <= FRESH_WINDOW_MS ? 'fresh' as const : 'stale' as const;
};

const unwrapCachedPayload = (cached: any) => {
  if (!cached) return null;
  const wrapped = cached?.report;
  if (wrapped && typeof wrapped === 'object' && wrapped.status) return wrapped;
  return cached;
};

const loadCached = async () => {
  const cachedRaw = await fetchAiAnalysisCache(CACHE_KEY);
  const cached = unwrapCachedPayload(cachedRaw);
  if (!cached || cached.status !== 'success' || !cached.actionPlan) return null;
  return {
    actionPlan: cached.actionPlan,
    metadata: {
      generatedAt: cached.metadata?.generatedAt || cached.actionPlan?.generatedAt,
      freshnessStatus: resolveFreshness(cached.metadata?.generatedAt || cached.actionPlan?.generatedAt),
      cached: true
    }
  };
};

const buildAndPersist = async () => {
  const context = await loadStrategicAdvisorContext();
  if (!context) return null;

  const actionPlan = generateActionPlan(
    context.report,
    context.trendSignals || [],
    context.forecastSignals || [],
    context.riskPropagationSignals || []
  );
  const generatedAt = actionPlan.generatedAt;

  await saveAiAnalysisCache(CACHE_KEY, {
    status: 'success',
    reportType: CACHE_KEY,
    actionPlan,
    metadata: {
      generatedAt,
      snapshotHash: context.snapshotHash
    },
    report: {
      status: 'success',
      reportType: CACHE_KEY,
      actionPlan,
      metadata: {
        generatedAt,
        snapshotHash: context.snapshotHash
      }
    }
  });

  return {
    actionPlan,
    metadata: {
      generatedAt,
      freshnessStatus: 'fresh' as const,
      cached: false,
      snapshotHash: context.snapshotHash
    }
  };
};

export async function GET() {
  const authUser = await getAuthUserFromCookies();
  if (!authUser?.userId) {
    return NextResponse.json({ status: 'error', error: 'Unauthenticated' }, { status: 401 });
  }

  const cached = await loadCached();
  if (cached) {
    return NextResponse.json({ status: 'success', actionPlan: cached.actionPlan, metadata: cached.metadata });
  }

  const built = await buildAndPersist();
  if (!built) {
    return NextResponse.json(
      { status: 'error', error: 'No AI Insights report found. Generate analysis first.' },
      { status: 404 }
    );
  }

  return NextResponse.json({ status: 'success', actionPlan: built.actionPlan, metadata: built.metadata });
}

export async function POST() {
  const authUser = await getAuthUserFromCookies();
  if (!authUser?.userId) {
    return NextResponse.json({ status: 'error', error: 'Unauthenticated' }, { status: 401 });
  }

  const built = await buildAndPersist();
  if (!built) {
    return NextResponse.json(
      { status: 'error', error: 'No AI Insights report found. Generate analysis first.' },
      { status: 404 }
    );
  }

  return NextResponse.json({ status: 'success', actionPlan: built.actionPlan, metadata: built.metadata });
}
