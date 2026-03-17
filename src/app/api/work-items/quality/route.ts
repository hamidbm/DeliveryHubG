import { NextResponse } from 'next/server';
import { requireUser } from '../../../../shared/auth/guards';
import { listQualityIssueWorkItems } from '../../../../server/db/repositories/workItemsRepo';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;

  try {
    const milestoneId = searchParams.get('milestoneId');
    const sprintId = searchParams.get('sprintId');
    const issue = searchParams.get('issue');
    if (!milestoneId && !sprintId) {
      return NextResponse.json({ error: 'milestoneId or sprintId required' }, { status: 400 });
    }
    if (!issue) {
      return NextResponse.json({ error: 'issue required' }, { status: 400 });
    }
    if (!['missingStoryPoints', 'missingDueAt', 'missingRiskSeverity'].includes(issue)) {
      return NextResponse.json({ error: 'invalid issue' }, { status: 400 });
    }

    const items = await listQualityIssueWorkItems({
      milestoneId,
      sprintId,
      issue: issue as 'missingStoryPoints' | 'missingDueAt' | 'missingRiskSeverity',
      limit: 200
    });

    return NextResponse.json({ items });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Quality lookup failed' }, { status: 500 });
  }
}
