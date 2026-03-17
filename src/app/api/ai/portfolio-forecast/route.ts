import { NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { fetchAiAnalysisCache, saveAiAnalysisCache } from '../../../../services/aiPersistence';
import { getAuthUserFromCookies } from '../../../../services/visibility';
import { derivePortfolioSignals } from '../../../../services/ai/portfolioSignals';
import { normalizePortfolioReport } from '../../../../services/ai/normalizePortfolioReport';
import { loadTrendSignals } from '../../../../services/ai/trendAnalyzer';
import { generateForecastSignals } from '../../../../services/ai/forecastEngine';
import { PortfolioSnapshot, StructuredPortfolioReport } from '../../../../types/ai';

const FORECAST_CACHE_KEY = 'portfolio-forecast';
const PORTFOLIO_CACHE_KEY = 'portfolio-summary';
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

const loadForecastCache = async () => {
  const cachedRaw = await fetchAiAnalysisCache(FORECAST_CACHE_KEY);
  const cached = unwrapCachedPayload(cachedRaw);
  if (!cached || cached.status !== 'success' || !Array.isArray(cached.forecastSignals)) return null;

  return {
    forecastSignals: cached.forecastSignals,
    metadata: {
      generatedAt: cached.metadata?.generatedAt,
      freshnessStatus: resolveFreshnessStatus(cached.metadata?.generatedAt),
      snapshotHash: cached.metadata?.snapshotHash,
      cached: true
    }
  };
};

const saveForecastCache = async (payload: { forecastSignals: any[]; snapshotHash: string; generatedAt: string }) => {
  await saveAiAnalysisCache(FORECAST_CACHE_KEY, {
    status: 'success',
    reportType: FORECAST_CACHE_KEY,
    forecastSignals: payload.forecastSignals,
    report: {
      status: 'success',
      reportType: FORECAST_CACHE_KEY,
      forecastSignals: payload.forecastSignals,
      metadata: {
        generatedAt: payload.generatedAt,
        snapshotHash: payload.snapshotHash
      }
    },
    metadata: {
      generatedAt: payload.generatedAt,
      snapshotHash: payload.snapshotHash
    },
    updatedAt: new Date().toISOString()
  });
};

const buildAndPersistForecast = async () => {
  const portfolio = await loadPortfolioReport();
  if (!portfolio) return null;
  const trendContext = await loadTrendSignals();
  const forecastSignals = generateForecastSignals(
    portfolio.snapshot,
    portfolio.report,
    portfolio.report.trendSignals || trendContext.trendSignals || []
  );
  const generatedAt = new Date().toISOString();
  await saveForecastCache({
    forecastSignals,
    snapshotHash: portfolio.snapshotHash,
    generatedAt
  });
  return {
    forecastSignals,
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

  const cached = await loadForecastCache();
  if (cached) {
    return NextResponse.json({ status: 'success', forecastSignals: cached.forecastSignals, metadata: cached.metadata });
  }

  const built = await buildAndPersistForecast();
  if (!built) {
    return NextResponse.json({ error: 'No portfolio summary report available. Generate AI portfolio analysis first.' }, { status: 404 });
  }

  return NextResponse.json({ status: 'success', forecastSignals: built.forecastSignals, metadata: built.metadata });
}

export async function POST() {
  const authUser = await getAuthUserFromCookies();
  if (!authUser?.userId) {
    return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  }

  const built = await buildAndPersistForecast();
  if (!built) {
    return NextResponse.json({ error: 'No portfolio summary report available. Generate AI portfolio analysis first.' }, { status: 404 });
  }

  return NextResponse.json({ status: 'success', forecastSignals: built.forecastSignals, metadata: built.metadata });
}
