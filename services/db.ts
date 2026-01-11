
import clientPromise from '../lib/mongodb';
import { ObjectId } from 'mongodb';
import { WikiPage, WikiSpace, WikiComment, WikiTemplate } from '../types';

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

// Wiki Spaces
export const fetchWikiSpaces = async () => {
  try {
    const db = await getDb();
    return await db.collection('wiki_spaces').find({}).toArray();
  } catch (error) {
    console.error("Wiki spaces fetch error:", error);
    return [];
  }
};

export const saveWikiSpace = async (space: Partial<WikiSpace>) => {
  try {
    const db = await getDb();
    const { _id, ...data } = space;
    if (_id) {
      return await db.collection('wiki_spaces').updateOne(
        { _id: new ObjectId(_id) },
        { $set: data }
      );
    } else {
      return await db.collection('wiki_spaces').insertOne({
        ...data,
        createdAt: new Date().toISOString()
      });
    }
  } catch (error) {
    console.error("Wiki space save error:", error);
    return null;
  }
};

// Wiki Pages
export const fetchWikiPages = async (spaceId?: string) => {
  try {
    const db = await getDb();
    const query = spaceId ? { spaceId } : {};
    return await db.collection('wiki_pages').find(query).toArray();
  } catch (error) {
    console.error("Wiki fetch error:", error);
    return [];
  }
};

export const saveWikiPage = async (page: Partial<WikiPage>) => {
  try {
    const db = await getDb();
    const { _id, ...data } = page;
    const now = new Date().toISOString();
    
    const calculateReadingTime = (content: string): number => {
      const wordsPerMinute = 225;
      const noOfWords = content.split(/\s/g).length;
      return Math.ceil(noOfWords / wordsPerMinute);
    };
    
    const readingTime = calculateReadingTime(data.content || '');

    if (_id) {
      const existing = await db.collection('wiki_pages').findOne({ _id: new ObjectId(_id) }) as unknown as WikiPage | null;
      if (existing) {
        // Archive to history
        const { _id: currentId, ...historyData } = existing as any;
        await db.collection('wiki_history').insertOne({
          ...historyData,
          pageId: currentId.toString(),
          versionedAt: now
        });

        const nextVersion = (existing.version || 1) + 1;
        const updatePayload = {
          ...data,
          updatedAt: now,
          readingTime,
          version: nextVersion,
          status: data.status || existing.status || 'Published',
          author: existing.author || data.author || 'System',
          createdAt: existing.createdAt,
          lastModifiedBy: data.lastModifiedBy || 'System'
        };

        return await db.collection('wiki_pages').updateOne(
          { _id: new ObjectId(_id) },
          { $set: updatePayload }
        );
      }
      return null;
    } else {
      const insertPayload = {
        ...data,
        createdAt: now,
        updatedAt: now,
        readingTime,
        version: 1,
        status: data.status || 'Published',
        author: data.author || 'System',
        lastModifiedBy: data.lastModifiedBy || data.author || 'System'
      };
      return await db.collection('wiki_pages').insertOne(insertPayload);
    }
  } catch (error) {
    console.error("Wiki save error:", error);
    return null;
  }
};

// Wiki Comments
export const fetchWikiComments = async (pageId: string) => {
  try {
    const db = await getDb();
    return await db.collection('wiki_comments')
      .find({ pageId })
      .sort({ createdAt: 1 })
      .toArray();
  } catch (error) {
    console.error("Wiki comments fetch error:", error);
    return [];
  }
};

// Fixed TypeScript error by destructuring _id out of comment to prevent string/ObjectId mismatch
export const saveWikiComment = async (comment: Partial<WikiComment>) => {
  try {
    const db = await getDb();
    const { _id, ...data } = comment;
    return await db.collection('wiki_comments').insertOne({
      ...data,
      createdAt: new Date().toISOString()
    });
  } catch (error) {
    console.error("Wiki comment save error:", error);
    return null;
  }
};

// Wiki History
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

export const revertWikiPage = async (pageId: string, versionId: string) => {
  try {
    const db = await getDb();
    const now = new Date().toISOString();
    const version = await db.collection('wiki_history').findOne({ _id: new ObjectId(versionId) });
    if (!version) throw new Error("Target version not found");
    const current = await db.collection('wiki_pages').findOne({ _id: new ObjectId(pageId) }) as unknown as WikiPage | null;
    if (current) {
      const { _id: curId, ...historyData } = current as any;
      await db.collection('wiki_history').insertOne({
        ...historyData,
        pageId: curId.toString(),
        versionedAt: now,
        revertNote: `Snapshot before revert to ${versionId}`
      });
    }
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

// Templates
export const fetchWikiTemplates = async () => {
  try {
    const db = await getDb();
    return await db.collection('wiki_templates').find({}).toArray();
  } catch (error) {
    console.error("Templates fetch error:", error);
    return [];
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

    const spaceCount = await db.collection('wiki_spaces').countDocuments();
    if (spaceCount === 0) {
      await db.collection('wiki_spaces').insertOne({
        _id: new ObjectId('000000000000000000000001'),
        id: 'default',
        key: 'GEN',
        name: 'General Space',
        description: 'Core platform documentation and onboarding.',
        icon: 'fa-book-atlas',
        color: '#3b82f6',
        visibility: 'internal',
        createdAt: new Date().toISOString()
      });
    }

    if (wiki.length > 0) {
      await db.collection('wiki_pages').insertMany(wiki.map(p => ({ 
        ...p, 
        version: 1, 
        status: 'Published', 
        createdAt: new Date().toISOString(), 
        updatedAt: new Date().toISOString(),
        author: 'System',
        spaceId: '000000000000000000000001'
      })));
    }

    return { success: true };
  } catch (error) {
    console.error("Seeding failed:", error);
    return { success: false };
  }
};
