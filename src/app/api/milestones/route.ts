
import { NextResponse } from 'next/server';
import { fetchMilestones, saveMilestone } from '../../../services/db';
import { createVisibilityContext, getAuthUserFromCookies } from '../../../services/visibility';

export async function GET(request: Request) {
  const user = await getAuthUserFromCookies();
  if (!user?.userId) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  const { searchParams } = new URL(request.url);
  const filters = {
    bundleId: searchParams.get('bundleId'),
    applicationId: searchParams.get('applicationId'),
    status: searchParams.get('status')
  };
  const milestones = await fetchMilestones(filters);
  const visibility = createVisibilityContext(user);
  const visible = (await Promise.all(milestones.map(async (m: any) => ({
    milestone: m,
    visible: await visibility.canViewBundle(String(m.bundleId || ''))
  })))).filter((m) => m.visible).map((m) => m.milestone);
  return NextResponse.json(visible);
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
