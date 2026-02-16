
import { NextResponse } from 'next/server';
import { fetchWikiThemes, saveWikiTheme } from '../../../../services/db';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const activeOnly = searchParams.get('active') === 'true';
  const themes = await fetchWikiThemes(activeOnly);
  return NextResponse.json(themes);
}

export async function POST(request: Request) {
  try {
    const themeData = await request.json();
    const result = await saveWikiTheme(themeData);
    return NextResponse.json({ success: true, result });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to save theme' }, { status: 500 });
  }
}
