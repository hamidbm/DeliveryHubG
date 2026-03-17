import { getServerDb } from '../client';

export type BundleCapacityInput = {
  unit: 'POINTS_PER_SPRINT' | 'POINTS_PER_WEEK';
  value: number;
};

const ensureBundleCapacityIndexes = async (db: any) => {
  await db.collection('bundle_capacity').createIndex({ bundleId: 1 }, { unique: true });
  await db.collection('bundle_capacity').createIndex({ updatedAt: -1 });
};

export const listBundleCapacity = async (bundleIds?: string[]) => {
  try {
    const db = await getServerDb();
    await ensureBundleCapacityIndexes(db);
    const query = bundleIds && bundleIds.length ? { bundleId: { $in: bundleIds.map(String) } } : {};
    return await db.collection('bundle_capacity').find(query).sort({ bundleId: 1 }).toArray();
  } catch {
    return [];
  }
};

export const saveBundleCapacity = async (bundleId: string, capacity: BundleCapacityInput, actorUserId?: string) => {
  const db = await getServerDb();
  await ensureBundleCapacityIndexes(db);
  const now = new Date().toISOString();
  const targetId = String(bundleId);
  const payload = {
    _id: targetId,
    bundleId: targetId,
    unit: capacity.unit,
    value: capacity.value,
    updatedAt: now,
    updatedBy: actorUserId
  };

  return await db.collection('bundle_capacity').updateOne(
    { bundleId: targetId },
    {
      $set: payload,
      $setOnInsert: {
        createdAt: now,
        createdBy: actorUserId
      }
    },
    { upsert: true }
  );
};
