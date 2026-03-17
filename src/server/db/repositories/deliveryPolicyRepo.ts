import type { DeliveryPolicy, DeliveryPolicyOverride } from '../../../services/policy';
import { getServerDb } from '../client';

const ensureOverrideIndexes = async (db: any) => {
  await db.collection('delivery_policy_overrides').createIndex({ bundleId: 1 }, { unique: true });
};

export const getGlobalDeliveryPolicyRecord = async () => {
  const db = await getServerDb();
  return await db.collection('delivery_policies').findOne({ _id: 'global' as any });
};

export const insertGlobalDeliveryPolicyRecord = async (policy: DeliveryPolicy) => {
  const db = await getServerDb();
  return await db.collection('delivery_policies').insertOne(policy as any);
};

export const upsertGlobalDeliveryPolicyRecord = async (policy: DeliveryPolicy) => {
  const db = await getServerDb();
  return await db.collection('delivery_policies').updateOne(
    { _id: 'global' as any },
    { $set: policy as any },
    { upsert: true }
  );
};

export const getDeliveryPolicyOverrideRecord = async (bundleId: string): Promise<DeliveryPolicyOverride | null> => {
  const db = await getServerDb();
  await ensureOverrideIndexes(db);
  return await db.collection<DeliveryPolicyOverride>('delivery_policy_overrides').findOne({ bundleId: String(bundleId) });
};

export const listDeliveryPolicyOverrideRecords = async () => {
  const db = await getServerDb();
  await ensureOverrideIndexes(db);
  return await db.collection('delivery_policy_overrides')
    .find({}, { projection: { _id: 0, bundleId: 1, version: 1, updatedAt: 1, updatedBy: 1 } })
    .toArray();
};

export const saveDeliveryPolicyOverrideRecord = async (payload: DeliveryPolicyOverride) => {
  const db = await getServerDb();
  await ensureOverrideIndexes(db);
  await db.collection('delivery_policy_overrides').updateOne(
    { bundleId: String(payload.bundleId) },
    { $set: payload },
    { upsert: true }
  );
  return payload;
};

export const deleteDeliveryPolicyOverrideRecord = async (bundleId: string) => {
  const db = await getServerDb();
  await ensureOverrideIndexes(db);
  await db.collection('delivery_policy_overrides').deleteOne({ bundleId: String(bundleId) });
};
