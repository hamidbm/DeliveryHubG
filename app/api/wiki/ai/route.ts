import { NextResponse } from 'next/server';
import { fetchSystemSettings } from '../../../../services/db';
import { generateWikiAssistance } from '../../../../services/geminiService';

const VALID_TASKS = new Set(['improve', 'expand', 'diagram', 'summary']);

export async function POST(request: Request) {
  try {
    const { task, content, title, format } = await request.json();

    if (!VALID_TASKS.has(task)) {
      return NextResponse.json({ error: 'Invalid AI task requested.' }, { status: 400 });
    }

    if (!content || !content.trim()) {
      return NextResponse.json({ error: 'Content is required for AI assistance.' }, { status: 400 });
    }

    if (!process.env.API_KEY) {
      return NextResponse.json({ error: 'Gemini API key is missing.' }, { status: 400 });
    }

    const settings = await fetchSystemSettings();
    const aiSettings = settings?.ai || {};
    const provider = aiSettings.defaultProvider || 'GEMINI';
    const model =
      task === 'diagram' || task === 'summary'
        ? aiSettings.proModel || 'gemini-3-pro-preview'
        : aiSettings.flashModel || 'gemini-3-flash-preview';

    const result = await generateWikiAssistance({
      task,
      content,
      title,
      format: format || 'markdown',
      model
    });

    return NextResponse.json({ result, provider: provider === 'GEMINI' ? 'GEMINI' : 'GEMINI_FALLBACK' });
  } catch (error) {
    return NextResponse.json({ error: 'AI request failed.' }, { status: 500 });
  }
}
