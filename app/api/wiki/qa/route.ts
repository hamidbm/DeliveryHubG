import { NextResponse } from 'next/server';
import { fetchSystemSettings, fetchWikiQaHistory, saveWikiQaHistory } from '../../../../services/db';
import { generateGeminiText } from '../../../../services/geminiService';
import { generateOpenAiResponse } from '../../../../services/openaiService';

const buildQaPrompt = (question: string, content: string, title?: string) => {
  const header = title ? `Title: ${title}\n\n` : '';
  return `${header}Answer the question using ONLY the content below. If the answer is not present, say "Not found in this page." Answer in Markdown.\n\nQuestion:\n${question}\n\nContent:\n${content}`;
};

export async function POST(request: Request) {
  try {
    const { question, content, title, pageId } = await request.json();

    if (!question || !question.trim()) {
      return NextResponse.json({ error: 'Question is required.' }, { status: 400 });
    }

    if (!content || !content.trim()) {
      return NextResponse.json({ error: 'Content is required for Q&A.' }, { status: 400 });
    }

    const settings = await fetchSystemSettings();
    const aiSettings = settings?.ai || {};
    const provider = aiSettings.defaultProvider || 'GEMINI';
    const isOpenAiDefault = provider === 'OPENAI' || Boolean(process.env.OPENAI_API_KEY);
    const prompt = buildQaPrompt(question, content, title);

    if (isOpenAiDefault) {
      const apiKey = process.env.OPENAI_API_KEY || aiSettings.openaiKey;
      const configuredModel = aiSettings.openaiModelDefault || aiSettings.openaiModelHigh || aiSettings.openaiModel || aiSettings.defaultModel || 'gpt-5.2';
      const model = configuredModel.startsWith('gpt-') ? configuredModel : 'gpt-5.2';
      const reasoningEffort = model.startsWith('gpt-5.2-pro') ? 'medium' : 'low';

      if (apiKey) {
        const result = await generateOpenAiResponse({
          prompt,
          model,
          apiKey,
          reasoningEffort
        });
        if (pageId) {
          await saveWikiQaHistory({
            pageId,
            question,
            answer: result,
            provider: 'OPENAI',
            model
          });
        }
        return NextResponse.json({ result, provider: 'OPENAI' });
      }
    }

    if (!process.env.API_KEY) {
      return NextResponse.json({ error: 'Gemini API key is missing.' }, { status: 400 });
    }

    const geminiModel = aiSettings.geminiFlashModel || aiSettings.flashModel || 'gemini-3-flash-preview';
    const result = await generateGeminiText(prompt, geminiModel);
    if (pageId) {
      await saveWikiQaHistory({
        pageId,
        question,
        answer: result,
        provider: isOpenAiDefault ? 'GEMINI_FALLBACK' : 'GEMINI',
        model: geminiModel
      });
    }
    return NextResponse.json({ result, provider: isOpenAiDefault ? 'GEMINI_FALLBACK' : 'GEMINI' });
  } catch (error) {
    return NextResponse.json({ error: 'AI request failed.' }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const pageId = searchParams.get('pageId');
  const limit = Number(searchParams.get('limit') || 10);
  if (!pageId) {
    return NextResponse.json({ error: 'pageId is required.' }, { status: 400 });
  }
  const history = await fetchWikiQaHistory(pageId, Number.isNaN(limit) ? 10 : limit);
  return NextResponse.json({ history });
}
