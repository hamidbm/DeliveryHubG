import { NextResponse } from 'next/server';
import { getDb } from '../../../../../services/db';
import { getAuthUserFromCookies, createVisibilityContext } from '../../../../../services/visibility';
import { evaluateMilestoneCommitReview } from '../../../../../services/commitmentReview';
import { getEffectivePolicyForMilestone } from '../../../../../services/policy';
import { ObjectId } from 'mongodb';

const buildMilestoneQuery = (id: string) => {
  if (ObjectId.isValid(id)) {
    return { $or: [{ _id: new ObjectId(id) }, { id }, { name: id }] };
  }
  return { $or: [{ id }, { name: id }] };
};

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const authUser = await getAuthUserFromCookies();
    if (!authUser?.userId) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
    const visibility = createVisibilityContext(authUser);

    const db = await getDb();
    const milestone = await db.collection('milestones').findOne(buildMilestoneQuery(id));
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
