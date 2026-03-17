import { NextResponse } from 'next/server';
import { computeSprintRollups } from '../../../../services/rollupAnalytics';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sprintIds = searchParams.get('sprintIds');
  const bundleId = searchParams.get('bundleId') || undefined;
  const milestoneId = searchParams.get('milestoneId') || undefined;
  const status = searchParams.get('status') || undefined;
  const limit = Number(searchParams.get('limit') || '8');

  const ids = sprintIds ? sprintIds.split(',').map((id) => id.trim()).filter(Boolean) : undefined;

  const rollups = await computeSprintRollups({
    sprintIds: ids,
    bundleId,
    milestoneId,
    status,
    limit
  });

  return NextResponse.json(rollups);
}
