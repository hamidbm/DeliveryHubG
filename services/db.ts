
import clientPromise from '../lib/mongodb';
import { ObjectId } from 'mongodb';
import { WikiPage, WikiSpace, WikiTheme, Bundle, Application, TaxonomyCategory, TaxonomyDocumentType, WorkItem, WorkItemType, WorkItemStatus, WorkItemActivity, Sprint, Milestone } from '../types';

export const getDb = async () => {
  const client = await clientPromise;
  return client.db('deliveryhub');
};

/**
 * Helper to create a query condition that matches either a string ID or a MongoDB ObjectId.
 */
const safeIdMatch = (id: string) => {
  if (!id || id === 'all') return null;
  const conditions: any[] = [{ [id.includes('-') ? 'key' : 'id']: id }];
  conditions.push(id);
  if (ObjectId.isValid(id)) {
    conditions.push(new ObjectId(id));
  }
  return { $in: conditions };
};

// ... (seedDatabase, Wiki services, Bundle services, etc. remain unchanged)
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

export const fetchApplications = async (bundleId?: string, activeOnly: boolean = false) => {
  const db = await getDb();
  const query: any = {};
  if (bundleId && bundleId !== 'all') {
    const bundleMatch = safeIdMatch(bundleId);
    if (bundleMatch) query.bundleId = bundleMatch;
  }
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
  if (categoryId) {
    const catMatch = safeIdMatch(categoryId);
    if (catMatch) query.categoryId = catMatch;
  }
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

export const fetchWorkItems = async (filters: any) => {
  const db = await getDb();
  const query: any = {};
  
  if (filters.bundleId && filters.bundleId !== 'all') {
    const match = safeIdMatch(filters.bundleId);
    if (match) query.bundleId = match;
  }
  
  if (filters.applicationId && filters.applicationId !== 'all') {
    const match = safeIdMatch(filters.applicationId);
    if (match) query.applicationId = match;
  }
  
  if (filters.milestoneId && filters.milestoneId !== 'all') {
    const msRegex = new RegExp(`^${filters.milestoneId}$`, 'i');
    query.$or = [{ milestoneIds: msRegex }, { milestoneId: msRegex }];
  }

  const pId = filters.parentId || filters.epicId;
  if (pId && pId !== 'all') {
    const match = safeIdMatch(pId);
    if (match) query.parentId = match;
  }
  
  if (filters.q) {
    query.$or = [
      ...(query.$or || []),
      { title: { $regex: filters.q, $options: 'i' } },
      { key: { $regex: filters.q, $options: 'i' } }
    ];
  }
  
  return await db.collection('workitems').find(query).sort({ rank: 1, createdAt: -1 }).toArray();
};

export const fetchWorkItemById = async (id: string) => {
  const db = await getDb();
  try {
    if (ObjectId.isValid(id)) {
      return await db.collection('workitems').findOne({ 
        $or: [{ _id: new ObjectId(id) }, { id: id }, { key: id }] 
      });
    }
    return await db.collection('workitems').findOne({ 
      $or: [{ id: id }, { key: id }] 
    });
  } catch {
    return null;
  }
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
  const db = await getDb();
  const items = await fetchWorkItems(filters);
  const treeMode = filters.treeMode || 'hierarchy';

  if (treeMode === 'milestone') {
    // Group by Milestones
    const milestones = await fetchMilestones(filters);
    return milestones.map(m => {
      const mIdStr = m._id?.toString();
      const mItems = items.filter(i => {
         const ids = i.milestoneIds || [];
         const id = i.milestoneId;
         return ids.includes(mIdStr) || id === mIdStr || id === m.name;
      });
      
      return {
        id: `ms-node-${mIdStr}`,
        label: m.name,
        type: 'MILESTONE',
        status: m.status,
        children: mItems.map(i => ({
          id: i._id?.toString() || i.id,
          label: i.title,
          type: i.type,
          status: i.status,
          workItemId: i._id?.toString() || i.id,
          nodeType: 'WORK_ITEM',
          children: []
        }))
      };
    });
  }

  // Standard Hierarchy Mode
  const buildTree = (parentId: any = null): any[] => {
    return items
      .filter(item => {
        const itemPid = item.parentId?.toString() || null;
        const comparePid = parentId?.toString() || null;
        if (comparePid === null) {
          return itemPid === null || itemPid === "";
        }
        return itemPid === comparePid;
      })
      .map(item => ({
        id: item._id?.toString() || item.id,
        label: item.title,
        type: item.type,
        status: item.status,
        workItemId: item._id?.toString() || item.id,
        nodeType: 'WORK_ITEM',
        children: buildTree(item._id || item.id)
      }));
  };
  
  const startPid = (filters.parentId && filters.parentId !== 'all') ? filters.parentId : 
                   (filters.epicId && filters.epicId !== 'all') ? filters.epicId : null;
  
  const tree = buildTree(startPid);
  if (tree.length === 0 && items.length > 0) {
    return items.map(item => ({
      id: item._id?.toString() || item.id,
      label: item.title,
      type: item.type,
      status: item.status,
      workItemId: item._id?.toString() || item.id,
      nodeType: 'WORK_ITEM',
      children: []
    }));
  }
  return tree;
};

// ... (fetchWorkItemsBoard, searchUsers, fetchSprints remain unchanged)
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

export const searchUsers = async (query: string) => {
  const db = await getDb();
  return await db.collection('users').find({
    $or: [
      { name: { $regex: query, $options: 'i' } },
      { email: { $regex: query, $options: 'i' } }
    ]
  }).limit(10).toArray();
};

export const fetchSprints = async (filters: any) => {
  const db = await getDb();
  const query: any = {};
  if (filters.bundleId && filters.bundleId !== 'all') {
    const match = safeIdMatch(filters.bundleId);
    if (match) query.bundleId = match;
  }
  if (filters.applicationId && filters.applicationId !== 'all') {
    const match = safeIdMatch(filters.applicationId);
    if (match) query.applicationId = match;
  }
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

export const fetchMilestones = async (filters: any) => {
  const db = await getDb();
  const query: any = {};
  if (filters.bundleId && filters.bundleId !== 'all') {
    const match = safeIdMatch(filters.bundleId);
    if (match) query.bundleId = match;
  }
  if (filters.applicationId && filters.applicationId !== 'all') {
    const match = safeIdMatch(filters.applicationId);
    if (match) query.applicationId = match;
  }
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
