import { ObjectId } from 'mongodb';
import type { Bundle, BundleProfile } from '../../../types';
import { getServerDb } from '../client';

const ensureBundleProfileIndexes = async (db: any) => {
  await db.collection('bundle_profiles').createIndex({ bundleId: 1 }, { unique: true });
  await db.collection('bundle_profiles').createIndex({ status: 1, updatedAt: -1 });
  await db.collection('bundle_profiles').createIndex({ 'schedule.goLivePlanned': 1 });
};

export const listBundles = async (activeOnly = false) => {
  try {
    const db = await getServerDb();
    const query = activeOnly ? { isActive: true } : {};
    return await db.collection('bundles').find(query).sort({ sortOrder: 1 }).toArray();
  } catch {
    return [];
  }
};

export const listBundleRefs = async () => {
  try {
    const db = await getServerDb();
    return await db.collection('bundles').find(
      {},
      { projection: { _id: 1, id: 1, key: 1, name: 1, title: 1 } }
    ).toArray();
  } catch {
    return [];
  }
};

export const listBundlesByRefs = async (refs: string[]) => {
  try {
    const ids = Array.from(new Set(refs.map((ref) => String(ref || '')).filter(Boolean)));
    if (!ids.length) return [];
    const db = await getServerDb();
    return await db.collection('bundles').find({
      $or: [
        { _id: { $in: ids.filter(ObjectId.isValid).map((id) => new ObjectId(id)) } },
        { id: { $in: ids } },
        { key: { $in: ids } }
      ]
    }).toArray();
  } catch {
    return [];
  }
};

export const findBundleByAnyId = async (id: string) => {
  try {
    const db = await getServerDb();
    if (ObjectId.isValid(id)) {
      return await db.collection('bundles').findOne({
        $or: [{ _id: new ObjectId(id) }, { id }, { key: id }]
      });
    }
    return await db.collection('bundles').findOne({ $or: [{ id }, { key: id }] });
  } catch {
    return null;
  }
};

export const saveBundleRecord = async (bundle: Partial<Bundle>) => {
  const db = await getServerDb();
  const { _id, ...data } = bundle;
  const now = new Date().toISOString();

  if (_id && ObjectId.isValid(_id as string)) {
    return await db.collection('bundles').updateOne(
      { _id: new ObjectId(_id) },
      { $set: { ...data, updatedAt: now } }
    );
  }

  return await db.collection('bundles').insertOne({
    ...data,
    createdAt: now,
    updatedAt: now
  });
};

export const getBundleProfile = async (bundleId: string) => {
  try {
    const db = await getServerDb();
    await ensureBundleProfileIndexes(db);
    return await db.collection('bundle_profiles').findOne({ bundleId: String(bundleId) });
  } catch {
    return null;
  }
};

export const listBundleProfiles = async (bundleIds?: string[]) => {
  try {
    const db = await getServerDb();
    await ensureBundleProfileIndexes(db);
    const query = bundleIds && bundleIds.length > 0 ? { bundleId: { $in: bundleIds.map(String) } } : {};
    return await db.collection('bundle_profiles').find(query).sort({ updatedAt: -1 }).toArray();
  } catch {
    return [];
  }
};

export const saveBundleProfile = async (bundleId: string, profile: Partial<BundleProfile>) => {
  const db = await getServerDb();
  await ensureBundleProfileIndexes(db);
  const now = new Date().toISOString();
  const payload = { ...profile, bundleId: String(bundleId), updatedAt: now };
  return await db.collection('bundle_profiles').updateOne(
    { bundleId: String(bundleId) },
    {
      $set: payload,
      $setOnInsert: { createdAt: now }
    },
    { upsert: true }
  );
};

export const listBundleMetaByRefs = async (refs: string[]) => {
  try {
    const ids = Array.from(new Set(refs.map((ref) => String(ref || '')).filter(Boolean)));
    if (!ids.length) return [];
    const db = await getServerDb();
    return await db.collection('bundles').find({
      $or: [
        { _id: { $in: ids.filter(ObjectId.isValid).map((id) => new ObjectId(id)) } },
        { id: { $in: ids } },
        { key: { $in: ids } }
      ]
    }, {
      projection: { _id: 1, id: 1, key: 1, name: 1, visibility: 1 }
    }).toArray();
  } catch {
    return [];
  }
};
