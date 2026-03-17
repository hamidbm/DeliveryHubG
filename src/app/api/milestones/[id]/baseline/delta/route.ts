import { NextResponse } from 'next/server';
import { createVisibilityContext, getAuthUserFromCookies } from '../../../../../../services/visibility';
import { computeMilestoneBaselineDelta, getMilestoneBaseline } from '../../../../../../services/baselineDelta';
import { getMilestoneByRef } from '../../../../../../server/db/repositories/milestonesRepo';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const authUser = await getAuthUserFromCookies();
  if (!authUser?.userId) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  const visibility = createVisibilityContext(authUser);

  const milestone = await getMilestoneByRef(id);
  if (!milestone) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!(await visibility.canViewBundle(String(milestone.bundleId || '')))) {
    return NextResponse.json({ error: 'Forbidden', code: 'BUNDLE_RESTRICTED' }, { status: 403 });
  }

  const milestoneKey = String(milestone._id || milestone.id || milestone.name || id);
  const delta = await computeMilestoneBaselineDelta(milestoneKey, {
    visibilityContext: visibility
  });
  if (!delta) return NextResponse.json({ error: 'Baseline not found' }, { status: 404 });

  const baseline = await getMilestoneBaseline(milestoneKey);
  return NextResponse.json({ delta, policy: baseline?.policy });
}
