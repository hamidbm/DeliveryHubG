import { NextResponse } from 'next/server';
import { fetchSystemSettings, fetchWikiAssetAiHistory, saveWikiAssetAiHistory } from '../../../../../services/db';
import { generateGeminiText } from '../../../../../services/geminiService';
import { generateOpenAiResponse } from '../../../../../services/openaiService';

const VALID_TASKS = new Set(['summary', 'key_decisions', 'assumptions']);

const buildAssetPrompt = (task: string, content: string, title?: string) => {
  const header = title ? `Title: ${title}\n\n` : '';
  switch (task) {
    case 'key_decisions':
      return `${header}Extract the key decisions from the following content. Return bullet points in Markdown.\n\nContent:\n${content}`;
    case 'assumptions':
      return `${header}List the assumptions found in the following content. Return bullet points in Markdown.\n\nContent:\n${content}`;
    case 'summary':
    default:
      return `${header}Provide a concise summary (3-5 bullet points or a short paragraph) of the following content in Markdown.\n\nContent:\n${content}`;
  }
};

export async function POST(request: Request) {
  try {
    const { task, content, title, assetId } = await request.json();

    if (!VALID_TASKS.has(task)) {
      return NextResponse.json({ error: 'Invalid AI task requested.' }, { status: 400 });
    }

    if (!content || !content.trim()) {
      return NextResponse.json({ error: 'Content is required for AI assistance.' }, { status: 400 });
    }

    const settings = await fetchSystemSettings();
    const aiSettings = settings?.ai || {};
    const provider = aiSettings.defaultProvider || 'GEMINI';
    const isOpenAiDefault = provider === 'OPENAI' || Boolean(process.env.OPENAI_API_KEY);
    const prompt = buildAssetPrompt(task, content, title);

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
        if (assetId) {
          await saveWikiAssetAiHistory({
            assetId,
            task,
            result,
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
    if (assetId) {
      await saveWikiAssetAiHistory({
        assetId,
        task,
        result,
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
  const assetId = searchParams.get('assetId');
  const limit = Number(searchParams.get('limit') || 10);
  if (!assetId) {
    return NextResponse.json({ error: 'assetId is required.' }, { status: 400 });
  }
  const history = await fetchWikiAssetAiHistory(assetId, Number.isNaN(limit) ? 10 : limit);
  return NextResponse.json({ history });
}
