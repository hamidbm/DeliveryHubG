import { NextResponse } from 'next/server';
import { getAuthUserFromCookies } from '../../../../services/visibility';
import { PortfolioQueryResponse } from '../../../../types/ai';
import { getInvestigations, saveInvestigation } from '../../../../services/ai/investigationService';

export async function GET() {
  const authUser = await getAuthUserFromCookies();
  const userId = String(authUser?.userId || '');
  if (!userId) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });

  const items = await getInvestigations(userId);
  return NextResponse.json({ status: 'success', items });
}

export async function POST(request: Request) {
  const authUser = await getAuthUserFromCookies();
  const userId = String(authUser?.userId || '');
  if (!userId) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });

  let body: any = null;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const question = String(body?.question || '').trim();
  const queryResult = (body?.queryResult || null) as PortfolioQueryResponse | null;
  if (!question) return NextResponse.json({ error: 'question is required' }, { status: 400 });
  if (!queryResult?.answer || !queryResult?.explanation) {
    return NextResponse.json({ error: 'queryResult.answer and queryResult.explanation are required' }, { status: 400 });
  }

  const investigationId = await saveInvestigation(userId, question, queryResult);
  return NextResponse.json({ status: 'success', investigationId });
}
