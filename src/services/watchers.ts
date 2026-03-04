import { ObjectId } from 'mongodb';
import { getDb } from './db';

export type WatchScope = 'BUNDLE' | 'MILESTONE';

const ensureWatcherIndexes = async (db: any) => {
  await db.collection('notification_watchers').createIndex({ userId: 1, scopeType: 1, scopeId: 1 }, { unique: true });
  await db.collection('notification_watchers').createIndex({ scopeType: 1, scopeId: 1 });
};

export const addWatcher = async (userId: string, scopeType: WatchScope, scopeId: string, createdBy?: string) => {
  const db = await getDb();
  await ensureWatcherIndexes(db);
  const now = new Date().toISOString();
  return await db.collection('notification_watchers').updateOne(
    { userId, scopeType, scopeId },
    { $setOnInsert: { userId, scopeType, scopeId, createdAt: now, createdBy: createdBy || userId } },
    { upsert: true }
  );
};

export const removeWatcher = async (userId: string, scopeType: WatchScope, scopeId: string) => {
  const db = await getDb();
  await ensureWatcherIndexes(db);
  return await db.collection('notification_watchers').deleteOne({ userId, scopeType, scopeId });
};

export const listWatchersByUser = async (userId: string, scopeType?: WatchScope) => {
  const db = await getDb();
  await ensureWatcherIndexes(db);
  const query: any = { userId };
  if (scopeType) query.scopeType = scopeType;
  return await db.collection('notification_watchers').find(query).sort({ createdAt: -1 }).toArray();
};

export const listWatchersForScope = async (scopeType: WatchScope, scopeId: string) => {
  const db = await getDb();
  await ensureWatcherIndexes(db);
  return await db.collection('notification_watchers').find({ scopeType, scopeId }).sort({ createdAt: -1 }).toArray();
};

export const listWatcherUserIdsForScopes = async (scopes: Array<{ scopeType: WatchScope; scopeId: string }>) => {
  const db = await getDb();
  await ensureWatcherIndexes(db);
  const or = scopes.filter((s) => s.scopeId).map((s) => ({ scopeType: s.scopeType, scopeId: s.scopeId }));
  if (!or.length) return [] as string[];
  const docs = await db.collection('notification_watchers').find({ $or: or }).toArray();
  return Array.from(new Set(docs.map((d: any) => String(d.userId || '')).filter(Boolean)));
};

export const canViewScopeWatchers = async (scopeType: WatchScope, scopeId: string, user: { userId?: string; role?: string } | null) => {
  if (!user?.userId) return false;
  const roleName = String(user.role || '').toLowerCase();
  if (roleName.includes('admin') || roleName.includes('cmo')) return true;

  if (scopeType === 'BUNDLE') {
    const db = await getDb();
    const assignment = await db.collection('bundle_assignments').findOne({
      bundleId: String(scopeId),
      userId: String(user.userId),
      assignmentType: 'bundle_owner',
      active: true
    });
    return Boolean(assignment);
  }

  return false;
};
