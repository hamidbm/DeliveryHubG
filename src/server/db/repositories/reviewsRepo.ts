import { ObjectId, type Sort, type SortDirection } from 'mongodb';
import type { ReviewRecord } from '../../../types';
import { getServerDb } from '../client';

const ensureReviewIndexes = async (db: any) => {
  await db.collection('reviews').createIndex({ 'resource.type': 1, 'resource.id': 1 }, { unique: true });
  await db.collection('reviews').createIndex({ status: 1, createdAt: -1 });
  await db.collection('reviews').createIndex({ 'resource.bundleId': 1, currentCycleStatus: 1, updatedAt: -1 });
  await db.collection('reviews').createIndex({ currentReviewerUserIds: 1, currentCycleStatus: 1, currentDueAt: 1 });
  await db.collection('reviews').createIndex({ currentRequestedByUserId: 1, currentRequestedAt: -1 });
  await db.collection('reviews').createIndex({ 'resource.title': 'text' });
};

export const getReviewByResource = async (resourceType: string, resourceId: string): Promise<ReviewRecord | null> => {
  try {
    const db = await getServerDb();
    await ensureReviewIndexes(db);
    return await db.collection<ReviewRecord>('reviews').findOne({ 'resource.type': resourceType, 'resource.id': resourceId });
  } catch {
    return null;
  }
};

export const getReviewById = async (reviewId: string): Promise<ReviewRecord | null> => {
  try {
    const db = await getServerDb();
    await ensureReviewIndexes(db);
    if (!ObjectId.isValid(reviewId)) return null;
    return await db.collection<ReviewRecord>('reviews').findOne({ _id: new ObjectId(reviewId) } as any);
  } catch {
    return null;
  }
};

export const findReviewByAnyId = async (reviewId: string): Promise<ReviewRecord | null> => {
  try {
    if (!reviewId) return null;
    const db = await getServerDb();
    await ensureReviewIndexes(db);
    if (ObjectId.isValid(reviewId)) {
      return await db.collection<ReviewRecord>('reviews').findOne({ _id: new ObjectId(reviewId) } as any);
    }
    return await db.collection<ReviewRecord>('reviews').findOne({
      $or: [
        { _id: reviewId as any },
        { 'resource.id': reviewId }
      ]
    } as any);
  } catch {
    return null;
  }
};

export const saveReviewRecord = async (review: Partial<ReviewRecord>) => {
  const db = await getServerDb();
  await ensureReviewIndexes(db);
  const now = new Date().toISOString();

  if (review._id && ObjectId.isValid(review._id as string)) {
    const { _id, ...data } = review;
    return await db.collection('reviews').updateOne(
      { _id: new ObjectId(_id) },
      { $set: { ...data, updatedAt: now } }
    );
  }

  return await db.collection('reviews').updateOne(
    { 'resource.type': review.resource?.type, 'resource.id': review.resource?.id },
    {
      $set: {
        resource: review.resource,
        status: review.status || 'active',
        createdBy: review.createdBy,
        currentCycleId: review.currentCycleId,
        currentCycleStatus: review.currentCycleStatus,
        currentDueAt: review.currentDueAt,
        currentReviewerUserIds: review.currentReviewerUserIds,
        currentRequestedAt: review.currentRequestedAt,
        currentRequestedByUserId: review.currentRequestedByUserId,
        cycles: review.cycles || [],
        resourceVersion: review.resourceVersion,
        updatedAt: now
      },
      $setOnInsert: { createdAt: now }
    },
    { upsert: true }
  );
};

export const listReviewsPage = async ({
  query,
  sort,
  page,
  pageSize
}: {
  query: Record<string, unknown>;
  sort: Sort;
  page: number;
  pageSize: number;
}) => {
  const db = await getServerDb();
  await ensureReviewIndexes(db);
  const total = await db.collection('reviews').countDocuments(query);
  const reviews = await db.collection('reviews')
    .find(query)
    .sort(sort)
    .skip((page - 1) * pageSize)
    .limit(pageSize)
    .toArray();
  return { total, reviews };
};

export const listReviewsByResourceIds = async (resourceType: string, resourceIds: string[]) => {
  if (!resourceIds.length) return [];
  const db = await getServerDb();
  await ensureReviewIndexes(db);
  return await db.collection('reviews').find({
    'resource.type': resourceType,
    'resource.id': { $in: resourceIds.map(String) }
  }).toArray();
};

export const listReviewMetaByRefs = async (refs: string[]) => {
  if (!refs.length) return [];
  const ids = Array.from(new Set(refs.map((ref) => String(ref || '')).filter(Boolean)));
  const objectIds = ids.filter((id) => ObjectId.isValid(id)).map((id) => new ObjectId(id));
  const db = await getServerDb();
  await ensureReviewIndexes(db);
  return await db.collection('reviews').find({
    $or: [
      { _id: { $in: objectIds } },
      { 'resource.id': { $in: ids } }
    ]
  }, {
    projection: { _id: 1, id: 1, status: 1, currentCycleStatus: 1, currentDueAt: 1, currentCycleDueAt: 1 }
  }).toArray();
};

export const getReviewCycleCommentStats = async (cycleIds: string[]) => {
  const threadCounts: Record<string, number> = {};
  const messageCounts: Record<string, number> = {};

  if (!cycleIds.length) return { threadCounts, messageCounts };

  const db = await getServerDb();
  const threads = await db.collection('comment_threads').find({ reviewCycleId: { $in: cycleIds } }).toArray();
  threads.forEach((thread: any) => {
    const cycleId = String(thread.reviewCycleId || '');
    if (!cycleId) return;
    threadCounts[cycleId] = (threadCounts[cycleId] || 0) + 1;
    const count = typeof thread.messageCount === 'number' ? thread.messageCount : 0;
    messageCounts[cycleId] = (messageCounts[cycleId] || 0) + count;
  });

  return { threadCounts, messageCounts };
};
