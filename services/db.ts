
import clientPromise from '../lib/mongodb';
import { ObjectId } from 'mongodb';
import { WikiPage, WikiSpace, WikiTheme, Bundle, Application, TaxonomyCategory, TaxonomyDocumentType, WorkItem, WorkItemType, WorkItemStatus } from '../types';

export const getDb = async () => {
  const client = await clientPromise;
  return client.db('deliveryhub');
};

// Sequences for Work Item Keys (e.g., WI-101)
export const getNextSequence = async (name: string) => {
  const db = await getDb();
  const res = await db.collection('counters').findOneAndUpdate(
    { _id: name as any },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: 'after' }
  );
  return res?.seq || 1;
};

// Work Items
export const fetchWorkItems = async (filters: any) => {
  const db = await getDb();
  const query: any = {};
  if (filters.bundleId && filters.bundleId !== 'all') query.bundleId = filters.bundleId;
  if (filters.applicationId && filters.applicationId !== 'all') query.applicationId = filters.applicationId;
  if (filters.milestoneId && filters.milestoneId !== 'all') query.milestoneIds = filters.milestoneId;
  if (filters.parentId) query.parentId = filters.parentId;
  if (filters.q) query.title = { $regex: filters.q, $options: 'i' };
  
  return await db.collection('work_items').find(query).sort({ key: 1 }).toArray();
};

export const fetchWorkItemTree = async (filters: any) => {
  const db = await getDb();
  const items = await fetchWorkItems(filters) as unknown as WorkItem[];
  
  // Basic tree builder - for MVT we build the whole visible tree
  // In a real app with 10k items, this would be lazy-loaded
  const buildTree = (parentId: string | null = null): any[] => {
    return items
      .filter(item => (parentId ? item.parentId === parentId : !item.parentId))
      .map(item => ({
        id: item._id?.toString() || item.id,
        label: `${item.key}: ${item.title}`,
        workItemId: item._id?.toString() || item.id,
        nodeType: 'WORK_ITEM',
        type: item.type,
        status: item.status,
        children: buildTree(item._id?.toString() || item.id)
      }));
  };

  return buildTree();
};

export const saveWorkItem = async (item: Partial<WorkItem>, user?: any) => {
  const db = await getDb();
  const { _id, ...data } = item;
  const now = new Date().toISOString();

  if (_id) {
    return await db.collection('work_items').updateOne(
      { _id: new ObjectId(_id) },
      { $set: { ...data, updatedAt: now, updatedBy: user?.name } }
    );
  } else {
    const seq = await getNextSequence('work_item_key');
    const key = `WI-${seq}`;
    return await db.collection('work_items').insertOne({
      ...data,
      key,
      status: data.status || WorkItemStatus.TODO,
      priority: data.priority || 'MEDIUM',
      createdAt: now,
      updatedAt: now,
      createdBy: user?.name,
      updatedBy: user?.name
    });
  }
};

export const fetchWorkItemById = async (id: string) => {
  const db = await getDb();
  return await db.collection('work_items').findOne({ _id: new ObjectId(id) });
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

export const seedDatabase = async (apps: any[], workItems: any[], wikiPages: any[] = []) => {
  try {
    const db = await getDb();
    
    // Clear all existing taxonomy for clean seed
    await db.collection('taxonomy_categories').deleteMany({});
    await db.collection('taxonomy_document_types').deleteMany({});

    // Seed Categories (1-8 as requested)
    const categorySeeds = [
      { key: 'ARCH', name: 'Architecture', icon: 'fa-sitemap', isActive: true, sortOrder: 10 },
      { key: 'DESIGN', name: 'Design & Engineering', icon: 'fa-pencil-ruler', isActive: true, sortOrder: 20 },
      { key: 'SEC', name: 'Security & Risk', icon: 'fa-shield-halved', isActive: true, sortOrder: 30 },
      { key: 'DEVOPS', name: 'DevOps & Platform', icon: 'fa-terminal', isActive: true, sortOrder: 40 },
      { key: 'OPS', name: 'Operations & Support', icon: 'fa-gears', isActive: true, sortOrder: 50 },
      { key: 'TEST', name: 'Testing & Quality', icon: 'fa-flask', isActive: true, sortOrder: 60 },
      { key: 'PROG', name: 'Delivery & Program Management', icon: 'fa-route', isActive: true, sortOrder: 70 },
      { key: 'GOV', name: 'Governance & Compliance', icon: 'fa-building-columns', isActive: true, sortOrder: 80 }
    ];
    const catRes = await db.collection('taxonomy_categories').insertMany(categorySeeds);
    const catIds = Object.values(catRes.insertedIds);

    // Seed Document Types per Category
    const typeSeeds = [
      // 1. Architecture
      { key: 'ADR', name: 'Architecture Decision Record (ADR)', categoryId: catIds[0].toString(), isActive: true, sortOrder: 1, audience: ['engineering', 'leadership'] },
      { key: 'SOL_ARCH', name: 'Solution Architecture', categoryId: catIds[0].toString(), isActive: true, sortOrder: 2, audience: ['engineering'] },
      { key: 'TECH_ARCH', name: 'Technical Architecture', categoryId: catIds[0].toString(), isActive: true, sortOrder: 3, audience: ['engineering'] },
      { key: 'DATA_ARCH', name: 'Data Architecture', categoryId: catIds[0].toString(), isActive: true, sortOrder: 4, audience: ['engineering'] },
      { key: 'REF_ARCH', name: 'Reference Architecture', categoryId: catIds[0].toString(), isActive: true, sortOrder: 5, audience: ['engineering'] },
      // 2. Design
      { key: 'HLD', name: 'High-Level Design (HLD)', categoryId: catIds[1].toString(), isActive: true, sortOrder: 1, audience: ['engineering'] },
      { key: 'LLD', name: 'Low-Level Design (LLD)', categoryId: catIds[1].toString(), isActive: true, sortOrder: 2, audience: ['engineering'] },
      { key: 'API_DESIGN', name: 'API Design / OpenAPI', categoryId: catIds[1].toString(), isActive: true, sortOrder: 3, audience: ['engineering'] },
      { key: 'DB_DESIGN', name: 'Database Design / ERD', categoryId: catIds[1].toString(), isActive: true, sortOrder: 4, audience: ['engineering'] },
      { key: 'UX_SPEC', name: 'UI/UX Design Spec', categoryId: catIds[1].toString(), isActive: true, sortOrder: 5, audience: ['product', 'engineering'] },
      // 3. Security
      { key: 'THREAT_MODEL', name: 'Threat Model', categoryId: catIds[2].toString(), isActive: true, sortOrder: 1, audience: ['security', 'engineering'] },
      { key: 'SEC_REVIEW', name: 'Security Review / Assessment', categoryId: catIds[2].toString(), isActive: true, sortOrder: 2, audience: ['security', 'audit'] },
      { key: 'RISK_REG', name: 'Risk Register Entry', categoryId: catIds[2].toString(), isActive: true, sortOrder: 3, audience: ['security', 'leadership'] },
      // 4. DevOps
      { key: 'CICD_DESIGN', name: 'CI/CD Pipeline Design', categoryId: catIds[3].toString(), isActive: true, sortOrder: 1, audience: ['engineering', 'operations'] },
      { key: 'IAC_DESIGN', name: 'IaC (Terraform) Design', categoryId: catIds[3].toString(), isActive: true, sortOrder: 2, audience: ['engineering'] },
      { key: 'ENV_STRAT', name: 'Environment Strategy', categoryId: catIds[3].toString(), isActive: true, sortOrder: 3, audience: ['engineering', 'operations'] },
      // 5. Operations
      { key: 'RUNBOOK_OPS', name: 'Operational Runbook', categoryId: catIds[4].toString(), isActive: true, sortOrder: 1, audience: ['operations'] },
      { key: 'INCIDENT_PLAY', name: 'Incident Playbook', categoryId: catIds[4].toString(), isActive: true, sortOrder: 2, audience: ['operations'] },
      { key: 'DR_PLAN', name: 'DR/BCP Plan', categoryId: catIds[4].toString(), isActive: true, sortOrder: 3, audience: ['operations', 'leadership'] },
      // 6. Testing
      { key: 'TEST_STRAT', name: 'Test Strategy', categoryId: catIds[5].toString(), isActive: true, sortOrder: 1, audience: ['engineering', 'audit'] },
      { key: 'TEST_PLAN', name: 'Test Plan', categoryId: catIds[5].toString(), isActive: true, sortOrder: 2, audience: ['engineering'] },
      { key: 'UAT_SIGNOFF', name: 'UAT Signoff', categoryId: catIds[5].toString(), isActive: true, sortOrder: 3, audience: ['product', 'engineering'] },
      // 7. Delivery
      { key: 'PROJ_CHARTER', name: 'Project Charter', categoryId: catIds[6].toString(), isActive: true, sortOrder: 1, audience: ['program_management', 'leadership'] },
      { key: 'RAID_LOG', name: 'RAID Log', categoryId: catIds[6].toString(), isActive: true, sortOrder: 2, audience: ['program_management'] },
      { key: 'MEETING_NOTES', name: 'Meeting Notes', categoryId: catIds[6].toString(), isActive: true, sortOrder: 3, audience: ['program_management', 'engineering'] },
      // 8. Governance
      { key: 'POLICY_STD', name: 'Policy / Standard', categoryId: catIds[7].toString(), isActive: true, sortOrder: 1, audience: ['audit', 'leadership'] },
      { key: 'COMP_CHECK', name: 'Compliance Checklist', categoryId: catIds[7].toString(), isActive: true, sortOrder: 2, audience: ['audit', 'security'] },
      { key: 'APPROVAL_REC', name: 'Approval Record', categoryId: catIds[7].toString(), isActive: true, sortOrder: 3, audience: ['leadership', 'audit'] },
    ];
    await db.collection('taxonomy_document_types').insertMany(typeSeeds);

    // Bundles & Apps Seeding
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

    // Wiki Pages Seeding
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
