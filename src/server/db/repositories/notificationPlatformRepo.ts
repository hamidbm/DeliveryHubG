import { ObjectId } from 'mongodb';
import { getServerDb } from '../client';

const ensureNotificationSettingsIndexes = async (db: any) => {
  await db.collection('notification_settings').createIndex({ updatedAt: -1 });
};

const ensureNotificationUserPrefsIndexes = async (db: any) => {
  await db.collection('notification_user_prefs').createIndex({ userId: 1 }, { unique: true });
};

const ensureNotificationDigestQueueIndexes = async (db: any) => {
  await db.collection('notification_digest_queue').createIndex({ userId: 1, createdAt: -1 });
};

const ensureDigestRunIndexes = async (db: any) => {
  await db.collection('digest_runs').createIndex({ userId: 1, dateKey: 1 }, { unique: true });
  await db.collection('digest_runs').createIndex({ sentAt: -1 });
};

export const getNotificationSettingsDoc = async () => {
  const db = await getServerDb();
  await ensureNotificationSettingsIndexes(db);
  return await db.collection('notification_settings').findOne({ _id: 'global' } as any);
};

export const saveNotificationSettingsDoc = async (doc: Record<string, unknown>) => {
  const db = await getServerDb();
  await ensureNotificationSettingsIndexes(db);
  await db.collection('notification_settings').updateOne(
    { _id: 'global' } as any,
    { $set: doc },
    { upsert: true }
  );
  return doc;
};

export const getUserNotificationPrefsDoc = async (userId: string) => {
  const db = await getServerDb();
  await ensureNotificationUserPrefsIndexes(db);
  return await db.collection('notification_user_prefs').findOne({ userId });
};

export const saveUserNotificationPrefsDoc = async (userId: string, doc: Record<string, unknown>) => {
  const db = await getServerDb();
  await ensureNotificationUserPrefsIndexes(db);
  await db.collection('notification_user_prefs').updateOne(
    { userId },
    { $set: doc },
    { upsert: true }
  );
  return doc;
};

export const listUserNotificationPrefsDocs = async (userIds: string[]) => {
  const ids = Array.from(new Set(userIds.map((id) => String(id || '')).filter(Boolean)));
  if (!ids.length) return [];
  const db = await getServerDb();
  await ensureNotificationUserPrefsIndexes(db);
  return await db.collection('notification_user_prefs').find({ userId: { $in: ids } }).toArray();
};

export const listDigestOptInUserPrefsDocs = async (limit = 2000) => {
  const db = await getServerDb();
  await ensureNotificationUserPrefsIndexes(db);
  return await db.collection('notification_user_prefs')
    .find({ digestOptIn: true }, { projection: { userId: 1 } })
    .limit(limit)
    .toArray();
};

export const insertClassicNotifications = async (notifications: Array<Record<string, unknown>>) => {
  if (!notifications.length) return;
  const db = await getServerDb();
  await db.collection('notifications').insertMany(notifications);
};

export const insertClassicNotification = async (notification: Record<string, unknown>) => {
  const db = await getServerDb();
  return await db.collection('notifications').insertOne(notification);
};

export const listClassicNotificationsByRecipient = async (recipient: string) => {
  const normalizedRecipient = String(recipient || '').trim();
  if (!normalizedRecipient) return [];
  const db = await getServerDb();
  return await db.collection('notifications')
    .find({ recipient: normalizedRecipient })
    .sort({ createdAt: -1 })
    .toArray();
};

export const markClassicNotificationRead = async (id: string) => {
  if (!ObjectId.isValid(id)) return { matchedCount: 0, modifiedCount: 0, acknowledged: true };
  const db = await getServerDb();
  return await db.collection('notifications').updateOne(
    { _id: new ObjectId(id) },
    { $set: { read: true } }
  );
};

export const getClassicNotificationById = async (id: string, projection?: Record<string, unknown>) => {
  if (!ObjectId.isValid(id)) return null;
  const db = await getServerDb();
  return await db.collection('notifications').findOne(
    { _id: new ObjectId(id) },
    projection ? { projection } : undefined
  );
};

export const listClassicNotificationRecords = async (input: {
  query?: Record<string, unknown>;
  projection?: Record<string, unknown>;
  limit?: number;
}) => {
  const db = await getServerDb();
  return await db.collection('notifications')
    .find(input.query || {}, input.projection ? { projection: input.projection } : undefined)
    .sort({ createdAt: -1, _id: -1 })
    .limit(Math.max(1, Math.min(input.limit || 50, 200)))
    .toArray();
};

export const aggregateClassicNotificationsByDayAndTypeSince = async (since: Date) => {
  const db = await getServerDb();
  return await db.collection('notifications').aggregate([
    { $addFields: { createdAtDate: { $toDate: '$createdAt' } } },
    { $match: { createdAtDate: { $gte: since } } },
    {
      $group: {
        _id: {
          day: { $dateToString: { format: '%Y-%m-%d', date: '$createdAtDate' } },
          type: '$type'
        },
        count: { $sum: 1 }
      }
    }
  ]).toArray();
};

export const enqueueNotificationDigestItems = async (items: Array<Record<string, unknown>>) => {
  if (!items.length) return;
  const db = await getServerDb();
  await ensureNotificationDigestQueueIndexes(db);
  await db.collection('notification_digest_queue').insertMany(items);
};

export const enqueueNotificationDigestItem = async (item: Record<string, unknown>) => {
  const db = await getServerDb();
  await ensureNotificationDigestQueueIndexes(db);
  await db.collection('notification_digest_queue').insertOne(item);
};

export const listNotificationDigestQueueItems = async (query: Record<string, unknown>) => {
  const db = await getServerDb();
  await ensureNotificationDigestQueueIndexes(db);
  return await db.collection('notification_digest_queue').find(query).toArray();
};

export const getNotificationDigestQueueItem = async (query: Record<string, unknown>) => {
  const db = await getServerDb();
  await ensureNotificationDigestQueueIndexes(db);
  return await db.collection('notification_digest_queue').findOne(query);
};

export const listNotificationDigestQueueItemsForUserSince = async (userId: string, sinceIso: string) => {
  const db = await getServerDb();
  await ensureNotificationDigestQueueIndexes(db);
  return await db.collection('notification_digest_queue')
    .find({ userId, createdAt: { $gte: sinceIso } })
    .sort({ createdAt: -1 })
    .toArray();
};

export const deleteNotificationDigestQueueItemsByIds = async (ids: Array<string | ObjectId>) => {
  const objectIds = ids
    .map((id) => String(id || ''))
    .filter(Boolean)
    .filter((id) => ObjectId.isValid(id))
    .map((id) => new ObjectId(id));
  if (!objectIds.length) return;
  const db = await getServerDb();
  await ensureNotificationDigestQueueIndexes(db);
  await db.collection('notification_digest_queue').deleteMany({ _id: { $in: objectIds } });
};

export const getDigestRunRecord = async (userId: string, dateKey: string) => {
  const db = await getServerDb();
  await ensureDigestRunIndexes(db);
  return await db.collection('digest_runs').findOne({ userId, dateKey });
};

export const upsertDigestRunRecord = async (userId: string, dateKey: string, countItems: number) => {
  const db = await getServerDb();
  await ensureDigestRunIndexes(db);
  await db.collection('digest_runs').updateOne(
    { userId, dateKey },
    { $set: { userId, dateKey, sentAt: new Date().toISOString(), countItems } },
    { upsert: true }
  );
};
