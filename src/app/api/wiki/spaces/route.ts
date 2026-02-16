
import { NextResponse } from 'next/server';
import { fetchWikiSpaces, saveWikiSpace } from '../../../../services/db';

export async function GET() {
  const spaces = await fetchWikiSpaces();
  return NextResponse.json(spaces);
}

export async function POST(request: Request) {
  try {
    const spaceData = await request.json();
    const result = await saveWikiSpace(spaceData);
    return NextResponse.json({ success: true, result });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to save wiki space' }, { status: 500 });
  }
}
