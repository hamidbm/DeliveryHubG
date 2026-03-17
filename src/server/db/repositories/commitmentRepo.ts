import { getServerDb } from '../client';

const ensureCommitmentIndexes = async (db: any) => {
  await db.collection('commitment_reviews').createIndex({ milestoneId: 1, evaluatedAt: -1 });
  await db.collection('commitment_drift_snapshots').createIndex({ milestoneId: 1, evaluatedAt: -1 });
  await db.collection('milestone_baselines').createIndex({ milestoneId: 1 }, { unique: true });
  await db.collection('drift_runs').createIndex({ runKey: 1 }, { unique: true });
};

export const getCommitmentDriftSnapshotByMilestoneId = async (milestoneId: string) => {
  const db = await getServerDb();
  await ensureCommitmentIndexes(db);
  return await db.collection('commitment_drift_snapshots').findOne({ milestoneId });
};

export const listCommitmentDriftSnapshotsByMilestoneIds = async (milestoneIds: string[]) => {
  const ids = Array.from(new Set(milestoneIds.map((id) => String(id || '')).filter(Boolean)));
  if (!ids.length) return [];
  const db = await getServerDb();
  await ensureCommitmentIndexes(db);
  return await db.collection('commitment_drift_snapshots').find({ milestoneId: { $in: ids } }).toArray();
};

export const upsertCommitmentDriftSnapshotRecord = async (milestoneId: string, doc: Record<string, unknown>) => {
  const db = await getServerDb();
  await ensureCommitmentIndexes(db);
  return await db.collection('commitment_drift_snapshots').updateOne(
    { milestoneId: String(milestoneId) },
    { $set: { ...doc, milestoneId: String(milestoneId) } },
    { upsert: true }
  );
};

export const getDriftRunRecordByRunKey = async (runKey: string) => {
  const db = await getServerDb();
  await ensureCommitmentIndexes(db);
  return await db.collection('drift_runs').findOne({ runKey: String(runKey) });
};

export const insertDriftRunRecord = async (doc: Record<string, unknown>) => {
  const db = await getServerDb();
  await ensureCommitmentIndexes(db);
  return await db.collection('drift_runs').insertOne(doc);
};

export const updateDriftRunRecord = async (runId: string, update: Record<string, unknown>) => {
  const db = await getServerDb();
  await ensureCommitmentIndexes(db);
  return await db.collection('drift_runs').updateOne({ runId: String(runId) }, { $set: update });
};

export const getMilestoneBaselineRecord = async (milestoneId: string) => {
  const db = await getServerDb();
  await ensureCommitmentIndexes(db);
  return await db.collection('milestone_baselines').findOne({ milestoneId });
};

export const insertMilestoneBaselineRecord = async (doc: Record<string, unknown>) => {
  const db = await getServerDb();
  await ensureCommitmentIndexes(db);
  return await db.collection('milestone_baselines').insertOne(doc);
};

export const getLatestPassingCommitmentReviewRecord = async (milestoneId: string) => {
  const db = await getServerDb();
  await ensureCommitmentIndexes(db);
  const docs = await db.collection('commitment_reviews')
    .find({ milestoneId, result: { $in: ['PASS', 'OVERRIDDEN'] } })
    .sort({ evaluatedAt: -1 })
    .limit(1)
    .toArray();
  return docs[0] || null;
};

export const insertCommitmentReviewRecord = async (doc: Record<string, unknown>) => {
  const db = await getServerDb();
  await ensureCommitmentIndexes(db);
  return await db.collection('commitment_reviews').insertOne(doc);
};
