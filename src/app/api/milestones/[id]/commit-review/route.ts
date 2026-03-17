import { NextResponse } from 'next/server';
import { getAuthUserFromCookies, createVisibilityContext } from '../../../../../services/visibility';
import { evaluateMilestoneCommitReview } from '../../../../../services/commitmentReview';
import { getEffectivePolicyForMilestone } from '../../../../../services/policy';
import { getMilestoneByRef } from '../../../../../server/db/repositories/milestonesRepo';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const authUser = await getAuthUserFromCookies();
    if (!authUser?.userId) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
    const visibility = createVisibilityContext(authUser);

    const milestone = await getMilestoneByRef(id);
    if (!milestone) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (!(await visibility.canViewBundle(String(milestone.bundleId || '')))) {
      return NextResponse.json({ error: 'Forbidden', code: 'BUNDLE_RESTRICTED' }, { status: 403 });
    }

    const policyRef = await getEffectivePolicyForMilestone(String(milestone._id || milestone.id || milestone.name || id));
    if (!policyRef.effective.commitReview?.enabled) {
      return NextResponse.json({ enabled: false });
    }

    const review = await evaluateMilestoneCommitReview(String(milestone._id || milestone.id || milestone.name || id));
    if (!review) return NextResponse.json({ error: 'Unable to evaluate review' }, { status: 500 });
    return NextResponse.json({ enabled: true, review });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to compute review' }, { status: 500 });
  }
}
