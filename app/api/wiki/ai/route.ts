import { NextResponse } from 'next/server';
import { fetchSystemSettings } from '../../../../services/db';
import { generateWikiAssistance } from '../../../../services/geminiService';
import { generateOpenAiResponse } from '../../../../services/openaiService';

type WikiAssistTask = 'improve' | 'expand' | 'diagram' | 'summary';

const buildWikiPrompt = (task: WikiAssistTask, content: string, format: string, title?: string) => {
  const header = title ? `Title: ${title}\n\n` : '';
  const formatHint = format === 'html' ? 'HTML' : 'Markdown';

  switch (task) {
    case 'improve':
      return `${header}Improve the clarity and flow of the following ${formatHint} content. Preserve meaning and structure, avoid adding new sections unless necessary.\n\nContent:\n${content}`;
    case 'expand':
      return `${header}Expand the following ${formatHint} outline into a richer, more detailed section. Keep the original headings and structure.\n\nContent:\n${content}`;
    case 'diagram':
      return `${header}Generate a Mermaid diagram based on the following content. Return ONLY a Mermaid code block fenced with mermaid syntax. Prefer flowchart or sequence diagrams.\n\nContent:\n${content}`;
    case 'summary':
    default:
      return `${header}Provide a concise summary (3-5 bullet points or a short paragraph) of the following content in ${formatHint}.\n\nContent:\n${content}`;
  }
};

const generateOpenAiWikiAssistance = async ({
  task,
  content,
  format,
  title,
  model,
  apiKey,
  reasoningEffort
}: {
  task: WikiAssistTask;
  content: string;
  format: string;
  title?: string;
  model: string;
  apiKey: string;
  reasoningEffort: 'low' | 'medium' | 'high' | 'xhigh';
}) => {
  const prompt = buildWikiPrompt(task, content, format, title);
  try {
    return await generateOpenAiResponse({
      prompt,
      model,
      apiKey,
      reasoningEffort
    });
  } catch (error: any) {
    console.error("OpenAI Wiki Assist Error:", error);
    return "AI response unavailable.";
  }
};

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

    const settings = await fetchSystemSettings();
    const aiSettings = settings?.ai || {};
    const provider = aiSettings.defaultProvider || 'GEMINI';
    const isOpenAiDefault = provider === 'OPENAI' || Boolean(process.env.OPENAI_API_KEY);
    const formatValue = format || 'markdown';

    if (isOpenAiDefault) {
      const apiKey = process.env.OPENAI_API_KEY || aiSettings.openaiKey;
      const configuredModel = aiSettings.openaiModelDefault || aiSettings.openaiModelHigh || aiSettings.openaiModel || aiSettings.defaultModel || 'gpt-5.2';
      const model = configuredModel.startsWith('gpt-') ? configuredModel : 'gpt-5.2';
      const reasoningEffort = model.startsWith('gpt-5.2-pro') ? 'medium' : 'low';

      if (apiKey) {
        const result = await generateOpenAiWikiAssistance({
          task,
          content,
          title,
          format: formatValue,
          model,
          apiKey,
          reasoningEffort
        });
        return NextResponse.json({ result, provider: 'OPENAI' });
      }
    }

    if (!process.env.API_KEY) {
      return NextResponse.json({ error: 'Gemini API key is missing.' }, { status: 400 });
    }

    const geminiModel =
      task === 'diagram' || task === 'summary'
        ? aiSettings.geminiProModel || aiSettings.proModel || 'gemini-3-pro-preview'
        : aiSettings.geminiFlashModel || aiSettings.flashModel || 'gemini-3-flash-preview';

    const result = await generateWikiAssistance({
      task,
      content,
      title,
      format: formatValue,
      model: geminiModel
    });

    return NextResponse.json({ result, provider: isOpenAiDefault ? 'GEMINI_FALLBACK' : 'GEMINI' });
  } catch (error) {
    return NextResponse.json({ error: 'AI request failed.' }, { status: 500 });
  }
}
