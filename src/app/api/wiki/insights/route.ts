import { NextResponse } from 'next/server';
import { clearWikiAiInsightRecords, listWikiAiInsights, saveWikiAiInsightRecord } from '../../../../server/db/repositories/wikiRepo';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const targetId = searchParams.get('targetId');
  const targetType = searchParams.get('targetType') as 'page' | 'asset';
  if (!targetId || !targetType) {
    return NextResponse.json({ error: 'targetId and targetType are required.' }, { status: 400 });
  }
  const insights = await listWikiAiInsights(targetId, targetType);
  return NextResponse.json({ insights });
}

export async function POST(request: Request) {
  try {
    const { targetId, targetType, type, content } = await request.json();
    if (!targetId || !targetType || !type || !content) {
      return NextResponse.json({ error: 'Missing insight payload.' }, { status: 400 });
    }
    await saveWikiAiInsightRecord({ targetId, targetType, type, content });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to save insight.' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { targetId, targetType } = await request.json();
    if (!targetId || !targetType) {
      return NextResponse.json({ error: 'Missing target.' }, { status: 400 });
    }
    await clearWikiAiInsightRecords(targetId, targetType);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to clear insights.' }, { status: 500 });
  }
}
