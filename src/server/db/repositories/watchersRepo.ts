import { getServerDb } from '../client';

export type WatchScope = 'BUNDLE' | 'MILESTONE';

const ensureWatcherIndexes = async (db: any) => {
  await db.collection('notification_watchers').createIndex({ userId: 1, scopeType: 1, scopeId: 1 }, { unique: true });
  await db.collection('notification_watchers').createIndex({ scopeType: 1, scopeId: 1 });
};

export const addWatcherRecord = async (userId: string, scopeType: WatchScope, scopeId: string, createdBy?: string) => {
  const db = await getServerDb();
  await ensureWatcherIndexes(db);
  const now = new Date().toISOString();
  return await db.collection('notification_watchers').updateOne(
    { userId, scopeType, scopeId },
    { $setOnInsert: { userId, scopeType, scopeId, createdAt: now, createdBy: createdBy || userId } },
    { upsert: true }
  );
};

export const removeWatcherRecord = async (userId: string, scopeType: WatchScope, scopeId: string) => {
  const db = await getServerDb();
  await ensureWatcherIndexes(db);
  return await db.collection('notification_watchers').deleteOne({ userId, scopeType, scopeId });
};

export const listWatchersByUserRecord = async (userId: string, scopeType?: WatchScope) => {
  const db = await getServerDb();
  await ensureWatcherIndexes(db);
  const query: any = { userId };
  if (scopeType) query.scopeType = scopeType;
  return await db.collection('notification_watchers').find(query).sort({ createdAt: -1 }).toArray();
};

export const listWatchersForScopeRecord = async (scopeType: WatchScope, scopeId: string) => {
  const db = await getServerDb();
  await ensureWatcherIndexes(db);
  return await db.collection('notification_watchers').find({ scopeType, scopeId }).sort({ createdAt: -1 }).toArray();
};

export const listWatcherUserIdsForScopesRecord = async (scopes: Array<{ scopeType: WatchScope; scopeId: string }>) => {
  const db = await getServerDb();
  await ensureWatcherIndexes(db);
  const or = scopes.filter((scope) => scope.scopeId).map((scope) => ({ scopeType: scope.scopeType, scopeId: scope.scopeId }));
  if (!or.length) return [] as string[];
  const docs = await db.collection('notification_watchers').find({ $or: or }).toArray();
  return Array.from(new Set(docs.map((doc: any) => String(doc.userId || '')).filter(Boolean)));
};

export const listWatcherUserIdsForScopeRecord = async (scopeType: WatchScope, scopeId: string) => {
  return await listWatcherUserIdsForScopesRecord([{ scopeType, scopeId }]);
};
