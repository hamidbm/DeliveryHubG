import { NextResponse } from 'next/server';
import { suggestRationalization } from '../../../../services/geminiService';
import { checkAndIncrementAiRateLimit, fetchSystemSettings, saveAiAuditLog } from '../../../../services/db';
import { getRateLimitPerHour, getRequestIdentity, getRetentionDays } from '../../../../services/aiPolicy';

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
    const model = aiSettings.geminiFlashModel || aiSettings.flashModel || 'gemini-3-flash-preview';

    const result = await suggestRationalization(app, model);
    await saveAiAuditLog({
      task: 'appRationalize',
      provider: 'GEMINI',
      model,
      success: true,
      latencyMs: Date.now() - startedAt,
      identity,
      ttlDays: getRetentionDays(aiSettings, 'auditLogs', 30)
    });
    return NextResponse.json(result);
  } catch (error) {
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
    return NextResponse.json({ error: 'AI processing failed' }, { status: 500 });
  }
}
