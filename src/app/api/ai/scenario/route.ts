import { createHash } from 'crypto';
import { NextResponse } from 'next/server';
import { fetchAiAnalysisCache, saveAiAnalysisCache } from '../../../../services/aiPersistence';
import { getAuthUserFromCookies } from '../../../../services/visibility';
import { ScenarioDefinition, ScenarioResult } from '../../../../types/ai';
import { simulateScenario } from '../../../../services/ai/scenarioEngine';
import { derivePortfolioSignals } from '../../../../services/ai/portfolioSignals';
import { normalizePortfolioReport } from '../../../../services/ai/normalizePortfolioReport';
import { loadTrendSignals } from '../../../../services/ai/trendAnalyzer';

const PORTFOLIO_CACHE_KEY = 'portfolio-summary';
const SCENARIO_CACHE_PREFIX = 'scenario-result:';
const FRESH_WINDOW_MS = 24 * 60 * 60 * 1000;

const normalizeScenario = (scenario: ScenarioDefinition): ScenarioDefinition => ({
  id: String(scenario?.id || '').trim(),
  description: String(scenario?.description || '').trim(),
  changes: Array.isArray(scenario?.changes) ? scenario.changes : []
});

const parseBody = async (request: Request) => {
  try {
    const body = await request.json();
    return body?.scenario as ScenarioDefinition;
  } catch {
    return null;
  }
};

const validateScenario = (scenario: ScenarioDefinition | null) => {
  if (!scenario) return 'Scenario is required.';
  if (!scenario.id?.trim()) return 'Scenario id is required.';
  if (!scenario.description?.trim()) return 'Scenario description is required.';
  if (!Array.isArray(scenario.changes) || scenario.changes.length === 0) return 'Scenario must include at least one change.';
  return null;
};

const buildHash = (value: string) => createHash('sha256').update(value).digest('hex');

const resolveFreshness = (generatedAt?: string) => {
  if (!generatedAt) return 'stale' as const;
  const ageMs = Date.now() - new Date(generatedAt).getTime();
  return ageMs <= FRESH_WINDOW_MS ? 'fresh' as const : 'stale' as const;
};

const unwrapCachedPayload = (cached: any) => {
  if (!cached) return null;
  const wrapped = cached?.report;
  if (wrapped && typeof wrapped === 'object' && wrapped.status) return wrapped;
  return cached;
};

const loadPortfolioContext = async () => {
  const cached = await fetchAiAnalysisCache(PORTFOLIO_CACHE_KEY);
  const source = cached?.status === 'success'
    ? cached
    : (cached?.report?.status === 'success' ? cached.report : null);
  if (!source?.snapshot) return null;

  const trendContext = await loadTrendSignals();
  const signals = derivePortfolioSignals(source.snapshot);
  const normalized = source.report
    ? normalizePortfolioReport(source.report, signals, trendContext.trendSignals, source.snapshot)
    : null;

  const snapshotHash = source.metadata?.snapshotHash || buildHash(JSON.stringify(source.snapshot));

  return {
    snapshot: source.snapshot,
    report: normalized?.report,
    trendSignals: normalized?.report?.trendSignals || trendContext.trendSignals,
    snapshotHash
  };
};

const readScenarioCache = async (cacheKey: string): Promise<ScenarioResult | null> => {
  const raw = await fetchAiAnalysisCache(cacheKey);
  const cached = unwrapCachedPayload(raw);
  if (!cached || cached.status !== 'success' || !cached.scenarioResult) return null;
  if (resolveFreshness(cached.metadata?.generatedAt) !== 'fresh') return null;
  return cached.scenarioResult as ScenarioResult;
};

const saveScenarioCache = async (
  cacheKey: string,
  scenarioHash: string,
  snapshotHash: string,
  scenario: ScenarioDefinition,
  scenarioResult: ScenarioResult
) => {
  const generatedAt = new Date().toISOString();
  await saveAiAnalysisCache(cacheKey, {
    status: 'success',
    reportType: 'scenarioResult',
    scenarioHash,
    metadata: { generatedAt, snapshotHash },
    scenario,
    scenarioResult,
    report: {
      status: 'success',
      reportType: 'scenarioResult',
      scenarioHash,
      metadata: { generatedAt, snapshotHash },
      scenario,
      scenarioResult
    }
  });
};

export async function POST(request: Request) {
  const authUser = await getAuthUserFromCookies();
  if (!authUser?.userId) {
    return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  }

  const incoming = await parseBody(request);
  const scenario = normalizeScenario(incoming as ScenarioDefinition);
  const validationError = validateScenario(scenario);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  const portfolio = await loadPortfolioContext();
  if (!portfolio) {
    return NextResponse.json({ error: 'No portfolio summary report available. Generate AI portfolio analysis first.' }, { status: 404 });
  }

  const scenarioHash = buildHash(`${portfolio.snapshotHash}:${JSON.stringify(scenario)}`);
  const cacheKey = `${SCENARIO_CACHE_PREFIX}${scenarioHash}`;

  const cached = await readScenarioCache(cacheKey);
  if (cached) {
    return NextResponse.json({
      status: 'success',
      scenarioResult: cached,
      metadata: {
        cached: true,
        scenarioHash,
        snapshotHash: portfolio.snapshotHash
      }
    });
  }

  const scenarioResult = simulateScenario(
    portfolio.snapshot,
    scenario,
    portfolio.report,
    portfolio.trendSignals || []
  );

  await saveScenarioCache(cacheKey, scenarioHash, portfolio.snapshotHash, scenario, scenarioResult);

  return NextResponse.json({
    status: 'success',
    scenarioResult,
    metadata: {
      cached: false,
      scenarioHash,
      snapshotHash: portfolio.snapshotHash
    }
  });
}
