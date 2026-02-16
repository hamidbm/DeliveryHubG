
import { NextResponse } from 'next/server';
import { fetchWikiHistory } from '../../../../services/db';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const pageId = searchParams.get('id');
  
  if (!pageId) {
    return NextResponse.json({ error: 'Page ID required' }, { status: 400 });
  }

  const history = await fetchWikiHistory(pageId);
  return NextResponse.json(history);
}
