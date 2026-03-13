import { NextResponse } from 'next/server';
import { getAuthUserFromCookies } from '../../../../../../services/visibility';
import { refreshInvestigation } from '../../../../../../services/ai/investigationService';

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const authUser = await getAuthUserFromCookies();
  const userId = String(authUser?.userId || '');
  if (!userId) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  const { id } = await context.params;
  const investigation = await refreshInvestigation(userId, String(id));
  if (!investigation) return NextResponse.json({ error: 'Investigation not found' }, { status: 404 });
  return NextResponse.json({ status: 'success', investigation });
}
