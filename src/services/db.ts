import clientPromise from '../lib/mongodb';
import { ObjectId } from 'mongodb';
import { WikiPage, WikiSpace, WikiTheme, WikiTemplate, CommentThread, CommentMessage, EventRecord, ReviewRecord, ReviewCycle, ReviewReviewer, FeedbackPackage, UserEventState, Bundle, Application, TaxonomyCategory, TaxonomyDocumentType, WorkItem, WorkItemType, WorkItemStatus, WorkItemActivity, Sprint, Milestone, Notification, ArchitectureDiagram, BusinessCapability, AppInterface, WikiAsset, BundleAssignment, AssignmentType } from '../types';

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
  cohereKey: '',
  providerToggles: {
    OPENAI: true,
    GEMINI: true,
    ANTHROPIC: false,
    HUGGINGFACE: false,
    COHERE: false
  },
  taskRouting: {
    wikiSummary: { provider: 'OPENAI', model: 'openaiModelDefault' },
    wikiImprove: { provider: 'OPENAI', model: 'openaiModelDefault' },
    wikiExpand: { provider: 'OPENAI', model: 'openaiModelDefault' },
    wikiDiagram: { provider: 'OPENAI', model: 'openaiModelDefault' },
    wikiQa: { provider: 'OPENAI', model: 'openaiModelDefault' },
    assetSummary: { provider: 'OPENAI', model: 'openaiModelDefault' },
    assetKeyDecisions: { provider: 'OPENAI', model: 'openaiModelDefault' },
    assetAssumptions: { provider: 'OPENAI', model: 'openaiModelDefault' },
    assetQa: { provider: 'OPENAI', model: 'openaiModelDefault' },
    terraformAnalysis: { provider: 'OPENAI', model: 'openaiModelHigh' },
    terraformDiagram: { provider: 'OPENAI', model: 'openaiModelHigh' }
  },
  retentionDays: {
    wikiQa: 30,
    assetQa: 30,
    assetAi: 30,
    auditLogs: 30
  },
  rateLimits: {
    perUserPerHour: 30
  }
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

  const providerToggles = doc?.providerToggles || defaultAiSettings.providerToggles;
  const taskRouting = doc?.taskRouting || defaultAiSettings.taskRouting;
  const retentionDays = doc?.retentionDays || defaultAiSettings.retentionDays;
  const rateLimits = doc?.rateLimits || defaultAiSettings.rateLimits;

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
      providerToggles,
      taskRouting,
      retentionDays,
      rateLimits,
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
    providerToggles: ai.providerToggles || defaultAiSettings.providerToggles,
    taskRouting: ai.taskRouting || defaultAiSettings.taskRouting,
    retentionDays: ai.retentionDays || defaultAiSettings.retentionDays,
    rateLimits: ai.rateLimits || defaultAiSettings.rateLimits,
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

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const ensureAdminIndexes = async (db: any) => {
  await db.collection('admins').createIndex({ userId: 1 }, { unique: true });
};

export const ensureUserIndexes = async (db: any) => {
  await db.collection('users').createIndex({ email: 1 }, { unique: true });
};

export const getAdminBootstrapEmails = () => {
  return new Set(
    (process.env.ADMIN_BOOTSTRAP_EMAILS || '')
      .split(',')
      .map((v) => v.trim().toLowerCase())
      .filter(Boolean)
  );
};

export const upsertAdmin = async (userId: string, createdBy: string = 'system') => {
  const db = await getDb();
  await ensureAdminIndexes(db);
  return await db.collection('admins').updateOne(
    { userId },
    { $setOnInsert: { userId, createdAt: new Date().toISOString(), createdBy } },
    { upsert: true }
  );
};

export const removeAdmin = async (userId: string) => {
  const db = await getDb();
  await ensureAdminIndexes(db);
  return await db.collection('admins').deleteOne({ userId });
};

export const isAdmin = async (userId: string) => {
  try {
    const db = await getDb();
    await ensureAdminIndexes(db);
    const record = await db.collection('admins').findOne({ userId });
    return Boolean(record);
  } catch {
    return false;
  }
};

const ensureBundleAssignmentIndexes = async (db: any) => {
  await db.collection('bundle_assignments').createIndex({ bundleId: 1, active: 1, assignmentType: 1 });
  await db.collection('bundle_assignments').createIndex({ userId: 1, active: 1, assignmentType: 1 });
  await db.collection('bundle_assignments').createIndex({ bundleId: 1, userId: 1, assignmentType: 1 }, { unique: true });
};

export const fetchBundleAssignments = async (filters: {
  bundleId?: string;
  userId?: string;
  assignmentType?: AssignmentType;
  active?: boolean;
}) => {
  try {
    const db = await getDb();
    await ensureBundleAssignmentIndexes(db);
    const query: any = {};
    if (filters.bundleId) query.bundleId = filters.bundleId;
    if (filters.userId) query.userId = filters.userId;
    if (filters.assignmentType) query.assignmentType = filters.assignmentType;
    if (typeof filters.active === 'boolean') query.active = filters.active;
    return await db.collection('bundle_assignments').find(query).sort({ updatedAt: -1 }).toArray();
  } catch {
    return [];
  }
};

export const upsertBundleAssignment = async (assignment: Partial<BundleAssignment>, userId?: string) => {
  const db = await getDb();
  await ensureBundleAssignmentIndexes(db);
  const now = new Date().toISOString();
  const bundleId = String(assignment.bundleId || '');
  const targetUserId = String(assignment.userId || '');
  const assignmentType = assignment.assignmentType as AssignmentType;
  if (!bundleId || !targetUserId || !assignmentType) {
    throw new Error('bundleId, userId, and assignmentType are required.');
  }
  return await db.collection('bundle_assignments').updateOne(
    { bundleId, userId: targetUserId, assignmentType },
    {
      $set: {
        bundleId,
        userId: targetUserId,
        assignmentType,
        active: assignment.active !== false,
        isPrimary: assignment.isPrimary || false,
        startAt: assignment.startAt || undefined,
        endAt: assignment.endAt || undefined,
        notes: assignment.notes || undefined,
        updatedAt: now
      },
      $setOnInsert: {
        createdAt: now,
        createdBy: userId || assignment.createdBy
      }
    },
    { upsert: true }
  );
};

export const updateBundleAssignment = async (id: string, updates: Partial<BundleAssignment>, userId?: string) => {
  const db = await getDb();
  await ensureBundleAssignmentIndexes(db);
  const now = new Date().toISOString();
  const setData: any = { updatedAt: now, updatedBy: userId };
  if (typeof updates.active === 'boolean') setData.active = updates.active;
  if (typeof updates.isPrimary === 'boolean') setData.isPrimary = updates.isPrimary;
  if (typeof updates.startAt !== 'undefined') setData.startAt = updates.startAt || undefined;
  if (typeof updates.endAt !== 'undefined') setData.endAt = updates.endAt || undefined;
  if (typeof updates.notes !== 'undefined') setData.notes = updates.notes || undefined;
  return await db.collection('bundle_assignments').updateOne(
    { _id: new ObjectId(id) },
    { $set: setData }
  );
};

export const fetchAssignedCmoReviewers = async (bundleId: string): Promise<ReviewReviewer[]> => {
  try {
    const db = await getDb();
    await ensureBundleAssignmentIndexes(db);
    const assignments = await db.collection('bundle_assignments').find({
      bundleId,
      active: true,
      assignmentType: 'assigned_cmo'
    }).toArray();
    const userIds = assignments.map((a: any) => String(a.userId));
    const users = await fetchUsersByIds(userIds);
    const userMap = new Map(users.map((u: any) => [String(u._id || u.id), u]));
    return userIds
      .map((id) => userMap.get(id))
      .filter(Boolean)
      .map((user: any) => ({
        userId: String(user._id || user.id),
        displayName: user.name || user.email || 'Reviewer',
        email: user.email
      }));
  } catch {
    return [];
  }
};

export const buildReviewCycle = async ({
  bundleId,
  cycleNumber,
  requestedBy,
  reviewers,
  status = 'requested',
  notes,
  dueAt
}: {
  bundleId: string;
  cycleNumber: number;
  requestedBy: { userId: string; displayName: string; email?: string };
  reviewers?: ReviewReviewer[];
  status?: ReviewCycle['status'];
  notes?: string;
  dueAt?: string;
}): Promise<ReviewCycle> => {
  const autoReviewers = reviewers && reviewers.length
    ? reviewers
    : (bundleId ? await fetchAssignedCmoReviewers(bundleId) : []);
  const cycleId = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : new ObjectId().toHexString();
  const now = new Date().toISOString();
  const defaultDueAt = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString();
  return {
    cycleId,
    number: cycleNumber,
    status,
    requestedBy,
    requestedAt: now,
    reviewers: autoReviewers,
    reviewerUserIds: autoReviewers.map((r) => r.userId),
    dueAt: dueAt || defaultDueAt,
    notes,
    correlationId: cycleId
  };
};

export const addReviewCycleAttachments = async ({
  review,
  cycleId,
  attachments
}: {
  review: ReviewRecord;
  cycleId: string;
  attachments: AttachmentRef[];
}) => {
  const cycles = (review.cycles || []).map((cycle) => {
    if (cycle.cycleId !== cycleId) return cycle;
    const existing = cycle.feedbackAttachments || [];
    return {
      ...cycle,
      feedbackAttachments: [...existing, ...attachments]
    };
  });
  const updated: ReviewRecord = {
    ...review,
    cycles,
    updatedAt: new Date().toISOString()
  };
  await saveReview(updated);
  return updated;
};

export const appendReviewCycle = async ({
  review,
  bundleId,
  requestedBy,
  notes,
  dueAt,
  reviewers
}: {
  review: ReviewRecord;
  bundleId: string;
  requestedBy: { userId: string; displayName: string; email?: string };
  notes?: string;
  dueAt?: string;
  reviewers?: ReviewReviewer[];
}) => {
  const nextNumber = (review.cycles?.length || 0) + 1;
  const cycle = await buildReviewCycle({
    bundleId,
    cycleNumber: nextNumber,
    requestedBy,
    notes,
    dueAt,
    reviewers
  });
  const updated: ReviewRecord = {
    ...review,
    status: 'active',
    currentCycleId: cycle.cycleId,
    currentCycleStatus: cycle.status,
    currentDueAt: cycle.dueAt,
    currentReviewerUserIds: cycle.reviewerUserIds,
    currentRequestedAt: cycle.requestedAt,
    currentRequestedByUserId: cycle.requestedBy?.userId,
    cycles: [...(review.cycles || []), cycle],
    updatedAt: new Date().toISOString()
  };
  await saveReview(updated);
  return { review: updated, cycle };
};

export const updateReviewCycleStatus = async ({
  review,
  cycleId,
  status,
  notes,
  dueAt,
  actor
}: {
  review: ReviewRecord;
  cycleId: string;
  status: ReviewCycle['status'];
  notes?: string;
  dueAt?: string;
  actor?: { userId: string; displayName: string; email?: string };
}) => {
  const now = new Date().toISOString();
  const cycles = (review.cycles || []).map((cycle) => {
    if (cycle.cycleId !== cycleId) return cycle;
    const updated: ReviewCycle = {
      ...cycle,
      status,
      notes: notes ?? cycle.notes,
      dueAt: dueAt ?? cycle.dueAt,
      completedAt: status === 'feedback_sent' ? now : cycle.completedAt,
      inReviewAt: status === 'in_review' ? cycle.inReviewAt || now : cycle.inReviewAt,
      inReviewBy: status === 'in_review' ? cycle.inReviewBy || actor : cycle.inReviewBy,
      feedbackSentAt: status === 'feedback_sent' ? now : cycle.feedbackSentAt,
      feedbackSentBy: status === 'feedback_sent' ? actor : cycle.feedbackSentBy,
      closedAt: status === 'closed' ? now : cycle.closedAt,
      closedBy: status === 'closed' ? actor : cycle.closedBy
    };
    return updated;
  });
  const currentCycle = cycles.find((cycle) => cycle.cycleId === review.currentCycleId);
  const hasOpenCycle = cycles.some((cycle) => cycle.status !== 'closed');
  const updated: ReviewRecord = {
    ...review,
    status: status === 'closed' ? (hasOpenCycle ? 'active' : 'closed') : review.status,
    currentCycleStatus: currentCycle?.status || review.currentCycleStatus,
    currentDueAt: currentCycle?.dueAt || review.currentDueAt,
    currentReviewerUserIds: currentCycle?.reviewerUserIds || review.currentReviewerUserIds,
    currentRequestedAt: currentCycle?.requestedAt || review.currentRequestedAt,
    currentRequestedByUserId: currentCycle?.requestedBy?.userId || review.currentRequestedByUserId,
    cycles,
    updatedAt: now
  };
  await saveReview(updated);
  return updated;
};

export const updateReviewCycleNote = async ({
  review,
  cycleId,
  reviewerNote,
  vendorResponse
}: {
  review: ReviewRecord;
  cycleId: string;
  reviewerNote?: { body: string; createdAt: string; createdBy: CommentAuthor };
  vendorResponse?: { body: string; submittedAt: string; submittedBy: CommentAuthor };
}) => {
  const now = new Date().toISOString();
  const cycles = (review.cycles || []).map((cycle) => {
    if (cycle.cycleId !== cycleId) return cycle;
    return {
      ...cycle,
      reviewerNote: reviewerNote ?? cycle.reviewerNote,
      vendorResponse: vendorResponse ?? cycle.vendorResponse
    };
  });
  const currentCycle = cycles.find((cycle) => cycle.cycleId === review.currentCycleId);
  const updated: ReviewRecord = {
    ...review,
    currentCycleStatus: currentCycle?.status || review.currentCycleStatus,
    currentDueAt: currentCycle?.dueAt || review.currentDueAt,
    currentReviewerUserIds: currentCycle?.reviewerUserIds || review.currentReviewerUserIds,
    currentRequestedAt: currentCycle?.requestedAt || review.currentRequestedAt,
    currentRequestedByUserId: currentCycle?.requestedBy?.userId || review.currentRequestedByUserId,
    cycles,
    updatedAt: now
  };
  await saveReview(updated);
  return updated;
};

export const fetchFeedbackPackages = async (resourceType: string, resourceId: string) => {
  try {
    const db = await getDb();
    await ensureFeedbackPackageIndexes(db);
    return await db.collection('feedback_packages').find({ 'resource.type': resourceType, 'resource.id': resourceId }).sort({ createdAt: -1 }).toArray();
  } catch {
    return [];
  }
};

export const createFeedbackPackage = async (pkg: Omit<FeedbackPackage, '_id'>) => {
  const db = await getDb();
  await ensureFeedbackPackageIndexes(db);
  return await db.collection('feedback_packages').insertOne(pkg);
};

export const closeFeedbackPackage = async (id: string, userId: string) => {
  const db = await getDb();
  await ensureFeedbackPackageIndexes(db);
  return await db.collection('feedback_packages').updateOne(
    { _id: new ObjectId(id) },
    { $set: { status: 'closed', updatedAt: new Date().toISOString(), updatedBy: userId } }
  );
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

export const fetchWikiPageById = async (id: string) => {
  try {
    const db = await getDb();
    if (!ObjectId.isValid(id)) return await db.collection('wiki_pages').findOne({ id });
    return await db.collection('wiki_pages').findOne({ _id: new ObjectId(id) });
  } catch {
    return null;
  }
};

export const fetchWikiAssets = async () => {
  try {
    const db = await getDb();
    await ensureWikiAssetIndexes(db);
    return await db.collection('wiki_assets').find({}).toArray();
  } catch { return []; }
};

export const fetchWikiAssetById = async (id: string) => {
  try {
    const db = await getDb();
    await ensureWikiAssetIndexes(db);
    if (!ObjectId.isValid(id)) return await db.collection('wiki_assets').findOne({ id });
    return await db.collection('wiki_assets').findOne({ _id: new ObjectId(id) });
  } catch {
    return null;
  }
};

const ensureWikiAiInsightIndexes = async (db: any) => {
  await db.collection('wiki_ai_insights').createIndex({ targetType: 1, targetId: 1, type: 1, createdAt: -1 });
};

export const saveWikiAiInsight = async ({
  targetId,
  targetType,
  type,
  content
}: {
  targetId: string;
  targetType: 'page' | 'asset';
  type: string;
  content: string;
}) => {
  const db = await getDb();
  await ensureWikiAiInsightIndexes(db);
  const now = new Date().toISOString();
  return await db.collection('wiki_ai_insights').insertOne({
    targetId: String(targetId),
    targetType,
    type,
    content,
    createdAt: now
  });
};

export const fetchWikiAiInsights = async (targetId: string, targetType: 'page' | 'asset') => {
  try {
    const db = await getDb();
    await ensureWikiAiInsightIndexes(db);
    const items = await db
      .collection('wiki_ai_insights')
      .find({ targetId: String(targetId), targetType })
      .sort({ createdAt: -1 })
      .toArray();
    const latest: Record<string, { content: string; generatedAt: string }> = {};
    for (const item of items) {
      if (!latest[item.type]) {
        latest[item.type] = { content: item.content, generatedAt: item.createdAt };
      }
    }
    return latest;
  } catch {
    return {};
  }
};

export const clearWikiAiInsights = async (targetId: string, targetType: 'page' | 'asset') => {
  const db = await getDb();
  await ensureWikiAiInsightIndexes(db);
  return await db.collection('wiki_ai_insights').deleteMany({ targetId: String(targetId), targetType });
};

const ensureWikiAssetIndexes = async (db: any) => {
  await db.collection('wiki_assets').createIndex({ artifactKind: 1, bundleId: 1, applicationId: 1, documentTypeId: 1 });
};

export const saveWikiAsset = async (asset: Partial<WikiAsset>) => {
  const db = await getDb();
  await ensureWikiAssetIndexes(db);
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
      artifactKind: data.artifactKind || 'primary',
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

const ensureWikiQaIndexes = async (db: any) => {
  await db.collection('wiki_qa_history').createIndex({ targetType: 1, targetId: 1, createdAt: -1 });
  await db.collection('wiki_qa_history').createIndex({ targetType: 1, targetIdStr: 1, createdAt: -1 });
  await db.collection('wiki_qa_history').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
};

const ensureWikiAssetAiIndexes = async (db: any) => {
  await db.collection('wiki_asset_ai_history').createIndex({ assetId: 1, createdAt: -1 });
  await db.collection('wiki_asset_ai_history').createIndex({ assetIdStr: 1, createdAt: -1 });
  await db.collection('wiki_asset_ai_history').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
};

export const saveWikiQaHistory = async ({
  targetId,
  targetType = 'page',
  ttlDays = 30,
  question,
  answer,
  provider,
  model,
  userEmail
}: {
  targetId: string;
  targetType?: 'page' | 'asset';
  ttlDays?: number;
  question: string;
  answer: string;
  provider: string;
  model?: string;
  userEmail?: string;
}) => {
  const db = await getDb();
  await ensureWikiQaIndexes(db);
  const isValidId = ObjectId.isValid(targetId);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 1000 * 60 * 60 * 24 * Math.max(ttlDays, 1));
  return await db.collection('wiki_qa_history').insertOne({
    targetType,
    targetId: isValidId ? new ObjectId(targetId) : undefined,
    targetIdStr: isValidId ? undefined : targetId,
    question,
    answer,
    provider,
    model,
    userEmail,
    createdAt: now.toISOString(),
    expiresAt
  });
};

export const fetchWikiQaHistory = async (targetId: string, targetType: 'page' | 'asset' = 'page', limit: number = 10) => {
  try {
    const db = await getDb();
    await ensureWikiQaIndexes(db);
    const isValidId = ObjectId.isValid(targetId);
    return await db
      .collection('wiki_qa_history')
      .find(isValidId ? { targetType, targetId: new ObjectId(targetId) } : { targetType, targetIdStr: targetId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray();
  } catch { return []; }
};

export const saveWikiAssetAiHistory = async ({
  assetId,
  task,
  result,
  provider,
  model,
  userEmail,
  ttlDays = 30
}: {
  assetId: string;
  task: string;
  result: string;
  provider: string;
  model?: string;
  userEmail?: string;
  ttlDays?: number;
}) => {
  const db = await getDb();
  await ensureWikiAssetAiIndexes(db);
  const isValidId = ObjectId.isValid(assetId);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 1000 * 60 * 60 * 24 * Math.max(ttlDays, 1));
  return await db.collection('wiki_asset_ai_history').insertOne({
    assetId: isValidId ? new ObjectId(assetId) : undefined,
    assetIdStr: isValidId ? undefined : assetId,
    task,
    result,
    provider,
    model,
    userEmail,
    createdAt: now.toISOString(),
    expiresAt
  });
};

export const fetchWikiAssetAiHistory = async (assetId: string, limit: number = 10) => {
  try {
    const db = await getDb();
    await ensureWikiAssetAiIndexes(db);
    const isValidId = ObjectId.isValid(assetId);
    return await db
      .collection('wiki_asset_ai_history')
      .find(isValidId ? { assetId: new ObjectId(assetId) } : { assetIdStr: assetId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray();
  } catch { return []; }
};

const ensureAiAuditIndexes = async (db: any) => {
  await db.collection('ai_audit_logs').createIndex({ createdAt: -1 });
  await db.collection('ai_audit_logs').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
};

export const saveAiAuditLog = async ({
  task,
  provider,
  model,
  targetType,
  targetId,
  success,
  error,
  latencyMs,
  identity,
  ttlDays = 30
}: {
  task: string;
  provider: string;
  model?: string;
  targetType?: string;
  targetId?: string;
  success: boolean;
  error?: string;
  latencyMs?: number;
  identity?: string;
  ttlDays?: number;
}) => {
  const db = await getDb();
  await ensureAiAuditIndexes(db);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 1000 * 60 * 60 * 24 * Math.max(ttlDays, 1));
  return await db.collection('ai_audit_logs').insertOne({
    task,
    provider,
    model,
    targetType,
    targetId,
    success,
    error,
    latencyMs,
    identity,
    createdAt: now.toISOString(),
    expiresAt
  });
};

const ensureAiRateLimitIndexes = async (db: any) => {
  await db.collection('ai_rate_limits').createIndex({ identity: 1, windowStart: 1 }, { unique: true });
  await db.collection('ai_rate_limits').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
};

export const checkAndIncrementAiRateLimit = async (identity: string, limit: number) => {
  const db = await getDb();
  await ensureAiRateLimitIndexes(db);
  const now = new Date();
  const windowStart = new Date(now);
  windowStart.setMinutes(0, 0, 0);
  const expiresAt = new Date(windowStart.getTime() + 1000 * 60 * 60 * 2);
  const key = { identity, windowStart: windowStart.toISOString() };

  const result = await db.collection('ai_rate_limits').findOneAndUpdate(
    key,
    {
      $inc: { count: 1 },
      $setOnInsert: { createdAt: now.toISOString(), expiresAt }
    },
    { upsert: true, returnDocument: 'after' }
  );

  const count = result?.value?.count || 1;
  return count <= limit;
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
  if (_id) {
    const idValue = typeof _id === 'string' ? _id : String(_id);
    if (ObjectId.isValid(idValue)) {
      return await db.collection('wiki_themes').updateOne({ _id: new ObjectId(idValue) }, { $set: data });
    }
  }
  if (data.key) {
    return await db.collection('wiki_themes').updateOne(
      { key: data.key },
      { $set: data },
      { upsert: true }
    );
  }
  return await db.collection('wiki_themes').insertOne(data);
};

export const deleteWikiTheme = async (id: string) => {
  const db = await getDb();
  return await db.collection('wiki_themes').deleteOne({ _id: new ObjectId(id) });
};

const ensureWikiTemplateIndexes = async (db: any) => {
  await db.collection('wiki_templates').createIndex({ documentTypeId: 1, isActive: 1 });
  await db.collection('wiki_templates').createIndex(
    { documentTypeId: 1, isDefault: 1 },
    { unique: true, partialFilterExpression: { isDefault: true } }
  );
};

export const fetchWikiTemplates = async ({
  documentTypeId,
  activeOnly = false
}: {
  documentTypeId?: string;
  activeOnly?: boolean;
}) => {
  try {
    const db = await getDb();
    await ensureWikiTemplateIndexes(db);
    const query: any = {};
    if (documentTypeId) query.documentTypeId = String(documentTypeId);
    if (activeOnly) query.isActive = true;
    return await db.collection('wiki_templates').find(query).sort({ isDefault: -1, updatedAt: -1, name: 1 }).toArray();
  } catch {
    return [];
  }
};

export const saveWikiTemplate = async (template: Partial<WikiTemplate>, user?: any) => {
  const db = await getDb();
  await ensureWikiTemplateIndexes(db);
  const { _id, ...data } = template;
  const now = new Date().toISOString();
  const docTypeId = data.documentTypeId ? String(data.documentTypeId) : undefined;
  const payload = {
    ...data,
    documentTypeId: docTypeId,
    updatedAt: now,
    updatedBy: user?.name || data.updatedBy
  };

  if (payload.isDefault && docTypeId) {
    const excludeId = _id && ObjectId.isValid(String(_id)) ? new ObjectId(String(_id)) : null;
    await db.collection('wiki_templates').updateMany(
      { documentTypeId: docTypeId, isDefault: true, ...(excludeId ? { _id: { $ne: excludeId } } : {}) },
      { $set: { isDefault: false, updatedAt: now } }
    );
  }

  if (_id && ObjectId.isValid(String(_id))) {
    return await db.collection('wiki_templates').updateOne(
      { _id: new ObjectId(String(_id)) },
      { $set: payload }
    );
  }

  return await db.collection('wiki_templates').insertOne({
    ...payload,
    isActive: payload.isActive ?? true,
    isDefault: payload.isDefault ?? false,
    createdAt: now,
    createdBy: user?.name || data.createdBy
  });
};

export const deactivateWikiTemplate = async (id: string, user?: any) => {
  const db = await getDb();
  await ensureWikiTemplateIndexes(db);
  return await db.collection('wiki_templates').updateOne(
    { _id: new ObjectId(id) },
    { $set: { isActive: false, updatedAt: new Date().toISOString(), updatedBy: user?.name } }
  );
};

const ensureCommentIndexes = async (db: any) => {
  await db.collection('comment_threads').createIndex({ 'resource.type': 1, 'resource.id': 1, lastActivityAt: -1 });
  await db.collection('comment_threads').createIndex({ reviewId: 1, status: 1 });
  await db.collection('comment_threads').createIndex({ reviewId: 1, reviewCycleId: 1, lastActivityAt: -1 });
  await db.collection('comment_threads').createIndex({ 'resource.type': 1, 'resource.id': 1, reviewCycleId: 1, createdAt: -1 });
  await db.collection('comment_messages').createIndex({ threadId: 1, createdAt: 1 });
  await db.collection('comment_messages').createIndex({ body: 'text' });
};

const ensureReviewIndexes = async (db: any) => {
  await db.collection('reviews').createIndex({ 'resource.type': 1, 'resource.id': 1 }, { unique: true });
  await db.collection('reviews').createIndex({ status: 1, createdAt: -1 });
  await db.collection('reviews').createIndex({ 'resource.bundleId': 1, currentCycleStatus: 1, updatedAt: -1 });
  await db.collection('reviews').createIndex({ currentReviewerUserIds: 1, currentCycleStatus: 1, currentDueAt: 1 });
  await db.collection('reviews').createIndex({ currentRequestedByUserId: 1, currentRequestedAt: -1 });
  await db.collection('reviews').createIndex({ 'resource.title': 'text' });
};

const ensureFeedbackPackageIndexes = async (db: any) => {
  await db.collection('feedback_packages').createIndex({ 'resource.type': 1, 'resource.id': 1, createdAt: -1 });
  await db.collection('feedback_packages').createIndex({ status: 1, createdAt: -1 });
};

const ensureEventIndexes = async (db: any) => {
  await db.collection('events').createIndex({ ts: -1 });
  await db.collection('events').createIndex({ type: 1, ts: -1 });
  await db.collection('events').createIndex({ 'actor.userId': 1, ts: -1 });
  await db.collection('events').createIndex({ 'resource.type': 1, 'resource.id': 1, ts: -1 });
  await db.collection('events').createIndex({ ts: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 60 });
};

const ensureUserEventStateIndexes = async (db: any) => {
  await db.collection('user_event_state').createIndex({ userId: 1 }, { unique: true });
};

export const emitEvent = async (event: Omit<EventRecord, '_id'>) => {
  const db = await getDb();
  await ensureEventIndexes(db);
  const typePattern = /^[a-z0-9]+\.[a-z0-9]+\.[a-z0-9]+$/;
  if (!typePattern.test(event.type)) {
    throw new Error(`Invalid event type "${event.type}". Expected <module>.<entity>.<verb>.`);
  }
  const tsValue = event.ts ? new Date(event.ts) : new Date();
  return await db.collection('events').insertOne({
    ...event,
    ts: tsValue
  });
};

export const fetchEvents = async ({
  limit = 200,
  type,
  resourceType,
  resourceId,
  actorId,
  since,
  mentionUserId
}: {
  limit?: number;
  type?: string;
  resourceType?: string;
  resourceId?: string;
  actorId?: string;
  since?: string;
  mentionUserId?: string;
}) => {
  try {
    const db = await getDb();
    await ensureEventIndexes(db);
    const query: any = {};
    if (type) query.type = type;
    if (resourceType) query['resource.type'] = resourceType;
    if (resourceId) query['resource.id'] = resourceId;
    if (actorId) query['actor.userId'] = actorId;
    if (mentionUserId) query['payload.mentionedUserId'] = mentionUserId;
    if (since) query.ts = { $gt: new Date(since) };
    return await db.collection('events').find(query).sort({ ts: -1 }).limit(limit).toArray();
  } catch {
    return [];
  }
};

export const getUserEventState = async (userId: string) => {
  try {
    const db = await getDb();
    await ensureUserEventStateIndexes(db);
    return await db.collection('user_event_state').findOne({ userId });
  } catch {
    return null;
  }
};

const makeCommentStateKey = (resourceType: string, resourceId: string) => {
  return Buffer.from(`${resourceType}::${resourceId}`).toString('base64url');
};

export const setUserEventState = async (userId: string, lastSeenAt: string) => {
  const db = await getDb();
  await ensureUserEventStateIndexes(db);
  return await db.collection('user_event_state').updateOne(
    { userId },
    { $set: { userId, lastSeenAt } },
    { upsert: true }
  );
};

export const getCommentLastSeen = async (userId: string, resourceType: string, resourceId: string) => {
  try {
    const state = await getUserEventState(userId);
    if (!state?.commentLastSeen) return null;
    const key = makeCommentStateKey(resourceType, resourceId);
    return state.commentLastSeen[key] || null;
  } catch {
    return null;
  }
};

export const setCommentLastSeen = async (
  userId: string,
  resourceType: string,
  resourceId: string,
  lastSeenAt: string
) => {
  const db = await getDb();
  await ensureUserEventStateIndexes(db);
  const key = makeCommentStateKey(resourceType, resourceId);
  return await db.collection('user_event_state').updateOne(
    { userId },
    { $set: { userId, [`commentLastSeen.${key}`]: lastSeenAt } },
    { upsert: true }
  );
};

export const fetchCommentUnreadCount = async (userId: string, resourceType: string, resourceId: string) => {
  try {
    const db = await getDb();
    await ensureCommentIndexes(db);
    const lastSeenAt = await getCommentLastSeen(userId, resourceType, resourceId);
    const query: any = { 'resource.type': resourceType, 'resource.id': resourceId };
    if (lastSeenAt) query.lastActivityAt = { $gt: lastSeenAt };
    return await db.collection('comment_threads').countDocuments(query);
  } catch {
    return 0;
  }
};

export const fetchUnreadEventsCount = async (userId: string) => {
  try {
    const db = await getDb();
    await ensureEventIndexes(db);
    const state = await getUserEventState(userId);
    const since = state?.lastSeenAt;
    const query: any = since ? { ts: { $gt: new Date(since) } } : {};
    return await db.collection('events').countDocuments(query);
  } catch {
    return 0;
  }
};

export const fetchCommentThreads = async (resourceType: string, resourceId: string) => {
  try {
    const db = await getDb();
    await ensureCommentIndexes(db);
    return await db
      .collection('comment_threads')
      .find({ 'resource.type': resourceType, 'resource.id': resourceId })
      .sort({ lastActivityAt: -1 })
      .toArray();
  } catch {
    return [];
  }
};

export const createCommentThread = async ({
  resource,
  anchor,
  body,
  author,
  mentions = [],
  reviewId,
  reviewCycleId
}: {
  resource: { type: string; id: string; title?: string };
  anchor?: { kind: string; data: any };
  body: string;
  author: { userId: string; displayName: string; email?: string };
  mentions?: string[];
  reviewId?: string;
  reviewCycleId?: string;
}) => {
  const db = await getDb();
  await ensureCommentIndexes(db);
  const now = new Date().toISOString();
  const thread: Partial<CommentThread> = {
    resource: { type: resource.type, id: resource.id },
    anchor,
    status: 'open',
    createdBy: author,
    createdAt: now,
    lastActivityAt: now,
    messageCount: 1,
    participants: [author.userId],
    reviewId,
    reviewCycleId
  };
  const threadResult = await db.collection('comment_threads').insertOne(thread);
  const message: Partial<CommentMessage> = {
    threadId: String(threadResult.insertedId),
    author,
    body,
    createdAt: now,
    mentions
  };
  await db.collection('comment_messages').insertOne(message);
  return { threadId: String(threadResult.insertedId), thread, message };
};

export const fetchCommentMessages = async (threadId: string) => {
  try {
    const db = await getDb();
    await ensureCommentIndexes(db);
    return await db.collection('comment_messages').find({ threadId: String(threadId) }).sort({ createdAt: 1 }).toArray();
  } catch {
    return [];
  }
};

export const fetchCommentThreadById = async (threadId: string) => {
  try {
    const db = await getDb();
    await ensureCommentIndexes(db);
    return await db.collection('comment_threads').findOne({ _id: new ObjectId(threadId) });
  } catch {
    return null;
  }
};

export const addCommentMessage = async ({
  threadId,
  body,
  author,
  mentions = []
}: {
  threadId: string;
  body: string;
  author: { userId: string; displayName: string; email?: string };
  mentions?: string[];
}) => {
  const db = await getDb();
  await ensureCommentIndexes(db);
  const now = new Date().toISOString();
  const message: Partial<CommentMessage> = {
    threadId: String(threadId),
    author,
    body,
    createdAt: now,
    mentions
  };
  await db.collection('comment_messages').insertOne(message);
  await db.collection('comment_threads').updateOne(
    { _id: new ObjectId(threadId) },
    {
      $set: { lastActivityAt: now },
      $inc: { messageCount: 1 },
      $addToSet: { participants: author.userId }
    }
  );
  return message;
};

export const updateCommentThreadStatus = async (threadId: string, status: 'open' | 'resolved') => {
  const db = await getDb();
  await ensureCommentIndexes(db);
  return await db.collection('comment_threads').updateOne(
    { _id: new ObjectId(threadId) },
    { $set: { status, lastActivityAt: new Date().toISOString() } }
  );
};

export const fetchReview = async (resourceType: string, resourceId: string) => {
  try {
    const db = await getDb();
    await ensureReviewIndexes(db);
    return await db.collection('reviews').findOne({ 'resource.type': resourceType, 'resource.id': resourceId });
  } catch {
    return null;
  }
};

export const fetchReviewById = async (reviewId: string) => {
  try {
    const db = await getDb();
    await ensureReviewIndexes(db);
    if (!ObjectId.isValid(reviewId)) return null;
    return await db.collection('reviews').findOne({ _id: new ObjectId(reviewId) });
  } catch {
    return null;
  }
};

export const saveReview = async (review: Partial<ReviewRecord>) => {
  const db = await getDb();
  await ensureReviewIndexes(db);
  const now = new Date().toISOString();
  if (review._id && ObjectId.isValid(review._id as string)) {
    const { _id, ...data } = review;
    return await db.collection('reviews').updateOne(
      { _id: new ObjectId(_id) },
      { $set: { ...data, updatedAt: now } }
    );
  }
  return await db.collection('reviews').updateOne(
    { 'resource.type': review.resource?.type, 'resource.id': review.resource?.id },
    {
      $set: {
        resource: review.resource,
        status: review.status || 'active',
        createdBy: review.createdBy,
        currentCycleId: review.currentCycleId,
        currentCycleStatus: review.currentCycleStatus,
        currentDueAt: review.currentDueAt,
        currentReviewerUserIds: review.currentReviewerUserIds,
        currentRequestedAt: review.currentRequestedAt,
        currentRequestedByUserId: review.currentRequestedByUserId,
        cycles: review.cycles || [],
        resourceVersion: review.resourceVersion,
        updatedAt: now
      },
      $setOnInsert: { createdAt: now }
    },
    { upsert: true }
  );
};

export const emitReviewCycleEvent = async ({
  type,
  actor,
  resource,
  cycle
}: {
  type:
    | 'review.cycle.requested'
    | 'review.cycle.inreview'
    | 'review.cycle.feedbacksent'
    | 'review.cycle.resubmitted'
    | 'review.cycle.vendoraddressing'
    | 'review.cycle.closed';
  actor: { userId: string; displayName: string; email?: string };
  resource: { type: string; id: string; title?: string };
  cycle: { cycleId: string; number: number; status: string };
}) => {
  return await emitEvent({
    ts: new Date().toISOString(),
    type,
    actor,
    resource,
    payload: {
      reviewCycleId: cycle.cycleId,
      cycleNumber: cycle.number,
      cycleStatus: cycle.status
    },
    correlationId: cycle.cycleId
  });
};

export const ensureInReview = async ({
  reviewId,
  cycleId,
  actor
}: {
  reviewId: string;
  cycleId: string;
  actor: { userId: string; displayName: string; email?: string };
}) => {
  const review = await fetchReviewById(reviewId);
  if (!review) return null;
  const cycle = (review.cycles || []).find((c) => c.cycleId === cycleId);
  if (!cycle || cycle.status !== 'requested') return review;
  const updated = await updateReviewCycleStatus({
    review,
    cycleId,
    status: 'in_review',
    actor
  });
  await emitReviewCycleEvent({
    type: 'review.cycle.inreview',
    actor,
    resource: { type: review.resource.type, id: review.resource.id, title: review.resource.title },
    cycle: { cycleId: cycle.cycleId, number: cycle.number, status: 'in_review' }
  });
  return updated;
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

let warnedLegacyWorkItems = false;
const warnLegacyWorkItems = async (db: any) => {
  if (warnedLegacyWorkItems) return;
  warnedLegacyWorkItems = true;
  try {
    const legacyCount = await db.collection('work_items').countDocuments({}, { limit: 1 });
    if (legacyCount > 0) {
      console.warn(
        'Legacy collection work_items contains data. Work Items now use workitems; consider migrating.'
      );
    }
  } catch {
    // Best-effort warning only.
  }
};

const ensureWorkItemsIndexes = async (db: any) => {
  await db.collection('workitems').createIndex({ bundleId: 1 });
  await db.collection('workitems').createIndex({ applicationId: 1 });
  await db.collection('workitems').createIndex({ status: 1, updatedAt: -1 });
  await db.collection('workitems').createIndex({ assignedTo: 1, updatedAt: -1 });
  await db.collection('workitems').createIndex({ parentId: 1 });
  await db.collection('workitems').createIndex({ rank: 1 });
  await db.collection('workitems').createIndex({ key: 1 }, { unique: false });
};

let warnedLegacySprints = false;
const warnLegacySprints = async (db: any) => {
  if (warnedLegacySprints) return;
  warnedLegacySprints = true;
  try {
    const legacyCount = await db.collection('sprints').countDocuments({}, { limit: 1 });
    if (legacyCount > 0) {
      console.warn(
        'Legacy collection sprints contains data. Work Items now use workitems_sprints; consider migrating.'
      );
    }
  } catch {
    // Best-effort warning only.
  }
};

const normalizeWorkItemRanks = async (
  db: any,
  scope: { status?: string; bundleId?: string; applicationId?: string; sprintId?: string }
) => {
  const query: any = {};
  if (scope.status) query.status = scope.status;
  if (scope.bundleId) query.bundleId = scope.bundleId;
  if (scope.applicationId) query.applicationId = scope.applicationId;
  if (scope.sprintId !== undefined) query.sprintId = scope.sprintId;

  const items = await db
    .collection('workitems')
    .find(query)
    .sort({ rank: 1, createdAt: -1 })
    .limit(1000)
    .toArray();

  if (items.length < 2) return;

  let needsNormalize = false;
  let lastRank = 0;
  for (const item of items) {
    const rank = typeof item.rank === 'number' ? item.rank : 0;
    if (!rank) { needsNormalize = true; break; }
    if (rank <= lastRank || rank - lastRank < 2) { needsNormalize = true; break; }
    lastRank = rank;
  }

  if (lastRank > 1_000_000_000) needsNormalize = true;
  if (!needsNormalize) return;

  const bulk = items.map((item: any, idx: number) => ({
    updateOne: {
      filter: { _id: item._id },
      update: { $set: { rank: (idx + 1) * 1000 } }
    }
  }));

  await db.collection('workitems').bulkWrite(bulk, { ordered: false });
};

export const fetchWorkItems = async (filters: any) => {
  try {
    const db = await getDb();
    await warnLegacyWorkItems(db);
    await ensureWorkItemsIndexes(db);
    const query: any = {};
    const andClauses: any[] = [];
    const orClauses: any[] = [];
    let sort: any = { rank: 1, createdAt: -1 };

    if (!filters.includeArchived) {
      andClauses.push({ $or: [{ isArchived: { $exists: false } }, { isArchived: false }] });
    }
    
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
      orClauses.push({ milestoneIds: msRegex }, { milestoneId: msRegex });
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
          orClauses.push(
            { status: WorkItemStatus.BLOCKED },
            { isFlagged: true }
          );
          break;
      }
    }
    
    if (filters.q) {
      orClauses.push(
        { title: { $regex: filters.q, $options: 'i' } },
        { key: { $regex: filters.q, $options: 'i' } }
      );
    }

    if (filters.types) {
      const types = String(filters.types).split(',').filter(Boolean);
      if (types.length) andClauses.push({ type: { $in: types } });
    }

    if (filters.priorities) {
      const priorities = String(filters.priorities).split(',').filter(Boolean);
      if (priorities.length) andClauses.push({ priority: { $in: priorities } });
    }

    if (filters.health) {
      const health = String(filters.health).split(',').filter(Boolean);
      if (health.includes('FLAGGED')) andClauses.push({ isFlagged: true });
      if (health.includes('BLOCKED')) {
        orClauses.push({ status: WorkItemStatus.BLOCKED }, { 'links.type': 'IS_BLOCKED_BY' });
      }
    }

    if (orClauses.length) andClauses.push({ $or: orClauses });
    if (andClauses.length) query.$and = andClauses;
    
    return await db.collection('workitems').find(query).sort(sort).toArray();
  } catch { return []; }
};

export const fetchWorkItemById = async (id: string) => {
  try {
    const db = await getDb();
    await warnLegacyWorkItems(db);
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

export const fetchWorkItemByKeyOrId = async (input: string) => {
  try {
    const db = await getDb();
    await warnLegacyWorkItems(db);
    const key = String(input).trim();
    if (!key) return null;
    if (ObjectId.isValid(key)) {
      return await db.collection('workitems').findOne({
        $or: [{ _id: new ObjectId(key) }, { id: key }, { key }]
      });
    }
    return await db.collection('workitems').findOne({
      $or: [{ key: key.toUpperCase() }, { key }, { id: key }]
    });
  } catch {
    return null;
  }
};

export const saveWorkItem = async (item: Partial<WorkItem>, user?: any) => {
  const db = await getDb();
  await warnLegacyWorkItems(db);
  await ensureWorkItemsIndexes(db);
  const { _id, ...data } = item;
  const now = new Date().toISOString();
  const userName = user?.name || 'Nexus System';
  const actor = {
    userId: String(user?.id || user?.userId || user?.email || userName),
    displayName: String(user?.name || user?.displayName || userName),
    email: user?.email ? String(user.email) : undefined
  };

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

    const updateResult = await db.collection('workitems').updateOne(
      { _id: new ObjectId(_id) },
      { $set: finalSet, $push: finalPush }
    );

    if (activities.length > 0) {
      for (const act of activities) {
        try {
          const type =
            act.action === 'CHANGED_STATUS' ? 'workitems.item.statuschanged' :
            act.action === 'IMPEDIMENT_RAISED' ? 'workitems.item.impedimentraised' :
            act.action === 'IMPEDIMENT_CLEARED' ? 'workitems.item.impedimentcleared' :
            act.action === 'WORK_LOGGED' ? 'workitems.item.worklogged' :
            act.action === 'AI_REFINEMENT_COMMITTED' ? 'workitems.item.airefinement' :
            act.action === 'CHECKLIST_UPDATED' ? 'workitems.item.checklistupdated' :
            'workitems.item.updated';
          await emitEvent({
            ts: now,
            type,
            actor,
            resource: { type: 'workitems.item', id: String(existing._id || existing.id || _id), title: existing.title },
            context: { bundleId: existing.bundleId, appId: existing.applicationId },
            payload: { field: act.field, from: act.from, to: act.to }
          });
        } catch {}
      }
    }

    if (data.rank !== undefined) {
      try {
        await normalizeWorkItemRanks(db, {
          status: (data.status as string) || existing.status,
          bundleId: (data.bundleId as string) || existing.bundleId,
          applicationId: (data.applicationId as string) || existing.applicationId,
          sprintId: (data.sprintId as string) ?? existing.sprintId
        });
      } catch {}
    }

    return updateResult;
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
    const result = await db.collection('workitems').insertOne(newItem);
    try {
      await emitEvent({
        ts: now,
        type: 'workitems.item.created',
        actor,
        resource: { type: 'workitems.item', id: String(result.insertedId), title: newItem.title },
        context: { bundleId: newItem.bundleId, appId: newItem.applicationId }
      });
    } catch {}
    return result;
  }
};

export const updateWorkItemStatus = async (id: string, toStatus: string, newRank: number, user: any) => {
  const db = await getDb();
  await warnLegacyWorkItems(db);
  const now = new Date().toISOString();
  const userName = user?.name || 'Nexus System';
  const actor = {
    userId: String(user?.id || user?.userId || user?.email || userName),
    displayName: String(user?.name || user?.displayName || userName),
    email: user?.email ? String(user.email) : undefined
  };
  
  const existing = await db.collection('workitems').findOne({ _id: new ObjectId(id) });
  if (!existing) return null;

  const result = await db.collection('workitems').updateOne(
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

  try {
    await normalizeWorkItemRanks(db, {
      status: toStatus,
      bundleId: existing.bundleId,
      applicationId: existing.applicationId,
      sprintId: existing.sprintId
    });
  } catch {}

  try {
    await emitEvent({
      ts: now,
      type: 'workitems.item.statuschanged',
      actor,
      resource: { type: 'workitems.item', id: String(existing._id || existing.id || id), title: existing.title },
      context: { bundleId: existing.bundleId, appId: existing.applicationId },
      payload: { from: existing.status, to: toStatus }
    });
  } catch {}

  return result;
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
    await ensureUserIndexes(db);
    return await db.collection('users').find({
      $or: [
        { name: { $regex: query, $options: 'i' } },
        { email: { $regex: query, $options: 'i' } },
        { username: { $regex: query, $options: 'i' } }
      ]
    }).limit(10).project({ password: 0 }).toArray();
  } catch { return []; }
};

export const fetchAdmins = async () => {
  try {
    const db = await getDb();
    await ensureAdminIndexes(db);
    return await db.collection('admins').find({}).sort({ createdAt: -1 }).toArray();
  } catch {
    return [];
  }
};

export const fetchUsersByIds = async (ids: string[]) => {
  try {
    const db = await getDb();
    const objectIds = ids.filter((id) => ObjectId.isValid(id)).map((id) => new ObjectId(id));
    const users = await db.collection('users').find({ _id: { $in: objectIds } }).project({ password: 0 }).toArray();
    return users;
  } catch {
    return [];
  }
};

export const resolveMentionUsers = async (tokens: string[]) => {
  try {
    const db = await getDb();
    const uniqueTokens = Array.from(new Set(tokens.map((t) => t.trim()).filter(Boolean)));
    if (uniqueTokens.length === 0) return [];

    const emailTokens = uniqueTokens.filter((t) => t.includes('@') && t.includes('.'));
    const nameTokens = uniqueTokens.filter((t) => !t.includes('@'));

    const orClauses: any[] = [];
    if (emailTokens.length) {
      orClauses.push(...emailTokens.map((t) => ({ email: { $regex: `^${escapeRegExp(t)}$`, $options: 'i' } })));
    }
    if (nameTokens.length) {
      orClauses.push(...nameTokens.map((t) => ({ username: { $regex: `^${escapeRegExp(t)}$`, $options: 'i' } })));
      orClauses.push(...nameTokens.map((t) => ({ name: { $regex: `^${escapeRegExp(t)}$`, $options: 'i' } })));
      orClauses.push(...nameTokens.map((t) => ({ email: { $regex: `^${escapeRegExp(t)}@`, $options: 'i' } })));
    }
    if (!orClauses.length) return [];

    const users = await db.collection('users')
      .find({ $or: orClauses })
      .limit(20)
      .project({ password: 0 })
      .toArray();

    return users.map((user: any) => ({
      userId: String(user._id || user.id || ''),
      displayName: String(user.name || user.displayName || 'Unknown'),
      email: user.email ? String(user.email) : undefined
    }));
  } catch {
    return [];
  }
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
    await warnLegacySprints(db);
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
    return await db.collection('workitems_sprints').find(query).sort({ startDate: 1 }).toArray();
  } catch { return []; }
};

export const saveSprint = async (sprint: Partial<Sprint>) => {
  const db = await getDb();
  await warnLegacySprints(db);
  const { _id, ...data } = sprint;
  const now = new Date().toISOString();
  if (_id && ObjectId.isValid(_id as string)) {
    return await db.collection('workitems_sprints').updateOne({ _id: new ObjectId(_id) }, { $set: data });
  } else {
    return await db.collection('workitems_sprints').insertOne({ ...data, createdAt: now });
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
          links: i.links || [],
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
          links: item.links || [],
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
