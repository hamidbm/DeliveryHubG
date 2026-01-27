import { NextResponse } from 'next/server';
import { generateDiagramFromTerraform } from '../../../../services/geminiService';
import { fetchSystemSettings } from '../../../../services/db';

async function generateOpenAiDiagram(code: string, apiKey: string) {
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
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2
      })
    });

    const data = await response.json();
    const text = data.choices[0].message.content || "";
    return text.replace(/```mermaid/g, '').replace(/```/g, '').trim();
  } catch (err) {
    console.error("OpenAI Error:", err);
    throw new Error("OpenAI failed to generate diagram.");
  }
}

export async function POST(request: Request) {
  try {
    const { code } = await request.json();
    if (!code) return NextResponse.json({ error: 'Terraform code required' }, { status: 400 });
    
    const settings = await fetchSystemSettings();
    const provider = settings?.ai?.defaultProvider || 'GEMINI';
    
    if (provider === 'OPENAI') {
      // Prioritize environment variable, fallback to settings key
      const apiKey = process.env.OPENAI_API_KEY || settings.ai?.openaiKey;
      if (!apiKey) {
        return NextResponse.json({ error: 'OpenAI API Key missing in System Environment or Admin Settings' }, { status: 401 });
      }
      const mermaid = await generateOpenAiDiagram(code, apiKey);
      return NextResponse.json({ mermaid, engine: 'OpenAI GPT-4' });
    }

    // Default to Gemini
    const model = settings?.ai?.proModel || 'gemini-3-pro-preview';
    const mermaid = await generateDiagramFromTerraform(code, model);
    return NextResponse.json({ mermaid, engine: 'Gemini 3 Pro' });

  } catch (error: any) {
    console.error("AI Dispatch Error:", error);
    return NextResponse.json({ error: error.message || 'AI processing failed' }, { status: 500 });
  }
}
