import { ObjectId } from 'mongodb';
import type { Milestone, Sprint } from '../../../types';
import { getServerDb } from '../client';
import { findApplicationByAnyId } from './applicationsRepo';
import { findBundleByAnyId } from './bundlesRepo';

const collectRefCandidates = (...values: Array<unknown>) => {
  const out: Array<string | ObjectId> = [];
  const seen = new Set<string>();
  values.forEach((value) => {
    const normalized = String(value || '').trim();
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    out.push(normalized);
    if (ObjectId.isValid(normalized)) out.push(new ObjectId(normalized));
  });
  return out;
};

const resolveBundleMatch = async (value?: string | null) => {
  if (!value || value === 'all') return undefined;
  const bundle = await findBundleByAnyId(String(value)).catch(() => null);
  const candidates = collectRefCandidates(value, bundle?._id, bundle?.id, bundle?.key);
  return candidates.length ? { $in: candidates } : undefined;
};

const resolveApplicationMatch = async (value?: string | null) => {
  if (!value || value === 'all') return undefined;
  const application = await findApplicationByAnyId(String(value)).catch(() => null);
  const candidates = collectRefCandidates(value, application?._id, application?.id, application?.aid);
  return candidates.length ? { $in: candidates } : undefined;
};

const ensureMilestonesIndexes = async (db: any) => {
  await db.collection('milestones').createIndex({ status: 1, startDate: 1, endDate: 1 });
};

const ensureSprintsIndexes = async (db: any) => {
  await db.collection('workitems_sprints').createIndex({ startDate: 1, endDate: 1, status: 1 });
  await db.collection('workitems_sprints').createIndex({ bundleId: 1, status: 1 });
};

export const listMilestones = async (filters: {
  bundleId?: string | null;
  applicationId?: string | null;
  status?: string | null;
}) => {
  try {
    const db = await getServerDb();
    await ensureMilestonesIndexes(db);
    const query: Record<string, unknown> = {};
    if (filters.bundleId && filters.bundleId !== 'all') {
      const match = await resolveBundleMatch(filters.bundleId);
      if (match) query.bundleId = match;
    }
    if (filters.applicationId && filters.applicationId !== 'all') {
      const match = await resolveApplicationMatch(filters.applicationId);
      if (match) query.applicationId = match;
    }
    if (filters.status && filters.status !== 'all') {
      query.status = filters.status;
    }
    return await db.collection('milestones').find(query).sort({ dueDate: 1 }).toArray();
  } catch {
    return [];
  }
};

export const listMilestonesByStatuses = async (statuses: string[]) => {
  try {
    const normalized = Array.from(new Set(statuses.map((status) => String(status || '')).filter(Boolean)));
    if (!normalized.length) return [];
    const db = await getServerDb();
    await ensureMilestonesIndexes(db);
    return await db.collection('milestones').find({ status: { $in: normalized } }).toArray();
  } catch {
    return [];
  }
};

export const listMilestonesByBundleIds = async (bundleIds: string[], statuses?: string[]) => {
  try {
    const normalized = Array.from(new Set(bundleIds.map((id) => String(id || '')).filter(Boolean)));
    if (!normalized.length) return [];
    const db = await getServerDb();
    await ensureMilestonesIndexes(db);
    const query: Record<string, unknown> = { bundleId: { $in: normalized } };
    if (statuses?.length) query.status = { $in: statuses };
    return await db.collection('milestones').find(query).toArray();
  } catch {
    return [];
  }
};

export const listMilestoneRefsByBundleId = async (bundleId: string) => {
  try {
    const db = await getServerDb();
    await ensureMilestonesIndexes(db);
    const match = await resolveBundleMatch(bundleId);
    if (!match) return [];
    return await db.collection('milestones').find(
      { bundleId: match },
      { projection: { _id: 1, id: 1, name: 1 } }
    ).toArray();
  } catch {
    return [];
  }
};

export const saveMilestoneRecord = async (milestone: Partial<Milestone>) => {
  const db = await getServerDb();
  await ensureMilestonesIndexes(db);
  const { _id, ...data } = milestone;
  const now = new Date().toISOString();

  if (_id && ObjectId.isValid(_id as string)) {
    return await db.collection('milestones').updateOne(
      { _id: new ObjectId(_id) },
      { $set: { ...data, updatedAt: now } }
    );
  }

  return await db.collection('milestones').insertOne({
    ...data,
    createdAt: now,
    updatedAt: now
  });
};

export const deleteMilestoneRecord = async (id: string) => {
  const db = await getServerDb();
  return await db.collection('milestones').deleteOne({ _id: new ObjectId(id) });
};

export const getMilestoneByRef = async (id: string) => {
  const db = await getServerDb();
  if (ObjectId.isValid(id)) {
    return await db.collection('milestones').findOne({ _id: new ObjectId(id) });
  }
  return await db.collection('milestones').findOne({ $or: [{ id }, { name: id }] });
};

export const listMilestoneMetaByRefs = async (refs: string[]) => {
  try {
    const ids = Array.from(new Set(refs.map((ref) => String(ref || '')).filter(Boolean)));
    if (!ids.length) return [];
    const db = await getServerDb();
    await ensureMilestonesIndexes(db);
    return await db.collection('milestones').find({
      $or: [
        { _id: { $in: ids.filter(ObjectId.isValid).map((id) => new ObjectId(id)) } },
        { id: { $in: ids } },
        { name: { $in: ids } }
      ]
    }, {
      projection: { _id: 1, id: 1, name: 1, status: 1, endDate: 1, dueDate: 1, targetDate: 1, bundleId: 1 }
    }).toArray();
  } catch {
    return [];
  }
};

export const listMilestoneRecordsByRefs = async (refs: string[]) => {
  try {
    const ids = Array.from(new Set(refs.map((ref) => String(ref || '')).filter(Boolean)));
    if (!ids.length) return [];
    const db = await getServerDb();
    await ensureMilestonesIndexes(db);
    return await db.collection('milestones').find({
      $or: [
        { _id: { $in: ids.filter(ObjectId.isValid).map((id) => new ObjectId(id)) } },
        { id: { $in: ids } },
        { name: { $in: ids } }
      ]
    }).toArray();
  } catch {
    return [];
  }
};

export const listMilestoneRecordsByIds = async (ids: string[]) => {
  try {
    const normalized = Array.from(new Set(ids.map((id) => String(id || '')).filter(Boolean)));
    const objectIds = normalized.filter(ObjectId.isValid).map((id) => new ObjectId(id));
    if (!objectIds.length) return [];
    const db = await getServerDb();
    await ensureMilestonesIndexes(db);
    return await db.collection('milestones').find({ _id: { $in: objectIds } }).toArray();
  } catch {
    return [];
  }
};

export const listMilestonesForScope = async (scope: { bundleId?: string | null; applicationId?: string | null }) => {
  try {
    const db = await getServerDb();
    await ensureMilestonesIndexes(db);
    const query: Record<string, unknown> = {};
    if (scope.bundleId && scope.bundleId !== 'all') {
      const match = await resolveBundleMatch(scope.bundleId);
      if (match) query.bundleId = match;
    }
    if (scope.applicationId && scope.applicationId !== 'all') {
      const match = await resolveApplicationMatch(scope.applicationId);
      if (match) query.applicationId = match;
    }
    return await db.collection('milestones')
      .find(query, { projection: { _id: 1, id: 1, name: 1, status: 1, bundleId: 1, applicationId: 1 } })
      .toArray();
  } catch {
    return [];
  }
};

export const patchMilestoneRecordById = async (id: string, update: Record<string, unknown>) => {
  const db = await getServerDb();
  await ensureMilestonesIndexes(db);
  if (!ObjectId.isValid(id)) return { matchedCount: 0, modifiedCount: 0 };
  return await db.collection('milestones').updateOne(
    { _id: new ObjectId(id) },
    { $set: update }
  );
};

export const updateMilestoneRecordByRef = async (id: string, update: Record<string, unknown>) => {
  const db = await getServerDb();
  await ensureMilestonesIndexes(db);
  const filter = ObjectId.isValid(id)
    ? { $or: [{ _id: new ObjectId(id) }, { id }, { name: id }] }
    : { $or: [{ id }, { name: id }] };
  return await db.collection('milestones').updateOne(filter, { $set: update });
};

export const listSprints = async (filters: {
  bundleId?: string | null;
  applicationId?: string | null;
  status?: string | null;
}) => {
  try {
    const db = await getServerDb();
    await ensureSprintsIndexes(db);
    const query: Record<string, unknown> = {};
    if (filters.bundleId && filters.bundleId !== 'all') {
      const match = await resolveBundleMatch(filters.bundleId);
      if (match) query.bundleId = match;
    }
    if (filters.applicationId && filters.applicationId !== 'all') {
      const match = await resolveApplicationMatch(filters.applicationId);
      if (match) query.applicationId = match;
    }
    if (filters.status) {
      query.status = filters.status;
    }
    return await db.collection('workitems_sprints').find(query).sort({ startDate: 1 }).toArray();
  } catch {
    return [];
  }
};

export const saveSprintRecord = async (sprint: Partial<Sprint>) => {
  const db = await getServerDb();
  await ensureSprintsIndexes(db);
  const { _id, ...data } = sprint;
  const now = new Date().toISOString();

  if (_id && ObjectId.isValid(_id as string)) {
    return await db.collection('workitems_sprints').updateOne({ _id: new ObjectId(_id) }, { $set: data });
  }

  return await db.collection('workitems_sprints').insertOne({ ...data, createdAt: now });
};

export const getSprintByRef = async (id: string) => {
  const db = await getServerDb();
  await ensureSprintsIndexes(db);
  if (ObjectId.isValid(id)) {
    return await db.collection('workitems_sprints').findOne({ _id: new ObjectId(id) });
  }
  return await db.collection('workitems_sprints').findOne({ $or: [{ id }, { name: id }] });
};

export const updateSprintRecordByRef = async (id: string, update: Record<string, unknown>) => {
  const db = await getServerDb();
  await ensureSprintsIndexes(db);
  const filter = ObjectId.isValid(id)
    ? { _id: new ObjectId(id) }
    : { $or: [{ id }, { name: id }] };
  return await db.collection('workitems_sprints').updateOne(filter, { $set: update });
};

export const listClosedSprintsByBundle = async (bundleId: string, limit: number) => {
  try {
    const db = await getServerDb();
    await ensureSprintsIndexes(db);
    return await db.collection('workitems_sprints')
      .find({ bundleId: String(bundleId), status: 'CLOSED' })
      .sort({ endDate: -1 })
      .limit(Math.max(1, limit))
      .toArray();
  } catch {
    return [];
  }
};

export const listRecentSprintsByBundle = async (bundleId: string, limit: number) => {
  try {
    const normalizedBundleId = String(bundleId || '');
    if (!normalizedBundleId) return [];
    const db = await getServerDb();
    await ensureSprintsIndexes(db);
    return await db.collection('workitems_sprints')
      .find({ bundleId: normalizedBundleId })
      .sort({ endDate: -1 })
      .limit(Math.max(1, limit))
      .toArray();
  } catch {
    return [];
  }
};
