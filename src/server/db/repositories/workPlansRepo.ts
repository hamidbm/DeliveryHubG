import { ObjectId } from 'mongodb';
import { getServerDb } from '../client';

const ensureWorkPlanIndexes = async (db: any) => {
  await db.collection('work_plan_previews').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  await db.collection('work_plan_previews').createIndex({ createdBy: 1, createdAt: -1 });
  await db.collection('work_plan_previews').createIndex({ scopeType: 1, scopeId: 1, createdAt: -1 });
  await db.collection('work_roadmap_phases').createIndex({ scopeType: 1, scopeId: 1, startDate: 1 });
  await db.collection('work_roadmap_phases').createIndex({ milestoneIds: 1 });
  await db.collection('work_delivery_plan_runs').createIndex({ createdBy: 1, createdAt: -1 });
  await db.collection('work_delivery_plan_runs').createIndex({ scopeType: 1, scopeId: 1, createdAt: -1 });
};

const toLookupId = (id: string) => (ObjectId.isValid(id) ? new ObjectId(id) : id);

export const createWorkPlanPreviewRecord = async (doc: Record<string, unknown>) => {
  const db = await getServerDb();
  await ensureWorkPlanIndexes(db);
  return await db.collection('work_plan_previews').insertOne(doc);
};

export const getWorkPlanPreviewRecord = async (previewId: string) => {
  const db = await getServerDb();
  await ensureWorkPlanIndexes(db);
  return await db.collection('work_plan_previews').findOne({ _id: toLookupId(previewId) } as any);
};

export const listWorkPlanPreviewRecords = async ({
  createdBy,
  scopeType,
  scopeId,
  limit
}: {
  createdBy?: string;
  scopeType?: string;
  scopeId?: string;
  limit: number;
}) => {
  const db = await getServerDb();
  await ensureWorkPlanIndexes(db);
  const query: any = {};
  if (createdBy) query.createdBy = String(createdBy);
  if (scopeType) query.scopeType = scopeType;
  if (scopeId) query.scopeId = scopeId;
  return await db.collection('work_plan_previews')
    .find(query)
    .sort({ createdAt: -1 })
    .limit(limit)
    .toArray();
};

export const updateWorkPlanPreviewRecord = async (previewId: string, update: Record<string, unknown>) => {
  const db = await getServerDb();
  await ensureWorkPlanIndexes(db);
  return await db.collection('work_plan_previews').updateOne(
    { _id: toLookupId(previewId) } as any,
    { $set: update }
  );
};

export const createRoadmapPhaseRecord = async (doc: Record<string, unknown>) => {
  const db = await getServerDb();
  await ensureWorkPlanIndexes(db);
  return await db.collection('work_roadmap_phases').insertOne(doc);
};

export const createWorkDeliveryPlanRunRecord = async (doc: Record<string, unknown>) => {
  const db = await getServerDb();
  await ensureWorkPlanIndexes(db);
  return await db.collection('work_delivery_plan_runs').insertOne(doc);
};

export const listWorkDeliveryPlanRunRecords = async (limit = 50) => {
  const db = await getServerDb();
  await ensureWorkPlanIndexes(db);
  return await db.collection('work_delivery_plan_runs')
    .find({})
    .sort({ createdAt: -1 })
    .limit(limit)
    .toArray();
};

export const getWorkDeliveryPlanRunRecord = async (runId: string) => {
  const db = await getServerDb();
  await ensureWorkPlanIndexes(db);
  return await db.collection('work_delivery_plan_runs').findOne({ _id: toLookupId(runId) } as any);
};

export const getLatestWorkDeliveryPlanRunRecord = async (scopeType: string, scopeId: string) => {
  const db = await getServerDb();
  await ensureWorkPlanIndexes(db);
  return await db.collection('work_delivery_plan_runs')
    .find({ scopeType, scopeId })
    .sort({ createdAt: -1 })
    .limit(1)
    .next();
};
