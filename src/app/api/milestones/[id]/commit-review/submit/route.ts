import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { ObjectId } from 'mongodb';
import { emitEvent, getDb } from '../../../../../../services/db';
import { canCommitMilestone, isAdminOrCmo } from '../../../../../../services/authz';
import { evaluateMilestoneCommitReview } from '../../../../../../services/commitmentReview';
import { getEffectivePolicyForMilestone } from '../../../../../../services/policy';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'nexus_super_secret_key_123');

const buildMilestoneQuery = (id: string) => {
  if (ObjectId.isValid(id)) {
    return { $or: [{ _id: new ObjectId(id) }, { id }, { name: id }] };
  }
  return { $or: [{ id }, { name: id }] };
};

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    let token: string | undefined;
    if (process.env.NODE_ENV === 'test') {
      token = (globalThis as any).__testToken as string | undefined;
    } else {
      const cookieStore = await cookies();
      token = cookieStore.get('nexus_auth_token')?.value;
    }
    if (!token) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });

    const { payload } = await jwtVerify(token, JWT_SECRET);
    const authUser = {
      userId: String((payload as any).id || (payload as any).userId || ''),
      role: String((payload as any).role || ''),
      team: String((payload as any).team || '')
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

    const db = await getDb();
    const milestone = await db.collection('milestones').findOne(buildMilestoneQuery(id));
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
    await db.collection('milestones').updateOne(buildMilestoneQuery(id), { $set: { status: 'COMMITTED', updatedAt: now } });
    await db.collection('commitment_reviews').createIndex({ milestoneId: 1, evaluatedAt: -1 });
    await db.collection('commitment_reviews').insertOne({
      milestoneId: String(milestone._id || milestone.id || milestone.name || id),
      evaluatedAt: now,
      evaluatedBy: String(authUser.userId || ''),
      result: decision === 'OVERRIDE' ? 'OVERRIDDEN' : 'PASS',
      overrideReason: decision === 'OVERRIDE' ? overrideReason : undefined,
      review
    });

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
