import { NextResponse } from 'next/server';
import { emitEvent } from '../../../../../shared/events/emitEvent';
import { createVisibilityContext, getAuthUserFromCookies } from '../../../../../services/visibility';
import { evaluateMilestoneCommitmentDrift } from '../../../../../services/commitmentDrift';
import { getEffectivePolicyForMilestone } from '../../../../../services/policy';
import { createNotificationsForEvent } from '../../../../../services/notifications';
import { getCommitmentDriftSnapshotByMilestoneId, upsertCommitmentDriftSnapshotRecord } from '../../../../../server/db/repositories/commitmentRepo';
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
    if (!policyRef.effective.commitReview?.enabled || !policyRef.effective.commitReview?.drift?.enabled) {
      return NextResponse.json({ enabled: false });
    }

    const drift = await evaluateMilestoneCommitmentDrift(String(milestone._id || milestone.id || milestone.name || id));
    if (!drift) return NextResponse.json({ error: 'Unable to evaluate drift' }, { status: 500 });

    const previous = await getCommitmentDriftSnapshotByMilestoneId(drift.milestoneId);
    const now = new Date().toISOString();
    await upsertCommitmentDriftSnapshotRecord(drift.milestoneId, {
      evaluatedAt: now,
      driftBand: drift.driftBand,
      deltas: drift.deltas,
      baselineAt: drift.baselineAt || null,
      hasBaseline: drift.hasBaseline
    });

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
