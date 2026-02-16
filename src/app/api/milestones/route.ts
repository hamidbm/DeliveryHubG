
import { NextResponse } from 'next/server';
import { fetchMilestones, saveMilestone } from '../../../services/db';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const filters = {
    bundleId: searchParams.get('bundleId'),
    applicationId: searchParams.get('applicationId'),
    status: searchParams.get('status')
  };
  const milestones = await fetchMilestones(filters);
  return NextResponse.json(milestones);
}

export async function POST(request: Request) {
  try {
    const milestoneData = await request.json();
    const result = await saveMilestone(milestoneData);
    return NextResponse.json({ success: true, result });
  } catch (error: any) {
    return NextResponse.json({ error: 'Failed to save milestone' }, { status: 500 });
  }
}
