import { NextResponse } from 'next/server';
import { getPortfolioSummary } from '../../../../services/geminiService';
import { checkAndIncrementAiRateLimit, fetchSystemSettings, fetchApplications, fetchBundles, saveAiAuditLog } from '../../../../services/db';
import { getRateLimitPerHour, getRequestIdentity, getRetentionDays } from '../../../../services/aiPolicy';

export async function POST(request: Request) {
  const startedAt = Date.now();
  try {
    const settings = await fetchSystemSettings();
    const aiSettings = settings?.ai || {};
    const identity = getRequestIdentity(request);
    const allowed = await checkAndIncrementAiRateLimit(identity, getRateLimitPerHour(aiSettings, 30));
    if (!allowed) {
      return NextResponse.json({ error: 'Rate limit exceeded.' }, { status: 429 });
    }
    const model = aiSettings.geminiProModel || aiSettings.proModel || 'gemini-3-pro-preview';
    
    // Fetch real-time registry data to ensure the AI has the latest context
    const [applications, bundles] = await Promise.all([
      fetchApplications(),
      fetchBundles()
    ]);

    const summary = await getPortfolioSummary({
      applications,
      bundles
    }, model);

    await saveAiAuditLog({
      task: 'portfolioSummary',
      provider: 'GEMINI',
      model,
      success: true,
      latencyMs: Date.now() - startedAt,
      identity,
      ttlDays: getRetentionDays(aiSettings, 'auditLogs', 30)
    });
    return NextResponse.json({ summary });
  } catch (error) {
    const settings = await fetchSystemSettings();
    const aiSettings = settings?.ai || {};
    await saveAiAuditLog({
      task: 'portfolioSummary',
      provider: 'UNKNOWN',
      success: false,
      error: (error as Error)?.message,
      latencyMs: Date.now() - startedAt,
      identity: getRequestIdentity(request),
      ttlDays: getRetentionDays(aiSettings, 'auditLogs', 30)
    });
    console.error("Portfolio AI API Error:", error);
    return NextResponse.json({ error: 'AI Synthesis failed' }, { status: 500 });
  }
}
