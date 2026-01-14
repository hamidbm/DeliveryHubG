
import clientPromise from '../lib/mongodb';
import { ObjectId } from 'mongodb';
import { WikiPage, WikiSpace, WikiTheme, Bundle, Application, TaxonomyCategory, TaxonomyDocumentType, WorkItem, WorkItemType, WorkItemStatus, WorkItemActivity, Sprint, Milestone } from '../types';

export const getDb = async () => {
  const client = await clientPromise;
  return client.db('deliveryhub');
};

// Fix: Implementation of seedDatabase to initialize registry with base content.
export const seedDatabase = async (applications: any[], workItems: any[], wikiPages: any[]) => {
  try {
    const db = await getDb();
    if (applications.length) await db.collection('applications').insertMany(applications);
    if (workItems.length) await db.collection('workitems').insertMany(workItems);
    if (wikiPages.length) await db.collection('wikipages').insertMany(wikiPages);
    return { success: true };
  } catch (error) {
    console.error("Seed error:", error);
    return { success: false };
  }
};

// Fix: Wiki service implementations including history and comments.
export const fetchWikiPages = async () => {
  const db = await getDb();
  return await db.collection('wikipages').find({}).toArray();
};

export const saveWikiPage = async (page: Partial<WikiPage>) => {
  const db = await getDb();
  const { _id, ...data } = page;
  const now = new Date().toISOString();
  
  if (_id) {
    const existing = await db.collection('wikipages').findOne({ _id: new ObjectId(_id) });
    if (existing) {
      await db.collection('wiki_versions').insertOne({
        ...existing,
        pageId: existing._id,
        _id: new ObjectId(),
        versionedAt: now
      });
    }
    return await db.collection('wikipages').updateOne(
      { _id: new ObjectId(_id) },
      { $set: { ...data, updatedAt: now } }
    );
  } else {
    return await db.collection('wikipages').insertOne({
      ...data,
      createdAt: now,
      updatedAt: now,
      version: 1
    });
  }
};

export const fetchWikiHistory = async (pageId: string) => {
  const db = await getDb();
  return await db.collection('wiki_versions').find({ pageId: new ObjectId(pageId) }).sort({ versionedAt: -1 }).toArray();
};

export const revertWikiPage = async (pageId: string, versionId: string) => {
  const db = await getDb();
  const version = await db.collection('wiki_versions').findOne({ _id: new ObjectId(versionId) });
  if (!version) throw new Error("Version not found");
  const { _id, pageId: pid, versionedAt, ...data } = version;
  return await saveWikiPage({ ...data, _id: pageId } as any);
};

export const fetchWikiSpaces = async () => {
  const db = await getDb();
  return await db.collection('spaces').find({}).toArray();
};

export const saveWikiSpace = async (space: Partial<WikiSpace>) => {
  const db = await getDb();
  const { _id, ...data } = space;
  if (_id) {
    return await db.collection('spaces').updateOne({ _id: new ObjectId(_id) }, { $set: data });
  } else {
    return await db.collection('spaces').insertOne(data);
  }
};

export const fetchWikiComments = async (pageId: string) => {
  const db = await getDb();
  const page = await db.collection('wikipages').findOne({ _id: new ObjectId(pageId) });
  return page?.comments || [];
};

export const saveWikiComment = async (commentData: any) => {
  const db = await getDb();
  const { pageId, ...comment } = commentData;
  return await db.collection('wikipages').updateOne(
    { _id: new ObjectId(pageId) },
    { $push: { comments: { ...comment, createdAt: new Date().toISOString() } } }
  );
};

// Fix: Bundle service implementations.
export const fetchBundles = async (activeOnly: boolean = false) => {
  const db = await getDb();
  const query = activeOnly ? { isActive: true } : {};
  return await db.collection('bundles').find(query).sort({ sortOrder: 1 }).toArray();
};

export const saveBundle = async (bundle: Partial<Bundle>, user?: any) => {
  const db = await getDb();
  const { _id, ...data } = bundle;
  const now = new Date().toISOString();
  if (_id) {
    return await db.collection('bundles').updateOne({ _id: new ObjectId(_id) }, { $set: { ...data, updatedAt: now } });
  } else {
    return await db.collection('bundles').insertOne({ ...data, createdAt: now, updatedAt: now });
  }
};

// Fix: Wiki Theme service implementations.
export const fetchWikiThemes = async (activeOnly: boolean = false) => {
  const db = await getDb();
  const query = activeOnly ? { isActive: true } : {};
  return await db.collection('themes').find(query).toArray();
};

export const saveWikiTheme = async (theme: Partial<WikiTheme>) => {
  const db = await getDb();
  const { _id, ...data } = theme;
  if (_id) {
    return await db.collection('themes').updateOne({ _id: new ObjectId(_id) }, { $set: data });
  } else {
    return await db.collection('themes').insertOne(data);
  }
};

export const deleteWikiTheme = async (id: string) => {
  const db = await getDb();
  return await db.collection('themes').deleteOne({ _id: new ObjectId(id) });
};

// Fix: Application service implementations.
export const fetchApplications = async (bundleId?: string, activeOnly: boolean = false) => {
  const db = await getDb();
  const query: any = {};
  if (bundleId) query.bundleId = bundleId;
  if (activeOnly) query.isActive = true;
  return await db.collection('applications').find(query).toArray();
};

export const saveApplication = async (app: Partial<Application>, user?: any) => {
  const db = await getDb();
  const { _id, ...data } = app;
  const now = new Date().toISOString();
  if (_id) {
    return await db.collection('applications').updateOne({ _id: new ObjectId(_id) }, { $set: { ...data, updatedAt: now } });
  } else {
    return await db.collection('applications').insertOne({ ...data, createdAt: now, updatedAt: now });
  }
};

// Fix: Taxonomy service implementations.
export const fetchTaxonomyCategories = async (activeOnly: boolean = false) => {
  const db = await getDb();
  const query = activeOnly ? { isActive: true } : {};
  return await db.collection('taxonomy_categories').find(query).sort({ sortOrder: 1 }).toArray();
};

export const saveTaxonomyCategory = async (cat: Partial<TaxonomyCategory>) => {
  const db = await getDb();
  const { _id, ...data } = cat;
  if (_id) {
    return await db.collection('taxonomy_categories').updateOne({ _id: new ObjectId(_id) }, { $set: data });
  } else {
    return await db.collection('taxonomy_categories').insertOne(data);
  }
};

export const fetchTaxonomyDocumentTypes = async (activeOnly: boolean = false, categoryId?: string) => {
  const db = await getDb();
  const query: any = {};
  if (activeOnly) query.isActive = true;
  if (categoryId) query.categoryId = categoryId;
  return await db.collection('taxonomy_document_types').find(query).sort({ sortOrder: 1 }).toArray();
};

export const saveTaxonomyDocumentType = async (type: Partial<TaxonomyDocumentType>) => {
  const db = await getDb();
  const { _id, ...data } = type;
  if (_id) {
    return await db.collection('taxonomy_document_types').updateOne({ _id: new ObjectId(_id) }, { $set: data });
  } else {
    return await db.collection('taxonomy_document_types').insertOne(data);
  }
};

// Fix: WorkItem service implementations.
export const fetchWorkItems = async (filters: any) => {
  const db = await getDb();
  const query: any = {};
  if (filters.bundleId && filters.bundleId !== 'all') query.bundleId = filters.bundleId;
  if (filters.applicationId && filters.applicationId !== 'all') query.applicationId = filters.applicationId;
  if (filters.milestoneId && filters.milestoneId !== 'all') query.milestoneIds = filters.milestoneId;
  if (filters.parentId && filters.parentId !== 'all') query.parentId = filters.parentId;
  if (filters.q) query.title = { $regex: filters.q, $options: 'i' };
  
  return await db.collection('workitems').find(query).sort({ rank: 1 }).toArray();
};

export const fetchWorkItemById = async (id: string) => {
  const db = await getDb();
  return await db.collection('workitems').findOne({ _id: new ObjectId(id) });
};

export const saveWorkItem = async (item: Partial<WorkItem>, user?: any) => {
  const db = await getDb();
  const { _id, ...data } = item;
  const now = new Date().toISOString();
  if (_id) {
    return await db.collection('workitems').updateOne({ _id: new ObjectId(_id) }, { $set: { ...data, updatedAt: now } });
  } else {
    return await db.collection('workitems').insertOne({ ...data, createdAt: now, updatedAt: now });
  }
};

export const updateWorkItemStatus = async (id: string, toStatus: string, newRank: number, user: any) => {
  const db = await getDb();
  return await db.collection('workitems').updateOne(
    { _id: new ObjectId(id) },
    { $set: { status: toStatus, rank: newRank, updatedAt: new Date().toISOString() } }
  );
};

export const fetchWorkItemTree = async (filters: any) => {
  const items = await fetchWorkItems(filters);
  const buildTree = (parentId: string | null = null): any[] => {
    return items
      .filter(item => (item.parentId || null) === parentId)
      .map(item => ({
        id: item._id,
        label: item.title,
        type: item.type,
        status: item.status,
        workItemId: item._id,
        nodeType: 'WORK_ITEM',
        children: buildTree(item._id!.toString())
      }));
  };
  return buildTree(null);
};

export const fetchWorkItemsBoard = async (filters: any) => {
  const items = await fetchWorkItems(filters);
  const statuses = [WorkItemStatus.TODO, WorkItemStatus.IN_PROGRESS, WorkItemStatus.REVIEW, WorkItemStatus.DONE, WorkItemStatus.BLOCKED];
  const columns = statuses.map(s => ({
    statusId: s,
    statusName: s.replace('_', ' '),
    items: items.filter(i => i.status === s)
  }));
  return { columns };
};

// Fix: Search users service implementation.
export const searchUsers = async (query: string) => {
  const db = await getDb();
  return await db.collection('users').find({
    $or: [
      { name: { $regex: query, $options: 'i' } },
      { email: { $regex: query, $options: 'i' } }
    ]
  }).limit(10).toArray();
};

// Fix: Sprint service implementations.
export const fetchSprints = async (filters: any) => {
  const db = await getDb();
  const query: any = {};
  if (filters.bundleId && filters.bundleId !== 'all') query.bundleId = filters.bundleId;
  if (filters.applicationId && filters.applicationId !== 'all') query.applicationId = filters.applicationId;
  return await db.collection('sprints').find(query).sort({ createdAt: -1 }).toArray();
};

export const saveSprint = async (sprint: Partial<Sprint>) => {
  const db = await getDb();
  const { _id, ...data } = sprint;
  if (_id) {
    return await db.collection('sprints').updateOne({ _id: new ObjectId(_id) }, { $set: data });
  } else {
    return await db.collection('sprints').insertOne({ ...data, createdAt: new Date().toISOString() });
  }
};

// Milestones
export const fetchMilestones = async (filters: any) => {
  const db = await getDb();
  const query: any = {};
  if (filters.bundleId && filters.bundleId !== 'all') query.bundleId = filters.bundleId;
  if (filters.applicationId && filters.applicationId !== 'all') query.applicationId = filters.applicationId;
  if (filters.status) query.status = filters.status;
  
  return await db.collection('milestones').find(query).sort({ startDate: 1 }).toArray();
};

export const saveMilestone = async (milestone: Partial<Milestone>) => {
  const db = await getDb();
  const { _id, ...data } = milestone;
  const now = new Date().toISOString();

  if (_id) {
    return await db.collection('milestones').updateOne(
      { _id: new ObjectId(_id) },
      { $set: { ...data, updatedAt: now } }
    );
  } else {
    return await db.collection('milestones').insertOne({
      ...data,
      createdAt: now,
      updatedAt: now
    });
  }
};

export const deleteMilestone = async (id: string) => {
  const db = await getDb();
  return await db.collection('milestones').deleteOne({ _id: new ObjectId(id) });
};
