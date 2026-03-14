import { NextResponse } from 'next/server';
import { getAuthUserFromCookies } from '../../../../services/visibility';
import { runStrategicAdvisorQuery } from '../../../../services/ai/strategicAdvisor';

const parseBody = async (request: Request) => {
  try {
    const body = await request.json();
    const question = typeof body?.question === 'string' ? body.question.trim() : '';
    const useLLM = typeof body?.options?.useLLM === 'boolean' ? body.options.useLLM : true;
    const maxTokens = typeof body?.options?.maxTokens === 'number' ? body.options.maxTokens : undefined;
    return { question, useLLM, maxTokens };
  } catch {
    return { question: '', useLLM: true as boolean, maxTokens: undefined as number | undefined };
  }
};

export async function POST(request: Request) {
  const authUser = await getAuthUserFromCookies();
  if (!authUser?.userId) {
    return NextResponse.json({ success: false, errorMessage: 'Unauthenticated' }, { status: 401 });
  }

  const parsed = await parseBody(request);
  if (!parsed.question) {
    return NextResponse.json({ success: false, errorMessage: 'Question is required.' }, { status: 400 });
  }

  try {
    const result = await runStrategicAdvisorQuery({
      question: parsed.question,
      useLLM: parsed.useLLM,
      maxTokens: parsed.maxTokens
    });

    const status = result.response.success ? 200 : 422;
    return NextResponse.json(
      {
        ...result.response,
        metadata: result.metadata
      },
      { status }
    );
  } catch {
    return NextResponse.json(
      {
        success: false,
        answer: '',
        explanation: '',
        evidence: [],
        relatedEntities: [],
        followUps: [],
        errorMessage: 'Strategic advisor request failed.'
      },
      { status: 500 }
    );
  }
}
