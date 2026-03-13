import { NextResponse } from 'next/server';
import { fetchAiAnalysisCache, fetchSystemSettings } from '../../../../services/db';
import { getAuthUserFromCookies } from '../../../../services/visibility';
import { PortfolioQueryResponse, PortfolioSummaryResponse } from '../../../../types/ai';
import { derivePortfolioSignals } from '../../../../services/ai/portfolioSignals';
import { answerPortfolioQuestionDeterministically } from '../../../../services/ai/queryEngine';
import { executeAiTextTask } from '../../../../services/aiRouting';

const CACHE_KEY = 'portfolio-summary';

type AiSettings = {
  geminiProModel?: string;
  proModel?: string;
};

const parseQuestionBody = async (request: Request) => {
  try {
    const body = await request.json();
    return typeof body?.question === 'string' ? body.question.trim() : '';
  } catch {
    return '';
  }
};

const loadStructuredReport = async (): Promise<PortfolioSummaryResponse | null> => {
  const cached = await fetchAiAnalysisCache(CACHE_KEY);
  if (!cached) return null;
  const source = cached?.status === 'success'
    ? cached
    : (cached?.report?.status === 'success' ? cached.report : null);
  if (!source) return null;
  return {
    status: 'success',
    metadata: source.metadata,
    snapshot: source.snapshot,
    report: source.report
  };
};

export async function POST(request: Request) {
  const authUser = await getAuthUserFromCookies();
  if (!authUser?.userId) {
    return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  }

  const question = await parseQuestionBody(request);
  if (!question) {
    return NextResponse.json({ error: 'Question is required.' }, { status: 400 });
  }

  const cached = await loadStructuredReport();
  if (!cached?.snapshot) {
    return NextResponse.json({ error: 'No portfolio analysis is available yet. Generate analysis first.' }, { status: 400 });
  }

  const signals = derivePortfolioSignals(cached.snapshot);
  const deterministic = answerPortfolioQuestionDeterministically(question, signals, cached.report);
  let answer: PortfolioQueryResponse = deterministic;

  try {
    const settings = await fetchSystemSettings();
    const aiSettings: AiSettings = (settings?.ai || {}) as AiSettings;
    const prompt = `You are a delivery portfolio analyst.
User question: ${question}

Deterministic answer baseline:
${JSON.stringify(deterministic, null, 2)}

Deterministic signals:
${JSON.stringify(signals, null, 2)}

Structured report:
${JSON.stringify(cached.report || {}, null, 2)}

Return strict JSON only with shape:
{
  "answer": "string",
  "explanation": "string",
  "evidence": [{"label":"string","value":"string"}],
  "followUps": ["string"]
}
Keep evidence factual and concise.
Do not invent numbers.`;

    const execution = await executeAiTextTask({
      aiSettings,
      taskKey: 'portfolioSummary',
      prompt,
      openAiFallbackModel: 'gpt-5.2',
      geminiModel: aiSettings.geminiProModel || aiSettings.proModel || 'gemini-3-pro-preview',
      timeoutMs: 15000,
      logDecision: false
    });

    const raw = execution.text?.trim() || '';
    const parsed = JSON.parse(raw.startsWith('{') ? raw : raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1));
    if (typeof parsed?.answer === 'string' && typeof parsed?.explanation === 'string') {
      answer = {
        answer: parsed.answer.trim() || deterministic.answer,
        explanation: parsed.explanation.trim() || deterministic.explanation,
        evidence: Array.isArray(parsed.evidence)
          ? parsed.evidence
            .map((item: any) => ({
              label: typeof item?.label === 'string' ? item.label.trim() : '',
              value: typeof item?.value === 'string' ? item.value.trim() : ''
            }))
            .filter((item: any) => item.label && item.value)
            .slice(0, 6)
          : deterministic.evidence,
        followUps: Array.isArray(parsed.followUps)
          ? parsed.followUps.map((item: any) => String(item || '').trim()).filter(Boolean).slice(0, 6)
          : deterministic.followUps
      };
    }
  } catch {
    // Deterministic fallback is returned unchanged.
  }

  return NextResponse.json(answer);
}
