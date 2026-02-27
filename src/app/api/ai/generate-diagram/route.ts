import { NextResponse } from 'next/server';
import { generateDiagramFromTerraform } from '../../../../services/geminiService';
import { checkAndIncrementAiRateLimit, fetchSystemSettings, saveAiAuditLog } from '../../../../services/db';
import { generateOpenAiResponse, pickOpenAiReasoningEffort } from '../../../../services/openaiService';
import { getRateLimitPerHour, getRequestIdentity, getRetentionDays, resolveTaskRouting } from '../../../../services/aiPolicy';

type AiSettings = {
  openaiKey?: string;
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

async function generateOpenAiDiagram(code: string, apiKey: string, model: string) {
  const prompt = `As a Cloud Architect, convert this Terraform HCL code into a high-quality Mermaid.js flowchart (LR). 
  Guidelines:
  1. Use subgraphs to group tiers.
  2. Create logical connections.
  3. Use clean node labels.
  4. Include basic Mermaid styling classes.
  Return ONLY the Mermaid code block starting with 'graph LR' or 'flowchart LR'.
  
  Terraform Code:
  ${code}`;

  try {
    const text = await generateOpenAiResponse({
      prompt,
      model,
      apiKey,
      reasoningEffort: pickOpenAiReasoningEffort(model)
    });
    return text.replace(/```mermaid/g, '').replace(/```/g, '').trim();
  } catch (err: any) {
    console.error("OpenAI Error:", err);
    throw new Error(err.message || "OpenAI failed to generate diagram.");
  }
}

export async function POST(request: Request) {
  const startedAt = Date.now();
  try {
    const { code } = await request.json();
    if (!code) return NextResponse.json({ error: 'Terraform code required' }, { status: 400 });
    
    const settings = await fetchSystemSettings();
    const envKey = process.env.OPENAI_API_KEY;
    const aiSettings: AiSettings = (settings?.ai || {}) as AiSettings;
    const identity = getRequestIdentity(request);
    const allowed = await checkAndIncrementAiRateLimit(identity, getRateLimitPerHour(aiSettings, 30));
    if (!allowed) {
      return NextResponse.json({ error: 'Rate limit exceeded.' }, { status: 429 });
    }
    
    // Auto-detect and prioritize OpenAI if env var is present, 
    // or if DB explicitly says OpenAI.
    const defaultProvider = (aiSettings.defaultProvider === 'OPENAI' || aiSettings.defaultProvider === 'GEMINI' || aiSettings.defaultProvider === 'ANTHROPIC' || aiSettings.defaultProvider === 'HUGGINGFACE' || aiSettings.defaultProvider === 'COHERE')
      ? aiSettings.defaultProvider
      : 'GEMINI';
    const { provider: routedProvider, model: routedModel } = resolveTaskRouting(aiSettings, 'terraformDiagram', defaultProvider);
    const openAiIntended = routedProvider === 'OPENAI';
    const geminiProviderLabel = routedProvider === 'GEMINI' ? 'GEMINI' : 'GEMINI_FALLBACK';
    
    if (openAiIntended) {
      const apiKey = envKey || aiSettings.openaiKey;
      if (!apiKey) {
        // Fallback to Gemini if OpenAI is intended but key is missing
        const model = aiSettings.geminiProModel || aiSettings.proModel || 'gemini-3-pro-preview';
        const mermaid = await generateDiagramFromTerraform(code, model);
        await saveAiAuditLog({
          task: 'terraformDiagram',
          provider: geminiProviderLabel,
          model,
          success: true,
          latencyMs: Date.now() - startedAt,
          identity,
          ttlDays: getRetentionDays(aiSettings, 'auditLogs', 30)
        });
        return NextResponse.json({ mermaid, engine: 'Gemini 3 Pro (OpenAI Key Missing)' });
      }
      
      const model = routedModel || aiSettings.openaiModelHigh || aiSettings.openaiModelDefault || aiSettings.openaiModel || aiSettings.defaultModel || 'gpt-5.2-pro';
      const mermaid = await generateOpenAiDiagram(code, apiKey, model);
      await saveAiAuditLog({
        task: 'terraformDiagram',
        provider: 'OPENAI',
        model,
        success: true,
        latencyMs: Date.now() - startedAt,
        identity,
        ttlDays: getRetentionDays(aiSettings, 'auditLogs', 30)
      });
      return NextResponse.json({ mermaid, engine: `OpenAI ${model}` });
    }

    // Default path for Gemini
    const model =
      routedProvider === 'GEMINI' && routedModel
        ? routedModel
        : aiSettings.geminiProModel || aiSettings.proModel || 'gemini-3-pro-preview';
    const mermaid = await generateDiagramFromTerraform(code, model);
    await saveAiAuditLog({
      task: 'terraformDiagram',
      provider: geminiProviderLabel,
      model,
      success: true,
      latencyMs: Date.now() - startedAt,
      identity,
      ttlDays: getRetentionDays(aiSettings, 'auditLogs', 30)
    });
    return NextResponse.json({ mermaid, engine: 'Gemini 3 Pro' });

  } catch (error: any) {
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
    return NextResponse.json({ error: error.message || 'AI processing failed' }, { status: 500 });
  }
}
