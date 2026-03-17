
import { NextResponse } from 'next/server';
import { listWikiSpaces, saveWikiSpaceRecord } from '../../../../server/db/repositories/wikiRepo';
import { requireStandardUser, requireUser } from '../../../../shared/auth/guards';

export async function GET(request: Request) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;
  const spaces = await listWikiSpaces();
  return NextResponse.json(spaces);
}

export async function POST(request: Request) {
  try {
    const auth = await requireStandardUser(request);
    if (!auth.ok) return auth.response;
    const spaceData = await request.json();
    const result = await saveWikiSpaceRecord(spaceData);
    return NextResponse.json({ success: true, result });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to save wiki space' }, { status: 500 });
  }
}
