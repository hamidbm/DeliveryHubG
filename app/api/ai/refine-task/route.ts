
import { NextResponse } from 'next/server';
import { generateWorkPlan } from '../../../../services/geminiService';
import { fetchWorkItemById } from '../../../../services/db';

export async function POST(request: Request) {
  try {
    const { id } = await request.json();
    if (!id) return NextResponse.json({ error: 'Work Item ID required' }, { status: 400 });

    const item = await fetchWorkItemById(id);
    if (!item) return NextResponse.json({ error: 'Item not found' }, { status: 404 });

    const plan = await generateWorkPlan(item);
    return NextResponse.json({ plan });
  } catch (error) {
    return NextResponse.json({ error: 'AI processing failed' }, { status: 500 });
  }
}
