import { getServerDb } from '../client';

const ensureEventIndexes = async (db: any) => {
  await db.collection('events').createIndex({ ts: -1 });
  await db.collection('events').createIndex({ type: 1, ts: -1 });
  await db.collection('events').createIndex({ 'actor.userId': 1, ts: -1 });
  await db.collection('events').createIndex({ 'resource.type': 1, 'resource.id': 1, ts: -1 });
  await db.collection('events').createIndex({ ts: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 60 });
};

const ensureUserEventStateIndexes = async (db: any) => {
  await db.collection('user_event_state').createIndex({ userId: 1 }, { unique: true });
};

export const listEvents = async ({
  limit = 200,
  type,
  typePrefix,
  resourceType,
  resourceId,
  actorId,
  since,
  mentionUserId,
  bundleId,
  appId,
  milestoneId,
  documentTypeId,
  search
}: {
  limit?: number;
  type?: string;
  typePrefix?: string;
  resourceType?: string;
  resourceId?: string;
  actorId?: string;
  since?: string;
  mentionUserId?: string;
  bundleId?: string;
  appId?: string;
  milestoneId?: string;
  documentTypeId?: string;
  search?: string;
}) => {
  try {
    const db = await getServerDb();
    await ensureEventIndexes(db);
    const query: any = {};
    if (type) query.type = type;
    if (!type && typePrefix) query.type = new RegExp(`^${typePrefix.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&')}`);
    if (resourceType) query['resource.type'] = resourceType;
    if (resourceId) query['resource.id'] = resourceId;
    if (actorId) query['actor.userId'] = actorId;
    if (mentionUserId) query['payload.mentionedUserId'] = mentionUserId;
    if (since) query.ts = { $gt: new Date(since) };
    if (bundleId) query['context.bundleId'] = bundleId;
    if (appId) query['context.appId'] = appId;
    if (milestoneId) query['context.milestoneId'] = milestoneId;
    if (documentTypeId) query['context.documentTypeId'] = documentTypeId;
    if (search) query['resource.title'] = { $regex: search.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&'), $options: 'i' };
    return await db.collection('events').find(query).sort({ ts: -1 }).limit(limit).toArray();
  } catch {
    return [];
  }
};

export const listEventsByQuery = async (query: Record<string, unknown>, limit = 50) => {
  try {
    const db = await getServerDb();
    await ensureEventIndexes(db);
    return await db.collection('events')
      .find(query)
      .sort({ ts: -1, _id: -1 })
      .limit(limit)
      .toArray();
  } catch {
    return [];
  }
};

export const getEventById = async (id: string, projection?: Record<string, unknown>) => {
  try {
    const db = await getServerDb();
    await ensureEventIndexes(db);
    const { ObjectId } = await import('mongodb');
    if (!ObjectId.isValid(id)) return null;
    return await db.collection('events').findOne(
      { _id: new ObjectId(id) },
      projection ? { projection } : undefined
    );
  } catch {
    return null;
  }
};

export const listEventRecords = async (input: {
  query?: Record<string, unknown>;
  projection?: Record<string, unknown>;
  limit?: number;
}) => {
  try {
    const db = await getServerDb();
    await ensureEventIndexes(db);
    return await db.collection('events')
      .find(input.query || {}, input.projection ? { projection: input.projection } : undefined)
      .sort({ ts: -1, _id: -1 })
      .limit(Math.max(1, Math.min(input.limit || 50, 200)))
      .toArray();
  } catch {
    return [];
  }
};

export const listPerfEventRecordsSince = async (since: Date, eventTypes: string[]) => {
  try {
    const db = await getServerDb();
    await ensureEventIndexes(db);
    return await db.collection('events').find({
      ts: { $gte: since },
      type: { $in: eventTypes }
    }).toArray();
  } catch {
    return [];
  }
};

export const getUserEventStateRecord = async (userId: string) => {
  try {
    const db = await getServerDb();
    await ensureUserEventStateIndexes(db);
    return await db.collection('user_event_state').findOne({ userId });
  } catch {
    return null;
  }
};

export const saveUserEventStateRecord = async (userId: string, lastSeenAt: string) => {
  const db = await getServerDb();
  await ensureUserEventStateIndexes(db);
  return await db.collection('user_event_state').updateOne(
    { userId },
    { $set: { userId, lastSeenAt } },
    { upsert: true }
  );
};

export const countUnreadEvents = async (userId: string) => {
  try {
    const db = await getServerDb();
    await ensureEventIndexes(db);
    const state = await getUserEventStateRecord(userId);
    const since = state?.lastSeenAt;
    const query: any = since ? { ts: { $gt: new Date(since) } } : {};
    return await db.collection('events').countDocuments(query);
  } catch {
    return 0;
  }
};
