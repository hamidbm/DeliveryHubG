
import { NextResponse } from 'next/server';
import { fetchSystemSettings } from '../../../../services/aiSettings';
import { checkAndIncrementAiRateLimit, saveAiAuditLog } from '../../../../services/aiPersistence';
import { fetchWorkItemById } from '../../../../services/workItemsService';
import { getRateLimitPerHour, getRequestIdentity, getRetentionDays } from '../../../../services/aiPolicy';
import { executeAiTextTask } from '../../../../services/aiRouting';

type AiSettings = {
  geminiFlashModel?: string;
  flashModel?: string;
};

export async function POST(request: Request) {
  const startedAt = Date.now();
  try {
    const { id } = await request.json();
    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

    const item = await fetchWorkItemById(id);
    if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const settings = await fetchSystemSettings();
    const aiSettings: AiSettings = (settings?.ai || {}) as AiSettings;
    const identity = getRequestIdentity(request);
    const allowed = await checkAndIncrementAiRateLimit(identity, getRateLimitPerHour(aiSettings, 30));
    if (!allowed) {
      return NextResponse.json({ error: 'Rate limit exceeded.' }, { status: 429 });
    }
    const prompt = `Summarize progress for this item: ${JSON.stringify(item)}`;
    const execution = await executeAiTextTask({
      aiSettings,
      taskKey: 'standupDigest',
      prompt,
      openAiFallbackModel: 'gpt-5.2',
      geminiModel: aiSettings.geminiFlashModel || aiSettings.flashModel || 'gemini-3-flash-preview'
    });
    const digest = execution.text;
    await saveAiAuditLog({
      task: 'standupDigest',
      provider: execution.provider,
      model: execution.model,
      success: true,
      latencyMs: Date.now() - startedAt,
      identity,
      ttlDays: getRetentionDays(aiSettings, 'auditLogs', 30)
    });
    return NextResponse.json({ digest });
  } catch (error) {
    const message = (error as Error)?.message || 'AI processing failed';
    const status = message.startsWith('No default AI provider is configured') ? 400 : 500;
    const settings = await fetchSystemSettings();
    const aiSettings: AiSettings = (settings?.ai || {}) as AiSettings;
    await saveAiAuditLog({
      task: 'standupDigest',
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
