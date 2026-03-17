import { NextResponse } from 'next/server';
import { fetchSystemSettings } from '../../../../services/aiSettings';
import { checkAndIncrementAiRateLimit, saveAiAuditLog } from '../../../../services/aiPersistence';
import { getRateLimitPerHour, getRequestIdentity, getRetentionDays } from '../../../../services/aiPolicy';
import { executeAiTextTask } from '../../../../services/aiRouting';

type AiSettings = {
  openRouterModel?: string;
  openaiModelHigh?: string;
  openaiModelDefault?: string;
  openaiModel?: string;
  defaultModel?: string;
  defaultProvider?: string;
  geminiFlashModel?: string;
  flashModel?: string;
};

export async function POST(request: Request) {
  const startedAt = Date.now();
  try {
    const { code, provider } = await request.json();
    if (!code) return NextResponse.json({ error: 'Code required' }, { status: 400 });

    const settings = await fetchSystemSettings();
    const identity = getRequestIdentity(request);
    const aiSettings: AiSettings = (settings?.ai || {}) as AiSettings;
    const allowed = await checkAndIncrementAiRateLimit(identity, getRateLimitPerHour(aiSettings, 30));
    if (!allowed) {
      return NextResponse.json({ error: 'Rate limit exceeded.' }, { status: 429 });
    }
    
    const prompt = `Act as a Cloud Architect and Security Engineer. Analyze this ${provider || 'Azure'} Terraform script for:
1. Security Risks (Misconfigurations, wide-open rules, missing encryption)
2. Cost Optimization (Right-sizing, redundant resources)
3. Best Practices (Naming conventions, modularity)

Provide a structured review in Markdown.

Terraform code:
${code}`;
    const geminiModel = aiSettings.geminiFlashModel || aiSettings.flashModel || 'gemini-3-flash-preview';
    const execution = await executeAiTextTask({
      aiSettings,
      taskKey: 'terraformAnalysis',
      prompt,
      openAiFallbackModel: 'gpt-5.2-pro',
      geminiModel
    });
    const analysis = execution.text;
    await saveAiAuditLog({
      task: 'terraformAnalysis',
      provider: execution.provider,
      model: execution.model,
      success: true,
      latencyMs: Date.now() - startedAt,
      identity,
      ttlDays: getRetentionDays(aiSettings, 'auditLogs', 30)
    });
    return NextResponse.json({
      analysis,
      engine: `${execution.provider === 'OPEN_ROUTER' ? 'OpenRouter' : execution.provider === 'OPENAI' ? 'OpenAI' : 'Gemini'} ${execution.model}`
    });

  } catch (error: any) {
    const message = error?.message || 'AI processing failed';
    const status = String(message).startsWith('No default AI provider is configured') ? 400 : 500;
    const settings = await fetchSystemSettings();
    const aiSettings: AiSettings = (settings?.ai || {}) as AiSettings;
    await saveAiAuditLog({
      task: 'terraformAnalysis',
      provider: 'UNKNOWN',
      success: false,
      error: error?.message,
      latencyMs: Date.now() - startedAt,
      identity: getRequestIdentity(request),
      ttlDays: getRetentionDays(aiSettings, 'auditLogs', 30)
    });
    console.error("Audit AI Error:", error);
    return NextResponse.json({ error: message }, { status });
  }
}
