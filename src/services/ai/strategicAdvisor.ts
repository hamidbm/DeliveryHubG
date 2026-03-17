import { createHash } from 'crypto';
import { fetchSystemSettings } from '../aiSettings';
import { fetchAiAnalysisCache, saveAiAnalysisCache } from '../aiPersistence';
import {
  ForecastSignal,
  PortfolioAlert,
  PortfolioSnapshot,
  PortfolioTrendSignal,
  RiskPropagationSignal,
  ScenarioResult,
  StrategicQueryResponse,
  StructuredPortfolioReport
} from '../../types/ai';
import { derivePortfolioSignals } from './portfolioSignals';
import { normalizePortfolioReport } from './normalizePortfolioReport';
import { loadTrendSignals } from './trendAnalyzer';
import { buildStrategicPrompt } from './strategicPromptBuilder';
import { executeAiTextTask } from '../aiRouting';
import { generateDeterministicStrategicAnswer } from './strategicDeterministicEngine';
import { normalizeStrategicModelResponse } from './strategicResponseNormalizer';
import { generateStrategicQuickSuggestions } from './suggestionGenerator';
import { generateActionPlan } from './actionRecommender';
import { listAiAnalysisCacheRecordsByReportType } from '../../server/db/repositories/aiSupportRepo';

type AiSettings = {
  geminiProModel?: string;
  proModel?: string;
};

const PORTFOLIO_CACHE_KEY = 'portfolio-summary';
const FORECAST_CACHE_KEY = 'portfolio-forecast';
const RISK_PROPAGATION_CACHE_KEY = 'risk-propagation';
const SCENARIO_CACHE_PREFIX = 'scenario-result:';
const STRATEGIC_CACHE_PREFIX = 'strategic-query:';
const FRESH_WINDOW_MS = 24 * 60 * 60 * 1000;

const emptySnapshot: PortfolioSnapshot = {
  generatedAt: new Date().toISOString(),
  applications: { total: 0, byHealth: { healthy: 0, warning: 0, critical: 0, unknown: 0 } },
  bundles: { total: 0 },
  workItems: { total: 0, overdue: 0, blocked: 0, unassigned: 0, byStatus: {} },
  reviews: { open: 0, overdue: 0 },
  milestones: { total: 0, overdue: 0 }
};

export type StrategicAdvisorContext = {
  snapshot: PortfolioSnapshot;
  snapshotHash: string;
  report?: StructuredPortfolioReport;
  trendSignals: PortfolioTrendSignal[];
  forecastSignals: ForecastSignal[];
  riskPropagationSignals: RiskPropagationSignal[];
  alerts: PortfolioAlert[];
  scenarioResults: ScenarioResult[];
};

export type StrategicAdvisorResult = {
  response: StrategicQueryResponse;
  metadata: {
    generatedAt: string;
    cached: boolean;
    snapshotHash: string;
    queryHash: string;
    provider?: string;
    model?: string;
  };
};

const resolveFreshness = (generatedAt?: string) => {
  if (!generatedAt) return 'stale' as const;
  const age = Date.now() - new Date(generatedAt).getTime();
  return age <= FRESH_WINDOW_MS ? 'fresh' as const : 'stale' as const;
};

const normalizeQuestion = (question: string) => question.trim().toLowerCase().replace(/\s+/g, ' ');
const isActionPlanIntent = (question: string) => {
  const q = normalizeQuestion(question);
  return (
    q.includes('action plan') ||
    q.includes('step-by-step') ||
    q.includes('step by step') ||
    q.includes('execution plan') ||
    (q.includes('generate') && q.includes('tasks')) ||
    (q.includes('suggest') && q.includes('plan'))
  );
};

const buildHash = (value: string) => createHash('sha256').update(value).digest('hex');

const unwrapCachedPayload = (cached: any) => {
  if (!cached) return null;
  const wrapped = cached?.report;
  if (wrapped && typeof wrapped === 'object' && wrapped.status) return wrapped;
  return cached;
};

const loadPortfolioContext = async (): Promise<{ snapshot: PortfolioSnapshot; report?: StructuredPortfolioReport; snapshotHash: string } | null> => {
  const cached = await fetchAiAnalysisCache(PORTFOLIO_CACHE_KEY);
  if (!cached) return null;

  const source = cached?.status === 'success'
    ? cached
    : (cached?.report?.status === 'success' ? cached.report : null);

  if (!source?.snapshot) return null;

  const snapshot = source.snapshot || emptySnapshot;
  const trendContext = await loadTrendSignals();
  const signals = derivePortfolioSignals(snapshot);
  const normalized = source.report
    ? normalizePortfolioReport(source.report, signals, trendContext.trendSignals, snapshot)
    : null;

  return {
    snapshot,
    report: normalized?.report,
    snapshotHash: source?.metadata?.snapshotHash || buildHash(JSON.stringify(snapshot))
  };
};

const loadForecastSignals = async () => {
  const raw = await fetchAiAnalysisCache(FORECAST_CACHE_KEY);
  const cached = unwrapCachedPayload(raw);
  if (!cached || cached.status !== 'success' || !Array.isArray(cached.forecastSignals)) return [] as ForecastSignal[];
  return cached.forecastSignals as ForecastSignal[];
};

const loadRiskPropagationSignals = async () => {
  const raw = await fetchAiAnalysisCache(RISK_PROPAGATION_CACHE_KEY);
  const cached = unwrapCachedPayload(raw);
  if (!cached || cached.status !== 'success' || !Array.isArray(cached.riskPropagationSignals)) return [] as RiskPropagationSignal[];
  return cached.riskPropagationSignals as RiskPropagationSignal[];
};

const loadRecentScenarioResults = async () => {
  const rows = await listAiAnalysisCacheRecordsByReportType('scenarioResult', 30);

  return rows
    .filter((row: any) => String(row?._id || '').startsWith(SCENARIO_CACHE_PREFIX))
    .map((row: any) => {
      const source = row?.scenarioResult ? row : (row?.report?.scenarioResult ? row.report : null);
      if (!source?.scenarioResult) return null;
      return source.scenarioResult as ScenarioResult;
    })
    .filter(Boolean) as ScenarioResult[];
};

const gatherContext = async (): Promise<StrategicAdvisorContext | null> => {
  const portfolio = await loadPortfolioContext();
  if (!portfolio) return null;
  const trendContext = await loadTrendSignals();
  const forecastSignals = await loadForecastSignals();
  const riskPropagationSignals = await loadRiskPropagationSignals();
  const scenarioResults = await loadRecentScenarioResults();

  return {
    snapshot: portfolio.snapshot,
    snapshotHash: portfolio.snapshotHash,
    report: portfolio.report,
    trendSignals: portfolio.report?.trendSignals || trendContext.trendSignals || [],
    forecastSignals,
    riskPropagationSignals,
    alerts: portfolio.report?.alerts || [],
    scenarioResults
  };
};

const readStrategicCache = async (cacheKey: string): Promise<StrategicAdvisorResult | null> => {
  const raw = await fetchAiAnalysisCache(cacheKey);
  const cached = unwrapCachedPayload(raw);
  if (!cached || cached.status !== 'success' || !cached.strategicResponse) return null;
  const freshness = resolveFreshness(cached.metadata?.generatedAt);
  if (freshness !== 'fresh') return null;

  return {
    response: cached.strategicResponse as StrategicQueryResponse,
    metadata: {
      generatedAt: cached.metadata?.generatedAt,
      cached: true,
      snapshotHash: cached.metadata?.snapshotHash,
      queryHash: cached.queryHash,
      provider: cached.metadata?.provider,
      model: cached.metadata?.model
    }
  };
};

const persistStrategicCache = async (params: {
  cacheKey: string;
  queryHash: string;
  questionNormalized: string;
  response: StrategicQueryResponse;
  snapshotHash: string;
  provider?: string;
  model?: string;
}) => {
  const generatedAt = new Date().toISOString();
  const payload = {
    status: 'success',
    reportType: 'strategic-query',
    queryHash: params.queryHash,
    questionNormalized: params.questionNormalized,
    metadata: {
      generatedAt,
      snapshotHash: params.snapshotHash,
      provider: params.provider || 'deterministic',
      model: params.model || 'deterministic'
    },
    strategicResponse: params.response,
    report: {
      status: 'success',
      reportType: 'strategic-query',
      queryHash: params.queryHash,
      questionNormalized: params.questionNormalized,
      metadata: {
        generatedAt,
        snapshotHash: params.snapshotHash,
        provider: params.provider || 'deterministic',
        model: params.model || 'deterministic'
      },
      strategicResponse: params.response
    }
  };

  await saveAiAnalysisCache(params.cacheKey, payload);
  return generatedAt;
};

export const loadStrategicAdvisorContext = async () => gatherContext();

export const runStrategicAdvisorQuery = async (params: {
  question: string;
  useLLM?: boolean;
  maxTokens?: number;
}): Promise<StrategicAdvisorResult> => {
  const question = String(params.question || '').trim();
  if (!question) {
    return {
      response: {
        answer: '',
        explanation: '',
        evidence: [],
        relatedEntities: [],
        followUps: [],
        success: false,
        errorMessage: 'Question is required.'
      },
      metadata: {
        generatedAt: new Date().toISOString(),
        cached: false,
        snapshotHash: '',
        queryHash: ''
      }
    };
  }

  const context = await gatherContext();
  if (!context) {
    return {
      response: {
        answer: '',
        explanation: '',
        evidence: [],
        relatedEntities: [],
        followUps: [],
        success: false,
        errorMessage: 'No portfolio analysis is available yet. Generate AI portfolio analysis first.'
      },
      metadata: {
        generatedAt: new Date().toISOString(),
        cached: false,
        snapshotHash: '',
        queryHash: ''
      }
    };
  }

  const questionNormalized = normalizeQuestion(question);
  const queryHash = buildHash(`${questionNormalized}|${context.snapshotHash}`);
  const cacheKey = `${STRATEGIC_CACHE_PREFIX}${queryHash}`;
  const useLLM = params.useLLM !== false;

  if (useLLM) {
    const cached = await readStrategicCache(cacheKey);
    if (cached) return cached;
  }

  const deterministic = generateDeterministicStrategicAnswer({
    question,
    snapshot: context.snapshot,
    report: context.report,
    trendSignals: context.trendSignals,
    forecastSignals: context.forecastSignals,
    riskPropagationSignals: context.riskPropagationSignals,
    scenarioResults: context.scenarioResults
  });

  const actionPlan = generateActionPlan(
    context.report,
    context.trendSignals || [],
    context.forecastSignals || [],
    context.riskPropagationSignals || []
  );
  const actionIntent = isActionPlanIntent(question);
  const actionLead = actionPlan.steps.slice(0, 3).map((step, index) => `${index + 1}) ${step.description}`).join(' ');

  const deterministicResponse: StrategicQueryResponse = {
    answer: actionIntent && actionLead
      ? `${deterministic.answer} Recommended execution sequence: ${actionLead}`
      : deterministic.answer,
    explanation: actionIntent
      ? `${deterministic.explanation} The action plan below links each step to evidence and related entities for execution traceability.`
      : deterministic.explanation,
    evidence: deterministic.evidence,
    relatedEntities: deterministic.relatedEntities,
    followUps: deterministic.followUps,
    actionPlan,
    success: true
  };

  if (!useLLM) {
    const generatedAt = await persistStrategicCache({
      cacheKey,
      queryHash,
      questionNormalized,
      response: deterministicResponse,
      snapshotHash: context.snapshotHash
    });
    return {
      response: deterministicResponse,
      metadata: {
        generatedAt,
        cached: false,
        snapshotHash: context.snapshotHash,
        queryHash,
        provider: 'deterministic',
        model: 'deterministic'
      }
    };
  }

  try {
    const settings = await fetchSystemSettings();
    const aiSettings: AiSettings = (settings?.ai || {}) as AiSettings;
    const tokenInstruction = typeof params.maxTokens === 'number' && params.maxTokens > 0
      ? `\nResponse length guidance: keep response under approximately ${params.maxTokens} tokens.`
      : '';

    const prompt = buildStrategicPrompt({
      question,
      snapshot: context.snapshot,
      report: context.report,
      trendSignals: context.trendSignals,
      forecastSignals: context.forecastSignals,
      riskPropagationSignals: context.riskPropagationSignals,
      alerts: context.alerts,
      healthScore: context.report?.healthScore,
      scenarioResults: context.scenarioResults,
      deterministicBaseline: {
        answer: deterministic.answer,
        explanation: deterministic.explanation,
        followUps: deterministic.followUps
      }
    }) + tokenInstruction;

    const execution = await executeAiTextTask({
      aiSettings,
      taskKey: 'strategicAdvisor',
      prompt,
      openAiFallbackModel: 'gpt-5.2',
      geminiModel: aiSettings.geminiProModel || aiSettings.proModel || 'gemini-3-pro-preview',
      timeoutMs: 20000,
      logDecision: false
    });

    const normalized = normalizeStrategicModelResponse(execution.text || '', deterministicResponse);
    const generatedAt = await persistStrategicCache({
      cacheKey,
      queryHash,
      questionNormalized,
      response: normalized,
      snapshotHash: context.snapshotHash,
      provider: execution.provider,
      model: execution.model
    });

    return {
      response: normalized,
      metadata: {
        generatedAt,
        cached: false,
        snapshotHash: context.snapshotHash,
        queryHash,
        provider: execution.provider,
        model: execution.model
      }
    };
  } catch {
    const fallback: StrategicQueryResponse = {
      ...deterministicResponse,
      warning: 'AI model is unavailable; returning deterministic strategic analysis.'
    };

    const generatedAt = await persistStrategicCache({
      cacheKey,
      queryHash,
      questionNormalized,
      response: fallback,
      snapshotHash: context.snapshotHash,
      provider: 'deterministic-fallback',
      model: 'deterministic'
    });

    return {
      response: fallback,
      metadata: {
        generatedAt,
        cached: false,
        snapshotHash: context.snapshotHash,
        queryHash,
        provider: 'deterministic-fallback',
        model: 'deterministic'
      }
    };
  }
};

export const getStrategicSuggestions = async (): Promise<string[]> => {
  const context = await gatherContext();
  if (!context) {
    return generateStrategicQuickSuggestions();
  }
  return generateStrategicQuickSuggestions(
    context.report,
    context.forecastSignals,
    context.riskPropagationSignals,
    context.scenarioResults
  );
};
