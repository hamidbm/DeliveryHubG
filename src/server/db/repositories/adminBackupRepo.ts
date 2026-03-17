import { getServerDb } from '../client';

export const listBackupCollectionRecords = async (collectionName: string) => {
  const db = await getServerDb();
  return await db.collection(String(collectionName)).find({}).toArray();
};

export const findBackupCollectionRecord = async (collectionName: string, filter: Record<string, unknown>) => {
  const db = await getServerDb();
  return await db.collection(String(collectionName)).findOne(filter as any);
};

export const updateBackupCollectionRecord = async (
  collectionName: string,
  filter: Record<string, unknown>,
  doc: Record<string, unknown>,
  allowUpsert = true
) => {
  const db = await getServerDb();
  return await db.collection(String(collectionName)).updateOne(
    filter as any,
    { $set: doc },
    { upsert: allowUpsert }
  );
};

export const insertBackupCollectionRecord = async (collectionName: string, doc: Record<string, unknown>) => {
  const db = await getServerDb();
  return await db.collection(String(collectionName)).insertOne(doc as any);
};
