
import { NextResponse } from 'next/server';
import { getDb, computeMilestoneRollup, computeSprintRollups, emitEvent } from '../../../../services/db';
import { ObjectId } from 'mongodb';
import { jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { evaluateCapacity } from '../../../../services/milestoneGovernance';
import { createNotificationsForEvent } from '../../../../services/notifications';
import { canOverrideCapacity, canCreateBlocksDependency, isAdminOrCmo, canEditRiskSeverity } from '../../../../services/authz';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'nexus_super_secret_key_123');

export async function PATCH(request: Request) {
  try {
    const testToken = process.env.NODE_ENV === 'test' ? (globalThis as any).__testToken : null;
    const cookieStore = testToken ? null : await cookies();
    const token = testToken || cookieStore?.get('nexus_auth_token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
    
    const { payload } = await jwtVerify(token, JWT_SECRET);
    const { ids, updates, allowOverCapacity } = await request.json();
    const allowOver = !!allowOverCapacity;
    const authUser = {
      userId: String((payload as any).id || (payload as any).userId || ''),
      role: String((payload as any).role || ''),
      team: String((payload as any).team || '')
    };

    if (allowOver && !(await canOverrideCapacity(authUser))) {
      return NextResponse.json({ error: 'FORBIDDEN_CAPACITY_OVERRIDE' }, { status: 403 });
    }

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'No IDs provided' }, { status: 400 });
    }

    const db = await getDb();
    const now = new Date().toISOString();
    const userName = payload.name as string || 'System';
    const warnings: Array<{ code: string; message: string; details?: any }> = [];
    const capacityOverrides: Array<{ milestone: any; item: any; details: any }> = [];
    const sprintCapacityOverrides: Array<{ sprint: any; item: any; details: any }> = [];
    const directScopeChanges: Array<{ milestone: any; action: string; count: number }> = [];

    if (updates && (updates.assignedTo !== undefined || updates.priority !== undefined)) {
      const userRole = String((payload as any).role || '');
      const privilegedRoles = new Set([
        'CMO Architect',
        'SVP Architect',
        'SVP PM',
        'SVP Engineer',
        'Director',
        'VP',
        'CIO'
      ]);
      if (!privilegedRoles.has(userRole)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    const itemsForChecks = await db.collection('workitems').find({ _id: { $in: ids.map((id: string) => new ObjectId(id)) } }).toArray();

    if (updates?.risk?.severity) {
      for (const item of itemsForChecks) {
        if (!(await canEditRiskSeverity(authUser, item))) {
          return NextResponse.json({ error: 'FORBIDDEN_RISK_SEVERITY_EDIT' }, { status: 403 });
        }
      }
    }

    if (updates?.milestoneIds && Array.isArray(updates.milestoneIds)) {
      const milestoneIds = updates.milestoneIds.map((m: any) => String(m)).filter(Boolean);
      if (milestoneIds.length > 0) {
        const items = itemsForChecks;
        for (const milestoneId of milestoneIds) {
          const milestone = ObjectId.isValid(milestoneId)
            ? await db.collection('milestones').findOne({ _id: new ObjectId(milestoneId) })
            : await db.collection('milestones').findOne({ $or: [{ id: milestoneId }, { name: milestoneId }] });
          if (!milestone) continue;

          const status = String(milestone.status || '').toUpperCase();
          const isCommitted = status === 'COMMITTED';
          const adminDirect = await isAdminOrCmo(authUser);
          if (isCommitted && !adminDirect) {
            return NextResponse.json({
              error: 'COMMITTED_SCOPE_REQUIRES_APPROVAL',
              milestoneId: String(milestone._id || milestone.id || milestone.name || milestoneId),
              link: `/work-items?view=milestone-plan`
            }, { status: 409 });
          }
          if (isCommitted && adminDirect) {
            const action = milestoneIds.length ? 'ADD_ITEMS' : 'REMOVE_ITEMS';
            directScopeChanges.push({ milestone, action, count: ids.length });
          }
          const targetCapacity = typeof milestone.targetCapacity === 'number' ? milestone.targetCapacity : undefined;

          let incomingPointsTotal = 0;
          let existingPointsAssigned = 0;
          let missingEstimate = false;

          items.forEach((item: any) => {
            const alreadyAssigned = Array.isArray(item.milestoneIds) && item.milestoneIds.map(String).includes(String(milestone._id || milestone.id || milestone.name || milestoneId));
            const incomingPointsRaw = updates.storyPoints !== undefined ? updates.storyPoints : item.storyPoints;
            const incomingPoints = typeof incomingPointsRaw === 'number' ? incomingPointsRaw : 0;
            const existingPoints = typeof item.storyPoints === 'number' ? item.storyPoints : 0;

            if (isCommitted && (!Number.isFinite(incomingPoints) || incomingPoints <= 0)) {
              missingEstimate = true;
            }

            if (alreadyAssigned) {
              if (updates.storyPoints !== undefined) {
                incomingPointsTotal += incomingPoints;
                existingPointsAssigned += existingPoints;
              }
            } else {
              incomingPointsTotal += incomingPoints;
            }
          });

          if (isCommitted && missingEstimate) {
            return NextResponse.json({
              error: 'MISSING_ESTIMATE',
              message: 'Committed milestones require story point estimates.',
              details: { milestoneId: String(milestone._id || milestone.id || milestone.name || milestoneId) }
            }, { status: 409 });
          }

          const rollup = await computeMilestoneRollup(String(milestone._id || milestone.id || milestone.name || milestoneId));
          const committedPoints = rollup?.capacity?.committedPoints || 0;

          const capacityResult = evaluateCapacity({
            milestoneId: String(milestone._id || milestone.id || milestone.name || milestoneId),
            isCommitted,
            targetCapacity,
            committedPoints,
            incomingPoints: incomingPointsTotal,
            existingPoints: existingPointsAssigned,
            allowOverCapacity: allowOver
          });

          if (!capacityResult.ok && capacityResult.error) {
            return NextResponse.json({
              error: capacityResult.error.code,
              message: capacityResult.error.message,
              details: capacityResult.error.details
            }, { status: 409 });
          }
          if (capacityResult.warning) {
            warnings.push({
              code: capacityResult.warning.code,
              message: capacityResult.warning.message,
              details: capacityResult.warning.details
            });
          }

          const wouldBe = Math.max(committedPoints - existingPointsAssigned, 0) + incomingPointsTotal;
          const isOverCapacity = typeof targetCapacity === 'number' && wouldBe > targetCapacity;
          if (isCommitted && allowOver && isOverCapacity) {
            items.forEach((item: any) => {
              capacityOverrides.push({
                milestone,
                item,
                details: {
                  milestoneId: String(milestone._id || milestone.id || milestone.name || milestoneId),
                  targetCapacity,
                  currentCommittedPoints: committedPoints,
                  incomingItemPoints: incomingPointsTotal,
                  wouldBeCommittedPoints: wouldBe
                }
              });
            });
          }
        }
      }
    }

    if (updates?.sprintId !== undefined && updates?.sprintId !== null) {
      const sprintId = String(updates.sprintId);
      const sprint = ObjectId.isValid(sprintId)
        ? await db.collection('workitems_sprints').findOne({ _id: new ObjectId(sprintId) })
        : await db.collection('workitems_sprints').findOne({ $or: [{ id: sprintId }, { name: sprintId }] });
      if (!sprint) {
        return NextResponse.json({ error: 'SPRINT_NOT_FOUND' }, { status: 404 });
      }

      const sprintStatus = String(sprint.status || '').toUpperCase();
      if (sprintStatus === 'ACTIVE') {
        const items = await db.collection('workitems').find({ _id: { $in: ids.map((id: string) => new ObjectId(id)) } }).toArray();
        let incomingPointsTotal = 0;
        let existingPointsAssigned = 0;
        let missingEstimate = false;

        items.forEach((item: any) => {
          const incomingPointsRaw = updates.storyPoints !== undefined ? updates.storyPoints : item.storyPoints;
          const incomingHoursRaw = updates.timeEstimate !== undefined ? updates.timeEstimate : item.timeEstimate;
          const incomingPoints = typeof incomingPointsRaw === 'number' ? incomingPointsRaw : (typeof incomingHoursRaw === 'number' ? incomingHoursRaw : 0);
          const existingPoints = typeof item.storyPoints === 'number' ? item.storyPoints : (typeof item.timeEstimate === 'number' ? item.timeEstimate : 0);
          const alreadyAssigned = String(item.sprintId || '') === String(sprint._id || sprint.id || sprintId);

          if (!Number.isFinite(incomingPoints) || incomingPoints <= 0) {
            missingEstimate = true;
          }

          if (alreadyAssigned) {
            if (updates.storyPoints !== undefined || updates.timeEstimate !== undefined) {
              incomingPointsTotal += incomingPoints;
              existingPointsAssigned += existingPoints;
            }
          } else {
            incomingPointsTotal += incomingPoints;
          }
        });

        if (missingEstimate) {
          return NextResponse.json({
            error: 'MISSING_ESTIMATE',
            message: 'Active sprints require story points or time estimates.',
            details: { sprintId: String(sprint._id || sprint.id || sprintId) }
          }, { status: 400 });
        }

        const rollups = await computeSprintRollups({ sprintIds: [String(sprint._id || sprint.id || sprintId)] });
        const rollup = rollups[0];
        const committedPoints = rollup?.capacity?.committedPoints || 0;
        const targetCapacity = typeof sprint.capacityPoints === 'number' ? sprint.capacityPoints : undefined;
        const wouldBe = Math.max(committedPoints - existingPointsAssigned, 0) + incomingPointsTotal;
        const isOverCapacity = typeof targetCapacity === 'number' && wouldBe > targetCapacity;

        if (isOverCapacity && !allowOver) {
          return NextResponse.json({
            error: 'OVER_CAPACITY',
            message: 'Sprint capacity exceeded.',
            details: {
              sprintId: String(sprint._id || sprint.id || sprintId),
              targetCapacity,
              currentCommittedPoints: committedPoints,
              incomingItemPoints: incomingPointsTotal,
              wouldBeCommittedPoints: wouldBe
            }
          }, { status: 409 });
        }

        if (allowOver && isOverCapacity) {
          items.forEach((item: any) => {
            sprintCapacityOverrides.push({
              sprint,
              item,
              details: {
                sprintId: String(sprint._id || sprint.id || sprintId),
                targetCapacity,
                currentCommittedPoints: committedPoints,
                incomingItemPoints: incomingPointsTotal,
                wouldBeCommittedPoints: wouldBe
              }
            });
          });
        }
      }
    }

    if (updates?.links && Array.isArray(updates.links)) {
      // Bulk dependency edits are restricted to admin/CMO
      const hasBlocks = updates.links.some((l: any) => String(l?.type) === 'BLOCKS');
      if (hasBlocks && !(await canCreateBlocksDependency(authUser, { bundleId: '' }, { bundleId: '' }))) {
        return NextResponse.json({ error: 'FORBIDDEN_BLOCKS_DEPENDENCY' }, { status: 403 });
      }
    }

    const auditEntry = {
      user: userName,
      action: 'BULK_UPDATE',
      field: Object.keys(updates).join(', '),
      to: 'Multiple Values (Bulk)',
      createdAt: now
    };

    if (updates && (updates.assignedTo !== undefined || updates.assigneeUserIds !== undefined)) {
      updates.assignedAt = now;
    }

    const result = await db.collection('workitems').updateMany(
      { _id: { $in: ids.map(id => new ObjectId(id)) } },
      { 
        $set: { ...updates, updatedAt: now, updatedBy: userName },
        $push: { activity: auditEntry }
      } as any
    );

    if (directScopeChanges.length) {
      const actor = {
        userId: String((payload as any).id || (payload as any).userId || (payload as any).email || ''),
        displayName: String((payload as any).name || (payload as any).displayName || ''),
        email: (payload as any).email ? String((payload as any).email) : undefined,
        role: (payload as any).role ? String((payload as any).role) : undefined
      };
      const seen = new Set<string>();
      await Promise.all(directScopeChanges.map(async (entry) => {
        const milestoneKey = String(entry.milestone._id || entry.milestone.id || entry.milestone.name);
        if (seen.has(milestoneKey)) return;
        seen.add(milestoneKey);
        try {
          await emitEvent({
            ts: now,
            type: 'milestones.scope.directchanged',
            actor,
            resource: { type: 'milestones.milestone', id: milestoneKey, title: entry.milestone.name || entry.milestone.id },
            context: { bundleId: entry.milestone.bundleId },
            payload: { action: entry.action, itemCount: entry.count }
          });
        } catch {}
      }));
    }

    if (capacityOverrides.length) {
      const actor = {
        userId: String((payload as any).id || (payload as any).userId || (payload as any).email || ''),
        displayName: String((payload as any).name || (payload as any).displayName || ''),
        email: (payload as any).email ? String((payload as any).email) : undefined,
        role: (payload as any).role ? String((payload as any).role) : undefined
      };
      const seen = new Set<string>();
      await Promise.all(capacityOverrides.map(async (entry) => {
        try {
          const key = `${entry.item?._id || entry.item?.id || ''}:${entry.details?.milestoneId || ''}`;
          if (seen.has(key)) return;
          seen.add(key);
          await createNotificationsForEvent({
            type: 'milestone.capacity.override',
            actor,
            payload: {
              milestone: entry.milestone,
              item: entry.item,
              details: entry.details
            }
          });
        } catch {}
      }));
    }

    if (sprintCapacityOverrides.length) {
      const actor = {
        userId: String((payload as any).id || (payload as any).userId || (payload as any).email || ''),
        displayName: String((payload as any).name || (payload as any).displayName || ''),
        email: (payload as any).email ? String((payload as any).email) : undefined,
        role: (payload as any).role ? String((payload as any).role) : undefined
      };
      const seen = new Set<string>();
      await Promise.all(sprintCapacityOverrides.map(async (entry) => {
        try {
          const key = `${entry.item?._id || entry.item?.id || ''}:${entry.details?.sprintId || ''}`;
          if (seen.has(key)) return;
          seen.add(key);
          await createNotificationsForEvent({
            type: 'sprint.capacity.override',
            actor,
            payload: {
              sprint: entry.sprint,
              item: entry.item,
              details: entry.details
            }
          });
        } catch {}
      }));
    }

    return NextResponse.json({ success: true, modifiedCount: result.modifiedCount, warnings });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Bulk update failed' }, { status: 500 });
  }
}
