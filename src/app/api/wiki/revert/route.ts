
import { NextResponse } from 'next/server';
import { revertWikiPageRecord } from '../../../../server/db/repositories/wikiRepo';
import { requireStandardUser } from '../../../../shared/auth/guards';

export async function POST(request: Request) {
  try {
    const auth = await requireStandardUser(request);
    if (!auth.ok) return auth.response;
    const { pageId, versionId } = await request.json();
    
    if (!pageId || !versionId) {
      return NextResponse.json({ error: 'Missing pageId or versionId' }, { status: 400 });
    }

    const result = await revertWikiPageRecord(pageId, versionId);
    return NextResponse.json({ success: true, result });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to revert wiki page' }, { status: 500 });
  }
}
