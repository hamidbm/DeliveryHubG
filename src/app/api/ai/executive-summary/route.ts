import { NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { fetchAiAnalysisCache, saveAiAnalysisCache } from '../../../../services/db';
import { getAuthUserFromCookies } from '../../../../services/visibility';
import { buildExecutiveSummary } from '../../../../services/ai/executiveSummary';
import { derivePortfolioSignals } from '../../../../services/ai/portfolioSignals';
import { normalizePortfolioReport } from '../../../../services/ai/normalizePortfolioReport';
import { loadTrendSignals } from '../../../../services/ai/trendAnalyzer';
import { PortfolioSnapshot, StructuredPortfolioReport } from '../../../../types/ai';

const EXEC_CACHE_KEY = 'executive-summary';
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

const loadExecutiveCache = async () => {
  const cachedRaw = await fetchAiAnalysisCache(EXEC_CACHE_KEY);
  const cached = unwrapCachedPayload(cachedRaw);
  if (!cached || cached.status !== 'success' || !cached.executiveSummary) return null;

  return {
    executiveSummary: cached.executiveSummary,
    metadata: {
      generatedAt: cached.metadata?.generatedAt || cached.executiveSummary.generatedAt,
      freshnessStatus: resolveFreshnessStatus(cached.metadata?.generatedAt || cached.executiveSummary.generatedAt),
      snapshotHash: cached.metadata?.snapshotHash,
      cached: true
    }
  };
};

const saveExecutiveCache = async (payload: { executiveSummary: any; snapshotHash: string }) => {
  await saveAiAnalysisCache(EXEC_CACHE_KEY, {
    status: 'success',
    reportType: EXEC_CACHE_KEY,
    executiveSummary: payload.executiveSummary,
    report: {
      status: 'success',
      reportType: EXEC_CACHE_KEY,
      executiveSummary: payload.executiveSummary,
      metadata: {
        generatedAt: payload.executiveSummary.generatedAt,
        snapshotHash: payload.snapshotHash
      }
    },
    metadata: {
      generatedAt: payload.executiveSummary.generatedAt,
      snapshotHash: payload.snapshotHash
    },
    updatedAt: new Date().toISOString()
  });
};

export async function GET() {
  const authUser = await getAuthUserFromCookies();
  if (!authUser?.userId) {
    return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  }

  const cached = await loadExecutiveCache();
  if (cached) {
    return NextResponse.json({
      status: 'success',
      executiveSummary: cached.executiveSummary,
      metadata: cached.metadata
    });
  }

  const portfolio = await loadPortfolioReport();
  if (!portfolio) {
    return NextResponse.json({ error: 'No portfolio summary report available. Generate AI portfolio analysis first.' }, { status: 404 });
  }

  const executiveSummary = await buildExecutiveSummary(portfolio.report);
  await saveExecutiveCache({ executiveSummary, snapshotHash: portfolio.snapshotHash });

  return NextResponse.json({
    status: 'success',
    executiveSummary,
    metadata: {
      generatedAt: executiveSummary.generatedAt,
      freshnessStatus: 'fresh',
      snapshotHash: portfolio.snapshotHash,
      cached: false
    }
  });
}

export async function POST() {
  const authUser = await getAuthUserFromCookies();
  if (!authUser?.userId) {
    return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  }

  const portfolio = await loadPortfolioReport();
  if (!portfolio) {
    return NextResponse.json({ error: 'No portfolio summary report available. Generate AI portfolio analysis first.' }, { status: 404 });
  }

  const executiveSummary = await buildExecutiveSummary(portfolio.report);
  await saveExecutiveCache({ executiveSummary, snapshotHash: portfolio.snapshotHash });

  return NextResponse.json({
    status: 'success',
    executiveSummary,
    metadata: {
      generatedAt: executiveSummary.generatedAt,
      freshnessStatus: 'fresh',
      snapshotHash: portfolio.snapshotHash,
      cached: false
    }
  });
}
