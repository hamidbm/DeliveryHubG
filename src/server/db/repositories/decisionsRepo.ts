import { ObjectId } from 'mongodb';
import { getServerDb } from '../client';

const ensureDecisionIndexes = async () => {
  const db = await getServerDb();
  await db.collection('decision_log').createIndex({ scopeType: 1, scopeId: 1, createdAt: -1 });
  await db.collection('decision_log').createIndex({ 'related.milestoneId': 1, createdAt: -1 });
  await db.collection('decision_log').createIndex({ decisionType: 1, createdAt: -1 });
  return db;
};

export const insertDecisionRecord = async (doc: Record<string, unknown>) => {
  const db = await ensureDecisionIndexes();
  return await db.collection('decision_log').insertOne(doc);
};

export const findDecisionById = async (id: string) => {
  if (!ObjectId.isValid(id)) return null;
  const db = await ensureDecisionIndexes();
  return await db.collection('decision_log').findOne({ _id: new ObjectId(id) });
};

export const listDecisionRecords = async (params: {
  scopeType?: string;
  scopeId?: string;
  milestoneId?: string;
  limit?: number;
  cursor?: string;
}) => {
  const db = await ensureDecisionIndexes();
  const query: any = {};
  if (params.scopeType) query.scopeType = params.scopeType;
  if (params.scopeId) query.scopeId = params.scopeId;
  if (params.milestoneId) query['related.milestoneId'] = params.milestoneId;
  if (params.cursor) {
    const [cursorTime, cursorId] = String(params.cursor).split('|');
    if (cursorTime && cursorId && ObjectId.isValid(cursorId)) {
      query.$or = [
        { createdAt: { $lt: cursorTime } },
        { createdAt: cursorTime, _id: { $lt: new ObjectId(cursorId) } }
      ];
    } else if (cursorTime) {
      query.createdAt = { $lt: cursorTime };
    }
  }
  const limit = Math.min(Math.max(params.limit || 50, 1), 200);
  return await db.collection('decision_log').find(query).sort({ createdAt: -1, _id: -1 }).limit(limit).toArray();
};

export const listDecisionSummariesForRange = async (params: {
  scopeType: string;
  scopeId?: string;
  startIso: string;
  endIso: string;
  limit?: number;
}) => {
  const db = await ensureDecisionIndexes();
  const query: any = {
    scopeType: params.scopeType,
    createdAt: { $gte: params.startIso, $lt: params.endIso }
  };
  if (params.scopeType !== 'PROGRAM') {
    query.scopeId = params.scopeId || null;
  }
  return await db.collection('decision_log')
    .find(query)
    .sort({ createdAt: -1 })
    .limit(params.limit || 5)
    .project({ title: 1, outcome: 1, severity: 1 })
    .toArray();
};
