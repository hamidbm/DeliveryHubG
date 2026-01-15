
import { NextResponse } from 'next/server';
import { generateStandupDigest } from '../../../../services/geminiService';
import { fetchWorkItemById } from '../../../../services/db';

export async function POST(request: Request) {
  try {
    const { id } = await request.json();
    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

    const item = await fetchWorkItemById(id);
    if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const digest = await generateStandupDigest(item);
    return NextResponse.json({ digest });
  } catch (error) {
    return NextResponse.json({ error: 'AI processing failed' }, { status: 500 });
  }
}
