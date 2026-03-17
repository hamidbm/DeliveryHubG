import type { ApplicationPlanningMetadata } from '../../../types';
import { getServerDb } from '../client';

export const ensureApplicationPlanningMetadataIndexes = async () => {
  const db = await getServerDb();
  await db.collection('application_planning_metadata').createIndex({ scopeType: 1, scopeId: 1 }, { unique: true });
  await db.collection('application_planning_metadata').createIndex({ bundleId: 1 });
};

export const getPlanningMetadataRecordByScope = async (scopeType: 'bundle' | 'application', scopeId: string) => {
  const db = await getServerDb();
  await ensureApplicationPlanningMetadataIndexes();
  if (scopeType === 'application') {
    return await db.collection<ApplicationPlanningMetadata>('application_planning_metadata').findOne({
      $or: [
        { scopeType: 'application', scopeId: String(scopeId) },
        { applicationId: String(scopeId) }
      ]
    });
  }
  return await db.collection<ApplicationPlanningMetadata>('application_planning_metadata').findOne({
    scopeType: 'bundle',
    scopeId: String(scopeId)
  });
};

export const upsertPlanningMetadataRecord = async (
  scopeType: 'bundle' | 'application',
  scopeId: string,
  payload: Partial<ApplicationPlanningMetadata> & { bundleId?: string | null; applicationId?: string | null }
) => {
  const db = await getServerDb();
  await ensureApplicationPlanningMetadataIndexes();
  const now = new Date().toISOString();
  const { createdAt: _createdAt, _id: _id, ...rest } = payload || {};
  const doc: Partial<ApplicationPlanningMetadata> = {
    ...rest,
    scopeType,
    scopeId: String(scopeId),
    bundleId: payload.bundleId ?? null,
    applicationId: payload.applicationId ?? (scopeType === 'application' ? String(scopeId) : undefined),
    updatedAt: now
  };
  await db.collection<ApplicationPlanningMetadata>('application_planning_metadata').updateOne(
    { scopeType, scopeId: String(scopeId) },
    {
      $set: doc,
      $setOnInsert: { createdAt: now }
    },
    { upsert: true }
  );
};
