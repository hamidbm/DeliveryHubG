import { NextResponse } from 'next/server';
import { checkAndIncrementAiRateLimit, fetchSystemSettings, saveAiAuditLog } from '../../../../services/db';
import { getRateLimitPerHour, getRequestIdentity, getRetentionDays } from '../../../../services/aiPolicy';
import { executeAiTextTask } from '../../../../services/aiRouting';

type WikiAssistTask = 'improve' | 'expand' | 'diagram' | 'summary' | 'template' | 'key_decisions' | 'assumptions';
type AiSettings = {
  defaultProvider?: string;
  openRouterModel?: string;
  openaiModelDefault?: string;
  openaiModelHigh?: string;
  openaiModel?: string;
  defaultModel?: string;
  geminiProModel?: string;
  proModel?: string;
  geminiFlashModel?: string;
  flashModel?: string;
};

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
    case 'template':
      return `${header}Create a Markdown template document using the guidance below. Include section headings, and add brief sample placeholders where helpful. Return Markdown only.\n\nGuidance:\n${content}`;
    case 'key_decisions':
      return `${header}Extract the key decisions from the following content. Return bullet points in ${formatHint}.\n\nContent:\n${content}`;
    case 'assumptions':
      return `${header}List the assumptions found in the following content. Return bullet points in ${formatHint}.\n\nContent:\n${content}`;
  }
};

const VALID_TASKS = new Set(['improve', 'expand', 'diagram', 'summary', 'template', 'key_decisions', 'assumptions']);

export async function POST(request: Request) {
  const startedAt = Date.now();
  try {
    const { task, content, title, format } = await request.json();

    if (!VALID_TASKS.has(task)) {
      return NextResponse.json({ error: 'Invalid AI task requested.' }, { status: 400 });
    }

    if (!content || !content.trim()) {
      return NextResponse.json({ error: 'Content is required for AI assistance.' }, { status: 400 });
    }

    const settings = await fetchSystemSettings();
    const aiSettings: AiSettings = (settings?.ai || {}) as AiSettings;
    const identity = getRequestIdentity(request);
    const allowed = await checkAndIncrementAiRateLimit(identity, getRateLimitPerHour(aiSettings, 30));
    if (!allowed) {
      return NextResponse.json({ error: 'Rate limit exceeded.' }, { status: 429 });
    }
    const taskKey =
      task === 'summary' || task === 'template' || task === 'key_decisions' || task === 'assumptions'
        ? 'wikiSummary'
        : task === 'diagram'
          ? 'wikiDiagram'
          : task === 'expand'
            ? 'wikiExpand'
            : 'wikiImprove';
    const formatValue = format || 'markdown';
    const geminiModel = task === 'diagram' || task === 'summary' || task === 'template' || task === 'key_decisions' || task === 'assumptions'
      ? aiSettings.geminiProModel || aiSettings.proModel || 'gemini-3-pro-preview'
      : aiSettings.geminiFlashModel || aiSettings.flashModel || 'gemini-3-flash-preview';
    const execution = await executeAiTextTask({
      aiSettings,
      taskKey,
      prompt: buildWikiPrompt(task, content, formatValue, title),
      openAiFallbackModel: 'gpt-5.2',
      geminiModel
    });
    const result = execution.text;

    await saveAiAuditLog({
      task: taskKey,
      provider: execution.provider,
      model: execution.model,
      success: true,
      latencyMs: Date.now() - startedAt,
      identity,
      ttlDays: getRetentionDays(aiSettings, 'auditLogs', 30)
    });
    return NextResponse.json({ result, provider: execution.provider });
  } catch (error) {
    const message = (error as Error)?.message || 'AI request failed.';
    const status = message.startsWith('No default AI provider is configured') ? 400 : 500;
    const settings = await fetchSystemSettings();
    const aiSettings: AiSettings = (settings?.ai || {}) as AiSettings;
    await saveAiAuditLog({
      task: 'wikiAi',
      provider: 'UNKNOWN',
      success: false,
      error: (error as Error)?.message,
      latencyMs: Date.now() - startedAt,
      identity: getRequestIdentity(request),
      ttlDays: getRetentionDays(aiSettings, 'auditLogs', 30)
    });
    return NextResponse.json({ error: message }, { status });
  }
}
