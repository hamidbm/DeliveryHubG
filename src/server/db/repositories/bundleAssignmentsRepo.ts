import { ObjectId } from 'mongodb';
import type { AssignmentType, BundleAssignment } from '../../../types';
import { getServerDb } from '../client';

export type BundleAssignmentFilters = {
  bundleId?: string;
  userId?: string;
  assignmentType?: AssignmentType;
  active?: boolean;
};

const ensureBundleAssignmentIndexes = async (db: any) => {
  await db.collection('bundle_assignments').createIndex({ bundleId: 1, assignmentType: 1, active: 1 });
  await db.collection('bundle_assignments').createIndex({ userId: 1, assignmentType: 1, active: 1 });
  await db.collection('bundle_assignments').createIndex({ bundleId: 1, userId: 1, assignmentType: 1 }, { unique: true });
};

export const listBundleAssignments = async (filters: BundleAssignmentFilters) => {
  try {
    const db = await getServerDb();
    await ensureBundleAssignmentIndexes(db);
    const query: Record<string, unknown> = {};
    if (filters.bundleId) query.bundleId = String(filters.bundleId);
    if (filters.userId) query.userId = String(filters.userId);
    if (filters.assignmentType) query.assignmentType = filters.assignmentType;
    if (typeof filters.active === 'boolean') query.active = filters.active;
    return await db.collection('bundle_assignments').find(query).sort({ updatedAt: -1 }).toArray();
  } catch {
    return [];
  }
};

export const saveBundleAssignment = async (assignment: Partial<BundleAssignment>, actorUserId?: string) => {
  const db = await getServerDb();
  await ensureBundleAssignmentIndexes(db);
  const now = new Date().toISOString();
  const bundleId = String(assignment.bundleId || '');
  const targetUserId = String(assignment.userId || '');
  const assignmentType = assignment.assignmentType as AssignmentType;
  if (!bundleId || !targetUserId || !assignmentType) {
    throw new Error('bundleId, userId, and assignmentType are required.');
  }

  return await db.collection('bundle_assignments').updateOne(
    { bundleId, userId: targetUserId, assignmentType },
    {
      $set: {
        bundleId,
        userId: targetUserId,
        assignmentType,
        active: assignment.active !== false,
        isPrimary: assignment.isPrimary || false,
        startAt: assignment.startAt || undefined,
        endAt: assignment.endAt || undefined,
        notes: assignment.notes || undefined,
        updatedAt: now,
        updatedBy: actorUserId
      },
      $setOnInsert: {
        createdAt: now,
        createdBy: actorUserId || assignment.createdBy
      }
    },
    { upsert: true }
  );
};

export const patchBundleAssignment = async (id: string, updates: Partial<BundleAssignment>, actorUserId?: string) => {
  const db = await getServerDb();
  await ensureBundleAssignmentIndexes(db);
  const now = new Date().toISOString();
  const setData: Record<string, unknown> = { updatedAt: now, updatedBy: actorUserId };
  if (typeof updates.active === 'boolean') setData.active = updates.active;
  if (typeof updates.isPrimary === 'boolean') setData.isPrimary = updates.isPrimary;
  if (typeof updates.startAt !== 'undefined') setData.startAt = updates.startAt || undefined;
  if (typeof updates.endAt !== 'undefined') setData.endAt = updates.endAt || undefined;
  if (typeof updates.notes !== 'undefined') setData.notes = updates.notes || undefined;

  return await db.collection('bundle_assignments').updateOne(
    { _id: new ObjectId(id) },
    { $set: setData }
  );
};

export const hasActiveBundleOwnerAssignment = async (bundleId: string, userId: string) => {
  try {
    const db = await getServerDb();
    await ensureBundleAssignmentIndexes(db);
    const assignment = await db.collection('bundle_assignments').findOne({
      bundleId: String(bundleId),
      userId: String(userId),
      assignmentType: 'bundle_owner',
      active: true
    });
    return Boolean(assignment);
  } catch {
    return false;
  }
};

export const findActiveBundleOwnerAssignment = async (bundleId: string, userId: string) => {
  try {
    const db = await getServerDb();
    await ensureBundleAssignmentIndexes(db);
    return await db.collection('bundle_assignments').findOne({
      bundleId: String(bundleId),
      userId: String(userId),
      assignmentType: 'bundle_owner',
      active: true
    });
  } catch {
    return null;
  }
};
