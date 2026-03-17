
import { NextResponse } from 'next/server';
import { addWikiCommentRecord, listWikiComments } from '../../../../server/db/repositories/wikiRepo';
import { requireCommentPermission, requireUser } from '../../../../shared/auth/guards';

export async function GET(request: Request) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;
  const { searchParams } = new URL(request.url);
  const pageId = searchParams.get('pageId');
  if (!pageId) return NextResponse.json({ error: 'pageId required' }, { status: 400 });
  const comments = await listWikiComments(pageId);
  return NextResponse.json(comments);
}

export async function POST(request: Request) {
  try {
    const auth = await requireCommentPermission(request);
    if (!auth.ok) return auth.response;
    const commentData = await request.json();
    const result = await addWikiCommentRecord(commentData);
    return NextResponse.json({ success: true, result });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to save comment' }, { status: 500 });
  }
}
