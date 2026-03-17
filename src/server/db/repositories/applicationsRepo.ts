import { ObjectId } from 'mongodb';
import type { Application } from '../../../types';
import { getServerDb } from '../client';

const safeIdMatch = (value?: string) => {
  if (!value) return undefined;
  return ObjectId.isValid(value) ? new ObjectId(value) : value;
};

export const listApplications = async (bundleId?: string, activeOnly = false) => {
  try {
    const db = await getServerDb();
    const query: Record<string, unknown> = {};
    if (bundleId && bundleId !== 'all') {
      const bundleMatch = safeIdMatch(bundleId);
      if (bundleMatch) query.bundleId = bundleMatch;
    }
    if (activeOnly) query.isActive = true;
    return await db.collection('applications').find(query).toArray();
  } catch {
    return [];
  }
};

export const saveApplicationRecord = async (application: Partial<Application>) => {
  const db = await getServerDb();
  const { _id, ...data } = application;
  const now = new Date().toISOString();

  if (_id && ObjectId.isValid(_id as string)) {
    return await db.collection('applications').updateOne(
      { _id: new ObjectId(_id) },
      { $set: { ...data, updatedAt: now } }
    );
  }

  return await db.collection('applications').insertOne({
    ...data,
    createdAt: now,
    updatedAt: now
  });
};

export const findApplicationByAnyId = async (id: string) => {
  const db = await getServerDb();
  const oid = ObjectId.isValid(id) ? new ObjectId(id) : null;
  return await db.collection('applications').findOne({
    $or: [
      oid ? { _id: oid } : null,
      { id },
      { aid: id }
    ].filter(Boolean) as any[]
  });
};

export const updateApplicationById = async (applicationId: ObjectId, update: Record<string, unknown>) => {
  const db = await getServerDb();
  await db.collection('applications').updateOne({ _id: applicationId }, { $set: update });
  return await db.collection('applications').findOne({ _id: applicationId });
};

export const listApplicationMetaByRefs = async (refs: string[]) => {
  try {
    const ids = Array.from(new Set(refs.map((ref) => String(ref || '')).filter(Boolean)));
    if (!ids.length) return [];
    const db = await getServerDb();
    return await db.collection('applications').find({
      $or: [
        { _id: { $in: ids.filter(ObjectId.isValid).map((id) => new ObjectId(id)) } },
        { id: { $in: ids } },
        { aid: { $in: ids } },
        { name: { $in: ids } }
      ]
    }, {
      projection: { _id: 1, id: 1, aid: 1, name: 1, health: 1, status: 1, bundleId: 1 }
    }).toArray();
  } catch {
    return [];
  }
};

export const listApplicationHealthCountsByBundleRefs = async (bundleRefs: string[]) => {
  try {
    const bundleIds = Array.from(new Set(bundleRefs.map((ref) => String(ref || '')).filter(Boolean)));
    if (!bundleIds.length) return [] as Array<{ _id: string; total: number; critical: number }>;
    const db = await getServerDb();
    return await db.collection('applications').aggregate([
      { $match: { bundleId: { $in: bundleIds } } },
      {
        $group: {
          _id: '$bundleId',
          total: { $sum: 1 },
          critical: {
            $sum: {
              $cond: [
                {
                  $in: [
                    { $toLower: { $ifNull: ['$health', ''] } },
                    ['critical', 'at_risk', 'blocked']
                  ]
                },
                1,
                0
              ]
            }
          }
        }
      }
    ]).toArray();
  } catch {
    return [];
  }
};
