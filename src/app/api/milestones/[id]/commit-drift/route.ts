import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { emitEvent, getDb } from '../../../../../services/db';
import { createVisibilityContext, getAuthUserFromCookies } from '../../../../../services/visibility';
import { evaluateMilestoneCommitmentDrift } from '../../../../../services/commitmentDrift';
import { getEffectivePolicyForMilestone } from '../../../../../services/policy';
import { createNotificationsForEvent } from '../../../../../services/notifications';

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
    if (!policyRef.effective.commitReview?.enabled || !policyRef.effective.commitReview?.drift?.enabled) {
      return NextResponse.json({ enabled: false });
    }

    const drift = await evaluateMilestoneCommitmentDrift(String(milestone._id || milestone.id || milestone.name || id));
    if (!drift) return NextResponse.json({ error: 'Unable to evaluate drift' }, { status: 500 });

    const previous = await db.collection('commitment_drift_snapshots').findOne({ milestoneId: drift.milestoneId });
    const now = new Date().toISOString();
    await db.collection('commitment_drift_snapshots').updateOne(
      { milestoneId: drift.milestoneId },
      { $set: { milestoneId: drift.milestoneId, evaluatedAt: now, driftBand: drift.driftBand, deltas: drift.deltas, baselineAt: drift.baselineAt || null, hasBaseline: drift.hasBaseline } },
      { upsert: true }
    );

    const prevBand = previous?.driftBand || 'NONE';
    if (prevBand !== drift.driftBand) {
      if (drift.driftBand === 'NONE' && prevBand !== 'NONE') {
        try {
          await emitEvent({
            ts: now,
            type: 'milestones.commitdrift.cleared',
            actor: { userId: String(authUser.userId || authUser.id || ''), displayName: authUser.email || authUser.userId || 'System' },
            resource: { type: 'milestones.milestone', id: drift.milestoneId, title: milestone.name },
            payload: { drift }
          });
        } catch {}
      } else if (drift.driftBand !== 'NONE') {
        try {
          await emitEvent({
            ts: now,
            type: 'milestones.commitdrift.detected',
            actor: { userId: String(authUser.userId || authUser.id || ''), displayName: authUser.email || authUser.userId || 'System' },
            resource: { type: 'milestones.milestone', id: drift.milestoneId, title: milestone.name },
            payload: { drift }
          });
        } catch {}
      }
    }

    if (drift.driftBand === 'MAJOR') {
      await createNotificationsForEvent({
        type: 'milestone.commitment.drift',
        actor: { userId: String(authUser.userId || authUser.id || ''), displayName: authUser.email || authUser.userId || 'System' },
        payload: { milestone, drift }
      });
    }

    return NextResponse.json({ enabled: true, drift: { ...drift, evaluatedAt: now } });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to compute drift' }, { status: 500 });
  }
}
