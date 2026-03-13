import { NextResponse } from 'next/server';
import { createHash } from 'crypto';
import {
  checkAndIncrementAiRateLimit,
  fetchAiAnalysisCache,
  fetchSystemSettings,
  saveAiAnalysisCache,
  saveAiAuditLog
} from '../../../../services/db';
import { getRateLimitPerHour, getRequestIdentity, getRetentionDays } from '../../../../services/aiPolicy';
import { executeAiTextTask } from '../../../../services/aiRouting';
import { buildPortfolioIntelligenceSnapshot } from '../../../../services/ai/portfolioSnapshot';
import { PortfolioSummaryResponse, PortfolioSnapshot } from '../../../../types/ai';
import { getAuthUserFromCookies } from '../../../../services/visibility';
import { AttemptedProvider, AiErrorCode } from '../../../../services/aiRouting';
import { derivePortfolioSignals } from '../../../../services/ai/portfolioSignals';
import { normalizePortfolioReport } from '../../../../services/ai/normalizePortfolioReport';
import { resolveRelatedEntitiesMetaFromReport } from '../../../../services/entityMetaResolver';

type AiSettings = {
  geminiProModel?: string;
  proModel?: string;
};
type PortfolioSummaryErrorCode = AiErrorCode | 'PORTFOLIO_SNAPSHOT_FAILED';

const CACHE_KEY = 'portfolio-summary';
const FRESH_WINDOW_MS = 24 * 60 * 60 * 1000;

const errorResponse = (code: PortfolioSummaryErrorCode, message: string): PortfolioSummaryResponse => ({
  status: 'error',
  error: { code, message }
});

const classifyError = (message: string, explicitCode?: string): { code: PortfolioSummaryErrorCode; message: string } => {
  if (explicitCode === 'AI_PROVIDER_NOT_CONFIGURED') return { code: 'AI_PROVIDER_NOT_CONFIGURED', message };
  if (explicitCode === 'AI_PROVIDER_CREDENTIALS_MISSING') return { code: 'AI_PROVIDER_CREDENTIALS_MISSING', message };
  if (explicitCode === 'AI_PROVIDER_RATE_LIMIT') return { code: 'AI_PROVIDER_RATE_LIMIT', message };
  if (explicitCode === 'AI_PROVIDER_REQUEST_FAILED') return { code: 'AI_PROVIDER_REQUEST_FAILED', message };
  const lower = message.toLowerCase();
  if (message.startsWith('No default AI provider is configured')) {
    return { code: 'AI_PROVIDER_NOT_CONFIGURED', message };
  }
  if (lower.includes('missing openrouter_api_key') || lower.includes('missing openai_api_key') || lower.includes('gemini api key is missing')) {
    return { code: 'AI_PROVIDER_CREDENTIALS_MISSING', message };
  }
  if (lower.includes('rate limit exceeded')) {
    return { code: 'AI_PROVIDER_RATE_LIMIT', message: 'AI provider rate limit exceeded. Try again shortly.' };
  }
  if (lower.includes('insufficient credits') || lower.includes('quota') || lower.includes('resource_exhausted') || lower.includes('429')) {
    return { code: 'AI_PROVIDER_RATE_LIMIT', message };
  }
  if (lower.includes('snapshot')) {
    return { code: 'PORTFOLIO_SNAPSHOT_FAILED', message };
  }
  return { code: 'AI_UNKNOWN_ERROR', message };
};

const describeRateLimit = (attempted: AttemptedProvider[]) => {
  if (attempted.length > 1) {
    return 'AI analysis could not be generated because all configured providers are unavailable or out of quota.';
  }
  const last = attempted[attempted.length - 1];
  if (last?.provider === 'OPEN_ROUTER') {
    return 'The configured OpenRouter provider cannot generate analysis because the account has insufficient credits or quota.';
  }
  if (last?.provider === 'GEMINI') {
    return 'The configured Gemini provider cannot generate analysis because its API quota is exhausted.';
  }
  return 'AI analysis could not be generated because providers are out of quota or rate-limited.';
};

const resolveFreshnessStatus = (generatedAt?: string) => {
  if (!generatedAt) return 'stale' as const;
  const ageMs = Date.now() - new Date(generatedAt).getTime();
  return ageMs <= FRESH_WINDOW_MS ? 'fresh' as const : 'stale' as const;
};

const buildSnapshotHash = (snapshot: unknown) => createHash('sha256')
  .update(JSON.stringify(snapshot))
  .digest('hex');

const emptySnapshot: PortfolioSnapshot = {
  generatedAt: new Date().toISOString(),
  applications: { total: 0, byHealth: { healthy: 0, warning: 0, critical: 0, unknown: 0 } },
  bundles: { total: 0 },
  workItems: { total: 0, overdue: 0, blocked: 0, unassigned: 0, byStatus: {} },
  reviews: { open: 0, overdue: 0 },
  milestones: { total: 0, overdue: 0 }
};

const normalizeCachedReport = async (cached: any): Promise<PortfolioSummaryResponse | null> => {
  if (!cached) return null;
  const legacyReport = cached?.report?.status === 'success' ? cached.report : null;
  const currentReport = cached?.status === 'success' ? cached : null;
  const source = currentReport || legacyReport;
  const legacyCacheNormalized = Boolean(legacyReport && !currentReport);
  if (!source) return null;
  const snapshot = source.snapshot || emptySnapshot;
  const signals = derivePortfolioSignals(snapshot);
  const normalized = normalizePortfolioReport(source.report, signals);
  const generatedAt = source.metadata?.generatedAt || cached.updatedAt || new Date().toISOString();
  const metadata = {
    provider: source.metadata?.provider || 'UNKNOWN',
    model: source.metadata?.model || 'UNKNOWN',
    generatedAt,
    cached: true,
    freshnessStatus: source.metadata?.freshnessStatus || resolveFreshnessStatus(generatedAt),
    snapshotHash: source.metadata?.snapshotHash,
    legacyCacheNormalized
  } satisfies NonNullable<PortfolioSummaryResponse['metadata']>;
  return {
    status: 'success',
    metadata,
    snapshot,
    report: normalized.report,
    relatedEntitiesMeta: source.relatedEntitiesMeta || await resolveRelatedEntitiesMetaFromReport(normalized.report)
  };
};

const loadCachedSuccess = async () => {
  const cached = await fetchAiAnalysisCache(CACHE_KEY);
  return normalizeCachedReport(cached);
};

export async function GET() {
  const authUser = await getAuthUserFromCookies();
  if (!authUser?.userId) {
    return NextResponse.json(errorResponse('AI_UNKNOWN_ERROR', 'Unauthenticated'), { status: 401 });
  }

  const cached = await loadCachedSuccess();
  if (!cached) {
    return NextResponse.json(
      {
        status: 'empty',
        message: 'No AI portfolio analysis exists yet. Click Generate Analysis to create the first report.'
      } satisfies PortfolioSummaryResponse
    );
  }
  return NextResponse.json(cached);
}

export async function POST(request: Request) {
  const startedAt = Date.now();
  const identity = getRequestIdentity(request);

  const authUser = await getAuthUserFromCookies();
  if (!authUser?.userId) {
    return NextResponse.json(errorResponse('AI_UNKNOWN_ERROR', 'Unauthenticated'), { status: 401 });
  }

  try {
    const settings = await fetchSystemSettings();
    const aiSettings: AiSettings = (settings?.ai || {}) as AiSettings;
    const allowed = await checkAndIncrementAiRateLimit(identity, getRateLimitPerHour(aiSettings, 30));
    if (!allowed) {
      return NextResponse.json(
        errorResponse('AI_PROVIDER_RATE_LIMIT', 'AI provider rate limit exceeded. Try again shortly.'),
        { status: 429 }
      );
    }

    const snapshot = await Promise.race([
      buildPortfolioIntelligenceSnapshot(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Portfolio snapshot build timeout')), 500)
      )
    ]);
    if (
      snapshot.applications.total === 0
      && snapshot.bundles.total === 0
      && snapshot.workItems.total === 0
      && snapshot.reviews.open === 0
      && snapshot.milestones.total === 0
    ) {
      throw new Error('Portfolio snapshot has no data to analyze.');
    }

    const prompt = `You are an enterprise delivery portfolio analyst.
You will receive:
1. A deterministic portfolio snapshot
2. A deterministic signal summary

Return STRICT JSON only (no markdown fences) matching this schema:
{
  "overallHealth": "green|amber|red|unknown",
  "executiveSummary": "string",
  "topRisks": [{ "title": "string", "severity": "low|medium|high|critical", "summary": "string", "evidence": ["string"] }],
  "recommendedActions": [{ "title": "string", "urgency": "now|7d|30d|later", "summary": "string", "ownerHint": "string", "evidence": ["string"] }],
  "concentrationSignals": [{ "title": "string", "summary": "string", "impact": "string", "evidence": ["string"] }],
  "questionsToAsk": [{ "question": "string", "rationale": "string" }]
}

Constraints:
- executiveSummary concise and management-friendly
- topRisks max 5
- recommendedActions max 5
- concentrationSignals max 5
- questionsToAsk between 2 and 6
- Ground statements in provided data

Deterministic signal summary:
${JSON.stringify(derivePortfolioSignals(snapshot), null, 2)}

Portfolio snapshot:
${JSON.stringify(snapshot, null, 2)}`;

    const execution = await executeAiTextTask({
      aiSettings,
      taskKey: 'portfolioSummary',
      prompt,
      openAiFallbackModel: 'gpt-5.2',
      geminiModel: aiSettings.geminiProModel || aiSettings.proModel || 'gemini-3-pro-preview',
      timeoutMs: 20000
    });
    const signals = derivePortfolioSignals(snapshot);
    const normalized = normalizePortfolioReport(execution.text, signals);

    const generatedAt = new Date().toISOString();
    const snapshotHash = buildSnapshotHash(snapshot);
    const relatedEntitiesMeta = await resolveRelatedEntitiesMetaFromReport(normalized.report);
    const response: PortfolioSummaryResponse = {
      status: 'success',
      metadata: {
        generatedAt,
        provider: execution.provider,
        model: execution.model,
        cached: false,
        freshnessStatus: 'fresh',
        snapshotHash
      },
      snapshot,
      report: normalized.report,
      relatedEntitiesMeta
    };

    await saveAiAnalysisCache(CACHE_KEY, {
      ...response,
      reportType: CACHE_KEY
    });
    await saveAiAuditLog({
      task: 'portfolioSummary',
      provider: execution.provider,
      model: execution.model,
      success: true,
      latencyMs: Date.now() - startedAt,
      identity,
      ttlDays: getRetentionDays(aiSettings, 'auditLogs', 30)
    });
    console.info('ai_portfolio_summary', {
      timestamp: new Date().toISOString(),
      provider: execution.provider,
      model: execution.model,
      duration: Date.now() - startedAt,
      success: true,
      normalizationFallbackUsed: normalized.normalizationFallbackUsed,
      sectionsSynthesized: normalized.sectionsSynthesized,
      structuredReportGenerated: true
    });
    return NextResponse.json(response);
  } catch (error) {
    const enriched = error as Error & {
      code?: string;
      attemptedProviders?: AttemptedProvider[];
      lastAttemptedProvider?: string | null;
      lastAttemptedModel?: string | null;
    };
    const attemptedProviders = Array.isArray(enriched?.attemptedProviders) ? enriched.attemptedProviders : [];
    const classified = classifyError(enriched?.message || 'Unknown AI error', enriched?.code);
    const userMessage = classified.code === 'AI_PROVIDER_RATE_LIMIT'
      ? describeRateLimit(attemptedProviders)
      : classified.message;
    const settings = await fetchSystemSettings();
    const aiSettings: AiSettings = (settings?.ai || {}) as AiSettings;

    await saveAiAuditLog({
      task: 'portfolioSummary',
      provider: enriched?.lastAttemptedProvider || 'UNKNOWN',
      success: false,
      error: `${classified.code}: ${classified.message}`,
      model: enriched?.lastAttemptedModel || undefined,
      latencyMs: Date.now() - startedAt,
      identity,
      ttlDays: getRetentionDays(aiSettings, 'auditLogs', 30)
    });
    console.info('ai_portfolio_summary', {
      timestamp: new Date().toISOString(),
      provider: enriched?.lastAttemptedProvider || 'UNKNOWN',
      model: enriched?.lastAttemptedModel || 'UNKNOWN',
      duration: Date.now() - startedAt,
      success: false,
      errorCode: classified.code,
      attemptedProviders
    });

    const cached = await loadCachedSuccess();
    if (cached) {
      return NextResponse.json(cached);
    }

    const status = classified.code === 'AI_PROVIDER_RATE_LIMIT'
      ? 429
      : classified.code === 'AI_PROVIDER_NOT_CONFIGURED' || classified.code === 'AI_PROVIDER_CREDENTIALS_MISSING'
        ? 400
        : classified.code === 'PORTFOLIO_SNAPSHOT_FAILED'
          ? 500
          : 500;
    return NextResponse.json(
      {
        ...errorResponse(classified.code, userMessage),
        metadata: {
          generatedAt: new Date().toISOString(),
          provider: enriched?.lastAttemptedProvider || 'UNKNOWN',
          model: enriched?.lastAttemptedModel || 'UNKNOWN',
          attemptedProviders: attemptedProviders.length > 0 ? attemptedProviders : undefined
        }
      } satisfies PortfolioSummaryResponse,
      { status }
    );
  }
}
