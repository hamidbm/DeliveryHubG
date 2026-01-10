
import clientPromise from '../lib/mongodb';
import { ObjectId } from 'mongodb';
import { WikiPage } from '../types';

export const getDb = async () => {
  const client = await clientPromise;
  return client.db('deliveryhub');
};

export const fetchAllApplications = async () => {
  try {
    const db = await getDb();
    return await db.collection('applications').find({}).toArray();
  } catch (error) {
    console.error("Failed to fetch applications:", error);
    return [];
  }
};

export const fetchAllWorkItems = async () => {
  try {
    const db = await getDb();
    return await db.collection('workitems').find({}).toArray();
  } catch (error) {
    console.error("Failed to fetch work items:", error);
    return [];
  }
};

// Wiki Operations
export const fetchWikiPages = async () => {
  try {
    const db = await getDb();
    return await db.collection('wiki_pages').find({}).toArray();
  } catch (error) {
    console.error("Wiki fetch error:", error);
    return [];
  }
};

export const fetchWikiHistory = async (pageId: string) => {
  try {
    const db = await getDb();
    return await db.collection('wiki_history')
      .find({ pageId })
      .sort({ versionedAt: -1 })
      .toArray();
  } catch (error) {
    console.error("Wiki history fetch error:", error);
    return [];
  }
};

const calculateReadingTime = (content: string): number => {
  const wordsPerMinute = 225;
  const noOfWords = content.split(/\s/g).length;
  const minutes = noOfWords / wordsPerMinute;
  return Math.ceil(minutes);
};

export const saveWikiPage = async (page: any) => {
  try {
    const db = await getDb();
    const { _id, ...data } = page;
    const now = new Date().toISOString();
    const readingTime = calculateReadingTime(data.content || '');

    if (_id) {
      // 1. Snapshot current version before update
      const existing = await db.collection('wiki_pages').findOne({ _id: new ObjectId(_id) });
      if (existing) {
        const { _id: currentId, ...historyData } = existing;
        await db.collection('wiki_history').insertOne({
          ...historyData,
          pageId: currentId.toString(),
          versionedAt: now
        });
      }

      // 2. Update existing page with version increment
      const nextVersion = (existing?.version || 1) + 1;
      const updatePayload = {
        ...data,
        updatedAt: now,
        readingTime,
        version: nextVersion,
        status: data.status || existing?.status || 'Published'
      };

      // Safeguard: Do not overwrite createdAt on update
      delete updatePayload.createdAt;

      return await db.collection('wiki_pages').updateOne(
        { _id: new ObjectId(_id) },
        { $set: updatePayload },
        { upsert: true }
      );
    } else {
      // Create new page with initial timestamps, version 1, and default status
      return await db.collection('wiki_pages').insertOne({
        ...data,
        createdAt: now,
        updatedAt: now,
        readingTime,
        version: 1,
        status: data.status || 'Published'
      });
    }
  } catch (error) {
    console.error("Wiki save error:", error);
    return null;
  }
};

export const revertWikiPage = async (pageId: string, versionId: string) => {
  try {
    const db = await getDb();
    const now = new Date().toISOString();

    // 1. Get the target version
    const version = await db.collection('wiki_history').findOne({ _id: new ObjectId(versionId) });
    if (!version) throw new Error("Target version not found");

    // 2. Snapshot current state before revert
    const current = await db.collection('wiki_pages').findOne({ _id: new ObjectId(pageId) });
    if (current) {
      const { _id: curId, ...historyData } = current;
      await db.collection('wiki_history').insertOne({
        ...historyData,
        pageId: curId.toString(),
        versionedAt: now,
        revertNote: `Snapshot before revert to ${versionId}`
      });
    }

    // 3. Restore the version (retaining latest version count + 1)
    const nextVersion = (current?.version || 0) + 1;
    const { _id: _, pageId: __, versionedAt: ___, ...rest } = version;
    return await db.collection('wiki_pages').updateOne(
      { _id: new ObjectId(pageId) },
      { $set: { ...rest, updatedAt: now, version: nextVersion } }
    );
  } catch (error) {
    console.error("Wiki revert error:", error);
    return null;
  }
};

export const seedDatabase = async (apps: any[], items: any[], wiki: any[] = []) => {
  try {
    const db = await getDb();
    await db.collection('applications').deleteMany({});
    await db.collection('workitems').deleteMany({});
    if (wiki.length > 0) await db.collection('wiki_pages').deleteMany({});
    
    await db.collection('applications').insertMany(apps);
    await db.collection('workitems').insertMany(items);
    if (wiki.length > 0) await db.collection('wiki_pages').insertMany(wiki.map(p => ({ ...p, version: 1, status: 'Published' })));
    return { success: true };
  } catch (error) {
    console.error("Seeding failed:", error);
    return { success: false };
  }
};
