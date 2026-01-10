
import { NextResponse } from 'next/server';
import { revertWikiPage } from '../../../../services/db';

export async function POST(request: Request) {
  try {
    const { pageId, versionId } = await request.json();
    
    if (!pageId || !versionId) {
      return NextResponse.json({ error: 'Missing pageId or versionId' }, { status: 400 });
    }

    const result = await revertWikiPage(pageId, versionId);
    return NextResponse.json({ success: true, result });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to revert wiki page' }, { status: 500 });
  }
}
