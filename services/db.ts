import clientPromise from '../lib/mongodb';
import { ObjectId } from 'mongodb';
import { WikiPage, WikiSpace, WikiTheme, Bundle, Application, TaxonomyCategory, TaxonomyDocumentType, WorkItem, WorkItemType, WorkItemStatus, WorkItemActivity, Sprint, Milestone, Notification, ArchitectureDiagram, BusinessCapability, AppInterface, WikiAsset } from '../types';

export const getDb = async () => {
  try {
    const client = await clientPromise;
    return client.db('deliveryhub');
  } catch (e) {
    console.error("CRITICAL: Database connection failed.", e);
    throw new Error("DB_OFFLINE");
  }
};

const defaultAiSettings = {
  defaultProvider: 'OPENAI',
  openaiModelDefault: 'gpt-5.2',
  openaiModelHigh: 'gpt-5.2-pro',
  openaiModelFast: 'gpt-5.2-chat-latest',
  geminiFlashModel: 'gemini-3-flash-preview',
  geminiProModel: 'gemini-3-pro-preview',
  anthropicModel: 'claude-3-5-sonnet-20240620',
  huggingfaceModel: '',
  cohereModel: '',
  openaiKey: '',
  anthropicKey: '',
  huggingfaceKey: '',
  cohereKey: ''
};

const normalizeAiSettings = (doc: any) => {
  const providers = doc?.providers || {};
  const openaiModels = providers.OPENAI?.models || {};
  const openaiModelDefault = openaiModels.default || doc?.openaiModelDefault || doc?.openaiModel || doc?.defaultModel || defaultAiSettings.openaiModelDefault;
  const openaiModelHigh = openaiModels.highReasoning || doc?.openaiModelHigh || defaultAiSettings.openaiModelHigh;
  const openaiModelFast = openaiModels.fast || doc?.openaiModelFast || defaultAiSettings.openaiModelFast;
  const geminiModels = providers.GEMINI?.models || {};
  const geminiFlashModel = geminiModels.flash || providers.GEMINI?.flashModel || doc?.geminiFlashModel || doc?.flashModel || defaultAiSettings.geminiFlashModel;
  const geminiProModel = geminiModels.pro || providers.GEMINI?.proModel || doc?.geminiProModel || doc?.proModel || defaultAiSettings.geminiProModel;
  const anthropicModels = providers.ANTHROPIC?.models || {};
  const anthropicModel = anthropicModels.default || providers.ANTHROPIC?.model || doc?.anthropicModel || defaultAiSettings.anthropicModel;
  const huggingfaceModels = providers.HUGGINGFACE?.models || {};
  const huggingfaceModel = huggingfaceModels.default || providers.HUGGINGFACE?.model || doc?.huggingfaceModel || defaultAiSettings.huggingfaceModel;
  const cohereModels = providers.COHERE?.models || {};
  const cohereModel = cohereModels.default || providers.COHERE?.model || doc?.cohereModel || defaultAiSettings.cohereModel;

  return {
    key: 'ai_settings',
    ai: {
      defaultProvider: doc?.defaultProvider || defaultAiSettings.defaultProvider,
      openaiKey: providers.OPENAI?.apiKey || doc?.openaiKey || defaultAiSettings.openaiKey,
      openaiModelDefault,
      openaiModelHigh,
      openaiModelFast,
      geminiFlashModel,
      geminiProModel,
      anthropicKey: providers.ANTHROPIC?.apiKey || doc?.anthropicKey || defaultAiSettings.anthropicKey,
      anthropicModel,
      huggingfaceKey: providers.HUGGINGFACE?.apiKey || doc?.huggingfaceKey || defaultAiSettings.huggingfaceKey,
      huggingfaceModel,
      cohereKey: providers.COHERE?.apiKey || doc?.cohereKey || defaultAiSettings.cohereKey,
      cohereModel,
      // Legacy compatibility fields
      defaultModel: openaiModelDefault,
      flashModel: geminiFlashModel,
      proModel: geminiProModel
    }
  };
};

// Global Settings Management
export const fetchSystemSettings = async () => {
  try {
    const db = await getDb();
    const aiSettings = await db.collection('ai_settings').findOne({ key: 'ai_settings' });
    if (aiSettings) {
      return normalizeAiSettings(aiSettings);
    }

    const legacy = await db.collection('settings').findOne({ key: 'global_config' });
    if (legacy?.ai) {
      const normalized = normalizeAiSettings({
        ...legacy.ai,
        defaultProvider: legacy.ai.defaultProvider || legacy.defaultProvider
      });
      await db.collection('ai_settings').updateOne(
        { key: 'ai_settings' },
        { $set: { ...normalized, key: 'ai_settings' } },
        { upsert: true }
      );
      return normalized;
    }

    return normalizeAiSettings({});
  } catch { return null; }
};

export const saveSystemSettings = async (settings: any) => {
  const db = await getDb();
  const ai = settings?.ai || {};
  const doc = {
    key: 'ai_settings',
    defaultProvider: ai.defaultProvider || defaultAiSettings.defaultProvider,
    providers: {
      OPENAI: {
        apiKey: ai.openaiKey || defaultAiSettings.openaiKey,
        models: {
          default: ai.openaiModelDefault || ai.openaiModel || ai.defaultModel || defaultAiSettings.openaiModelDefault,
          highReasoning: ai.openaiModelHigh || defaultAiSettings.openaiModelHigh,
          fast: ai.openaiModelFast || defaultAiSettings.openaiModelFast
        }
      },
      GEMINI: {
        apiKey: ai.geminiKey || '',
        models: {
          flash: ai.geminiFlashModel || ai.flashModel || defaultAiSettings.geminiFlashModel,
          pro: ai.geminiProModel || ai.proModel || defaultAiSettings.geminiProModel
        }
      },
      ANTHROPIC: {
        apiKey: ai.anthropicKey || defaultAiSettings.anthropicKey,
        models: {
          default: ai.anthropicModel || defaultAiSettings.anthropicModel
        }
      },
      HUGGINGFACE: {
        apiKey: ai.huggingfaceKey || defaultAiSettings.huggingfaceKey,
        models: {
          default: ai.huggingfaceModel || defaultAiSettings.huggingfaceModel
        }
      },
      COHERE: {
        apiKey: ai.cohereKey || defaultAiSettings.cohereKey,
        models: {
          default: ai.cohereModel || defaultAiSettings.cohereModel
        }
      }
    }
  };

  return await db.collection('ai_settings').updateOne(
    { key: 'ai_settings' },
    { $set: doc },
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
    if (workItems.length) await db.collection('wiki_items').insertMany(workItems);
    if (wikiPages.length) await db.collection('wiki_pages').insertMany(wikiPages);
    return { success: true };
  } catch (error) {
    console.error("Seed error:", error);
    return { success: false };
  }
};

export const fetchWikiPages = async () => {
  try {
    const db = await getDb();
    return await db.collection('wiki_pages').find({}).toArray();
  } catch { return []; }
};

export const fetchWikiAssets = async () => {
  try {
    const db = await getDb();
    return await db.collection('wiki_assets').find({}).toArray();
  } catch { return []; }
};

export const saveWikiAsset = async (asset: Partial<WikiAsset>) => {
  const db = await getDb();
  const { _id, ...data } = asset;
  const now = new Date().toISOString();
  if (_id && ObjectId.isValid(_id as string)) {
    return await db.collection('wiki_assets').updateOne(
      { _id: new ObjectId(_id) },
      { $set: { ...data, updatedAt: now } }
    );
  } else {
    return await db.collection('wiki_assets').insertOne({
      ...data,
      createdAt: now,
      updatedAt: now,
      version: 1
    });
  }
};

export const saveWikiPage = async (page: Partial<WikiPage>) => {
  const db = await getDb();
  const { _id, ...data } = page;
  const now = new Date().toISOString();
  
  if (_id && ObjectId.isValid(_id as string)) {
    const existing = await db.collection('wiki_pages').findOne({ _id: new ObjectId(_id) });
    if (existing) {
      await db.collection('wiki_history').insertOne({
        ...existing,
        pageId: existing._id,
        _id: new ObjectId(),
        versionedAt: now
      });
    }
    return await db.collection('wiki_pages').updateOne(
      { _id: new ObjectId(_id) },
      { $set: { ...data, updatedAt: now } }
    );
  } else {
    return await db.collection('wiki_pages').insertOne({
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
    return await db.collection('wiki_history').find({ pageId: new ObjectId(pageId) }).sort({ versionedAt: -1 }).toArray();
  } catch { return []; }
};

export const revertWikiPage = async (pageId: string, versionId: string) => {
  const db = await getDb();
  const version = await db.collection('wiki_history').findOne({ _id: new ObjectId(versionId) });
  if (!version) throw new Error("Version not found");
  const { _id, pageId: pid, versionedAt, ...data } = version;
  return await saveWikiPage({ ...data, _id: pageId } as any);
};

export const fetchWikiSpaces = async () => {
  try {
    const db = await getDb();
    return await db.collection('wiki_spaces').find({}).toArray();
  } catch { return []; }
};

export const saveWikiSpace = async (space: Partial<WikiSpace>) => {
  const db = await getDb();
  const { _id, ...data } = space;
  if (_id && ObjectId.isValid(_id as string)) {
    return await db.collection('wiki_spaces').updateOne({ _id: new ObjectId(_id) }, { $set: data });
  } else {
    return await db.collection('wiki_spaces').insertOne(data);
  }
};

export const fetchWikiComments = async (pageId: string) => {
  try {
    const db = await getDb();
    const page = await db.collection('wiki_pages').findOne({ _id: new ObjectId(pageId) });
    return page?.comments || [];
  } catch { return []; }
};

export const saveWikiComment = async (commentData: any) => {
  const db = await getDb();
  const { pageId, ...comment } = commentData;
  return await db.collection('wiki_pages').updateOne(
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
    return await db.collection('wiki_themes').find(query).toArray();
  } catch { return []; }
};

export const saveWikiTheme = async (theme: Partial<WikiTheme>) => {
  const db = await getDb();
  const { _id, ...data } = theme;
  if (_id && ObjectId.isValid(_id as string)) {
    return await db.collection('wiki_themes').updateOne({ _id: new ObjectId(_id) }, { $set: data });
  } else {
    return await db.collection('wiki_themes').insertOne(data);
  }
};

export const deleteWikiTheme = async (id: string) => {
  const db = await getDb();
  return await db.collection('wiki_themes').deleteOne({ _id: new ObjectId(id) });
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
    
    return await db.collection('wiki_items').find(query).sort(sort).toArray();
  } catch { return []; }
};

export const fetchWorkItemById = async (id: string) => {
  try {
    const db = await getDb();
    if (ObjectId.isValid(id)) {
      return await db.collection('wiki_items').findOne({ 
        $or: [{ _id: new ObjectId(id) }, { id: id }, { key: id }] 
      });
    }
    return await db.collection('wiki_items').findOne({ 
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
    const existing = await db.collection('wiki_items').findOne({ _id: new ObjectId(_id) });
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

    return await db.collection('wiki_items').updateOne(
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
      const count = await db.collection('wiki_items').countDocuments({ bundleId: data.bundleId });
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
    return await db.collection('wiki_items').insertOne(newItem);
  }
};

export const updateWorkItemStatus = async (id: string, toStatus: string, newRank: number, user: any) => {
  const db = await getDb();
  const now = new Date().toISOString();
  const userName = user?.name || 'Nexus System';
  
  const existing = await db.collection('wiki_items').findOne({ _id: new ObjectId(id) });
  if (!existing) return null;

  return await db.collection('wiki_items').updateOne(
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
