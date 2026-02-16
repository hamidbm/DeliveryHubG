
import { NextResponse } from 'next/server';
import { fetchWikiPages, saveWikiPage } from '../../../services/db';

export async function GET() {
  const pages = await fetchWikiPages();
  return NextResponse.json(pages);
}

export async function POST(request: Request) {
  try {
    const pageData = await request.json();
    const result = await saveWikiPage(pageData);
    return NextResponse.json({ success: true, result });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to save wiki page' }, { status: 500 });
  }
}
