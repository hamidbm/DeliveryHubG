import { getServerDb } from '../client';

const ensureAdminIndexes = async (db: any) => {
  await db.collection('admins').createIndex({ userId: 1 }, { unique: true });
};

export const listAdmins = async () => {
  try {
    const db = await getServerDb();
    await ensureAdminIndexes(db);
    return await db.collection('admins').find({}).sort({ createdAt: -1 }).toArray();
  } catch {
    return [];
  }
};

export const saveAdminRecord = async (userId: string, createdBy = 'system') => {
  const db = await getServerDb();
  await ensureAdminIndexes(db);
  return await db.collection('admins').updateOne(
    { userId },
    { $setOnInsert: { userId, createdAt: new Date().toISOString(), createdBy } },
    { upsert: true }
  );
};

export const deleteAdminRecord = async (userId: string) => {
  const db = await getServerDb();
  await ensureAdminIndexes(db);
  return await db.collection('admins').deleteOne({ userId });
};

export const hasAdminRecord = async (userId: string) => {
  try {
    const db = await getServerDb();
    await ensureAdminIndexes(db);
    const record = await db.collection('admins').findOne({ userId });
    return Boolean(record);
  } catch {
    return false;
  }
};
