import { getServerDb } from '../client';

const ensureOptimizationIndexes = async (db: any) => {
  await db.collection('optimization_applied_runs').createIndex({ planId: 1, appliedAt: -1 });
  await db.collection('optimization_applied_runs').createIndex({ appliedBy: 1, appliedAt: -1 });
  await db.collection('optimization_applied_runs').createIndex({ scopeType: 1, scopeId: 1, appliedAt: -1 });
};

export const insertOptimizationAppliedRunRecord = async (doc: Record<string, unknown>) => {
  const db = await getServerDb();
  await ensureOptimizationIndexes(db);
  return await db.collection('optimization_applied_runs').insertOne(doc);
};

export const getLatestOptimizationAppliedRunRecord = async (query: Record<string, unknown>) => {
  const db = await getServerDb();
  await ensureOptimizationIndexes(db);
  return await db.collection('optimization_applied_runs').findOne(query, {
    sort: { appliedAt: -1 }
  });
};
