import { NextResponse } from 'next/server';
import { checkAndIncrementAiRateLimit, fetchSystemSettings, fetchWikiQaHistory, saveAiAuditLog, saveWikiQaHistory } from '../../../../services/db';
import { getRateLimitPerHour, getRequestIdentity, getRetentionDays } from '../../../../services/aiPolicy';
import { executeAiTextTask } from '../../../../services/aiRouting';

type AiSettings = {
  defaultProvider?: string;
  openRouterModel?: string;
  openaiModelDefault?: string;
  openaiModelHigh?: string;
  openaiModel?: string;
  defaultModel?: string;
  geminiFlashModel?: string;
  flashModel?: string;
};

const buildQaPrompt = (question: string, content: string, title?: string) => {
  const header = title ? `Title: ${title}\n\n` : '';
  return `${header}Answer the question using ONLY the content below. If the answer is not present, say "Not found in this page." Answer in Markdown.\n\nQuestion:\n${question}\n\nContent:\n${content}`;
};

export async function POST(request: Request) {
  const startedAt = Date.now();
  try {
    const { question, content, title, pageId, targetId, targetType } = await request.json();

    if (!question || !question.trim()) {
      return NextResponse.json({ error: 'Question is required.' }, { status: 400 });
    }

    if (!content || !content.trim()) {
      return NextResponse.json({ error: 'Content is required for Q&A.' }, { status: 400 });
    }

    const settings = await fetchSystemSettings();
    const aiSettings: AiSettings = (settings?.ai || {}) as AiSettings;
    const identity = getRequestIdentity(request);
    const allowed = await checkAndIncrementAiRateLimit(identity, getRateLimitPerHour(aiSettings, 30));
    if (!allowed) {
      return NextResponse.json({ error: 'Rate limit exceeded.' }, { status: 429 });
    }
    const taskKey = targetType === 'asset' ? 'assetQa' : 'wikiQa';
    const prompt = buildQaPrompt(question, content, title);
    const geminiModel = aiSettings.geminiFlashModel || aiSettings.flashModel || 'gemini-3-flash-preview';
    const execution = await executeAiTextTask({
      aiSettings,
      taskKey,
      prompt,
      openAiFallbackModel: 'gpt-5.2',
      geminiModel
    });
    const result = execution.text;
    const resolvedTargetId = targetId || pageId;
    const resolvedTargetType = targetType || (pageId ? 'page' : 'asset');
    if (resolvedTargetId) {
      await saveWikiQaHistory({
        targetId: resolvedTargetId,
        targetType: resolvedTargetType,
        ttlDays: getRetentionDays(aiSettings, resolvedTargetType === 'asset' ? 'assetQa' : 'wikiQa', 30),
        question,
        answer: result,
        provider: execution.provider,
        model: execution.model
      });
    }
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
      task: 'wikiQa',
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

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const pageId = searchParams.get('pageId');
  const targetId = searchParams.get('targetId');
  const targetType = (searchParams.get('targetType') || (pageId ? 'page' : 'asset')) as 'page' | 'asset';
  const limit = Number(searchParams.get('limit') || 10);
  const resolvedTargetId = targetId || pageId;
  if (!resolvedTargetId) {
    return NextResponse.json({ error: 'targetId is required.' }, { status: 400 });
  }
  const history = await fetchWikiQaHistory(resolvedTargetId, targetType, Number.isNaN(limit) ? 10 : limit);
  return NextResponse.json({ history });
}
