import { NextResponse } from 'next/server';
import { suggestRationalization } from '../../../../services/geminiService';
import { fetchSystemSettings } from '../../../../services/db';

export async function POST(request: Request) {
  try {
    const app = await request.json();
    if (!app) return NextResponse.json({ error: 'App data required' }, { status: 400 });
    
    const settings = await fetchSystemSettings();
    const model = settings?.ai?.flashModel || 'gemini-3-flash-preview';

    const result = await suggestRationalization(app, model);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: 'AI processing failed' }, { status: 500 });
  }
}