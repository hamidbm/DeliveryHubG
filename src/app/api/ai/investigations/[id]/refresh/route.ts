import { NextResponse } from 'next/server';
import { getAuthUserFromCookies } from '../../../../../../services/visibility';
import { refreshInvestigation } from '../../../../../../services/ai/investigationService';
import { evaluateWatchersForUser } from '../../../../../../services/ai/notificationEngine';
import { fetchAiAnalysisCache } from '../../../../../../services/aiPersistence';

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const authUser = await getAuthUserFromCookies();
  const userId = String(authUser?.userId || '');
  if (!userId) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  const { id } = await context.params;
  const investigation = await refreshInvestigation(userId, String(id));
  if (!investigation) return NextResponse.json({ error: 'Investigation not found' }, { status: 404 });

  const cached = await fetchAiAnalysisCache('portfolio-summary');
  const source = cached?.status === 'success'
    ? cached
    : (cached?.report?.status === 'success' ? cached.report : null);
  if (source?.report) {
    await evaluateWatchersForUser(userId, {
      report: source.report,
      trendSignals: source.report?.trendSignals,
      healthScore: source.report?.healthScore,
      alerts: source.report?.alerts,
      investigationSnapshots: [{ id: investigation.id, answer: investigation.answer, explanation: investigation.explanation }]
    });
  }

  return NextResponse.json({ status: 'success', investigation });
}
