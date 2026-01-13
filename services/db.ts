
import clientPromise from '../lib/mongodb';
import { ObjectId } from 'mongodb';
import { WikiPage, WikiSpace, WikiTheme, Bundle, Application, TaxonomyCategory, TaxonomyDocumentType } from '../types';

export const getDb = async () => {
  const client = await clientPromise;
  return client.db('deliveryhub');
};

// Taxonomy - Categories
export const fetchTaxonomyCategories = async (activeOnly = false) => {
  try {
    const db = await getDb();
    const query = activeOnly ? { isActive: true } : {};
    return await db.collection('taxonomy_categories').find(query).sort({ sortOrder: 1, name: 1 }).toArray();
  } catch (error) {
    return [];
  }
};

export const saveTaxonomyCategory = async (category: Partial<TaxonomyCategory>) => {
  const db = await getDb();
  const { _id, ...data } = category;
  if (_id) {
    return await db.collection('taxonomy_categories').updateOne(
      { _id: new ObjectId(_id) },
      { $set: { ...data, updatedAt: new Date().toISOString() } }
    );
  } else {
    return await db.collection('taxonomy_categories').insertOne({
      ...data,
      isActive: data.isActive ?? true,
      createdAt: new Date().toISOString()
    });
  }
};

// Taxonomy - Document Types
export const fetchTaxonomyDocumentTypes = async (activeOnly = false, categoryId?: string) => {
  try {
    const db = await getDb();
    const query: any = activeOnly ? { isActive: true } : {};
    if (categoryId) query.categoryId = categoryId;
    return await db.collection('taxonomy_document_types').find(query).sort({ sortOrder: 1, name: 1 }).toArray();
  } catch (error) {
    return [];
  }
};

export const saveTaxonomyDocumentType = async (docType: Partial<TaxonomyDocumentType>) => {
  const db = await getDb();
  const { _id, ...data } = docType;
  if (_id) {
    return await db.collection('taxonomy_document_types').updateOne(
      { _id: new ObjectId(_id) },
      { $set: { ...data, updatedAt: new Date().toISOString() } }
    );
  } else {
    return await db.collection('taxonomy_document_types').insertOne({
      ...data,
      isActive: data.isActive ?? true,
      createdAt: new Date().toISOString()
    });
  }
};

// Bundles
export const fetchBundles = async (activeOnly = false) => {
  try {
    const db = await getDb();
    const query = activeOnly ? { isActive: true } : {};
    return await db.collection('bundles').find(query).sort({ sortOrder: 1, name: 1 }).toArray();
  } catch (error) {
    return [];
  }
};

export const saveBundle = async (bundle: Partial<Bundle>, user?: any) => {
  const db = await getDb();
  const { _id, ...data } = bundle;
  const now = new Date().toISOString();
  if (_id) {
    return await db.collection('bundles').updateOne(
      { _id: new ObjectId(_id) },
      { $set: { ...data, updatedAt: now } }
    );
  } else {
    return await db.collection('bundles').insertOne({
      ...data,
      isActive: data.isActive ?? true,
      createdAt: now,
      updatedAt: now
    });
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
    return [];
  }
};

export const saveApplication = async (application: Partial<Application>, user?: any) => {
  const db = await getDb();
  const { _id, ...data } = application;
  if (data.bundleId) data.bundleId = new ObjectId(data.bundleId) as any;
  if (_id) {
    return await db.collection('applications').updateOne({ _id: new ObjectId(_id) }, { $set: data });
  } else {
    return await db.collection('applications').insertOne({ ...data, isActive: true, status: data.status || { health: 'Healthy' } });
  }
};

// Wiki Spaces
export const fetchWikiSpaces = async () => {
  try {
    const db = await getDb();
    return await db.collection('wiki_spaces').find({}).toArray();
  } catch (error) {
    return [];
  }
};

export const saveWikiSpace = async (space: Partial<WikiSpace>) => {
  const db = await getDb();
  const { _id, ...data } = space;
  if (_id) {
    return await db.collection('wiki_spaces').updateOne({ _id: new ObjectId(_id) }, { $set: data });
  } else {
    return await db.collection('wiki_spaces').insertOne({ ...data, createdAt: new Date().toISOString() });
  }
};

// Wiki Themes
export const fetchWikiThemes = async (activeOnly = false) => {
  const db = await getDb();
  const query = activeOnly ? { isActive: true } : {};
  return await db.collection('wiki_themes').find(query).toArray();
};

export const saveWikiTheme = async (theme: Partial<WikiTheme>) => {
  const db = await getDb();
  const { _id, ...data } = theme;
  if (_id) return await db.collection('wiki_themes').updateOne({ _id: new ObjectId(_id) }, { $set: data });
  return await db.collection('wiki_themes').insertOne({ ...data, createdAt: new Date().toISOString() });
};

// Added deleteWikiTheme function to resolve theme API route error
export const deleteWikiTheme = async (id: string) => {
  const db = await getDb();
  return await db.collection('wiki_themes').deleteOne({ _id: new ObjectId(id) });
};

// Wiki Pages
export const fetchWikiPages = async (spaceId?: string) => {
  const db = await getDb();
  const query = spaceId ? { spaceId } : {};
  return await db.collection('wiki_pages').find(query).toArray();
};

export const saveWikiPage = async (page: Partial<WikiPage>) => {
  const db = await getDb();
  const { _id, ...data } = page;
  const now = new Date().toISOString();
  if (_id) {
    const existing = await db.collection('wiki_pages').findOne({ _id: new ObjectId(_id) }) as unknown as WikiPage | null;
    if (existing) {
      const { _id: currentId, ...historyData } = existing as any;
      await db.collection('wiki_history').insertOne({ ...historyData, pageId: currentId.toString(), versionedAt: now });
      return await db.collection('wiki_pages').updateOne({ _id: new ObjectId(_id) }, { $set: { ...data, updatedAt: now, version: (existing.version || 1) + 1 } });
    }
    return null;
  } else {
    return await db.collection('wiki_pages').insertOne({ ...data, version: 1, createdAt: now, updatedAt: now });
  }
};

// Comments
export const fetchWikiComments = async (pageId: string) => {
  const db = await getDb();
  return await db.collection('wiki_comments').find({ pageId }).sort({ createdAt: 1 }).toArray();
};

export const saveWikiComment = async (comment: any) => {
  const db = await getDb();
  return await db.collection('wiki_comments').insertOne({ ...comment, createdAt: new Date().toISOString() });
};

// History
export const fetchWikiHistory = async (pageId: string) => {
  const db = await getDb();
  return await db.collection('wiki_history').find({ pageId }).sort({ versionedAt: -1 }).toArray();
};

export const revertWikiPage = async (pageId: string, versionId: string) => {
  const db = await getDb();
  const version = await db.collection('wiki_history').findOne({ _id: new ObjectId(versionId) });
  if (!version) return null;
  return await db.collection('wiki_pages').updateOne({ _id: new ObjectId(pageId) }, { $set: { ...version, updatedAt: new Date().toISOString() } });
};

// Updated seedDatabase signature and implementation to include wikiPages and resolve seeding route error
export const seedDatabase = async (apps: any[], workItems: any[], wikiPages: any[] = []) => {
  try {
    const db = await getDb();
    
    // Taxonomy Categories
    await db.collection('taxonomy_categories').deleteMany({});
    const cats = [
      { key: 'ARCH', name: 'Architecture', icon: 'fa-sitemap', isActive: true, sortOrder: 10 },
      { key: 'DESIGN', name: 'Design & Engineering', icon: 'fa-pencil-ruler', isActive: true, sortOrder: 20 },
      { key: 'SEC', name: 'Security & Risk', icon: 'fa-shield-halved', isActive: true, sortOrder: 30 },
      { key: 'DEVOPS', name: 'DevOps & Platform', icon: 'fa-terminal', isActive: true, sortOrder: 40 },
      { key: 'OPS', name: 'Operations & Support', icon: 'fa-gears', isActive: true, sortOrder: 50 },
      { key: 'TEST', name: 'Testing & Quality', icon: 'fa-flask', isActive: true, sortOrder: 60 },
      { key: 'PROG', name: 'Delivery & Program Management', icon: 'fa-route', isActive: true, sortOrder: 70 },
      { key: 'GOV', name: 'Governance & Compliance', icon: 'fa-building-columns', isActive: true, sortOrder: 80 }
    ];
    const catRes = await db.collection('taxonomy_categories').insertMany(cats);
    const catIds = Object.values(catRes.insertedIds);

    // Taxonomy Document Types
    await db.collection('taxonomy_document_types').deleteMany({});
    const types = [
      { key: 'ADR', name: 'Architecture Decision Record (ADR)', categoryId: catIds[0].toString(), isActive: true, sortOrder: 10 },
      { key: 'SOL_ARCH', name: 'Solution Architecture', categoryId: catIds[0].toString(), isActive: true, sortOrder: 20 },
      { key: 'HLD', name: 'High-Level Design (HLD)', categoryId: catIds[1].toString(), isActive: true, sortOrder: 10 },
      { key: 'LLD', name: 'Low-Level Design (LLD)', categoryId: catIds[1].toString(), isActive: true, sortOrder: 20 },
      { key: 'TM', name: 'Threat Model', categoryId: catIds[2].toString(), isActive: true, sortOrder: 10 },
      { key: 'CICD', name: 'CI/CD Pipeline Design', categoryId: catIds[3].toString(), isActive: true, sortOrder: 10 },
      { key: 'RUNBOOK', name: 'Operational Runbook', categoryId: catIds[4].toString(), isActive: true, sortOrder: 10 },
      { key: 'TEST_PLAN', name: 'Test Plan', categoryId: catIds[5].toString(), isActive: true, sortOrder: 10 },
      { key: 'STATUS', name: 'Weekly Status Report', categoryId: catIds[6].toString(), isActive: true, sortOrder: 10 },
      { key: 'POLICY', name: 'Policy / Standard', categoryId: catIds[7].toString(), isActive: true, sortOrder: 10 }
    ];
    await db.collection('taxonomy_document_types').insertMany(types);

    // Bundles & Apps
    await db.collection('bundles').deleteMany({});
    await db.collection('applications').deleteMany({});
    const bundles = [
      { key: 'GPS', name: 'Global Positioning', description: 'Logistics Hub', isActive: true, sortOrder: 1 },
      { key: 'MEM', name: 'Member Services', description: 'Identity Cluster', isActive: true, sortOrder: 2 }
    ];
    const bundleRes = await db.collection('bundles').insertMany(bundles);
    const bundleIds = Object.values(bundleRes.insertedIds);

    const seededApps = apps.map((app, i) => ({
      ...app,
      aid: `APP${1000 + i}`,
      bundleId: bundleIds[i % bundleIds.length],
      isActive: true,
      status: { health: 'Healthy', phase: 'Onboarding' }
    }));
    await db.collection('applications').insertMany(seededApps);

    // Added Seeding logic for Wiki Pages if provided
    if (wikiPages && wikiPages.length > 0) {
      await db.collection('wiki_pages').deleteMany({});
      const seededWiki = wikiPages.map(p => ({
        ...p,
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }));
      await db.collection('wiki_pages').insertMany(seededWiki);
    }

    return { success: true };
  } catch (err) {
    return { success: false };
  }
};
