import { NextResponse } from 'next/server';
import { checkAndIncrementAiRateLimit, fetchSystemSettings, fetchApplications, fetchBundles, saveAiAuditLog } from '../../../../services/db';
import { getRateLimitPerHour, getRequestIdentity, getRetentionDays } from '../../../../services/aiPolicy';
import { executeAiTextTask } from '../../../../services/aiRouting';

type AiSettings = {
  defaultProvider?: string;
  selectedDefaultProvider?: string;
  activeEffectiveDefaultProvider?: string;
  envDefaultProvider?: string;
  fallbackOrder?: string[];
  taskRouting?: Record<string, { provider?: string; model?: string }>;
  openaiModelDefault?: string;
  openaiModelHigh?: string;
  openRouterModel?: string;
  geminiProModel?: string;
  proModel?: string;
};

export async function POST(request: Request) {
  const startedAt = Date.now();
  try {
    const settings = await fetchSystemSettings();
    const aiSettings: AiSettings = (settings?.ai || {}) as AiSettings;
    const identity = getRequestIdentity(request);
    const allowed = await checkAndIncrementAiRateLimit(identity, getRateLimitPerHour(aiSettings, 30));
    if (!allowed) {
      return NextResponse.json({ error: 'Rate limit exceeded.' }, { status: 429 });
    }

    // Fetch real-time registry data to ensure the AI has the latest context
    const [applications, bundles] = await Promise.all([
      fetchApplications(),
      fetchBundles()
    ]);

    const prompt = `You are generating an executive portfolio delivery insight summary.\n\nApplications count: ${applications.length}\nBundles count: ${bundles.length}\n\nBundle snapshot (JSON):\n${JSON.stringify(bundles.slice(0, 50))}\n\nApplication snapshot (JSON):\n${JSON.stringify(applications.slice(0, 120))}\n\nProduce concise Markdown with:\n1) Overall portfolio health signal\n2) Top 3 risks\n3) Top 3 action recommendations\n4) Notable concentration points (owner, lifecycle, criticality, or bundle pressure).`;
    const geminiModel = aiSettings.geminiProModel || aiSettings.proModel || 'gemini-3-pro-preview';
    const execution = await executeAiTextTask({
      aiSettings,
      taskKey: 'portfolioSummary',
      prompt,
      openAiFallbackModel: 'gpt-5.2',
      geminiModel
    });
    const summary = execution.text || 'Analysis unavailable.';

    await saveAiAuditLog({
      task: 'portfolioSummary',
      provider: execution.provider,
      model: execution.model,
      success: true,
      latencyMs: Date.now() - startedAt,
      identity,
      ttlDays: getRetentionDays(aiSettings, 'auditLogs', 30)
    });
    return NextResponse.json({ summary });
  } catch (error) {
    const message = (error as Error)?.message || 'AI Synthesis failed';
    const status = message.startsWith('No default AI provider is configured') ? 400 : 500;
    const settings = await fetchSystemSettings();
    const aiSettings: AiSettings = (settings?.ai || {}) as AiSettings;
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
    return NextResponse.json({ error: message }, { status });
  }
}
