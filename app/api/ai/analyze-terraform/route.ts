import { NextResponse } from 'next/server';
import { analyzeTerraform } from '../../../../services/geminiService';
import { fetchSystemSettings } from '../../../../services/db';

async function analyzeOpenAiTerraform(code: string, provider: string, apiKey: string) {
  const prompt = `Act as a Cloud Architect and Security Engineer. Analyze this ${provider} Terraform script for:
  1. Security Risks (Misconfigurations, wide-open rules, missing encryption)
  2. Cost Optimization (Right-sizing, redundant resources)
  3. Best Practices (Naming conventions, modularity)
  
  Provide a structured review in Markdown.
  
  Terraform code: 
  ${code}`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3
      })
    });

    const data = await response.json();
    if (data.error) throw new Error(data.error.message || "OpenAI API Error");
    return data.choices[0].message.content || "Analysis failed.";
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
        const analysis = await analyzeOpenAiTerraform(code, provider || 'Azure', apiKey);
        return NextResponse.json({ analysis, engine: 'OpenAI GPT-4' });
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
