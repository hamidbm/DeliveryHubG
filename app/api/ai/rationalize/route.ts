
import { NextResponse } from 'next/server';
import { suggestRationalization } from '../../../../services/geminiService';

export async function POST(request: Request) {
  try {
    const app = await request.json();
    if (!app) return NextResponse.json({ error: 'App data required' }, { status: 400 });
    const result = await suggestRationalization(app);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: 'AI processing failed' }, { status: 500 });
  }
}
