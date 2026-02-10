import { NextResponse } from 'next/server';
import { analyzeTerraform } from '../../../../services/geminiService';
import { fetchSystemSettings } from '../../../../services/db';
import { generateOpenAiResponse, pickOpenAiReasoningEffort } from '../../../../services/openaiService';

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
  try {
    const { code, provider } = await request.json();
    if (!code) return NextResponse.json({ error: 'Code required' }, { status: 400 });

    const settings = await fetchSystemSettings();
    const envKey = process.env.OPENAI_API_KEY;
    
    // Prioritize OpenAI if env var exists or settings explicitly set it
    const isOpenAiDefault = envKey || (settings?.ai?.defaultProvider === 'OPENAI');

    if (isOpenAiDefault) {
      const apiKey = envKey || settings.ai?.openaiKey;
      if (apiKey) {
        const model = settings?.ai?.openaiModelHigh || settings?.ai?.openaiModelDefault || settings?.ai?.openaiModel || settings?.ai?.defaultModel || 'gpt-5.2-pro';
        const analysis = await analyzeOpenAiTerraform(code, provider || 'Azure', apiKey, model);
        return NextResponse.json({ analysis, engine: `OpenAI ${model}` });
      }
    }

    // Default path for Gemini
    const model = settings?.ai?.geminiFlashModel || settings?.ai?.flashModel || 'gemini-3-flash-preview';
    const analysis = await analyzeTerraform(code, provider || 'Azure', model);
    return NextResponse.json({ analysis, engine: 'Gemini 3 Flash' });

  } catch (error: any) {
    console.error("Audit AI Error:", error);
    return NextResponse.json({ error: error.message || 'AI processing failed' }, { status: 500 });
  }
}
