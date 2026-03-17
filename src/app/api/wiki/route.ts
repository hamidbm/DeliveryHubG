
import { NextResponse } from 'next/server';
import { requireStandardUser } from '../../../shared/auth/guards';
import { listWikiPages, saveWikiPageRecord } from '../../../server/db/repositories/wikiRepo';

export async function GET() {
  const pages = await listWikiPages();
  return NextResponse.json(pages);
}

export async function POST(request: Request) {
  try {
    const auth = await requireStandardUser(request);
    if (!auth.ok) return auth.response;
    const pageData = await request.json();
    const result = await saveWikiPageRecord(pageData);
    return NextResponse.json({ success: true, result });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to save wiki page' }, { status: 500 });
  }
}
