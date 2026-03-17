
import { NextResponse } from 'next/server';
import { listWikiHistory } from '../../../../server/db/repositories/wikiRepo';
import { requireUser } from '../../../../shared/auth/guards';

export async function GET(request: Request) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;
  const { searchParams } = new URL(request.url);
  const pageId = searchParams.get('id');
  
  if (!pageId) {
    return NextResponse.json({ error: 'Page ID required' }, { status: 400 });
  }

  const history = await listWikiHistory(pageId);
  return NextResponse.json(history);
}
