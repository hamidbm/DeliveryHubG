
import { NextResponse } from 'next/server';
import { fetchWikiComments, saveWikiComment } from '../../../../services/db';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const pageId = searchParams.get('pageId');
  if (!pageId) return NextResponse.json({ error: 'pageId required' }, { status: 400 });
  const comments = await fetchWikiComments(pageId);
  return NextResponse.json(comments);
}

export async function POST(request: Request) {
  try {
    const commentData = await request.json();
    const result = await saveWikiComment(commentData);
    return NextResponse.json({ success: true, result });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to save comment' }, { status: 500 });
  }
}
