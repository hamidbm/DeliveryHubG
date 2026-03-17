import { NextResponse } from 'next/server';
import { fetchSystemSettings } from '../../../../../services/aiSettings';
import { checkAndIncrementAiRateLimit, fetchWikiAssetAiHistory, saveAiAuditLog, saveWikiAssetAiHistory } from '../../../../../services/aiPersistence';
import { getRateLimitPerHour, getRequestIdentity, getRetentionDays } from '../../../../../services/aiPolicy';
import { executeAiTextTask } from '../../../../../services/aiRouting';

const VALID_TASKS = new Set(['summary', 'key_decisions', 'assumptions']);

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
  const startedAt = Date.now();
  try {
    const { task, content, title, assetId } = await request.json();

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
      task === 'summary'
        ? 'assetSummary'
        : task === 'key_decisions'
          ? 'assetKeyDecisions'
          : 'assetAssumptions';
    const prompt = buildAssetPrompt(task, content, title);
    const geminiModel = aiSettings.geminiFlashModel || aiSettings.flashModel || 'gemini-3-flash-preview';
    const execution = await executeAiTextTask({
      aiSettings,
      taskKey,
      prompt,
      openAiFallbackModel: 'gpt-5.2',
      geminiModel
    });
    const result = execution.text;
    if (assetId) {
      await saveWikiAssetAiHistory({
        assetId,
        task,
        result,
        provider: execution.provider,
        model: execution.model,
        ttlDays: getRetentionDays(aiSettings, 'assetAi', 30)
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
      task: 'assetAi',
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
  const assetId = searchParams.get('assetId');
  const limit = Number(searchParams.get('limit') || 10);
  if (!assetId) {
    return NextResponse.json({ error: 'assetId is required.' }, { status: 400 });
  }
  const history = await fetchWikiAssetAiHistory(assetId, Number.isNaN(limit) ? 10 : limit);
  return NextResponse.json({ history });
}
