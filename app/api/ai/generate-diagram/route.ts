import { NextResponse } from 'next/server';
import { generateDiagramFromTerraform } from '../../../../services/geminiService';
import { fetchSystemSettings } from '../../../../services/db';
import { generateOpenAiResponse, pickOpenAiReasoningEffort } from '../../../../services/openaiService';

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
  try {
    const { code } = await request.json();
    if (!code) return NextResponse.json({ error: 'Terraform code required' }, { status: 400 });
    
    const settings = await fetchSystemSettings();
    const envKey = process.env.OPENAI_API_KEY;
    
    // Auto-detect and prioritize OpenAI if env var is present, 
    // or if DB explicitly says OpenAI.
    const isOpenAiDefault = envKey || (settings?.ai?.defaultProvider === 'OPENAI');
    
    if (isOpenAiDefault) {
      const apiKey = envKey || settings.ai?.openaiKey;
      if (!apiKey) {
        // Fallback to Gemini if OpenAI is intended but key is missing
        const model = settings?.ai?.geminiProModel || settings?.ai?.proModel || 'gemini-3-pro-preview';
        const mermaid = await generateDiagramFromTerraform(code, model);
        return NextResponse.json({ mermaid, engine: 'Gemini 3 Pro (OpenAI Key Missing)' });
      }
      
      const model = settings?.ai?.openaiModelHigh || settings?.ai?.openaiModelDefault || settings?.ai?.openaiModel || settings?.ai?.defaultModel || 'gpt-5.2-pro';
      const mermaid = await generateOpenAiDiagram(code, apiKey, model);
      return NextResponse.json({ mermaid, engine: `OpenAI ${model}` });
    }

    // Default path for Gemini
    const model = settings?.ai?.geminiProModel || settings?.ai?.proModel || 'gemini-3-pro-preview';
    const mermaid = await generateDiagramFromTerraform(code, model);
    return NextResponse.json({ mermaid, engine: 'Gemini 3 Pro' });

  } catch (error: any) {
    console.error("AI Dispatch Error:", error);
    return NextResponse.json({ error: error.message || 'AI processing failed' }, { status: 500 });
  }
}
