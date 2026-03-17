import { getServerDb } from '../client';

const ensureNudgeIndexes = async (db: any) => {
  await db.collection('staleness_nudges').createIndex({ workItemId: 1, nudgedAt: -1 });
  await db.collection('staleness_nudges').createIndex({ nudgedBy: 1, nudgedAt: -1 });
};

export const getRecentStalenessNudgeForWorkItem = async (workItemId: string, sinceIso: string) => {
  const db = await getServerDb();
  await ensureNudgeIndexes(db);
  return await db.collection('staleness_nudges').findOne({
    workItemId: String(workItemId),
    nudgedAt: { $gte: sinceIso }
  });
};

export const countRecentStalenessNudgesByUser = async (userId: string, sinceIso: string) => {
  const db = await getServerDb();
  await ensureNudgeIndexes(db);
  return await db.collection('staleness_nudges').countDocuments({
    nudgedBy: String(userId),
    nudgedAt: { $gte: sinceIso }
  });
};

export const insertStalenessNudgeRecord = async (doc: Record<string, unknown>) => {
  const db = await getServerDb();
  await ensureNudgeIndexes(db);
  return await db.collection('staleness_nudges').insertOne(doc);
};
