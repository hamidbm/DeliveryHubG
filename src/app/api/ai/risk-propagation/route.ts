import { NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { fetchAiAnalysisCache, saveAiAnalysisCache } from '../../../../services/db';
import { getAuthUserFromCookies } from '../../../../services/visibility';
import { derivePortfolioSignals } from '../../../../services/ai/portfolioSignals';
import { normalizePortfolioReport } from '../../../../services/ai/normalizePortfolioReport';
import { loadTrendSignals } from '../../../../services/ai/trendAnalyzer';
import { generateRiskPropagationSignals } from '../../../../services/ai/riskPropagation';
import { ForecastSignal, PortfolioSnapshot, StructuredPortfolioReport } from '../../../../types/ai';

const CACHE_KEY = 'risk-propagation';
const PORTFOLIO_CACHE_KEY = 'portfolio-summary';
const FORECAST_CACHE_KEY = 'portfolio-forecast';
const FRESH_WINDOW_MS = 24 * 60 * 60 * 1000;

const buildSnapshotHash = (snapshot: unknown) => createHash('sha256').update(JSON.stringify(snapshot)).digest('hex');

const resolveFreshnessStatus = (generatedAt?: string) => {
  if (!generatedAt) return 'stale' as const;
  const ageMs = Date.now() - new Date(generatedAt).getTime();
  return ageMs <= FRESH_WINDOW_MS ? 'fresh' as const : 'stale' as const;
};

const emptySnapshot: PortfolioSnapshot = {
  generatedAt: new Date().toISOString(),
  applications: { total: 0, byHealth: { healthy: 0, warning: 0, critical: 0, unknown: 0 } },
  bundles: { total: 0 },
  workItems: { total: 0, overdue: 0, blocked: 0, unassigned: 0, byStatus: {} },
  reviews: { open: 0, overdue: 0 },
  milestones: { total: 0, overdue: 0 }
};

const unwrapCachedPayload = (cached: any) => {
  if (!cached) return null;
  const wrapped = cached?.report;
  if (wrapped && typeof wrapped === 'object' && wrapped.status) return wrapped;
  return cached;
};

const loadPortfolioReport = async (): Promise<{ report: StructuredPortfolioReport; snapshot: PortfolioSnapshot; snapshotHash: string } | null> => {
  const cached = await fetchAiAnalysisCache(PORTFOLIO_CACHE_KEY);
  if (!cached) return null;

  const source = cached?.status === 'success'
    ? cached
    : (cached?.report?.status === 'success' ? cached.report : null);
  if (!source?.report) return null;

  const snapshot = source.snapshot || emptySnapshot;
  const signals = derivePortfolioSignals(snapshot);
  const trendContext = await loadTrendSignals();
  const normalized = normalizePortfolioReport(source.report, signals, trendContext.trendSignals, snapshot);

  return {
    report: normalized.report,
    snapshot,
    snapshotHash: source?.metadata?.snapshotHash || buildSnapshotHash(snapshot)
  };
};

const loadForecastSignals = async (): Promise<ForecastSignal[]> => {
  const cachedRaw = await fetchAiAnalysisCache(FORECAST_CACHE_KEY);
  const cached = unwrapCachedPayload(cachedRaw);
  if (!cached || cached.status !== 'success' || !Array.isArray(cached.forecastSignals)) return [];
  return cached.forecastSignals as ForecastSignal[];
};

const loadRiskPropagationCache = async () => {
  const cachedRaw = await fetchAiAnalysisCache(CACHE_KEY);
  const cached = unwrapCachedPayload(cachedRaw);
  if (!cached || cached.status !== 'success' || !Array.isArray(cached.riskPropagationSignals)) return null;

  return {
    riskPropagationSignals: cached.riskPropagationSignals,
    metadata: {
      generatedAt: cached.metadata?.generatedAt,
      freshnessStatus: resolveFreshnessStatus(cached.metadata?.generatedAt),
      snapshotHash: cached.metadata?.snapshotHash,
      cached: true
    }
  };
};

const saveRiskPropagationCache = async (payload: { riskPropagationSignals: any[]; snapshotHash: string; generatedAt: string }) => {
  await saveAiAnalysisCache(CACHE_KEY, {
    status: 'success',
    reportType: CACHE_KEY,
    metadata: {
      generatedAt: payload.generatedAt,
      snapshotHash: payload.snapshotHash
    },
    riskPropagationSignals: payload.riskPropagationSignals,
    report: {
      status: 'success',
      reportType: CACHE_KEY,
      metadata: {
        generatedAt: payload.generatedAt,
        snapshotHash: payload.snapshotHash
      },
      riskPropagationSignals: payload.riskPropagationSignals
    }
  });
};

const buildAndPersistRiskPropagation = async () => {
  const portfolio = await loadPortfolioReport();
  if (!portfolio) return null;

  const forecastSignals = await loadForecastSignals();
  const riskPropagationSignals = generateRiskPropagationSignals(
    portfolio.snapshot,
    portfolio.report,
    forecastSignals
  );
  const generatedAt = new Date().toISOString();

  await saveRiskPropagationCache({
    riskPropagationSignals,
    snapshotHash: portfolio.snapshotHash,
    generatedAt
  });

  return {
    riskPropagationSignals,
    metadata: {
      generatedAt,
      freshnessStatus: 'fresh' as const,
      snapshotHash: portfolio.snapshotHash,
      cached: false
    }
  };
};

export async function GET() {
  const authUser = await getAuthUserFromCookies();
  if (!authUser?.userId) {
    return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  }

  const cached = await loadRiskPropagationCache();
  if (cached) {
    return NextResponse.json({ status: 'success', riskPropagationSignals: cached.riskPropagationSignals, metadata: cached.metadata });
  }

  const built = await buildAndPersistRiskPropagation();
  if (!built) {
    return NextResponse.json({ error: 'No portfolio summary report available. Generate AI portfolio analysis first.' }, { status: 404 });
  }

  return NextResponse.json({ status: 'success', riskPropagationSignals: built.riskPropagationSignals, metadata: built.metadata });
}

export async function POST() {
  const authUser = await getAuthUserFromCookies();
  if (!authUser?.userId) {
    return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  }

  const built = await buildAndPersistRiskPropagation();
  if (!built) {
    return NextResponse.json({ error: 'No portfolio summary report available. Generate AI portfolio analysis first.' }, { status: 404 });
  }

  return NextResponse.json({ status: 'success', riskPropagationSignals: built.riskPropagationSignals, metadata: built.metadata });
}
