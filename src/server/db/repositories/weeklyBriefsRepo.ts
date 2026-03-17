import { getServerDb } from '../client';

const ensureWeeklyBriefIndexes = async (db: any) => {
  await db.collection('weekly_briefs').createIndex({ scopeType: 1, scopeId: 1, weekKey: 1 }, { unique: true });
  await db.collection('weekly_briefs').createIndex({ generatedAt: -1 });
};

export const getWeeklyBriefRecord = async (scopeType: string, scopeId: string | undefined, weekKey: string) => {
  const db = await getServerDb();
  await ensureWeeklyBriefIndexes(db);
  return await db.collection('weekly_briefs').findOne({ scopeType, scopeId: scopeId || null, weekKey });
};

export const upsertWeeklyBriefRecord = async (brief: Record<string, unknown>) => {
  const db = await getServerDb();
  await ensureWeeklyBriefIndexes(db);
  await db.collection('weekly_briefs').replaceOne(
    { scopeType: brief.scopeType, scopeId: brief.scopeId || null, weekKey: brief.weekKey },
    brief,
    { upsert: true }
  );
  return brief;
};

export const insertWeeklyBriefRecordIfMissing = async (brief: Record<string, unknown>) => {
  const existing = await getWeeklyBriefRecord(String(brief.scopeType || ''), brief.scopeId ? String(brief.scopeId) : undefined, String(brief.weekKey || ''));
  if (existing) return existing;
  const db = await getServerDb();
  await ensureWeeklyBriefIndexes(db);
  await db.collection('weekly_briefs').insertOne(brief);
  return brief;
};
