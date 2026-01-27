import { NextResponse } from 'next/server';
import { generateDiagramFromTerraform } from '../../../../services/geminiService';
import { fetchSystemSettings } from '../../../../services/db';

export async function POST(request: Request) {
  try {
    const { code } = await request.json();
    if (!code) return NextResponse.json({ error: 'Terraform code required' }, { status: 400 });
    
    const settings = await fetchSystemSettings();
    const model = settings?.ai?.proModel || 'gemini-3-pro-preview';

    const mermaid = await generateDiagramFromTerraform(code, model);
    return NextResponse.json({ mermaid });
  } catch (error) {
    return NextResponse.json({ error: 'AI processing failed' }, { status: 500 });
  }
}