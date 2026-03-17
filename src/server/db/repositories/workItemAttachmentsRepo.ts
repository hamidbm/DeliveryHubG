import { Binary, ObjectId } from 'mongodb';
import { getServerDb } from '../client';

const ensureWorkItemAttachmentIndexes = async (db: any) => {
  await db.collection('workitems_attachments').createIndex({ workItemId: 1, createdAt: -1 });
};

const asWorkItemRef = (id: string) => (ObjectId.isValid(id) ? new ObjectId(id) : id);

export const createWorkItemAttachmentRecords = async (workItemId: string, files: Array<{
  name: string;
  contentType: string;
  size: number;
  buffer: Buffer;
  uploadedBy: string;
}>) => {
  const db = await getServerDb();
  await ensureWorkItemAttachmentIndexes(db);
  const now = new Date().toISOString();
  const itemRef = asWorkItemRef(workItemId);
  const attachments = [];

  for (const file of files) {
    const result = await db.collection('workitems_attachments').insertOne({
      workItemId: itemRef,
      filename: file.name,
      contentType: file.contentType || 'application/octet-stream',
      size: file.size,
      data: new Binary(file.buffer),
      createdAt: now,
      uploadedBy: file.uploadedBy
    });
    attachments.push({
      assetId: result.insertedId.toString(),
      name: file.name,
      size: file.size,
      type: file.contentType || 'application/octet-stream',
      url: `/api/work-items/attachments/${result.insertedId.toString()}`,
      uploadedBy: file.uploadedBy,
      createdAt: now
    });
  }

  if (attachments.length) {
    await db.collection('workitems').updateOne(
      { _id: itemRef } as any,
      { $push: { attachments: { $each: attachments } }, $set: { updatedAt: now } } as any
    );
  }

  return { attachments, now, itemRef };
};

export const deleteWorkItemAttachmentRecord = async (workItemId: string, attachmentId: string) => {
  if (!ObjectId.isValid(attachmentId)) throw new Error('Invalid attachment id');
  const db = await getServerDb();
  const now = new Date().toISOString();
  const itemRef = asWorkItemRef(workItemId);

  await db.collection('workitems_attachments').deleteOne({ _id: new ObjectId(attachmentId) });
  await db.collection('workitems').updateOne(
    { _id: itemRef } as any,
    { $pull: { attachments: { assetId: attachmentId } }, $set: { updatedAt: now } } as any
  );

  return { success: true, now };
};

export const getWorkItemAttachmentById = async (attachmentId: string) => {
  if (!ObjectId.isValid(attachmentId)) return null;
  const db = await getServerDb();
  await ensureWorkItemAttachmentIndexes(db);
  return await db.collection('workitems_attachments').findOne({ _id: new ObjectId(attachmentId) });
};
