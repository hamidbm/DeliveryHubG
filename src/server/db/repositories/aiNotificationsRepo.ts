import { ObjectId } from 'mongodb';
import { getServerDb } from '../client';

const WATCHERS_COLLECTION = 'ai_watchers';
const NOTIFICATIONS_COLLECTION = 'ai_notifications';
const DIGEST_QUEUE_COLLECTION = 'ai_notification_digest_queue';

const toObjectId = (id: string) => (ObjectId.isValid(id) ? new ObjectId(id) : id);

const ensureWatcherIndexes = async (db: any) => {
  await db.collection(WATCHERS_COLLECTION).createIndex({ userId: 1, type: 1 });
};

const ensureNotificationIndexes = async (db: any) => {
  await db.collection(NOTIFICATIONS_COLLECTION).createIndex({ userId: 1, watcherId: 1, read: 1 });
  await db.collection(NOTIFICATIONS_COLLECTION).createIndex({ userId: 1, createdAt: -1 });
};

const ensureDigestIndexes = async (db: any) => {
  await db.collection(DIGEST_QUEUE_COLLECTION).createIndex({ userId: 1, digestFrequency: 1, processedAt: 1, createdAt: 1 });
  await db.collection(DIGEST_QUEUE_COLLECTION).createIndex({ notificationId: 1 }, { unique: true });
};

export const countAiWatchersForUser = async (userId: string) => {
  const db = await getServerDb();
  await ensureWatcherIndexes(db);
  return await db.collection(WATCHERS_COLLECTION).countDocuments({ userId: String(userId) });
};

export const countAiNotificationsForUserSince = async (userId: string, sinceIso: string) => {
  const db = await getServerDb();
  await ensureNotificationIndexes(db);
  return await db.collection(NOTIFICATIONS_COLLECTION).countDocuments({
    userId: String(userId),
    createdAt: { $gte: sinceIso }
  });
};

export const listAiWatchersForUserRecords = async (userId: string) => {
  const db = await getServerDb();
  await ensureWatcherIndexes(db);
  return await db.collection(WATCHERS_COLLECTION)
    .find({ userId: String(userId) })
    .sort({ createdAt: -1 })
    .toArray();
};

export const createAiWatcherRecord = async (doc: Record<string, unknown>) => {
  const db = await getServerDb();
  await ensureWatcherIndexes(db);
  return await db.collection(WATCHERS_COLLECTION).insertOne(doc);
};

export const updateAiWatcherForUserRecord = async (userId: string, watcherId: string, setData: Record<string, unknown>) => {
  const db = await getServerDb();
  await ensureWatcherIndexes(db);
  return await db.collection(WATCHERS_COLLECTION).updateOne(
    { _id: toObjectId(watcherId), userId: String(userId) } as any,
    { $set: setData }
  );
};

export const deleteAiWatcherForUserRecord = async (userId: string, watcherId: string) => {
  const db = await getServerDb();
  await ensureWatcherIndexes(db);
  return await db.collection(WATCHERS_COLLECTION).deleteOne({ _id: toObjectId(watcherId), userId: String(userId) } as any);
};

export const listAiNotificationsForUserRecords = async (userId: string, limit = 200) => {
  const db = await getServerDb();
  await ensureNotificationIndexes(db);
  return await db.collection(NOTIFICATIONS_COLLECTION)
    .find({ userId: String(userId) })
    .sort({ read: 1, createdAt: -1 })
    .limit(limit)
    .toArray();
};

export const updateAiNotificationReadStateRecord = async (userId: string, notificationId: string, read: boolean) => {
  const db = await getServerDb();
  await ensureNotificationIndexes(db);
  return await db.collection(NOTIFICATIONS_COLLECTION).updateOne(
    { _id: toObjectId(notificationId), userId: String(userId) } as any,
    { $set: { read: Boolean(read) } }
  );
};

export const listEnabledAiWatchersForUserRecords = async (userId: string) => {
  const db = await getServerDb();
  await ensureWatcherIndexes(db);
  return await db.collection(WATCHERS_COLLECTION)
    .find({ userId: String(userId), enabled: true })
    .toArray();
};

export const insertAiNotificationRecord = async (doc: Record<string, unknown>) => {
  const db = await getServerDb();
  await ensureNotificationIndexes(db);
  return await db.collection(NOTIFICATIONS_COLLECTION).insertOne(doc);
};

export const updateAiWatcherLastTriggeredRecord = async (userId: string, watcherId: string, lastTriggeredAt: string) => {
  const db = await getServerDb();
  await ensureWatcherIndexes(db);
  return await db.collection(WATCHERS_COLLECTION).updateOne(
    { _id: toObjectId(watcherId), userId: String(userId) } as any,
    { $set: { lastTriggeredAt } }
  );
};

export const enqueueAiNotificationDigestRecord = async (doc: Record<string, unknown>) => {
  const db = await getServerDb();
  await ensureDigestIndexes(db);
  return await db.collection(DIGEST_QUEUE_COLLECTION).insertOne(doc);
};

export const listPendingAiNotificationDigestRecords = async (limit = 1000) => {
  const db = await getServerDb();
  await ensureDigestIndexes(db);
  return await db.collection(DIGEST_QUEUE_COLLECTION)
    .find({ processedAt: null })
    .sort({ createdAt: 1 })
    .limit(limit)
    .toArray();
};

export const deleteAiNotificationDigestRecordsByIds = async (ids: string[]) => {
  const objectIds = ids.map((id) => toObjectId(id));
  if (!objectIds.length) return;
  const db = await getServerDb();
  await ensureDigestIndexes(db);
  await db.collection(DIGEST_QUEUE_COLLECTION).deleteMany({ _id: { $in: objectIds } } as any);
};

export const markAiNotificationDigestRecordsProcessed = async (ids: string[], processedAt: string) => {
  const objectIds = ids.map((id) => toObjectId(id));
  if (!objectIds.length) return;
  const db = await getServerDb();
  await ensureDigestIndexes(db);
  await db.collection(DIGEST_QUEUE_COLLECTION).updateMany(
    { _id: { $in: objectIds } } as any,
    { $set: { processedAt } }
  );
};

export const listAiNotificationsByIds = async (ids: string[]) => {
  const objectIds = ids.map((id) => toObjectId(id));
  if (!objectIds.length) return [];
  const db = await getServerDb();
  await ensureNotificationIndexes(db);
  return await db.collection(NOTIFICATIONS_COLLECTION).find({ _id: { $in: objectIds } } as any).toArray();
};

export const listDigestEnabledAiWatchersForUserRecords = async (userId: string) => {
  const db = await getServerDb();
  await ensureWatcherIndexes(db);
  return await db.collection(WATCHERS_COLLECTION)
    .find({ userId: String(userId), enabled: true, 'deliveryPreferences.digest.enabled': true })
    .toArray();
};

export const getAiNotificationByIdRecord = async (notificationId: string) => {
  const db = await getServerDb();
  await ensureNotificationIndexes(db);
  return await db.collection(NOTIFICATIONS_COLLECTION).findOne({ _id: toObjectId(notificationId) } as any);
};

export const listAiNotificationRecords = async (input: {
  query?: Record<string, unknown>;
  limit?: number;
}) => {
  const db = await getServerDb();
  await ensureNotificationIndexes(db);
  return await db.collection(NOTIFICATIONS_COLLECTION)
    .find(input.query || {})
    .sort({ createdAt: -1, _id: -1 })
    .limit(Math.max(1, Math.min(input.limit || 50, 200)))
    .toArray();
};

export const getAiWatcherByIdRecord = async (watcherId: string) => {
  const db = await getServerDb();
  await ensureWatcherIndexes(db);
  return await db.collection(WATCHERS_COLLECTION).findOne({ _id: toObjectId(watcherId) } as any);
};

export const listRecentDeliveredAiNotificationsForWatcherChannel = async (
  userId: string,
  watcherId: string,
  notificationId: string,
  channel: string,
  limit = 1
) => {
  const db = await getServerDb();
  await ensureNotificationIndexes(db);
  return await db.collection(NOTIFICATIONS_COLLECTION)
    .find({
      userId: String(userId),
      watcherId: String(watcherId),
      _id: { $ne: toObjectId(notificationId) },
      [`delivery.${channel}.status`]: 'sent'
    } as any)
    .sort({ createdAt: -1 })
    .limit(limit)
    .toArray();
};

export const updateAiNotificationRecord = async (notificationId: string, update: Record<string, unknown>, unset?: Record<string, unknown>) => {
  const db = await getServerDb();
  await ensureNotificationIndexes(db);
  await db.collection(NOTIFICATIONS_COLLECTION).updateOne(
    { _id: toObjectId(notificationId) } as any,
    unset && Object.keys(unset).length ? { $set: update, $unset: unset } : { $set: update }
  );
};

export const listAiNotificationsNeedingRetry = async (maxRows: number, retryMaxAttempts: number, nowIso: string) => {
  const db = await getServerDb();
  await ensureNotificationIndexes(db);
  const retryFilter = {
    $or: ['email', 'slack', 'teams'].map((channel) => ({
      [`delivery.${channel}.status`]: 'failed',
      [`delivery.${channel}.nextRetryAt`]: { $lte: nowIso },
      [`delivery.${channel}.attempts`]: { $lt: retryMaxAttempts }
    }))
  };
  return await db.collection(NOTIFICATIONS_COLLECTION)
    .find(retryFilter as any, { projection: { _id: 1 } })
    .sort({ createdAt: -1 })
    .limit(Math.max(1, Math.min(maxRows, 500)))
    .toArray();
};

export const clearAiNotificationChannelRetryState = async (notificationId: string, channel: string) => {
  const db = await getServerDb();
  await ensureNotificationIndexes(db);
  await db.collection(NOTIFICATIONS_COLLECTION).updateOne(
    { _id: toObjectId(notificationId) } as any,
    {
      $unset: {
        [`delivery.${channel}.nextRetryAt`]: ''
      }
    }
  );
};

export const findUserContactByAnyId = async (userId: string) => {
  const db = await getServerDb();
  return await db.collection('users').findOne({
    $or: [{ _id: toObjectId(userId) }, { id: userId }, { userId }]
  } as any, { projection: { _id: 1, email: 1, name: 1 } });
};
