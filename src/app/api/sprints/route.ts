
import { NextResponse } from 'next/server';
import { listSprints, saveSprintRecord } from '../../../server/db/repositories/milestonesRepo';
import { createVisibilityContext } from '../../../services/visibility';
import { requireStandardUser, requireUser } from '../../../shared/auth/guards';

export async function GET(request: Request) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;
  const { searchParams } = new URL(request.url);
  const filters = {
    bundleId: searchParams.get('bundleId'),
    applicationId: searchParams.get('applicationId'),
    status: searchParams.get('status')
  };
  const sprints = await listSprints(filters);
  const visibility = createVisibilityContext({
    userId: auth.principal.userId,
    email: auth.principal.email,
    role: auth.principal.role || undefined,
    accountType: auth.principal.accountType
  });
  const visible = (await Promise.all(sprints.map(async (sprint: any) => ({
    sprint,
    visible: sprint?.bundleId ? await visibility.canViewBundle(String(sprint.bundleId)) : true
  })))).filter((entry) => entry.visible).map((entry) => entry.sprint);
  return NextResponse.json(visible);
}

export async function POST(request: Request) {
  try {
    const auth = await requireStandardUser(request);
    if (!auth.ok) return auth.response;
    const sprintData = await request.json();
    const result = await saveSprintRecord(sprintData);
    return NextResponse.json({ success: true, result });
  } catch (error: any) {
    return NextResponse.json({ error: 'Failed to save sprint' }, { status: 500 });
  }
}
