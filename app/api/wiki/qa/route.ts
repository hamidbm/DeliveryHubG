import { NextResponse } from 'next/server';
import { checkAndIncrementAiRateLimit, fetchSystemSettings, fetchWikiQaHistory, saveAiAuditLog, saveWikiQaHistory } from '../../../../services/db';
import { generateGeminiText } from '../../../../services/geminiService';
import { generateOpenAiResponse } from '../../../../services/openaiService';
import { getRateLimitPerHour, getRequestIdentity, getRetentionDays, resolveTaskRouting } from '../../../../services/aiPolicy';

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
    const aiSettings = settings?.ai || {};
    const provider = aiSettings.defaultProvider || 'GEMINI';
    const identity = getRequestIdentity(request);
    const allowed = await checkAndIncrementAiRateLimit(identity, getRateLimitPerHour(aiSettings, 30));
    if (!allowed) {
      return NextResponse.json({ error: 'Rate limit exceeded.' }, { status: 429 });
    }
    const taskKey = targetType === 'asset' ? 'assetQa' : 'wikiQa';
    const { provider: routedProvider, model: routedModel } = resolveTaskRouting(aiSettings, taskKey, provider);
    const openAiIntended = routedProvider === 'OPENAI';
    const geminiProviderLabel = routedProvider === 'GEMINI' ? 'GEMINI' : 'GEMINI_FALLBACK';
    const prompt = buildQaPrompt(question, content, title);

    if (openAiIntended) {
      const apiKey = process.env.OPENAI_API_KEY || aiSettings.openaiKey;
      const configuredModel = routedModel || aiSettings.openaiModelDefault || aiSettings.openaiModelHigh || aiSettings.openaiModel || aiSettings.defaultModel || 'gpt-5.2';
      const model = configuredModel.startsWith('gpt-') ? configuredModel : 'gpt-5.2';
      const reasoningEffort = model.startsWith('gpt-5.2-pro') ? 'medium' : 'low';

      if (apiKey) {
        const result = await generateOpenAiResponse({
          prompt,
          model,
          apiKey,
          reasoningEffort
        });
        const resolvedTargetId = targetId || pageId;
        const resolvedTargetType = targetType || (pageId ? 'page' : 'asset');
        if (resolvedTargetId) {
          await saveWikiQaHistory({
            targetId: resolvedTargetId,
            targetType: resolvedTargetType,
            ttlDays: getRetentionDays(aiSettings, resolvedTargetType === 'asset' ? 'assetQa' : 'wikiQa', 30),
            question,
            answer: result,
            provider: 'OPENAI',
            model
          });
        }
        await saveAiAuditLog({
          task: taskKey,
          provider: 'OPENAI',
          model,
          success: true,
          latencyMs: Date.now() - startedAt,
          identity,
          ttlDays: getRetentionDays(aiSettings, 'auditLogs', 30)
        });
        return NextResponse.json({ result, provider: 'OPENAI' });
      }
    }

    if (!process.env.API_KEY) {
      return NextResponse.json({ error: 'Gemini API key is missing.' }, { status: 400 });
    }

    const geminiModel =
      routedProvider === 'GEMINI' && routedModel
        ? routedModel
        : aiSettings.geminiFlashModel || aiSettings.flashModel || 'gemini-3-flash-preview';
    const result = await generateGeminiText(prompt, geminiModel);
    const resolvedTargetId = targetId || pageId;
    const resolvedTargetType = targetType || (pageId ? 'page' : 'asset');
    if (resolvedTargetId) {
      await saveWikiQaHistory({
        targetId: resolvedTargetId,
        targetType: resolvedTargetType,
        ttlDays: getRetentionDays(aiSettings, resolvedTargetType === 'asset' ? 'assetQa' : 'wikiQa', 30),
        question,
        answer: result,
        provider: geminiProviderLabel,
        model: geminiModel
      });
    }
    await saveAiAuditLog({
      task: taskKey,
      provider: geminiProviderLabel,
      model: geminiModel,
      success: true,
      latencyMs: Date.now() - startedAt,
      identity,
      ttlDays: getRetentionDays(aiSettings, 'auditLogs', 30)
    });
    return NextResponse.json({ result, provider: geminiProviderLabel });
  } catch (error) {
    const settings = await fetchSystemSettings();
    const aiSettings = settings?.ai || {};
    await saveAiAuditLog({
      task: 'wikiQa',
      provider: 'UNKNOWN',
      success: false,
      error: (error as Error)?.message,
      latencyMs: Date.now() - startedAt,
      identity: getRequestIdentity(request),
      ttlDays: getRetentionDays(aiSettings, 'auditLogs', 30)
    });
    return NextResponse.json({ error: 'AI request failed.' }, { status: 500 });
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
