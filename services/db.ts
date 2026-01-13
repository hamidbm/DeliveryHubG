
import clientPromise from '../lib/mongodb';
import { ObjectId } from 'mongodb';
import { WikiPage, WikiSpace, WikiComment, WikiTheme, Bundle, Application } from '../types';

export const getDb = async () => {
  const client = await clientPromise;
  return client.db('deliveryhub');
};

// Bundles
export const fetchBundles = async (activeOnly = false) => {
  try {
    const db = await getDb();
    const query = activeOnly ? { isActive: true } : {};
    return await db.collection('bundles').find(query).sort({ sortOrder: 1, name: 1 }).toArray();
  } catch (error) {
    console.error("Failed to fetch bundles:", error);
    return [];
  }
};

export const saveBundle = async (bundle: Partial<Bundle>, user?: any) => {
  try {
    const db = await getDb();
    const { _id, ...data } = bundle;
    const now = new Date().toISOString();
    const audit = user ? { name: user.name, email: user.email } : undefined;

    if (_id) {
      return await db.collection('bundles').updateOne(
        { _id: new ObjectId(_id) },
        { $set: { ...data, updatedAt: now, updatedBy: audit } }
      );
    } else {
      return await db.collection('bundles').insertOne({
        ...data,
        isActive: data.isActive ?? true,
        createdAt: now,
        updatedAt: now,
        createdBy: audit,
        updatedBy: audit
      });
    }
  } catch (error) {
    console.error("Bundle save error:", error);
    throw error;
  }
};

// Applications
export const fetchApplications = async (bundleId?: string, activeOnly = false) => {
  try {
    const db = await getDb();
    const query: any = {};
    if (activeOnly) query.isActive = true;
    if (bundleId && bundleId !== 'all') query.bundleId = new ObjectId(bundleId);
    
    return await db.collection('applications').find(query).sort({ name: 1 }).toArray();
  } catch (error) {
    console.error("Failed to fetch applications:", error);
    return [];
  }
};

export const saveApplication = async (application: Partial<Application>, user?: any) => {
  try {
    const db = await getDb();
    const { _id, ...data } = application;
    const now = new Date().toISOString();
    const audit = user ? { name: user.name, email: user.email } : undefined;

    // Convert string bundleId to ObjectId
    if (data.bundleId) {
      data.bundleId = new ObjectId(data.bundleId) as any;
    }

    if (_id) {
      return await db.collection('applications').updateOne(
        { _id: new ObjectId(_id) },
        { $set: { ...data, updatedAt: now, updatedBy: audit } }
      );
    } else {
      return await db.collection('applications').insertOne({
        ...data,
        isActive: data.isActive ?? true,
        status: data.status || { health: 'Healthy' },
        createdAt: now,
        updatedAt: now,
        createdBy: audit,
        updatedBy: audit
      });
    }
  } catch (error) {
    console.error("Application save error:", error);
    throw error;
  }
};

// Existing fetch methods refactored to use the new dynamic collections
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

// Wiki Themes
export const fetchWikiThemes = async (activeOnly = false) => {
  try {
    const db = await getDb();
    const query = activeOnly ? { isActive: true } : {};
    return await db.collection('wiki_themes').find(query).toArray();
  } catch (error) {
    console.error("Wiki themes fetch error:", error);
    return [];
  }
};

export const saveWikiTheme = async (theme: Partial<WikiTheme>) => {
  try {
    const db = await getDb();
    const { _id, ...data } = theme;
    const now = new Date().toISOString();

    if (data.isDefault) {
      await db.collection('wiki_themes').updateMany({}, { $set: { isDefault: false } });
    }

    if (_id) {
      return await db.collection('wiki_themes').updateOne(
        { _id: new ObjectId(_id) },
        { $set: { ...data, updatedAt: now } }
      );
    } else {
      const existing = await db.collection('wiki_themes').findOne({ key: data.key });
      if (existing) throw new Error("Theme key already exists");

      return await db.collection('wiki_themes').insertOne({
        ...data,
        isActive: data.isActive ?? true,
        isDefault: data.isDefault ?? false,
        createdAt: now,
        updatedAt: now
      });
    }
  } catch (error) {
    console.error("Wiki theme save error:", error);
    throw error;
  }
};

export const deleteWikiTheme = async (id: string) => {
  try {
    const db = await getDb();
    const theme = await db.collection('wiki_themes').findOne({ _id: new ObjectId(id) }) as unknown as WikiTheme;
    if (!theme) return null;
    if (theme.isDefault) throw new Error("Cannot delete default theme");
    const spaceUsage = await db.collection('wiki_spaces').countDocuments({ defaultThemeKey: theme.key });
    const pageUsage = await db.collection('wiki_pages').countDocuments({ themeKey: theme.key });
    if (spaceUsage > 0 || pageUsage > 0) throw new Error(`Theme in use.`);
    return await db.collection('wiki_themes').deleteOne({ _id: new ObjectId(id) });
  } catch (error) {
    console.error("Wiki theme delete error:", error);
    throw error;
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
    
    if (_id) {
      const existing = await db.collection('wiki_pages').findOne({ _id: new ObjectId(_id) }) as unknown as WikiPage | null;
      if (existing) {
        const { _id: currentId, ...historyData } = existing as any;
        await db.collection('wiki_history').insertOne({
          ...historyData,
          pageId: currentId.toString(),
          versionedAt: now
        });
        const nextVersion = (existing.version || 1) + 1;
        return await db.collection('wiki_pages').updateOne(
          { _id: new ObjectId(_id) },
          { $set: { ...data, updatedAt: now, version: nextVersion } }
        );
      }
      return null;
    } else {
      return await db.collection('wiki_pages').insertOne({ ...data, version: 1, createdAt: now, updatedAt: now });
    }
  } catch (error) {
    console.error("Wiki save error:", error);
    return null;
  }
};

// Wiki History
export const fetchWikiHistory = async (pageId: string) => {
  try {
    const db = await getDb();
    return await db.collection('wiki_history').find({ pageId }).sort({ versionedAt: -1 }).toArray();
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
    return await db.collection('wiki_pages').updateOne(
      { _id: new ObjectId(pageId) },
      { $set: { ...version, updatedAt: now } }
    );
  } catch (error) {
    console.error("Wiki revert error:", error);
    return null;
  }
};

// Comments
export const fetchWikiComments = async (pageId: string) => {
  try {
    const db = await getDb();
    return await db.collection('wiki_comments').find({ pageId }).sort({ createdAt: 1 }).toArray();
  } catch (error) {
    return [];
  }
};

export const saveWikiComment = async (comment: Partial<WikiComment>) => {
  try {
    const db = await getDb();
    return await db.collection('wiki_comments').insertOne({ ...comment, createdAt: new Date().toISOString() });
  } catch (error) {
    return null;
  }
};

export const seedDatabase = async (apps: any[], items: any[], wiki: any[] = []) => {
  try {
    const db = await getDb();
    await db.collection('applications').deleteMany({});
    await db.collection('workitems').deleteMany({});
    await db.collection('bundles').deleteMany({});
    
    const bundles: any[] = [
      { key: 'GPS', name: 'Global Positioning', description: 'Logistics Hub', isActive: true, sortOrder: 1 },
      { key: 'MEM', name: 'Member', description: 'Identity Services', isActive: true, sortOrder: 2 },
      { key: 'CLM', name: 'Claims', description: 'Processing Engine', isActive: true, sortOrder: 3 },
      { key: 'FIN', name: 'Finance', description: 'Billing and Core', isActive: true, sortOrder: 4 },
    ];
    const bundleRes = await db.collection('bundles').insertMany(bundles);
    const bundleIds = Object.values(bundleRes.insertedIds);

    const appsWithIds = apps.map((app, i) => ({
      ...app,
      aid: `APP00${i+1}`,
      bundleId: bundleIds[i % bundleIds.length],
      isActive: true,
      status: { health: app.health || 'Healthy', phase: 'Planning' }
    }));
    await db.collection('applications').insertMany(appsWithIds);
    await db.collection('workitems').insertMany(items);

    return { success: true };
  } catch (error) {
    console.error("Seeding failed:", error);
    return { success: false };
  }
};
