
import { NextResponse } from 'next/server';
import { fetchSprints, saveSprint } from '../../../services/db';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const filters = {
    bundleId: searchParams.get('bundleId'),
    applicationId: searchParams.get('applicationId'),
    status: searchParams.get('status')
  };
  const sprints = await fetchSprints(filters);
  return NextResponse.json(sprints);
}

export async function POST(request: Request) {
  try {
    const sprintData = await request.json();
    const result = await saveSprint(sprintData);
    return NextResponse.json({ success: true, result });
  } catch (error: any) {
    return NextResponse.json({ error: 'Failed to save sprint' }, { status: 500 });
  }
}
