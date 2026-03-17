import { NextResponse } from 'next/server';
import { fetchSystemSettings } from '../../../../services/aiSettings';
import { checkAndIncrementAiRateLimit, saveAiAuditLog } from '../../../../services/aiPersistence';
import { getRateLimitPerHour, getRequestIdentity, getRetentionDays } from '../../../../services/aiPolicy';
import { executeAiTextTask } from '../../../../services/aiRouting';

type AiSettings = {
  geminiFlashModel?: string;
  flashModel?: string;
};

export async function POST(request: Request) {
  const startedAt = Date.now();
  try {
    const app = await request.json();
    if (!app) return NextResponse.json({ error: 'App data required' }, { status: 400 });
    
    const settings = await fetchSystemSettings();
    const aiSettings: AiSettings = (settings?.ai || {}) as AiSettings;
    const identity = getRequestIdentity(request);
    const allowed = await checkAndIncrementAiRateLimit(identity, getRateLimitPerHour(aiSettings, 30));
    if (!allowed) {
      return NextResponse.json({ error: 'Rate limit exceeded.' }, { status: 429 });
    }
    const prompt = `Act as an Enterprise Architect. Based on this application data: ${JSON.stringify(app)}, recommend one of the following TIME quadrants: INVEST, TOLERATE, MIGRATE, ELIMINATE. Provide a 2-sentence technical justification. Return JSON only with fields "recommendation" and "justification".`;
    const execution = await executeAiTextTask({
      aiSettings,
      taskKey: 'appRationalize',
      prompt,
      openAiFallbackModel: 'gpt-5.2',
      geminiModel: aiSettings.geminiFlashModel || aiSettings.flashModel || 'gemini-3-flash-preview'
    });
    let result: { recommendation: string; justification: string };
    try {
      const raw = execution.text || '{}';
      const cleaned = raw.trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim();
      const parsed = JSON.parse(cleaned);
      result = {
        recommendation: String(parsed.recommendation || 'TOLERATE'),
        justification: String(parsed.justification || 'AI analysis failed. Falling back to default baseline.')
      };
    } catch {
      result = { recommendation: 'TOLERATE', justification: 'AI analysis failed. Falling back to default baseline.' };
    }
    await saveAiAuditLog({
      task: 'appRationalize',
      provider: execution.provider,
      model: execution.model,
      success: true,
      latencyMs: Date.now() - startedAt,
      identity,
      ttlDays: getRetentionDays(aiSettings, 'auditLogs', 30)
    });
    return NextResponse.json(result);
  } catch (error) {
    const message = (error as Error)?.message || 'AI processing failed';
    const status = message.startsWith('No default AI provider is configured') ? 400 : 500;
    const settings = await fetchSystemSettings();
    const aiSettings: AiSettings = (settings?.ai || {}) as AiSettings;
    await saveAiAuditLog({
      task: 'appRationalize',
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
