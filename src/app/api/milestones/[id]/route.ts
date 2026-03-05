
import { NextRequest, NextResponse } from 'next/server';
import { deleteMilestone, getDb, computeMilestoneRollup, emitEvent } from '../../../../services/db';
import { jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { ObjectId } from 'mongodb';
import { canCommitMilestone, canStartMilestone, canCompleteMilestone, canOverrideMilestoneReadiness, canEditMilestoneOwner } from '../../../../services/authz';
import { evaluateMilestoneReadiness } from '../../../../services/milestoneGovernance';
import { getEffectivePolicyForMilestone } from '../../../../services/policy';
import { createNotificationsForEvent } from '../../../../services/notifications';
import { resolveMilestoneBundleScope } from '../../../../services/ownership';
import { evaluateMilestoneCommitReview } from '../../../../services/commitmentReview';
import { ensureMilestoneBaseline } from '../../../../services/baselineDelta';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'nexus_super_secret_key_123');


export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
    const body = await request.json();
    const nextStatus = body?.status ? String(body.status) : undefined;
    const ownerUserId = body?.ownerUserId ? String(body.ownerUserId) : undefined;
    const ownerEmail = body?.ownerEmail ? String(body.ownerEmail) : undefined;
    const allowOverride = !!body.allowOverride;
    const overrideReason = body.overrideReason ? String(body.overrideReason) : '';
    if (Object.prototype.hasOwnProperty.call(body, 'allowOverride')) delete body.allowOverride;
    if (Object.prototype.hasOwnProperty.call(body, 'overrideReason')) delete body.overrideReason;
    if (Object.prototype.hasOwnProperty.call(body, 'ownerUserId')) delete body.ownerUserId;
    if (Object.prototype.hasOwnProperty.call(body, 'ownerEmail')) delete body.ownerEmail;

    const authUser = {
      userId: String((payload as any).id || (payload as any).userId || ''),
      role: String((payload as any).role || ''),
      team: String((payload as any).team || '')
    };

    if (nextStatus && String(nextStatus).toUpperCase() === 'COMMITTED') {
      if (!(await canCommitMilestone(authUser))) {
        return NextResponse.json({ error: 'FORBIDDEN_COMMIT_MILESTONE' }, { status: 403 });
      }
    }

    const db = await getDb();
    const existing = ObjectId.isValid(id)
      ? await db.collection('milestones').findOne({ _id: new ObjectId(id) })
      : await db.collection('milestones').findOne({ $or: [{ id }, { name: id }] });
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    if (nextStatus && String(nextStatus).toUpperCase() === 'COMMITTED') {
      const policyRef = await getEffectivePolicyForMilestone(String(existing._id || existing.id || existing.name || id));
      if (policyRef.effective.commitReview?.enabled) {
        const review = await evaluateMilestoneCommitReview(String(existing._id || existing.id || existing.name || id));
        return NextResponse.json({ error: 'COMMIT_REVIEW_REQUIRED', review }, { status: 409 });
      }
    }

    if (nextStatus && ['IN_PROGRESS', 'DONE'].includes(String(nextStatus).toUpperCase())) {
      const upper = String(nextStatus).toUpperCase();
      if (upper === 'IN_PROGRESS' && !(await canStartMilestone(authUser))) {
        return NextResponse.json({ error: 'FORBIDDEN_START_MILESTONE' }, { status: 403 });
      }
      if (upper === 'DONE' && !(await canCompleteMilestone(authUser))) {
        return NextResponse.json({ error: 'FORBIDDEN_COMPLETE_MILESTONE' }, { status: 403 });
      }
      const rollup = await computeMilestoneRollup(String(existing._id || existing.id || existing.name || id));
      const policyRef = await getEffectivePolicyForMilestone(String(existing._id || existing.id || existing.name || id));
      const readiness = await evaluateMilestoneReadiness(rollup, policyRef.effective);
      const canProceed = upper === 'IN_PROGRESS' ? readiness.canStart : readiness.canComplete;

      if (!canProceed && !allowOverride) {
        try {
          await createNotificationsForEvent({
            type: 'milestone.readiness.blocked',
            actor: {
              userId: String((payload as any).id || (payload as any).userId || (payload as any).email || ''),
              displayName: String((payload as any).name || (payload as any).displayName || ''),
              email: (payload as any).email ? String((payload as any).email) : undefined,
              role: (payload as any).role ? String((payload as any).role) : undefined
            },
            payload: {
              milestone: existing,
              readiness
            }
          });
        } catch {}
        return NextResponse.json({
          error: 'READINESS_BLOCKED',
          message: 'Milestone readiness gates not satisfied.',
          readiness,
          rollup
        }, { status: 409 });
      }
      if (allowOverride && !overrideReason) {
        return NextResponse.json({ error: 'OVERRIDE_REASON_REQUIRED' }, { status: 400 });
      }
      if (allowOverride && !(await canOverrideMilestoneReadiness(authUser))) {
        return NextResponse.json({ error: 'FORBIDDEN_READINESS_OVERRIDE' }, { status: 403 });
      }

      const now = new Date().toISOString();
      const update = { ...body, status: nextStatus, updatedAt: now };
      if (ObjectId.isValid(id)) {
        await db.collection('milestones').updateOne({ _id: new ObjectId(id) }, { $set: update });
      } else {
        await db.collection('milestones').updateOne({ $or: [{ id }, { name: id }] }, { $set: update });
      }

      try {
        await emitEvent({
          ts: now,
          type: 'milestones.milestone.statuschanged',
          actor: {
            userId: String((payload as any).id || (payload as any).userId || (payload as any).email || ''),
            displayName: String((payload as any).name || (payload as any).displayName || ''),
            email: (payload as any).email ? String((payload as any).email) : undefined
          },
          resource: { type: 'milestones.milestone', id: String(existing._id || existing.id || id), title: existing.name },
          payload: {
            from: existing.status,
            to: nextStatus,
            allowOverride,
            overrideReason,
            readiness
          }
        });
      } catch {}

      try {
        await createNotificationsForEvent({
          type: 'milestone.status.changed',
          actor: {
            userId: String((payload as any).id || (payload as any).userId || (payload as any).email || ''),
            displayName: String((payload as any).name || (payload as any).displayName || ''),
            email: (payload as any).email ? String((payload as any).email) : undefined,
            role: (payload as any).role ? String((payload as any).role) : undefined
          },
          payload: {
            milestone: existing,
            from: existing.status,
            to: nextStatus
          }
        });
        if (allowOverride) {
          await createNotificationsForEvent({
            type: 'milestone.status.override',
            actor: {
              userId: String((payload as any).id || (payload as any).userId || (payload as any).email || ''),
              displayName: String((payload as any).name || (payload as any).displayName || ''),
              email: (payload as any).email ? String((payload as any).email) : undefined,
              role: (payload as any).role ? String((payload as any).role) : undefined
            },
            payload: {
              milestone: existing,
              overrideReason,
              readiness
            }
          });
        }
      } catch {}

      return NextResponse.json({ success: true, milestone: { ...existing, ...update }, rollup, readiness });
    }

    if (ownerUserId !== undefined || ownerEmail !== undefined) {
      const scopeBundleIds = await resolveMilestoneBundleScope(String(existing._id || existing.id || existing.name || id));
      if (!(await canEditMilestoneOwner(authUser, scopeBundleIds))) {
        return NextResponse.json({ error: 'FORBIDDEN_MILESTONE_OWNER' }, { status: 403 });
      }
      const updateOwner: any = {
        ownerUserId: ownerUserId || null,
        ownerEmail: ownerEmail || null,
        updatedAt: new Date().toISOString()
      };
      if (ObjectId.isValid(id)) {
        await db.collection('milestones').updateOne({ _id: new ObjectId(id) }, { $set: updateOwner });
      } else {
        await db.collection('milestones').updateOne({ $or: [{ id }, { name: id }] }, { $set: updateOwner });
      }

      try {
        await emitEvent({
          ts: updateOwner.updatedAt,
          type: 'milestones.milestone.ownerchanged',
          actor: {
            userId: String((payload as any).id || (payload as any).userId || (payload as any).email || ''),
            displayName: String((payload as any).name || (payload as any).displayName || ''),
            email: (payload as any).email ? String((payload as any).email) : undefined
          },
          resource: { type: 'milestones.milestone', id: String(existing._id || existing.id || id), title: existing.name },
          payload: {
            from: { ownerUserId: existing.ownerUserId, ownerEmail: existing.ownerEmail },
            to: { ownerUserId: ownerUserId || null, ownerEmail: ownerEmail || null },
            milestone: existing
          }
        });
      } catch {}

      try {
        await createNotificationsForEvent({
          type: 'milestone.owner.changed',
          actor: {
            userId: String((payload as any).id || (payload as any).userId || (payload as any).email || ''),
            displayName: String((payload as any).name || (payload as any).displayName || ''),
            email: (payload as any).email ? String((payload as any).email) : undefined,
            role: (payload as any).role ? String((payload as any).role) : undefined
          },
          payload: {
            milestone: { ...existing, ownerUserId: ownerUserId || null, ownerEmail: ownerEmail || null }
          }
        });
      } catch {}
    }

    const now = new Date().toISOString();
    const update: any = { ...body, updatedAt: now };
    if (ownerUserId !== undefined || ownerEmail !== undefined) {
      update.ownerUserId = ownerUserId || null;
      update.ownerEmail = ownerEmail || null;
    }
    if (ObjectId.isValid(id)) {
      await db.collection('milestones').updateOne({ _id: new ObjectId(id) }, { $set: update });
    } else {
      await db.collection('milestones').updateOne({ $or: [{ id }, { name: id }] }, { $set: update });
    }

    if (nextStatus && String(nextStatus).toUpperCase() === 'COMMITTED' && String(existing.status) !== String(nextStatus)) {
      try {
        await ensureMilestoneBaseline(String(existing._id || existing.id || existing.name || id), authUser.userId);
      } catch {}
      try {
        await emitEvent({
          ts: now,
          type: 'milestones.milestone.statuschanged',
          actor: {
            userId: String((payload as any).id || (payload as any).userId || (payload as any).email || ''),
            displayName: String((payload as any).name || (payload as any).displayName || ''),
            email: (payload as any).email ? String((payload as any).email) : undefined
          },
          resource: { type: 'milestones.milestone', id: String(existing._id || existing.id || id), title: existing.name },
          payload: {
            from: existing.status,
            to: nextStatus
          }
        });
      } catch {}
      try {
        await createNotificationsForEvent({
          type: 'milestone.status.changed',
          actor: {
            userId: String((payload as any).id || (payload as any).userId || (payload as any).email || ''),
            displayName: String((payload as any).name || (payload as any).displayName || ''),
            email: (payload as any).email ? String((payload as any).email) : undefined,
            role: (payload as any).role ? String((payload as any).role) : undefined
          },
          payload: {
            milestone: existing,
            from: existing.status,
            to: nextStatus
          }
        });
      } catch {}
    }

    return NextResponse.json({ success: true, milestone: { ...existing, ...update } });
  } catch (error) {
    console.error('Milestone PATCH error', error);
    return NextResponse.json({ error: 'Update failed' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await deleteMilestone(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Delete failed' }, { status: 500 });
  }
}
