import { NextResponse } from 'next/server';
import { checkAndIncrementAiRateLimit, fetchSystemSettings, saveAiAuditLog } from '../../../../services/db';
import { getRateLimitPerHour, getRequestIdentity, getRetentionDays } from '../../../../services/aiPolicy';
import { executeAiTextTask } from '../../../../services/aiRouting';

type AiSettings = {
  geminiFlashModel?: string;
  flashModel?: string;
};

export async function POST(request: Request) {
  const startedAt = Date.now();
  try {
    const { telemetryData, infraData } = await request.json();
    const settings = await fetchSystemSettings();
    const aiSettings: AiSettings = (settings?.ai || {}) as AiSettings;
    const identity = getRequestIdentity(request);
    const allowed = await checkAndIncrementAiRateLimit(identity, getRateLimitPerHour(aiSettings, 30));
    if (!allowed) {
      return NextResponse.json({ error: 'Rate limit exceeded.' }, { status: 429 });
    }

    const prompt = `As a Senior SRE AI, analyze this telemetry: ${JSON.stringify(telemetryData || [])} and infra: ${JSON.stringify(infraData || [])}. Detect anomalies and suggest scaling actions in Markdown.`;
    const execution = await executeAiTextTask({
      aiSettings,
      taskKey: 'operationsIntelligence',
      prompt,
      openAiFallbackModel: 'gpt-5.2',
      geminiModel: aiSettings.geminiFlashModel || aiSettings.flashModel || 'gemini-3-flash-preview'
    });

    await saveAiAuditLog({
      task: 'operationsIntelligence',
      provider: execution.provider,
      model: execution.model,
      success: true,
      latencyMs: Date.now() - startedAt,
      identity,
      ttlDays: getRetentionDays(aiSettings, 'auditLogs', 30)
    });

    return NextResponse.json({ result: execution.text, provider: execution.provider });
  } catch (error) {
    const message = (error as Error)?.message || 'AI processing failed';
    const status = message.startsWith('No default AI provider is configured') ? 400 : 500;
    const settings = await fetchSystemSettings();
    const aiSettings: AiSettings = (settings?.ai || {}) as AiSettings;
    await saveAiAuditLog({
      task: 'operationsIntelligence',
      provider: 'UNKNOWN',
      success: false,
      error: (error as Error)?.message,
      latencyMs: Date.now() - startedAt,
      identity: getRequestIdentity(request),
      ttlDays: getRetentionDays(aiSettings, 'auditLogs', 30)
    });
    return NextResponse.json({ error: message }, { status });
  }
}
