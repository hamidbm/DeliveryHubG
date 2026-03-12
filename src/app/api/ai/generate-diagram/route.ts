import { NextResponse } from 'next/server';
import { checkAndIncrementAiRateLimit, fetchSystemSettings, saveAiAuditLog } from '../../../../services/db';
import { getRateLimitPerHour, getRequestIdentity, getRetentionDays } from '../../../../services/aiPolicy';
import { executeAiTextTask } from '../../../../services/aiRouting';

type AiSettings = {
  openRouterModel?: string;
  openaiModelHigh?: string;
  openaiModelDefault?: string;
  openaiModel?: string;
  defaultModel?: string;
  defaultProvider?: string;
  geminiProModel?: string;
  proModel?: string;
  geminiFlashModel?: string;
  flashModel?: string;
};

export async function POST(request: Request) {
  const startedAt = Date.now();
  try {
    const { code } = await request.json();
    if (!code) return NextResponse.json({ error: 'Terraform code required' }, { status: 400 });
    
    const settings = await fetchSystemSettings();
    const aiSettings: AiSettings = (settings?.ai || {}) as AiSettings;
    const identity = getRequestIdentity(request);
    const allowed = await checkAndIncrementAiRateLimit(identity, getRateLimitPerHour(aiSettings, 30));
    if (!allowed) {
      return NextResponse.json({ error: 'Rate limit exceeded.' }, { status: 429 });
    }
    
    const prompt = `As a Cloud Architect, convert this Terraform HCL code into a high-quality Mermaid.js flowchart (LR).
Guidelines:
1. Use subgraphs to group tiers.
2. Create logical connections.
3. Use clean node labels.
4. Include basic Mermaid styling classes.
Return ONLY the Mermaid code block starting with 'graph LR' or 'flowchart LR'.

Terraform Code:
${code}`;
    const geminiModel = aiSettings.geminiProModel || aiSettings.proModel || 'gemini-3-pro-preview';
    const execution = await executeAiTextTask({
      aiSettings,
      taskKey: 'terraformDiagram',
      prompt,
      openAiFallbackModel: 'gpt-5.2-pro',
      geminiModel
    });
    const mermaid = (execution.text || '').replace(/```mermaid/g, '').replace(/```/g, '').trim();
    const looksValid = mermaid.toLowerCase().includes('graph') || mermaid.toLowerCase().includes('flowchart');
    const safeMermaid = looksValid ? mermaid : 'graph LR\n  Error[AI failed to parse HCL]';
    await saveAiAuditLog({
      task: 'terraformDiagram',
      provider: execution.provider,
      model: execution.model,
      success: true,
      latencyMs: Date.now() - startedAt,
      identity,
      ttlDays: getRetentionDays(aiSettings, 'auditLogs', 30)
    });
    return NextResponse.json({
      mermaid: safeMermaid,
      engine: `${execution.provider === 'OPEN_ROUTER' ? 'OpenRouter' : execution.provider === 'OPENAI' ? 'OpenAI' : 'Gemini'} ${execution.model}`
    });

  } catch (error: any) {
    const message = error?.message || 'AI processing failed';
    const status = String(message).startsWith('No default AI provider is configured') ? 400 : 500;
    const settings = await fetchSystemSettings();
    const aiSettings: AiSettings = (settings?.ai || {}) as AiSettings;
    await saveAiAuditLog({
      task: 'terraformDiagram',
      provider: 'UNKNOWN',
      success: false,
      error: error?.message,
      latencyMs: Date.now() - startedAt,
      identity: getRequestIdentity(request),
      ttlDays: getRetentionDays(aiSettings, 'auditLogs', 30)
    });
    console.error("AI Dispatch Error:", error);
    return NextResponse.json({ error: message }, { status });
  }
}
