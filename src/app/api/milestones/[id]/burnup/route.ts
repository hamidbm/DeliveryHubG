import { NextResponse } from 'next/server';
import { getMilestoneByRef, listRecentSprintsByBundle } from '../../../../../server/db/repositories/milestonesRepo';
import { listWorkItemRecordsByMilestoneRefs } from '../../../../../server/db/repositories/workItemsRepo';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const sprintLimit = Math.min(Math.max(Number(searchParams.get('sprintLimit') || 12), 1), 50);
  const bundleIdParam = searchParams.get('bundleId');

  const milestone = await getMilestoneByRef(id);
  if (!milestone) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const milestoneId = String(milestone._id || milestone.id || id);
  const bundleId = bundleIdParam || milestone.bundleId;

  const sprintQuery: any = {};
  if (bundleId) sprintQuery.bundleId = String(bundleId);

  let sprints = bundleId ? await listRecentSprintsByBundle(String(bundleId), sprintLimit) : [];
  sprints = sprints.reverse();

  const items = await listWorkItemRecordsByMilestoneRefs([milestoneId]);

  const committedPoints = items.reduce((sum: number, item: any) => sum + (Number(item.storyPoints) || 0), 0);
  const doneItems = items.filter((item: any) => String(item.status || '').toUpperCase() === 'DONE');
  const completedPointsTotal = doneItems.reduce((sum: number, item: any) => sum + (Number(item.storyPoints) || 0), 0);
  const remainingPointsTotal = Math.max(committedPoints - completedPointsTotal, 0);

  let cumulativeCompleted = 0;
  const sprintRows = sprints.map((sprint: any) => {
    const start = sprint.startDate ? new Date(sprint.startDate).getTime() : null;
    const end = sprint.endDate ? new Date(sprint.endDate).getTime() : null;
    let completedPoints = 0;
    if (start && end) {
      doneItems.forEach((item: any) => {
        const completedAtRaw = item.completedAt || item.updatedAt;
        if (!completedAtRaw) return;
        const completedTime = new Date(completedAtRaw).getTime();
        if (Number.isNaN(completedTime)) return;
        if (completedTime >= start && completedTime <= end) {
          completedPoints += Number(item.storyPoints) || 0;
        }
      });
    }

    cumulativeCompleted += completedPoints;
    const remainingPoints = Math.max(committedPoints - cumulativeCompleted, 0);

    return {
      sprintId: String(sprint._id || sprint.id || sprint.name || ''),
      name: sprint.name || sprint.id || sprint._id,
      startDate: sprint.startDate,
      endDate: sprint.endDate,
      status: sprint.status,
      completedPoints,
      cumulativeCompletedPoints: cumulativeCompleted,
      remainingPoints
    };
  });

  const totalCompletedInSprints = sprintRows.reduce((sum: number, row: any) => sum + (row.completedPoints || 0), 0);
  const avgCompletedPerSprint = sprintRows.length ? Number((totalCompletedInSprints / sprintRows.length).toFixed(2)) : 0;
  const last3 = sprintRows.slice(-3);
  const last3Avg = last3.length === 3
    ? Number((last3.reduce((sum: number, row: any) => sum + (row.completedPoints || 0), 0) / 3).toFixed(2))
    : null;

  let acceleration: 'improving' | 'flat' | 'worsening' | 'unknown' = 'unknown';
  if (last3Avg !== null && avgCompletedPerSprint > 0) {
    if (last3Avg > avgCompletedPerSprint * 1.1) acceleration = 'improving';
    else if (last3Avg < avgCompletedPerSprint * 0.9) acceleration = 'worsening';
    else acceleration = 'flat';
  }

  return NextResponse.json({
    milestoneId,
    metric: 'points',
    sprints: sprintRows,
    scope: {
      committedPoints,
      completedPoints: completedPointsTotal,
      remainingPoints: remainingPointsTotal
    },
    trend: {
      avgCompletedPerSprint,
      last3Avg,
      acceleration
    }
  });
}
