
import { NextResponse } from 'next/server';
import { checkAndIncrementAiRateLimit, fetchSystemSettings, fetchWorkItemById, saveAiAuditLog } from '../../../../services/db';
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

    // Simulate team capacity scan
    const teamCapacity = [
      { name: 'Sarah PM', load: 14, role: 'Program Manager' },
      { name: 'Emma Watson', load: 2, role: 'Frontend Engineer' },
      { name: 'John Doe', load: 7, role: 'Backend Engineer' },
      { name: 'Alex Architect', load: 4, role: 'Enterprise Architect' }
    ];

    const prompt = `Suggest peer for task handover: ${JSON.stringify(item)} Team: ${JSON.stringify(teamCapacity)}`;
    const execution = await executeAiTextTask({
      aiSettings,
      taskKey: 'suggestReassignment',
      prompt,
      openAiFallbackModel: 'gpt-5.2',
      geminiModel: aiSettings.geminiFlashModel || aiSettings.flashModel || 'gemini-3-flash-preview'
    });
    const suggestion = execution.text;
    await saveAiAuditLog({
      task: 'suggestReassignment',
      provider: execution.provider,
      model: execution.model,
      success: true,
      latencyMs: Date.now() - startedAt,
      identity,
      ttlDays: getRetentionDays(aiSettings, 'auditLogs', 30)
    });
    return NextResponse.json({ suggestion });
  } catch (error) {
    const message = (error as Error)?.message || 'AI Rebalancing failed';
    const status = message.startsWith('No default AI provider is configured') ? 400 : 500;
    const settings = await fetchSystemSettings();
    const aiSettings: AiSettings = (settings?.ai || {}) as AiSettings;
    await saveAiAuditLog({
      task: 'suggestReassignment',
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
