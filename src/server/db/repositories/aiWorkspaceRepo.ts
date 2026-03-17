import { ObjectId } from 'mongodb';
import { getServerDb } from '../client';

const SAVED_QUERIES = 'ai_saved_queries';
const SNAPSHOTS = 'portfolio_snapshots';
const WORKFLOW_RULES = 'ai_workflow_rules';
const SCENARIOS = 'ai_scenarios';

const ensureSavedQueryIndexes = async (db: any) => {
  await db.collection(SAVED_QUERIES).createIndex({ userId: 1, createdAt: -1 });
  await db.collection(SAVED_QUERIES).createIndex({ userId: 1, pinned: 1, updatedAt: -1 });
};

const ensureSnapshotIndexes = async (db: any) => {
  await db.collection(SNAPSHOTS).createIndex({ createdAt: -1 });
};

const ensureWorkflowRuleIndexes = async (db: any) => {
  await db.collection(WORKFLOW_RULES).createIndex({ id: 1 }, { unique: true });
  await db.collection(WORKFLOW_RULES).createIndex({ enabled: 1, updatedAt: -1 });
};

const ensureScenarioIndexes = async (db: any) => {
  await db.collection(SCENARIOS).createIndex({ userId: 1, updatedAt: -1 });
  await db.collection(SCENARIOS).createIndex({ userId: 1, id: 1 }, { unique: true });
};

const toDocId = (id: string) => (ObjectId.isValid(id) ? new ObjectId(id) : id);
const buildSavedQueryFilter = (userId: string, id: string) => ({ _id: toDocId(id) as any, userId: String(userId) });

export const insertSavedInvestigationRecord = async (doc: Record<string, unknown>) => {
  const db = await getServerDb();
  await ensureSavedQueryIndexes(db);
  return await db.collection(SAVED_QUERIES).insertOne(doc);
};

export const listSavedInvestigationRecords = async (userId: string) => {
  const db = await getServerDb();
  await ensureSavedQueryIndexes(db);
  return await db.collection(SAVED_QUERIES)
    .find({ userId: String(userId) })
    .sort({ pinned: -1, updatedAt: -1 })
    .toArray();
};

export const getSavedInvestigationRecord = async (userId: string, id: string) => {
  const db = await getServerDb();
  await ensureSavedQueryIndexes(db);
  return await db.collection(SAVED_QUERIES).findOne(buildSavedQueryFilter(userId, id));
};

export const updateSavedInvestigationRecord = async (userId: string, id: string, patch: Record<string, unknown>) => {
  const db = await getServerDb();
  await ensureSavedQueryIndexes(db);
  await db.collection(SAVED_QUERIES).updateOne(
    buildSavedQueryFilter(userId, id),
    { $set: patch }
  );
  return await db.collection(SAVED_QUERIES).findOne(buildSavedQueryFilter(userId, id));
};

export const deleteSavedInvestigationRecord = async (userId: string, id: string) => {
  const db = await getServerDb();
  await ensureSavedQueryIndexes(db);
  return await db.collection(SAVED_QUERIES).deleteOne(buildSavedQueryFilter(userId, id));
};

export const insertPortfolioSnapshotRecord = async (doc: Record<string, unknown>) => {
  const db = await getServerDb();
  await ensureSnapshotIndexes(db);
  await db.collection(SNAPSHOTS).insertOne(doc);
};

export const deleteExpiredPortfolioSnapshotRecords = async (retentionCutoff: string) => {
  const db = await getServerDb();
  await ensureSnapshotIndexes(db);
  await db.collection(SNAPSHOTS).deleteMany({ createdAt: { $lt: retentionCutoff } } as any);
};

export const listRecentPortfolioSnapshotRecords = async (limit: number) => {
  const db = await getServerDb();
  await ensureSnapshotIndexes(db);
  return await db.collection(SNAPSHOTS)
    .find(
      {},
      {
        projection: {
          _id: 1,
          createdAt: 1,
          totalApplications: 1,
          criticalApplications: 1,
          totalWorkItems: 1,
          unassignedWorkItems: 1,
          blockedWorkItems: 1,
          overdueWorkItems: 1,
          activeWorkItems: 1,
          openReviews: 1,
          overdueMilestones: 1
        }
      }
    )
    .sort({ createdAt: -1 })
    .limit(limit)
    .toArray();
};

export const listWorkflowRuleRecords = async () => {
  const db = await getServerDb();
  await ensureWorkflowRuleIndexes(db);
  return await db.collection(WORKFLOW_RULES).find({}).toArray();
};

export const listActiveWorkflowRuleRecords = async () => {
  const db = await getServerDb();
  await ensureWorkflowRuleIndexes(db);
  return await db.collection(WORKFLOW_RULES).find({ enabled: true }).toArray();
};

export const upsertWorkflowRuleRecord = async (id: string, doc: Record<string, unknown>) => {
  const db = await getServerDb();
  await ensureWorkflowRuleIndexes(db);
  await db.collection(WORKFLOW_RULES).updateOne(
    { id },
    doc,
    { upsert: true }
  );
};

export const listAiScenarioRecords = async (userId: string) => {
  const db = await getServerDb();
  await ensureScenarioIndexes(db);
  return await db.collection(SCENARIOS)
    .find({ userId: String(userId) }, { projection: { _id: 0, userId: 0 } })
    .sort({ updatedAt: -1 })
    .toArray();
};

export const saveAiScenarioRecord = async (userId: string, scenario: Record<string, unknown>) => {
  const db = await getServerDb();
  await ensureScenarioIndexes(db);
  const now = new Date().toISOString();
  await db.collection(SCENARIOS).updateOne(
    { userId: String(userId), id: String(scenario.id || '') },
    {
      $set: {
        ...scenario,
        userId: String(userId),
        updatedAt: now
      },
      $setOnInsert: {
        createdAt: now
      }
    },
    { upsert: true }
  );
};

export const deleteAiScenarioRecord = async (userId: string, id: string) => {
  const db = await getServerDb();
  await ensureScenarioIndexes(db);
  await db.collection(SCENARIOS).deleteOne({ userId: String(userId), id: String(id) });
};
