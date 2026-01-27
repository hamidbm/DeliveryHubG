
import { NextResponse } from 'next/server';
import { analyzeTerraform } from '../../../../services/geminiService';

export async function POST(request: Request) {
  try {
    const { code, provider } = await request.json();
    if (!code) return NextResponse.json({ error: 'Code required' }, { status: 400 });
    const analysis = await analyzeTerraform(code, provider || 'Azure');
    return NextResponse.json({ analysis });
  } catch (error) {
    return NextResponse.json({ error: 'AI processing failed' }, { status: 500 });
  }
}
