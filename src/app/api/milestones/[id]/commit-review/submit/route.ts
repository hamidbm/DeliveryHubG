import { NextRequest, NextResponse } from 'next/server';
import { emitEvent } from '../../../../../../shared/events/emitEvent';
import { canCommitMilestone, isAdminOrCmo } from '../../../../../../services/authz';
import { evaluateMilestoneCommitReview } from '../../../../../../services/commitmentReview';
import { getEffectivePolicyForMilestone } from '../../../../../../services/policy';
import { ensureMilestoneBaseline } from '../../../../../../services/baselineDelta';
import { createDecision } from '../../../../../../services/decisionLog';
import { requireStandardUser } from '../../../../../../shared/auth/guards';
import { insertCommitmentReviewRecord } from '../../../../../../server/db/repositories/commitmentRepo';
import { getMilestoneByRef, updateMilestoneRecordByRef } from '../../../../../../server/db/repositories/milestonesRepo';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const auth = await requireStandardUser(request);
    if (!auth.ok) return auth.response;
    const payload = auth.principal.rawPayload;
    const authUser = {
      userId: auth.principal.userId,
      role: String(auth.principal.role || ''),
      team: String(auth.principal.team || ''),
      accountType: auth.principal.accountType
    };

    const body = await request.json();
    const decision = String(body?.decision || '');
    const overrideReason = body?.overrideReason ? String(body.overrideReason) : '';
    if (!decision || !['COMMIT', 'OVERRIDE'].includes(decision)) {
      return NextResponse.json({ error: 'Invalid decision' }, { status: 400 });
    }

    if (!(await canCommitMilestone(authUser))) {
      return NextResponse.json({ error: 'FORBIDDEN_COMMIT_MILESTONE' }, { status: 403 });
    }
    if (decision === 'OVERRIDE') {
      if (!(await isAdminOrCmo(authUser))) {
        return NextResponse.json({ error: 'FORBIDDEN_COMMIT_OVERRIDE' }, { status: 403 });
      }
      if (!overrideReason.trim()) {
        return NextResponse.json({ error: 'OVERRIDE_REASON_REQUIRED' }, { status: 400 });
      }
    }

    const milestone = await getMilestoneByRef(id);
    if (!milestone) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const policyRef = await getEffectivePolicyForMilestone(String(milestone._id || milestone.id || milestone.name || id));
    if (!policyRef.effective.commitReview?.enabled) {
      return NextResponse.json({ error: 'COMMIT_REVIEW_DISABLED' }, { status: 409 });
    }

    const review = await evaluateMilestoneCommitReview(String(milestone._id || milestone.id || milestone.name || id));
    if (!review) return NextResponse.json({ error: 'Unable to evaluate review' }, { status: 500 });

    if (decision === 'COMMIT' && !review.canCommit) {
      try {
        await emitEvent({
          ts: new Date().toISOString(),
          type: 'milestones.commitreview.failed',
          actor: {
            userId: String(authUser.userId || ''),
            displayName: String((payload as any).name || (payload as any).displayName || (payload as any).email || '')
          },
          resource: { type: 'milestones.milestone', id: String(milestone._id || milestone.id || id), title: milestone.name },
          payload: { review }
        });
      } catch {}
      return NextResponse.json({ error: 'COMMIT_REVIEW_FAILED', review }, { status: 409 });
    }

    const now = new Date().toISOString();
    await updateMilestoneRecordByRef(id, { status: 'COMMITTED', updatedAt: now });
    const reviewInsert = await insertCommitmentReviewRecord({
      milestoneId: String(milestone._id || milestone.id || milestone.name || id),
      evaluatedAt: now,
      evaluatedBy: String(authUser.userId || ''),
      result: decision === 'OVERRIDE' ? 'OVERRIDDEN' : 'PASS',
      overrideReason: decision === 'OVERRIDE' ? overrideReason : undefined,
      review
    });

    try {
      await ensureMilestoneBaseline(String(milestone._id || milestone.id || milestone.name || id), String(authUser.userId || ''));
    } catch {}

    if (decision === 'OVERRIDE') {
      try {
        await createDecision({
          createdAt: now,
          createdBy: { userId: String(authUser.userId || ''), email: String((payload as any).email || ''), name: (payload as any).name },
          source: 'AUTO',
          scopeType: 'MILESTONE',
          scopeId: String(milestone._id || milestone.id || milestone.name || id),
          decisionType: 'COMMIT_OVERRIDE',
          title: `Commit override for ${milestone.name || milestone.id || id}`,
          rationale: overrideReason,
          outcome: 'APPROVED',
          severity: 'warn',
          related: {
            milestoneId: String(milestone._id || milestone.id || milestone.name || id),
            bundleId: milestone.bundleId ? String(milestone.bundleId) : undefined,
            commitReviewId: reviewInsert?.insertedId ? String(reviewInsert.insertedId) : undefined,
            policyRef: policyRef?.refs ? policyRef.refs : undefined
          }
        });
      } catch {}
    }

    await emitEvent({
      ts: now,
      type: decision === 'OVERRIDE' ? 'milestones.commitreview.overridden' : 'milestones.commitreview.passed',
      actor: {
        userId: String(authUser.userId || ''),
        displayName: String((payload as any).name || (payload as any).displayName || (payload as any).email || '')
      },
      resource: { type: 'milestones.milestone', id: String(milestone._id || milestone.id || id), title: milestone.name },
      payload: { review, overrideReason: decision === 'OVERRIDE' ? overrideReason : undefined }
    });

    return NextResponse.json({ ok: true, review });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to submit commitment review' }, { status: 500 });
  }
}
