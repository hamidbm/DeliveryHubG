import { NextResponse } from 'next/server';
import { analyzeTerraform } from '../../../../services/geminiService';
import { checkAndIncrementAiRateLimit, fetchSystemSettings, saveAiAuditLog } from '../../../../services/db';
import { generateOpenAiResponse, pickOpenAiReasoningEffort } from '../../../../services/openaiService';
import { getRateLimitPerHour, getRequestIdentity, getRetentionDays, resolveTaskRouting } from '../../../../services/aiPolicy';

async function analyzeOpenAiTerraform(code: string, provider: string, apiKey: string, model: string) {
  const prompt = `Act as a Cloud Architect and Security Engineer. Analyze this ${provider} Terraform script for:
  1. Security Risks (Misconfigurations, wide-open rules, missing encryption)
  2. Cost Optimization (Right-sizing, redundant resources)
  3. Best Practices (Naming conventions, modularity)
  
  Provide a structured review in Markdown.
  
  Terraform code: 
  ${code}`;

  try {
    return await generateOpenAiResponse({
      prompt,
      model,
      apiKey,
      reasoningEffort: pickOpenAiReasoningEffort(model)
    });
  } catch (err: any) {
    console.error("OpenAI Audit Error:", err);
    throw new Error(err.message || "OpenAI failed to analyze infrastructure.");
  }
}

export async function POST(request: Request) {
  const startedAt = Date.now();
  try {
    const { code, provider } = await request.json();
    if (!code) return NextResponse.json({ error: 'Code required' }, { status: 400 });

    const settings = await fetchSystemSettings();
    const envKey = process.env.OPENAI_API_KEY;
    const identity = getRequestIdentity(request);
    const aiSettings = settings?.ai || {};
    const allowed = await checkAndIncrementAiRateLimit(identity, getRateLimitPerHour(aiSettings, 30));
    if (!allowed) {
      return NextResponse.json({ error: 'Rate limit exceeded.' }, { status: 429 });
    }
    
    // Prioritize OpenAI if env var exists or settings explicitly set it
    const { provider: routedProvider, model: routedModel } = resolveTaskRouting(aiSettings, 'terraformAnalysis', settings?.ai?.defaultProvider || 'GEMINI');
    const openAiIntended = routedProvider === 'OPENAI';
    const geminiProviderLabel = routedProvider === 'GEMINI' ? 'GEMINI' : 'GEMINI_FALLBACK';

    if (openAiIntended) {
      const apiKey = envKey || aiSettings.openaiKey;
      if (apiKey) {
        const model = routedModel || aiSettings.openaiModelHigh || aiSettings.openaiModelDefault || aiSettings.openaiModel || aiSettings.defaultModel || 'gpt-5.2-pro';
        const analysis = await analyzeOpenAiTerraform(code, provider || 'Azure', apiKey, model);
        await saveAiAuditLog({
          task: 'terraformAnalysis',
          provider: 'OPENAI',
          model,
          success: true,
          latencyMs: Date.now() - startedAt,
          identity,
          ttlDays: getRetentionDays(aiSettings, 'auditLogs', 30)
        });
        return NextResponse.json({ analysis, engine: `OpenAI ${model}` });
      }
    }

    // Default path for Gemini
    const model =
      routedProvider === 'GEMINI' && routedModel
        ? routedModel
        : aiSettings.geminiFlashModel || aiSettings.flashModel || 'gemini-3-flash-preview';
    const analysis = await analyzeTerraform(code, provider || 'Azure', model);
    await saveAiAuditLog({
      task: 'terraformAnalysis',
      provider: geminiProviderLabel,
      model,
      success: true,
      latencyMs: Date.now() - startedAt,
      identity,
      ttlDays: getRetentionDays(aiSettings, 'auditLogs', 30)
    });
    return NextResponse.json({ analysis, engine: 'Gemini 3 Flash' });

  } catch (error: any) {
    const settings = await fetchSystemSettings();
    const aiSettings = settings?.ai || {};
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
    return NextResponse.json({ error: error.message || 'AI processing failed' }, { status: 500 });
  }
}
