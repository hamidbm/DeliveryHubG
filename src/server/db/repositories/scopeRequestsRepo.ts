import { ObjectId } from 'mongodb';
import { getServerDb } from '../client';

const ensureScopeChangeRequestIndexes = async (db: any) => {
  await db.collection('scope_change_requests').createIndex({ milestoneId: 1, status: 1, requestedAt: -1 });
  await db.collection('scope_change_requests').createIndex({ status: 1, requestedAt: -1 });
};

export const insertScopeChangeRequestRecord = async (doc: Record<string, unknown>) => {
  const db = await getServerDb();
  await ensureScopeChangeRequestIndexes(db);
  return await db.collection('scope_change_requests').insertOne(doc);
};

export const listScopeChangeRequestRecords = async (query: Record<string, unknown>) => {
  const db = await getServerDb();
  await ensureScopeChangeRequestIndexes(db);
  return await db.collection('scope_change_requests').find(query).sort({ requestedAt: -1 }).toArray();
};

export const getScopeChangeRequestByRef = async (id: string) => {
  const db = await getServerDb();
  await ensureScopeChangeRequestIndexes(db);
  if (ObjectId.isValid(id)) {
    return await db.collection('scope_change_requests').findOne({ _id: new ObjectId(id) });
  }
  return await db.collection('scope_change_requests').findOne({ _id: id as any });
};

export const updateScopeChangeRequestRecord = async (id: string, update: Record<string, unknown>) => {
  const db = await getServerDb();
  await ensureScopeChangeRequestIndexes(db);
  const filter = ObjectId.isValid(id) ? { _id: new ObjectId(id) } : { _id: id as any };
  return await db.collection('scope_change_requests').updateOne(filter, { $set: update });
};
