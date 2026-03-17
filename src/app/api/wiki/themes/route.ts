
import { NextResponse } from 'next/server';
import { listWikiThemes, saveWikiThemeRecord } from '../../../../server/db/repositories/wikiRepo';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const activeOnly = searchParams.get('active') === 'true';
  const themes = await listWikiThemes(activeOnly);
  return NextResponse.json(themes);
}

export async function POST(request: Request) {
  try {
    const themeData = await request.json();
    const result = await saveWikiThemeRecord(themeData);
    return NextResponse.json({ success: true, result });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to save theme' }, { status: 500 });
  }
}
