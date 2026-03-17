import { ObjectId } from 'mongodb';
import type { FeedbackPackage } from '../../../types';
import { getServerDb } from '../client';

const ensureFeedbackPackageIndexes = async (db: any) => {
  await db.collection('feedback_packages').createIndex({ 'resource.type': 1, 'resource.id': 1, createdAt: -1 });
  await db.collection('feedback_packages').createIndex({ status: 1, createdAt: -1 });
};

export const listFeedbackPackages = async (resourceType: string, resourceId: string) => {
  try {
    const db = await getServerDb();
    await ensureFeedbackPackageIndexes(db);
    return await db
      .collection('feedback_packages')
      .find({ 'resource.type': resourceType, 'resource.id': resourceId })
      .sort({ createdAt: -1 })
      .toArray();
  } catch {
    return [];
  }
};

export const saveFeedbackPackageRecord = async (pkg: Omit<FeedbackPackage, '_id'>) => {
  const db = await getServerDb();
  await ensureFeedbackPackageIndexes(db);
  return await db.collection('feedback_packages').insertOne(pkg);
};

export const closeFeedbackPackageRecord = async (id: string, userId: string) => {
  const db = await getServerDb();
  await ensureFeedbackPackageIndexes(db);
  return await db.collection('feedback_packages').updateOne(
    { _id: new ObjectId(id) },
    { $set: { status: 'closed', updatedAt: new Date().toISOString(), updatedBy: userId } }
  );
};
