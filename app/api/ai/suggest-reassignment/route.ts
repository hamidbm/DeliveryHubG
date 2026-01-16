
import { NextResponse } from 'next/server';
import { suggestReassignment } from '../../../../services/geminiService';
import { fetchWorkItemById, getDb } from '../../../../services/db';

export async function POST(request: Request) {
  try {
    const { id } = await request.json();
    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

    const item = await fetchWorkItemById(id);
    if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    // Simulate team capacity scan
    const teamCapacity = [
      { name: 'Sarah PM', load: 14, role: 'Program Manager' },
      { name: 'Emma Watson', load: 2, role: 'Frontend Engineer' },
      { name: 'John Doe', load: 7, role: 'Backend Engineer' },
      { name: 'Alex Architect', load: 4, role: 'Enterprise Architect' }
    ];

    const suggestion = await suggestReassignment(item, teamCapacity);
    return NextResponse.json({ suggestion });
  } catch (error) {
    return NextResponse.json({ error: 'AI Rebalancing failed' }, { status: 500 });
  }
}
