import { ObjectId } from 'mongodb';
import type { CommentMessage, CommentThread } from '../../../types';
import { getServerDb } from '../client';

const ensureCommentIndexes = async (db: any) => {
  await db.collection('comment_threads').createIndex({ 'resource.type': 1, 'resource.id': 1, lastActivityAt: -1 });
  await db.collection('comment_threads').createIndex({ reviewId: 1, status: 1 });
  await db.collection('comment_threads').createIndex({ reviewId: 1, reviewCycleId: 1, lastActivityAt: -1 });
  await db.collection('comment_threads').createIndex({ 'resource.type': 1, 'resource.id': 1, reviewCycleId: 1, createdAt: -1 });
  await db.collection('comment_threads').createIndex({ participants: 1, lastActivityAt: -1 });
  await db.collection('comment_messages').createIndex({ threadId: 1, createdAt: 1 });
  await db.collection('comment_messages').createIndex({ mentions: 1, createdAt: -1 });
  await db.collection('comment_messages').createIndex({ body: 'text' });
};

const ensureUserEventStateIndexes = async (db: any) => {
  await db.collection('user_event_state').createIndex({ userId: 1 }, { unique: true });
};

const makeCommentStateKey = (resourceType: string, resourceId: string) => `${resourceType}:${resourceId}`;

const getUserEventState = async (userId: string) => {
  try {
    const db = await getServerDb();
    await ensureUserEventStateIndexes(db);
    return await db.collection('user_event_state').findOne({ userId });
  } catch {
    return null;
  }
};

export const getCommentLastSeen = async (userId: string, resourceType: string, resourceId: string) => {
  try {
    const state = await getUserEventState(userId);
    if (!state?.commentLastSeen) return null;
    const key = makeCommentStateKey(resourceType, resourceId);
    return state.commentLastSeen[key] || null;
  } catch {
    return null;
  }
};

export const setCommentLastSeen = async (userId: string, resourceType: string, resourceId: string, lastSeenAt: string) => {
  const db = await getServerDb();
  await ensureUserEventStateIndexes(db);
  const key = makeCommentStateKey(resourceType, resourceId);
  return await db.collection('user_event_state').updateOne(
    { userId },
    { $set: { userId, [`commentLastSeen.${key}`]: lastSeenAt } },
    { upsert: true }
  );
};

export const countUnreadCommentThreads = async (userId: string, resourceType: string, resourceId: string) => {
  try {
    const db = await getServerDb();
    await ensureCommentIndexes(db);
    const lastSeenAt = await getCommentLastSeen(userId, resourceType, resourceId);
    const query: Record<string, unknown> = { 'resource.type': resourceType, 'resource.id': resourceId };
    if (lastSeenAt) query.lastActivityAt = { $gt: lastSeenAt };
    return await db.collection('comment_threads').countDocuments(query);
  } catch {
    return 0;
  }
};

export const listCommentThreads = async (resourceType: string, resourceId: string) => {
  try {
    const db = await getServerDb();
    await ensureCommentIndexes(db);
    return await db
      .collection('comment_threads')
      .find({ 'resource.type': resourceType, 'resource.id': resourceId })
      .sort({ lastActivityAt: -1 })
      .toArray();
  } catch {
    return [];
  }
};

export const createCommentThreadRecord = async ({
  resource,
  anchor,
  body,
  author,
  mentions = [],
  reviewId,
  reviewCycleId
}: {
  resource: { type: string; id: string; title?: string };
  anchor?: { kind: string; data: any };
  body: string;
  author: { userId: string; displayName: string; email?: string };
  mentions?: string[];
  reviewId?: string;
  reviewCycleId?: string;
}) => {
  const db = await getServerDb();
  await ensureCommentIndexes(db);
  const now = new Date().toISOString();
  const participantSet = new Set<string>([author.userId, ...mentions].filter(Boolean));
  const thread: Partial<CommentThread> = {
    resource: { type: resource.type, id: resource.id, title: resource.title },
    anchor,
    status: 'open',
    createdBy: author,
    createdAt: now,
    lastActivityAt: now,
    messageCount: 1,
    participants: Array.from(participantSet),
    reviewId,
    reviewCycleId
  };

  const { _id, ...threadData } = thread as any;
  const threadResult = await db.collection('comment_threads').insertOne(threadData);
  const message: Partial<CommentMessage> = {
    threadId: String(threadResult.insertedId),
    author,
    body,
    createdAt: now,
    mentions
  };
  const { _id: messageId, ...messageData } = message as any;
  await db.collection('comment_messages').insertOne(messageData);
  return { threadId: String(threadResult.insertedId), thread, message };
};

export const listCommentMessages = async (threadId: string) => {
  try {
    const db = await getServerDb();
    await ensureCommentIndexes(db);
    return await db.collection('comment_messages').find({ threadId: String(threadId) }).sort({ createdAt: 1 }).toArray();
  } catch {
    return [];
  }
};

export const getCommentThreadById = async (threadId: string) => {
  try {
    const db = await getServerDb();
    await ensureCommentIndexes(db);
    return await db.collection('comment_threads').findOne({ _id: new ObjectId(threadId) });
  } catch {
    return null;
  }
};

export const addCommentMessageRecord = async ({
  threadId,
  body,
  author,
  mentions = []
}: {
  threadId: string;
  body: string;
  author: { userId: string; displayName: string; email?: string };
  mentions?: string[];
}) => {
  const db = await getServerDb();
  await ensureCommentIndexes(db);
  const now = new Date().toISOString();
  const message: Partial<CommentMessage> = {
    threadId: String(threadId),
    author,
    body,
    createdAt: now,
    mentions
  };
  const { _id, ...messageData } = message as any;
  await db.collection('comment_messages').insertOne(messageData);
  await db.collection('comment_threads').updateOne(
    { _id: new ObjectId(threadId) },
    {
      $set: { lastActivityAt: now },
      $inc: { messageCount: 1 },
      $addToSet: { participants: { $each: Array.from(new Set([author.userId, ...mentions].filter(Boolean))) } }
    }
  );
  return message;
};

export const listCommentThreadsInbox = async ({
  userId,
  resourceType,
  status,
  mentionsOnly,
  participatingOnly,
  since,
  search,
  limit = 200
}: {
  userId: string;
  resourceType?: string;
  status?: 'open' | 'resolved';
  mentionsOnly?: boolean;
  participatingOnly?: boolean;
  since?: string;
  search?: string;
  limit?: number;
}) => {
  try {
    const db = await getServerDb();
    await ensureCommentIndexes(db);
    const query: Record<string, unknown> = {};
    if (resourceType) query['resource.type'] = resourceType;
    if (status) query.status = status;
    if (participatingOnly) query.participants = userId;
    if (since) query.lastActivityAt = { $gt: new Date(since) };
    if (search) query['resource.title'] = { $regex: search.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&'), $options: 'i' };

    if (mentionsOnly) {
      const mentionQuery: Record<string, unknown> = { mentions: userId };
      if (since) mentionQuery.createdAt = { $gt: new Date(since) };
      const threadIds = await db.collection('comment_messages').distinct('threadId', mentionQuery);
      const objectIds = (threadIds || [])
        .filter((id: any) => ObjectId.isValid(String(id)))
        .map((id: any) => new ObjectId(String(id)));
      if (objectIds.length === 0) return [];
      query._id = { $in: objectIds };
    }

    return await db.collection('comment_threads').aggregate([
      { $match: query },
      { $sort: { lastActivityAt: -1 } },
      { $limit: limit },
      {
        $lookup: {
          from: 'comment_messages',
          let: { tid: { $toString: '$_id' } },
          pipeline: [
            { $match: { $expr: { $eq: ['$threadId', '$$tid'] } } },
            { $sort: { createdAt: -1 } },
            { $limit: 1 }
          ],
          as: 'lastMessage'
        }
      },
      { $addFields: { lastMessage: { $arrayElemAt: ['$lastMessage', 0] } } }
    ]).toArray();
  } catch {
    return [];
  }
};

export const setCommentThreadStatus = async (threadId: string, status: 'open' | 'resolved') => {
  const db = await getServerDb();
  await ensureCommentIndexes(db);
  return await db.collection('comment_threads').updateOne(
    { _id: new ObjectId(threadId) },
    { $set: { status, lastActivityAt: new Date().toISOString() } }
  );
};
