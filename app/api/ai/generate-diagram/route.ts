
import { NextResponse } from 'next/server';
import { generateDiagramFromTerraform } from '../../../../services/geminiService';

export async function POST(request: Request) {
  try {
    const { code } = await request.json();
    if (!code) return NextResponse.json({ error: 'Terraform code required' }, { status: 400 });
    const mermaid = await generateDiagramFromTerraform(code);
    return NextResponse.json({ mermaid });
  } catch (error) {
    return NextResponse.json({ error: 'AI processing failed' }, { status: 500 });
  }
}
