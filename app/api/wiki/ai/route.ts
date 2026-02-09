import { NextResponse } from 'next/server';
import { fetchSystemSettings } from '../../../../services/db';
import { buildWikiPrompt, generateWikiAssistance, WikiAssistTask } from '../../../../services/geminiService';

const VALID_TASKS = new Set(['improve', 'expand', 'diagram', 'summary']);

const generateOpenAiResponse = async ({
  task,
  content,
  format,
  title,
  model,
  apiKey
}: {
  task: WikiAssistTask;
  content: string;
  format: string;
  title?: string;
  model: string;
  apiKey: string;
}) => {
  const prompt = buildWikiPrompt(task, content, format, title);
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2
    })
  });
  const data = await response.json();
  if (!response.ok || data.error) {
    throw new Error(data.error?.message || 'OpenAI API Error');
  }
  return data.choices?.[0]?.message?.content || 'AI response unavailable.';
};

export async function POST(request: Request) {
  try {
    const { task, content, title, format } = await request.json();

    if (!VALID_TASKS.has(task)) {
      return NextResponse.json({ error: 'Invalid AI task requested.' }, { status: 400 });
    }

    if (!content || !content.trim()) {
      return NextResponse.json({ error: 'Content is required for AI assistance.' }, { status: 400 });
    }

    const settings = await fetchSystemSettings();
    const aiSettings = settings?.ai || {};
    const providerSetting =
      aiSettings.defaultProvider ||
      (settings as any)?.defaultProvider ||
      (aiSettings.openaiKey ? 'OPENAI' : undefined);
    const provider = String(providerSetting || 'GEMINI').toUpperCase();
    const model =
      task === 'diagram' || task === 'summary'
        ? aiSettings.proModel || 'gemini-3-pro-preview'
        : aiSettings.flashModel || 'gemini-3-flash-preview';

    if (provider === 'OPENAI' || process.env.OPENAI_API_KEY || aiSettings.openaiKey) {
      const apiKey = process.env.OPENAI_API_KEY || aiSettings.openaiKey;
      if (!apiKey) {
        return NextResponse.json({ error: 'OpenAI API key is missing.' }, { status: 400 });
      }
      const openAiModel = aiSettings.defaultModel || 'gpt-4o';
      const result = await generateOpenAiResponse({
        task,
        content,
        title,
        format: format || 'markdown',
        model: openAiModel,
        apiKey
      });
      return NextResponse.json({ result, provider: 'OPENAI' });
    }

    if (!process.env.API_KEY) {
      return NextResponse.json({ error: 'Gemini API key is missing.' }, { status: 400 });
    }

    try {
      const result = await generateWikiAssistance({
        task,
        content,
        title,
        format: format || 'markdown',
        model
      });

      return NextResponse.json({ result, provider: provider === 'GEMINI' ? 'GEMINI' : 'GEMINI_FALLBACK' });
    } catch (error: any) {
      const message = String(error?.message || '');
      const status = error?.status || error?.code;
      const isQuota =
        status === 429 ||
        message.includes('RESOURCE_EXHAUSTED') ||
        message.includes('Quota exceeded');

      if (isQuota && (process.env.OPENAI_API_KEY || aiSettings.openaiKey)) {
        const apiKey = process.env.OPENAI_API_KEY || aiSettings.openaiKey;
        const openAiModel = aiSettings.defaultModel || 'gpt-4o';
        const result = await generateOpenAiResponse({
          task,
          content,
          title,
          format: format || 'markdown',
          model: openAiModel,
          apiKey
        });
        return NextResponse.json({ result, provider: 'OPENAI_FALLBACK' });
      }

      if (isQuota) {
        return NextResponse.json({ error: 'Gemini quota exceeded. Please retry later or switch providers.' }, { status: 429 });
      }

      return NextResponse.json({ error: 'AI request failed.' }, { status: 500 });
    }
  } catch (error) {
    return NextResponse.json({ error: 'AI request failed.' }, { status: 500 });
  }
}
