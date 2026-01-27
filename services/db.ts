import clientPromise from '../lib/mongodb';
import { ObjectId } from 'mongodb';
import { WikiPage, WikiSpace, WikiTheme, Bundle, Application, TaxonomyCategory, TaxonomyDocumentType, WorkItem, WorkItemType, WorkItemStatus, WorkItemActivity, Sprint, Milestone, Notification, ArchitectureDiagram, BusinessCapability, AppInterface } from '../types';

export const getDb = async () => {
  try {
    const client = await clientPromise;
    return client.db('deliveryhub');
  } catch (e) {
    console.error("CRITICAL: Database connection failed.", e);
    throw new Error("DB_OFFLINE");
  }
};

// Global Settings Management
export const fetchSystemSettings = async () => {
  try {
    const db = await getDb();
    const settings = await db.collection('settings').findOne({ key: 'global_config' });
    return settings || {
      key: 'global_config',
      ai: {
        defaultProvider: 'OPENAI',
        defaultModel: 'gpt-4o',
        flashModel: 'gemini-3-flash-preview',
        proModel: 'gemini-3-pro-preview',
        openaiKey: '',
        anthropicKey: '',
        huggingfaceKey: '',
        cohereKey: ''
      }
    };
  } catch { return null; }
};

export const saveSystemSettings = async (settings: any) => {
  const db = await getDb();
  return await db.collection('settings').updateOne(
    { key: 'global_config' },
    { $set: settings },
    { upsert: true }
  );
};

const safeIdMatch = (id: string) => {
  if (!id || id === 'all') return null;
  const conditions: any[] = [{ [id.includes('-') ? 'key' : 'id']: id }];
  conditions.push(id);
  if (ObjectId.isValid(id)) {
    conditions.push(new ObjectId(id));
  }
  return { $in: conditions };
};

export const fetchNotifications = async (userEmail: string) => {
  try {
    const db = await getDb();
    return await db.collection('notifications').find({ recipient: userEmail }).sort({ createdAt: -1 }).toArray();
  } catch { return []; }
};

export const saveNotification = async (notification: Partial<Notification>) => {
  const db = await getDb();
  return await db.collection('notifications').insertOne({
    ...notification,
    read: false,
    createdAt: new Date().toISOString()
  });
};

export const markNotificationRead = async (id: string) => {
  const db = await getDb();
  return await db.collection('notifications').updateOne({ _id: new ObjectId(id) }, { $set: { read: true } });
};

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
  try {
    const db = await getDb();
    return await db.collection('wikipages').find({}).toArray();
  } catch { return []; }
};

export const saveWikiPage = async (page: Partial<WikiPage>) => {
  const db = await getDb();
  const { _id, ...data } = page;
  const now = new Date().toISOString();
  
  if (_id && ObjectId.isValid(_id as string)) {
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
  try {
    const db = await getDb();
    return await db.collection('wiki_versions').find({ pageId: new ObjectId(pageId) }).sort({ versionedAt: -1 }).toArray();
  } catch { return []; }
};

export const revertWikiPage = async (pageId: string, versionId: string) => {
  const db = await getDb();
  const version = await db.collection('wiki_versions').findOne({ _id: new ObjectId(versionId) });
  if (!version) throw new Error("Version not found");
  const { _id, pageId: pid, versionedAt, ...data } = version;
  return await saveWikiPage({ ...data, _id: pageId } as any);
};

export const fetchWikiSpaces = async () => {
  try {
    const db = await getDb();
    // Standardizing on 'wikispaces' to prevent naming conflicts with system collections
    return await db.collection('wikispaces').find({}).toArray();
  } catch { return []; }
};

export const saveWikiSpace = async (space: Partial<WikiSpace>) => {
  const db = await getDb();
  const { _id, ...data } = space;
  if (_id && ObjectId.isValid(_id as string)) {
    return await db.collection('wikispaces').updateOne({ _id: new ObjectId(_id) }, { $set: data });
  } else {
    return await db.collection('wikispaces').insertOne(data);
  }
};

export const fetchWikiComments = async (pageId: string) => {
  try {
    const db = await getDb();
    const page = await db.collection('wikipages').findOne({ _id: new ObjectId(pageId) });
    return page?.comments || [];
  } catch { return []; }
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
  try {
    const db = await getDb();
    const query = activeOnly ? { isActive: true } : {};
    return await db.collection('bundles').find(query).sort({ sortOrder: 1 }).toArray();
  } catch { return []; }
};

export const saveBundle = async (bundle: Partial<Bundle>, user?: any) => {
  const db = await getDb();
  const { _id, ...data } = bundle;
  const now = new Date().toISOString();
  if (_id && ObjectId.isValid(_id as string)) {
    return await db.collection('bundles').updateOne({ _id: new ObjectId(_id) }, { $set: { ...data, updatedAt: now } });
  } else {
    return await db.collection('bundles').insertOne({ ...data, createdAt: now, updatedAt: now });
  }
};

export const fetchWikiThemes = async (activeOnly: boolean = false) => {
  try {
    const db = await getDb();
    const query = activeOnly ? { isActive: true } : {};
    return await db.collection('themes').find(query).toArray();
  } catch { return []; }
};

export const saveWikiTheme = async (theme: Partial<WikiTheme>) => {
  const db = await getDb();
  const { _id, ...data } = theme;
  if (_id && ObjectId.isValid(_id as string)) {
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
  try {
    const db = await getDb();
    const query: any = {};
    if (bundleId && bundleId !== 'all') {
      const bundleMatch = safeIdMatch(bundleId);
      if (bundleMatch) query.bundleId = bundleMatch;
    }
    if (activeOnly) query.isActive = true;
    return await db.collection('applications').find(query).toArray();
  } catch { return []; }
};

export const saveApplication = async (app: Partial<Application>, user?: any) => {
  const db = await getDb();
  const { _id, ...data } = app;
  const now = new Date().toISOString();
  if (_id && ObjectId.isValid(_id as string)) {
    return await db.collection('applications').updateOne({ _id: new ObjectId(_id) }, { $set: { ...data, updatedAt: now } });
  } else {
    return await db.collection('applications').insertOne({ ...data, createdAt: now, updatedAt: now });
  }
};

export const fetchTaxonomyCategories = async (activeOnly: boolean = false) => {
  try {
    const db = await getDb();
    const query = activeOnly ? { isActive: true } : {};
    return await db.collection('taxonomy_categories').find(query).sort({ sortOrder: 1 }).toArray();
  } catch { return []; }
};

export const saveTaxonomyCategory = async (cat: Partial<TaxonomyCategory>) => {
  const db = await getDb();
  const { _id, ...data } = cat;
  if (_id && ObjectId.isValid(_id as string)) {
    return await db.collection('taxonomy_categories').updateOne({ _id: new ObjectId(_id) }, { $set: data });
  } else {
    return await db.collection('taxonomy_categories').insertOne(data);
  }
};

export const fetchTaxonomyDocumentTypes = async (activeOnly: boolean = false, categoryId?: string) => {
  try {
    const db = await getDb();
    const query: any = {};
    if (activeOnly) query.isActive = true;
    if (categoryId) {
      const catMatch = safeIdMatch(categoryId);
      if (catMatch) query.categoryId = catMatch;
    }
    return await db.collection('taxonomy_document_types').find(query).sort({ sortOrder: 1 }).toArray();
  } catch { return []; }
};

export const saveTaxonomyDocumentType = async (type: Partial<TaxonomyDocumentType>) => {
  const db = await getDb();
  const { _id, ...data } = type;
  if (_id && ObjectId.isValid(_id as string)) {
    return await db.collection('taxonomy_document_types').updateOne({ _id: new ObjectId(_id) }, { $set: data });
  } else {
    return await db.collection('taxonomy_document_types').insertOne(data);
  }
};

export const fetchWorkItems = async (filters: any) => {
  try {
    const db = await getDb();
    const query: any = {};
    let sort: any = { rank: 1, createdAt: -1 };
    
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

    if (filters.assignedTo && filters.assignedTo !== 'all') {
      query.assignedTo = filters.assignedTo;
    }

    if (filters.status && filters.status !== 'all') {
      query.status = filters.status;
    }

    if (filters.quickFilter) {
      switch (filters.quickFilter) {
        case 'my':
          if (filters.currentUser) query.assignedTo = filters.currentUser;
          break;
        case 'updated':
          const recent = new Date();
          recent.setDate(recent.getDate() - 7);
          query.updatedAt = { $gte: recent.toISOString() };
          sort = { updatedAt: -1 };
          break;
        case 'blocked':
          query.$or = [
            { status: WorkItemStatus.BLOCKED },
            { isFlagged: true }
          ];
          break;
      }
    }
    
    if (filters.q) {
      query.$or = [
        ...(query.$or || []),
        { title: { $regex: filters.q, $options: 'i' } },
        { key: { $regex: filters.q, $options: 'i' } }
      ];
    }
    
    return await db.collection('workitems').find(query).sort(sort).toArray();
  } catch { return []; }
};

export const fetchWorkItemById = async (id: string) => {
  try {
    const db = await getDb();
    if (ObjectId.isValid(id)) {
      return await db.collection('workitems').findOne({ 
        $or: [{ _id: new ObjectId(id) }, { id: id }, { key: id }] 
      });
    }
    return await db.collection('workitems').findOne({ 
      $or: [{ id: id }, { key: id }] 
    });
  } catch { return null; }
};

export const saveWorkItem = async (item: Partial<WorkItem>, user?: any) => {
  const db = await getDb();
  const { _id, ...data } = item;
  const now = new Date().toISOString();
  const userName = user?.name || 'Nexus System';

  if (_id && ObjectId.isValid(_id as string)) {
    const existing = await db.collection('workitems').findOne({ _id: new ObjectId(_id) });
    if (!existing) throw new Error("Work item not found");

    const activities: any[] = [];
    const fieldsToTrack = ['status', 'priority', 'assignedTo', 'title', 'description', 'storyPoints', 'parentId', 'milestoneIds', 'timeEstimate', 'timeLogged', 'isFlagged', 'attachments', 'links', 'aiWorkPlan', 'checklists'];
    
    fieldsToTrack.forEach(field => {
      const oldVal = existing[field];
      const newVal = data[field as keyof typeof data];
      
      if (newVal !== undefined && JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
        activities.push({
          user: userName,
          action: field === 'checklists' ? 'CHECKLIST_UPDATED' : 
                  field === 'isFlagged' ? (newVal ? 'IMPEDIMENT_RAISED' : 'IMPEDIMENT_CLEARED') : 
                  field === 'timeLogged' ? 'WORK_LOGGED' :
                  field === 'aiWorkPlan' ? 'AI_REFINEMENT_COMMITTED' : 
                  (field === 'status' ? 'CHANGED_STATUS' : 'UPDATED_FIELD'),
          field: field,
          from: oldVal,
          to: newVal,
          createdAt: now
        });

        if (field === 'isFlagged' && newVal === true) {
          db.collection('notifications').insertOne({
            recipient: existing.assignedTo || 'Unassigned',
            sender: userName,
            type: 'IMPEDIMENT',
            message: `Impediment raised on ${existing.key}: ${existing.title}`,
            link: `/work-items?view=tree&pageId=${existing._id}`,
            read: false,
            createdAt: now
          });
        }

        if (field === 'assignedTo' && newVal) {
          db.collection('notifications').insertOne({
            recipient: newVal,
            sender: userName,
            type: 'ASSIGNMENT',
            message: `You have been assigned to artifact ${existing.key}`,
            link: `/work-items?view=tree&pageId=${existing._id}`,
            read: false,
            createdAt: now
          });
        }
      }
    });

    const finalSet = { ...data, updatedAt: now, updatedBy: userName };
    const finalPush = { activity: { $each: activities } };

    return await db.collection('workitems').updateOne(
      { _id: new ObjectId(_id) },
      { $set: finalSet, $push: finalPush }
    );
  } else {
    let key = data.key;
    if (!key) {
      const bundle = await db.collection('bundles').findOne(
        data.bundleId && ObjectId.isValid(data.bundleId) 
          ? { _id: new ObjectId(data.bundleId) } 
          : { key: data.bundleId }
      );
      const prefix = bundle?.key || 'TASK';
      const count = await db.collection('workitems').countDocuments({ bundleId: data.bundleId });
      key = `${prefix}-${count + 1}`;
    }

    const newItem = {
      ...data,
      key,
      createdAt: now,
      updatedAt: now,
      createdBy: userName,
      activity: [{ user: userName, action: 'CREATED', createdAt: now }]
    };
    return await db.collection('workitems').insertOne(newItem);
  }
};

export const updateWorkItemStatus = async (id: string, toStatus: string, newRank: number, user: any) => {
  const db = await getDb();
  const now = new Date().toISOString();
  const userName = user?.name || 'Nexus System';
  
  const existing = await db.collection('workitems').findOne({ _id: new ObjectId(id) });
  if (!existing) return null;

  return await db.collection('workitems').updateOne(
    { _id: new ObjectId(id) },
    { 
      $set: { status: toStatus, rank: newRank, updatedAt: now },
      $push: { 
        activity: {
          user: userName,
          action: 'CHANGED_STATUS',
          from: existing.status,
          to: toStatus,
          createdAt: now
        }
      }
    }
  );
};

export const fetchMilestones = async (filters: any) => {
  try {
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
    if (filters.status && filters.status !== 'all') {
      query.status = filters.status;
    }
    return await db.collection('milestones').find(query).sort({ dueDate: 1 }).toArray();
  } catch { return []; }
};

export const saveMilestone = async (milestone: Partial<Milestone>) => {
  const db = await getDb();
  const { _id, ...data } = milestone;
  const now = new Date().toISOString();
  if (_id && ObjectId.isValid(_id as string)) {
    return await db.collection('milestones').updateOne({ _id: new ObjectId(_id) }, { $set: { ...data, updatedAt: now } });
  } else {
    return await db.collection('milestones').insertOne({ ...data, createdAt: now, updatedAt: now });
  }
};

export const deleteMilestone = async (id: string) => {
  const db = await getDb();
  return await db.collection('milestones').deleteOne({ _id: new ObjectId(id) });
};

export const searchUsers = async (query: string) => {
  try {
    const db = await getDb();
    return await db.collection('users').find({
      $or: [
        { name: { $regex: query, $options: 'i' } },
        { email: { $regex: query, $options: 'i' } }
      ]
    }).limit(10).project({ password: 0 }).toArray();
  } catch { return []; }
};

export const fetchWorkItemsBoard = async (filters: any) => {
  const items = await fetchWorkItems(filters);
  const statuses = [
    { id: WorkItemStatus.TODO, name: 'To Do' },
    { id: WorkItemStatus.IN_PROGRESS, name: 'In Progress' },
    { id: WorkItemStatus.REVIEW, name: 'Review' },
    { id: WorkItemStatus.DONE, name: 'Done' },
    { id: WorkItemStatus.BLOCKED, name: 'Blocked' }
  ];

  const columns = statuses.map(s => ({
    statusId: s.id,
    statusName: s.name,
    items: items.filter(i => i.status === s.id)
  }));

  return { columns };
};

export const fetchSprints = async (filters: any) => {
  try {
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
    if (filters.status) {
      query.status = filters.status;
    }
    return await db.collection('sprints').find(query).sort({ startDate: 1 }).toArray();
  } catch { return []; }
};

export const saveSprint = async (sprint: Partial<Sprint>) => {
  const db = await getDb();
  const { _id, ...data } = sprint;
  const now = new Date().toISOString();
  if (_id && ObjectId.isValid(_id as string)) {
    return await db.collection('sprints').updateOne({ _id: new ObjectId(_id) }, { $set: data });
  } else {
    return await db.collection('sprints').insertOne({ ...data, createdAt: now });
  }
};

export const fetchWorkItemTree = async (filters: any) => {
  const items = await fetchWorkItems(filters);
  const treeMode = filters.treeMode || 'hierarchy';

  if (treeMode === 'milestone') {
    const milestones = await fetchMilestones(filters);
    return milestones.map(m => {
      const mIdStr = m._id?.toString();
      const mItems = items.filter(i => {
         const ids = i.milestoneIds || [];
         const id = (i as any).milestoneId;
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
          isFlagged: i.isFlagged,
          workItemId: i._id?.toString() || i.id,
          nodeType: 'WORK_ITEM',
          children: []
        }))
      };
    });
  }

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
      .map(item => {
        const children = buildTree(item._id || item.id);
        
        let completion = 0;
        if (children.length > 0) {
          const done = children.filter(c => c.status === WorkItemStatus.DONE).length;
          completion = Math.round((done / children.length) * 100);
        }

        return {
          id: item._id?.toString() || item.id,
          label: item.title,
          type: item.type,
          status: item.status,
          isFlagged: item.isFlagged,
          workItemId: item._id?.toString() || item.id,
          nodeType: 'WORK_ITEM',
          completion,
          children
        };
      });
  };

  return buildTree();
};

export const fetchArchitectureDiagrams = async (filters: any = {}) => {
  try {
    const db = await getDb();
    const query: any = {};
    if (filters.bundleId && filters.bundleId !== 'all') query.bundleId = filters.bundleId;
    if (filters.applicationId && filters.applicationId !== 'all') query.applicationId = filters.applicationId;
    return await db.collection('architecture_diagrams').find(query).sort({ updatedAt: -1 }).toArray();
  } catch { return []; }
};

export const saveArchitectureDiagram = async (diagram: Partial<ArchitectureDiagram>, user: any) => {
  const db = await getDb();
  const { _id, ...data } = diagram;
  const now = new Date().toISOString();
  const userName = user?.name || 'System';

  if (_id && ObjectId.isValid(_id as string)) {
    return await db.collection('architecture_diagrams').updateOne(
      { _id: new ObjectId(_id) },
      { $set: { ...data, updatedAt: now } }
    );
  } else {
    return await db.collection('architecture_diagrams').insertOne({
      ...data,
      createdBy: userName,
      updatedAt: now
    });
  }
};

export const deleteArchitectureDiagram = async (id: string) => {
  const db = await getDb();
  return await db.collection('architecture_diagrams').deleteOne({ _id: new ObjectId(id) });
};

export const fetchCapabilities = async () => {
  try {
    const db = await getDb();
    return await db.collection('capabilities').find({}).sort({ level: 1, name: 1 }).toArray();
  } catch { return []; }
};

export const saveCapability = async (capability: Partial<BusinessCapability>) => {
  const db = await getDb();
  const { _id, ...data } = capability;
  if (_id && ObjectId.isValid(_id as string)) {
    return await db.collection('capabilities').updateOne({ _id: new ObjectId(_id) }, { $set: data });
  } else {
    return await db.collection('capabilities').insertOne(data);
  }
};

export const deleteCapability = async (id: string) => {
  const db = await getDb();
  return await db.collection('capabilities').deleteOne({ _id: new ObjectId(id) });
};

export const fetchInterfaces = async (appId?: string) => {
  try {
    const db = await getDb();
    const query = appId && appId !== 'all' ? { $or: [{ sourceAppId: appId }, { targetAppId: appId }] } : {};
    return await db.collection('interfaces').find(query).toArray();
  } catch { return []; }
};

export const saveInterface = async (data: Partial<AppInterface>) => {
  const db = await getDb();
  const { _id, ...rest } = data;
  if (_id && ObjectId.isValid(_id as string)) {
    return await db.collection('interfaces').updateOne({ _id: new ObjectId(_id) }, { $set: rest });
  } else {
    return await db.collection('interfaces').insertOne(rest);
  }
};

export const deleteInterface = async (id: string) => {
  const db = await getDb();
  return await db.collection('interfaces').deleteOne({ _id: new ObjectId(id) });
};