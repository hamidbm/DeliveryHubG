import getMongoClientPromise from '../lib/mongodb';
import { ObjectId } from 'mongodb';
import { WikiPage, WikiSpace, WikiTheme, WikiTemplate, CommentThread, CommentMessage, EventRecord, ReviewRecord, ReviewCycle, ReviewReviewer, FeedbackPackage, UserEventState, Bundle, Application, TaxonomyCategory, TaxonomyDocumentType, WorkItem, WorkItemType, WorkItemStatus, WorkItemActivity, Sprint, Milestone, Notification, ArchitectureDiagram, BusinessCapability, AppInterface, WikiAsset, BundleAssignment, AssignmentType, BundleProfile, AttachmentRef, CommentAuthor } from '../types';

export const getDb = async () => {
  try {
    const client = await getMongoClientPromise();
    return client.db();
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

const ensureBundleProfileIndexes = async (db: any) => {
  await db.collection('bundle_profiles').createIndex({ bundleId: 1 }, { unique: true });
  await db.collection('bundle_profiles').createIndex({ status: 1, updatedAt: -1 });
  await db.collection('bundle_profiles').createIndex({ 'schedule.goLivePlanned': 1 });
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

export const fetchBundleProfile = async (bundleId: string) => {
  try {
    const db = await getDb();
    await ensureBundleProfileIndexes(db);
    return await db.collection('bundle_profiles').findOne({ bundleId: String(bundleId) });
  } catch {
    return null;
  }
};

export const fetchBundleProfiles = async (bundleIds?: string[]) => {
  try {
    const db = await getDb();
    await ensureBundleProfileIndexes(db);
    const query = bundleIds && bundleIds.length > 0 ? { bundleId: { $in: bundleIds.map(String) } } : {};
    return await db.collection('bundle_profiles').find(query).sort({ updatedAt: -1 }).toArray();
  } catch {
    return [];
  }
};

export const upsertBundleProfile = async (bundleId: string, profile: Partial<BundleProfile>) => {
  const db = await getDb();
  await ensureBundleProfileIndexes(db);
  const now = new Date().toISOString();
  const payload = { ...profile, bundleId: String(bundleId), updatedAt: now };
  return await db.collection('bundle_profiles').updateOne(
    { bundleId: String(bundleId) },
    {
      $set: payload,
      $setOnInsert: { createdAt: now }
    },
    { upsert: true }
  );
};

export const computeBundleHealth = async (bundleIds: string[]) => {
  try {
    const db = await getDb();
    await warnLegacyWorkItems(db);
    await ensureBundleProfileIndexes(db);

    const bundleIdList = (bundleIds || []).map(String).filter(Boolean);
    const profiles = await db.collection('bundle_profiles').find({ bundleId: { $in: bundleIdList } }).toArray();
    const profileMap = new Map(profiles.map((p: any) => [String(p.bundleId), p]));

    const workItems = await db.collection('workitems').find({
      $and: [
        { type: { $in: ['RISK', 'DEPENDENCY'] } },
        { $or: [{ bundleId: { $in: bundleIdList } }, { 'context.bundleId': { $in: bundleIdList } }] },
        { $or: [{ isArchived: { $exists: false } }, { isArchived: false }] }
      ]
    }).toArray();

    const itemsByBundle = new Map<string, any[]>();
    workItems.forEach((item: any) => {
      const bundleId = String(item.bundleId || item?.context?.bundleId || '');
      if (!bundleId) return;
      if (!itemsByBundle.has(bundleId)) itemsByBundle.set(bundleId, []);
      itemsByBundle.get(bundleId)!.push(item);
    });

    const computeSeverity = (risk: any) => {
      const p = Number(risk?.probability || 0);
      const i = Number(risk?.impact || 0);
      const score = p * i;
      if (!p || !i) return undefined;
      if (score <= 4) return 'low';
      if (score <= 9) return 'medium';
      if (score <= 16) return 'high';
      return 'critical';
    };

    const today = new Date();
    const results = bundleIdList.map((bundleId) => {
      const profile = profileMap.get(String(bundleId));
      const items = itemsByBundle.get(String(bundleId)) || [];
      const risks = items.filter((i) => i.type === 'RISK');
      const deps = items.filter((i) => i.type === 'DEPENDENCY');

      const isOpen = (item: any) => String(item.status || '').toUpperCase() !== String(WorkItemStatus.DONE);
      const isOverdue = (item: any) => item.dueAt && new Date(item.dueAt) < today && isOpen(item);

      const openRisksBySeverity = { low: 0, medium: 0, high: 0, critical: 0 };
      let overdueCount = 0;
      let overdueBlockingDeps = 0;
      let openRiskPenalty = 0;
      let overduePenalty = 0;
      let blockingDependenciesCount = 0;

      risks.forEach((r) => {
        if (!isOpen(r)) return;
        const severity = r?.risk?.severity || computeSeverity(r?.risk);
        if (severity && openRisksBySeverity[severity as keyof typeof openRisksBySeverity] !== undefined) {
          openRisksBySeverity[severity as keyof typeof openRisksBySeverity] += 1;
        }
        if (severity === 'low') openRiskPenalty += 2;
        else if (severity === 'medium') openRiskPenalty += 5;
        else if (severity === 'high') openRiskPenalty += 10;
        else if (severity === 'critical') openRiskPenalty += 20;

        if (isOverdue(r)) {
          overdueCount += 1;
          overduePenalty += 5;
        }
      });

      deps.forEach((d) => {
        const blocking = d?.dependency?.blocking !== false;
        if (blocking && isOpen(d)) blockingDependenciesCount += 1;
        if (isOverdue(d)) {
          overdueCount += 1;
          overduePenalty += blocking ? 10 : 3;
          if (blocking && isOpen(d)) overdueBlockingDeps += 1;
        }
      });

      openRiskPenalty = Math.min(openRiskPenalty, 40);
      overduePenalty = Math.min(overduePenalty, 30);

      const milestones = profile?.schedule?.milestones || [];
      const current = milestones.find((m: any) => m.status === 'in_progress') || milestones.find((m: any) => m.status !== 'done') || null;
      const blockedMilestone = milestones.some((m: any) => m.status === 'blocked');

      let scheduleSlipDays = 0;
      let schedulePenalty = 0;
      if (current?.plannedEnd && current?.status !== 'done') {
        const plannedEnd = new Date(current.plannedEnd);
        const slip = Math.max(0, Math.floor((today.getTime() - plannedEnd.getTime()) / (1000 * 60 * 60 * 24)));
        scheduleSlipDays = slip;
        schedulePenalty = Math.min(30, slip * 2);
      }

      const blockedPenalty = blockedMilestone ? 20 : 0;
      const healthScore = Math.max(0, Math.min(100, 100 - schedulePenalty - openRiskPenalty - overduePenalty - blockedPenalty));
      const healthBand = healthScore >= 80 ? 'healthy' : healthScore >= 60 ? 'watch' : 'at_risk';

      const hardTrigger =
        openRisksBySeverity.critical > 0 ||
        overdueBlockingDeps > 0 ||
        blockedMilestone;

      const thresholdTrigger =
        openRisksBySeverity.high >= 2 ||
        (openRisksBySeverity.medium + openRisksBySeverity.high + openRisksBySeverity.critical >= 1 && overdueCount > 0) ||
        (scheduleSlipDays > 0 && current && current.status !== 'done');

      let computedStatus: 'on_track' | 'at_risk' | 'blocked' | 'unknown' = 'on_track';
      if (blockedMilestone) computedStatus = 'blocked';
      else if (hardTrigger || thresholdTrigger || healthScore < 60) computedStatus = 'at_risk';

      return {
        bundleId,
        healthScore,
        healthBand,
        computedStatus,
        openRisksBySeverity,
        overdueCount,
        blockingDependenciesCount,
        scheduleSlipDays
      };
    });

    return results;
  } catch {
    return [];
  }
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
  const { _id, ...rest } = notification as any;
  return await db.collection('notifications').insertOne({
    ...rest,
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
    { $push: { comments: { ...comment, createdAt: new Date().toISOString() } } } as any
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
  await db.collection('comment_threads').createIndex({ participants: 1, lastActivityAt: -1 });
  await db.collection('comment_messages').createIndex({ threadId: 1, createdAt: 1 });
  await db.collection('comment_messages').createIndex({ mentions: 1, createdAt: -1 });
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
  typePrefix,
  resourceType,
  resourceId,
  actorId,
  since,
  mentionUserId,
  bundleId,
  appId,
  milestoneId,
  documentTypeId,
  search
}: {
  limit?: number;
  type?: string;
  typePrefix?: string;
  resourceType?: string;
  resourceId?: string;
  actorId?: string;
  since?: string;
  mentionUserId?: string;
  bundleId?: string;
  appId?: string;
  milestoneId?: string;
  documentTypeId?: string;
  search?: string;
}) => {
  try {
    const db = await getDb();
    await ensureEventIndexes(db);
    const query: any = {};
    if (type) query.type = type;
    if (!type && typePrefix) query.type = new RegExp(`^${typePrefix.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&')}`);
    if (resourceType) query['resource.type'] = resourceType;
    if (resourceId) query['resource.id'] = resourceId;
    if (actorId) query['actor.userId'] = actorId;
    if (mentionUserId) query['payload.mentionedUserId'] = mentionUserId;
    if (since) query.ts = { $gt: new Date(since) };
    if (bundleId) query['context.bundleId'] = bundleId;
    if (appId) query['context.appId'] = appId;
    if (milestoneId) query['context.milestoneId'] = milestoneId;
    if (documentTypeId) query['context.documentTypeId'] = documentTypeId;
    if (search) query['resource.title'] = { $regex: search.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&'), $options: 'i' };
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
  const participantSet = new Set<string>([author.userId, ...mentions].filter(Boolean));
  const thread: Partial<CommentThread> = {
    resource: { type: resource.type, id: resource.id, title: resource.title },
    anchor,
    status: 'open',
    createdBy: author,
    createdAt: now,
    lastActivityAt: now,
    messageCount: 1,
    participants: Array.from(participantSet),
    reviewId,
    reviewCycleId
  };
  const { _id, ...threadData } = thread as any;
  const threadResult = await db.collection('comment_threads').insertOne(threadData);
  const message: Partial<CommentMessage> = {
    threadId: String(threadResult.insertedId),
    author,
    body,
    createdAt: now,
    mentions
  };
  const { _id: messageId, ...messageData } = message as any;
  await db.collection('comment_messages').insertOne(messageData);
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
  const { _id: messageId, ...messageData } = message as any;
  await db.collection('comment_messages').insertOne(messageData);
  await db.collection('comment_threads').updateOne(
    { _id: new ObjectId(threadId) },
    {
      $set: { lastActivityAt: now },
      $inc: { messageCount: 1 },
      $addToSet: { participants: { $each: Array.from(new Set([author.userId, ...mentions].filter(Boolean))) } }
    }
  );
  return message;
};

export const fetchCommentThreadsInbox = async ({
  userId,
  resourceType,
  status,
  mentionsOnly,
  participatingOnly,
  since,
  search,
  limit = 200
}: {
  userId: string;
  resourceType?: string;
  status?: 'open' | 'resolved';
  mentionsOnly?: boolean;
  participatingOnly?: boolean;
  since?: string;
  search?: string;
  limit?: number;
}) => {
  try {
    const db = await getDb();
    await ensureCommentIndexes(db);
    const query: any = {};
    if (resourceType) query['resource.type'] = resourceType;
    if (status) query.status = status;
    if (participatingOnly) query.participants = userId;
    if (since) query.lastActivityAt = { $gt: new Date(since) };
    if (search) query['resource.title'] = { $regex: search.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&'), $options: 'i' };

    if (mentionsOnly) {
      const mentionQuery: any = { mentions: userId };
      if (since) mentionQuery.createdAt = { $gt: new Date(since) };
      const threadIds = await db.collection('comment_messages').distinct('threadId', mentionQuery);
      const objectIds = (threadIds || [])
        .filter((id: any) => ObjectId.isValid(String(id)))
        .map((id: any) => new ObjectId(String(id)));
      if (objectIds.length === 0) return [];
      query._id = { $in: objectIds };
    }

    const threads = await db.collection('comment_threads').aggregate([
      { $match: query },
      { $sort: { lastActivityAt: -1 } },
      { $limit: limit },
      {
        $lookup: {
          from: 'comment_messages',
          let: { tid: { $toString: '$_id' } },
          pipeline: [
            { $match: { $expr: { $eq: ['$threadId', '$$tid'] } } },
            { $sort: { createdAt: -1 } },
            { $limit: 1 }
          ],
          as: 'lastMessage'
        }
      },
      { $addFields: { lastMessage: { $arrayElemAt: ['$lastMessage', 0] } } }
    ]).toArray();

    return threads;
  } catch {
    return [];
  }
};

export const updateCommentThreadStatus = async (threadId: string, status: 'open' | 'resolved') => {
  const db = await getDb();
  await ensureCommentIndexes(db);
  return await db.collection('comment_threads').updateOne(
    { _id: new ObjectId(threadId) },
    { $set: { status, lastActivityAt: new Date().toISOString() } }
  );
};

export const fetchReview = async (resourceType: string, resourceId: string): Promise<ReviewRecord | null> => {
  try {
    const db = await getDb();
    await ensureReviewIndexes(db);
    return await db.collection<ReviewRecord>('reviews').findOne({ 'resource.type': resourceType, 'resource.id': resourceId });
  } catch {
    return null;
  }
};

export const fetchReviewById = async (reviewId: string): Promise<ReviewRecord | null> => {
  try {
    const db = await getDb();
    await ensureReviewIndexes(db);
    if (!ObjectId.isValid(reviewId)) return null;
    return await db.collection<ReviewRecord>('reviews').findOne({ _id: new ObjectId(reviewId) } as any);
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
    | 'reviews.cycle.requested'
    | 'reviews.cycle.inreview'
    | 'reviews.cycle.feedbacksent'
    | 'reviews.cycle.resubmitted'
    | 'reviews.cycle.vendoraddressing'
    | 'reviews.cycle.closed';
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

export const syncReviewCycleWorkItem = async ({
  reviewId,
  cycleId,
  actor
}: {
  reviewId: string;
  cycleId: string;
  actor: { userId?: string; displayName?: string; email?: string };
}) => {
  const db = await getDb();
  const review = await fetchReviewById(reviewId);
  if (!review) return null;
  const cycle = (review.cycles || []).find((c) => c.cycleId === cycleId);
  if (!cycle) return null;

  const statusMap: Record<string, WorkItemStatus> = {
    requested: WorkItemStatus.TODO,
    in_review: WorkItemStatus.IN_PROGRESS,
    feedback_sent: WorkItemStatus.REVIEW,
    vendor_addressing: WorkItemStatus.REVIEW,
    closed: WorkItemStatus.DONE
  };
  const desiredStatus = statusMap[cycle.status] || WorkItemStatus.TODO;

  const item = await db.collection('workitems').findOne({
    $or: [
      { reviewCycleId: cycleId },
      { reviewId: String(review._id || `${review.resource?.type}:${review.resource?.id}`) }
    ]
  });
  if (!item) return null;

  const updates: any = {
    reviewCycleStatus: cycle.status,
    updatedAt: new Date().toISOString()
  };
  if (!item.linkedResource?.id && review.resource?.id) {
    updates.linkedResource = {
      ...(item.linkedResource || {}),
      type: review.resource?.type,
      id: String(review.resource.id),
      title: review.resource?.title
    };
  }
  if (cycle.vendorResponse?.body) {
    updates.reviewVendorResponse = cycle.vendorResponse.body;
    updates.reviewVendorResponseAt = cycle.vendorResponse.submittedAt;
    updates.reviewVendorResponseBy = cycle.vendorResponse.submittedBy;
  }
  if (cycle.reviewerNote?.body) {
    updates.reviewReviewerNote = cycle.reviewerNote.body;
  }
  if (Array.isArray(cycle.feedbackAttachments)) {
    updates.reviewFeedbackAttachments = cycle.feedbackAttachments;
  }
  if (item.status !== desiredStatus) {
    updates.status = desiredStatus;
  }

  await db.collection('workitems').updateOne(
    { _id: item._id },
    {
      $set: updates,
      ...(item.status !== desiredStatus
        ? {
            $push: {
              activity: {
                user: actor.displayName || actor.email || 'System',
                action: 'CHANGED_STATUS',
                from: item.status,
                to: desiredStatus,
                createdAt: updates.updatedAt
              }
            }
          }
        : {})
    } as any
  );

  return item;
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
    type: 'reviews.cycle.inreview',
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
  await db.collection('workitems').createIndex({ dedupKey: 1 }, { unique: true, sparse: true });
  await db.collection('workitems').createIndex({ 'scopeRef.type': 1, 'scopeRef.id': 1 });
};

const ensureWorkItemAttachmentIndexes = async (db: any) => {
  await db.collection('workitems_attachments').createIndex({ workItemId: 1, createdAt: -1 });
};

const ensureWorkBlueprintIndexes = async (db: any) => {
  await db.collection('work_blueprints').createIndex({ key: 1 }, { unique: true });
};

const ensureWorkGeneratorIndexes = async (db: any) => {
  await db.collection('work_generators').createIndex({ eventType: 1 }, { unique: true });
};

const seedWorkBlueprints = async (db: any) => {
  await ensureWorkBlueprintIndexes(db);
  const builtIns = [
    {
      key: 'review_story_v1',
      name: 'Review Story Generator v1',
      scope: 'bundle',
      version: 1,
      enabled: true,
      isBuiltIn: true,
      isDefault: true,
      template: {
        epicStrategy: 'scope',
        featureStrategy: 'governance_reviews',
        storyStrategy: 'review_cycle'
      },
      createdAt: new Date().toISOString()
    }
  ];
  for (const bp of builtIns) {
    await db.collection('work_blueprints').updateOne(
      { key: bp.key },
      { $setOnInsert: bp },
      { upsert: true }
    );
  }
};

const seedWorkGenerators = async (db: any) => {
  await ensureWorkGeneratorIndexes(db);
  const builtIns = [
    {
      eventType: 'reviews.cycle.requested',
      enabled: true,
      blueprintKey: 'review_story_v1',
      assignmentStrategy: 'reviewers',
      priorityStrategy: 'normal',
      createdAt: new Date().toISOString()
    },
    {
      eventType: 'reviews.cycle.resubmitted',
      enabled: true,
      blueprintKey: 'review_story_v1',
      assignmentStrategy: 'reviewers',
      priorityStrategy: 'normal',
      createdAt: new Date().toISOString()
    }
  ];
  for (const gen of builtIns) {
    await db.collection('work_generators').updateOne(
      { eventType: gen.eventType },
      { $setOnInsert: gen },
      { upsert: true }
    );
  }
};

const resolveScopeRef = async ({
  bundleId,
  applicationId,
  initiativeId,
  initiativeName
}: {
  bundleId?: string;
  applicationId?: string;
  initiativeId?: string;
  initiativeName?: string;
}) => {
  const db = await getDb();
  if (bundleId) {
    const bundle = await db.collection('bundles').findOne(ObjectId.isValid(bundleId) ? { _id: new ObjectId(bundleId) } : { key: bundleId });
    const name = bundle?.name || bundle?.key || bundleId;
    return { type: 'bundle' as const, id: String(bundle?._id || bundle?.key || bundleId), name: String(name) };
  }
  if (applicationId) {
    const app = await db.collection('applications').findOne(ObjectId.isValid(applicationId) ? { _id: new ObjectId(applicationId) } : { aid: applicationId });
    const name = app?.name || app?.aid || applicationId;
    return { type: 'application' as const, id: String(app?._id || app?.aid || applicationId), name: String(name) };
  }
  return {
    type: 'initiative' as const,
    id: 'unscoped',
    name: 'Unscoped / Misc'
  };
};

const ensureEpicForScope = async (scopeRef: { type: 'bundle' | 'application' | 'initiative'; id: string; name: string }) => {
  const db = await getDb();
  await ensureWorkItemsIndexes(db);
  const existing = await db.collection('workitems').findOne({
    type: WorkItemType.EPIC,
    'scopeRef.type': scopeRef.type,
    'scopeRef.id': scopeRef.id
  });
  if (existing) return existing;
  const title = scopeRef.id === 'unscoped' ? scopeRef.name : `${scopeRef.name} Epic`;
  const data: Partial<WorkItem> = {
    type: WorkItemType.EPIC,
    title,
    description: `Epic for ${scopeRef.name}`,
    status: WorkItemStatus.TODO,
    priority: 'MEDIUM',
    bundleId: scopeRef.type === 'bundle' ? scopeRef.id : '',
    applicationId: scopeRef.type === 'application' ? scopeRef.id : undefined,
    scopeRef
  };
  const result = await saveWorkItem(data, { name: 'System' });
  const insertedId = (result as any)?.insertedId;
  return insertedId ? await db.collection('workitems').findOne({ _id: insertedId } as any) : null;
};

const ensureGovernanceFeature = async (epicId: string, scopeRef: { type: 'bundle' | 'application' | 'initiative'; id: string; name: string }) => {
  const db = await getDb();
  await ensureWorkItemsIndexes(db);
  const existing = await db.collection('workitems').findOne({
    type: WorkItemType.FEATURE,
    parentId: epicId,
    title: 'Governance & Reviews'
  });
  if (existing) return existing;
  const data: Partial<WorkItem> = {
    type: WorkItemType.FEATURE,
    title: 'Governance & Reviews',
    description: 'Review and governance work stream',
    status: WorkItemStatus.TODO,
    priority: 'MEDIUM',
    bundleId: scopeRef.type === 'bundle' ? scopeRef.id : '',
    applicationId: scopeRef.type === 'application' ? scopeRef.id : undefined,
    parentId: epicId,
    scopeRef
  };
  const result = await saveWorkItem(data, { name: 'System' });
  const insertedId = (result as any)?.insertedId;
  return insertedId ? await db.collection('workitems').findOne({ _id: insertedId } as any) : null;
};

export const createReviewWorkItem = async ({
  reviewId,
  cycleId,
  cycleNumber,
  eventType,
  resource,
  bundleId,
  applicationId,
  dueAt,
  requestedBy,
  notes,
  reviewers,
  actor
}: {
  reviewId: string;
  cycleId: string;
  cycleNumber?: number;
  eventType: 'reviews.cycle.requested' | 'reviews.cycle.resubmitted';
  resource: { type: string; id: string; title?: string };
  bundleId?: string;
  applicationId?: string;
  dueAt?: string;
  requestedBy?: { userId?: string; displayName?: string; email?: string };
  notes?: string;
  reviewers?: Array<{ userId: string; displayName: string; email?: string }>;
  actor: { userId: string; displayName: string; email?: string };
}) => {
  const db = await getDb();
  await seedWorkBlueprints(db);
  await seedWorkGenerators(db);
  const gen = await db.collection('work_generators').findOne({ eventType });
  if (!gen || gen.enabled === false) return null;

  await ensureWorkItemsIndexes(db);

  const dedupKey = `${eventType}:${reviewId}:${cycleId}`;
  const existing = await db.collection('workitems').findOne({ dedupKey });
  if (existing) return existing;

  const scopeRef = await resolveScopeRef({
    bundleId,
    applicationId,
    initiativeId: resource.id,
    initiativeName: resource.title || 'Initiative'
  });
  const scopeDerivation = bundleId || applicationId ? 'direct' : 'unscoped_fallback';

  const epic = await ensureEpicForScope(scopeRef);
  const feature = await ensureGovernanceFeature(String(epic?._id || epic?.id || ''), scopeRef);

  const reviewerUserIds = reviewers?.map(r => r.userId).filter(Boolean) || [];
  const assignedTo = reviewers?.[0]?.displayName || reviewers?.[0]?.email || actor.displayName || 'Unassigned';
  const watchers = reviewerUserIds.length ? reviewerUserIds : reviewers?.map(r => r.email || r.displayName).filter(Boolean) || [];
  const dueDate = dueAt || new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString();
  const requester = requestedBy?.displayName || requestedBy?.email || actor.displayName || 'Unknown';
  const resourceLabel = resource.title || resource.id || resource.type;
  const cycleLabel = typeof cycleNumber === 'number' ? `#${cycleNumber}` : cycleId;
  const dueLabel = dueDate ? new Date(dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'TBD';
  const submitterNote = notes && String(notes).trim().length ? String(notes).trim() : 'No submitter note provided.';
  const narrative = [
    '## Review Required',
    '',
    `**Resource:** ${resourceLabel} (${resource.type})`,
    `**Cycle:** ${cycleLabel}`,
    `**Requested by:** ${requester}`,
    `**Due:** ${dueLabel}`,
    '',
    '### Submitter Note',
    submitterNote
  ].join('\n');

  let linkedResourceId = resource.id ? String(resource.id) : '';
  if (!linkedResourceId && reviewId && ObjectId.isValid(reviewId)) {
    try {
      const review = await fetchReviewById(reviewId);
      if (review?.resource?.id) {
        linkedResourceId = String(review.resource.id);
      }
    } catch {}
  }

  const data: Partial<WorkItem> = {
    type: WorkItemType.STORY,
    title: `Review ${resource.title || resource.type}`,
    description: narrative,
    status: WorkItemStatus.TODO,
    priority: 'MEDIUM',
    bundleId: scopeRef.type === 'bundle' ? scopeRef.id : '',
    applicationId: scopeRef.type === 'application' ? scopeRef.id : undefined,
    parentId: String(feature?._id || feature?.id || ''),
    scopeRef,
    scopeDerivation,
    linkedResource: { type: resource.type, id: linkedResourceId, title: resource.title },
    reviewId,
    reviewCycleId: cycleId,
    reviewCycleNumber: cycleNumber,
    reviewRequestedBy: requestedBy,
    reviewNotes: notes ? String(notes) : undefined,
    dedupKey,
    assignedTo,
    assigneeUserIds: reviewerUserIds,
    watcherUserIds: reviewerUserIds,
    watchers,
    dueAt: dueDate
  };

  const result = await saveWorkItem(data, { name: actor.displayName, userId: actor.userId, email: actor.email });
  const insertedId = (result as any)?.insertedId;
  return insertedId ? await db.collection('workitems').findOne({ _id: insertedId } as any) : null;
};

export const closeReviewWorkItem = async ({
  reviewId,
  cycleId,
  actor,
  resolution
}: {
  reviewId: string;
  cycleId: string;
  actor: { userId: string; displayName: string; email?: string };
  resolution?: string;
}) => {
  const db = await getDb();
  const item = await db.collection('workitems').findOne({
    $or: [
      { dedupKey: `reviews.cycle.requested:${reviewId}:${cycleId}` },
      { dedupKey: `reviews.cycle.resubmitted:${reviewId}:${cycleId}` }
    ]
  });
  if (!item) return null;
  const now = new Date().toISOString();
  await db.collection('workitems').updateOne(
    { _id: item._id },
    { $set: { status: WorkItemStatus.DONE, updatedAt: now, resolution }, $push: { activity: { user: actor.displayName, action: 'CHANGED_STATUS', from: item.status, to: WorkItemStatus.DONE, createdAt: now } } } as any
  );
  try {
    await emitEvent({
      ts: now,
      type: 'workitems.item.statuschanged',
      actor: { userId: actor.userId, displayName: actor.displayName, email: actor.email },
      resource: { type: 'workitems.item', id: String(item._id || item.id), title: item.title },
      context: { bundleId: item.bundleId, appId: item.applicationId },
      payload: { from: item.status, to: WorkItemStatus.DONE }
    });
  } catch {}
  return item;
};

export const createWorkPlanFromIntake = async ({
  scopeType,
  scopeId,
  goLiveDate,
  devStartDate,
  uatStartDate,
  uatEndDate,
  milestoneCount = 4,
  milestoneDurationWeeks = 3,
  sprintDurationWeeks = 2,
  milestoneThemes = [],
  actor
}: {
  scopeType: 'bundle' | 'application';
  scopeId: string;
  goLiveDate?: string;
  devStartDate?: string;
  uatStartDate?: string;
  uatEndDate?: string;
  milestoneCount?: number;
  milestoneDurationWeeks?: number;
  sprintDurationWeeks?: number;
  milestoneThemes?: Array<{ milestoneNumber: number; themes: string[] }>;
  actor: { userId?: string; name?: string; displayName?: string; email?: string };
}) => {
  const db = await getDb();
  await ensureWorkItemsIndexes(db);
  await seedWorkBlueprints(db);

  const scopeRef = await resolveScopeRef({
    bundleId: scopeType === 'bundle' ? scopeId : undefined,
    applicationId: scopeType === 'application' ? scopeId : undefined
  });
  const scopeDerivation = 'direct' as const;

  const epic = await ensureEpicForScope(scopeRef);
  const epicId = String(epic?._id || epic?.id || '');
  await ensureGovernanceFeature(epicId, scopeRef);

  const startDate = devStartDate ? new Date(devStartDate) : new Date();
  const milestones: Array<{ id: string; number: number }> = [];

  for (let i = 1; i <= milestoneCount; i += 1) {
    const msStart = new Date(startDate.getTime() + (i - 1) * milestoneDurationWeeks * 7 * 24 * 60 * 60 * 1000);
    const msEnd = new Date(msStart.getTime() + milestoneDurationWeeks * 7 * 24 * 60 * 60 * 1000);
    const ms = await saveMilestone({
      name: `Milestone ${i}`,
      startDate: msStart.toISOString(),
      endDate: msEnd.toISOString(),
      dueDate: msEnd.toISOString(),
      status: 'PLANNED',
      bundleId: scopeType === 'bundle' ? scopeId : undefined,
      applicationId: scopeType === 'application' ? scopeId : undefined
    } as any);
    const insertedId = (ms as any)?.insertedId;
    if (insertedId) {
      milestones.push({ id: String(insertedId), number: i });
    }
  }

  for (const ms of milestones) {
    const feature = await saveWorkItem({
      type: WorkItemType.FEATURE,
      title: `Milestone ${ms.number}`,
      description: `Delivery milestone ${ms.number}`,
      status: WorkItemStatus.TODO,
      priority: 'MEDIUM',
      bundleId: scopeType === 'bundle' ? scopeId : '',
      applicationId: scopeType === 'application' ? scopeId : undefined,
      parentId: epicId,
      milestoneIds: [ms.id],
      scopeRef,
      scopeDerivation
    }, actor);

    const themes = milestoneThemes.find((m) => Number(m.milestoneNumber) === ms.number)?.themes || [];
    for (const theme of themes) {
      await saveWorkItem({
        type: WorkItemType.STORY,
        title: String(theme),
        description: '',
        status: WorkItemStatus.TODO,
        priority: 'MEDIUM',
        bundleId: scopeType === 'bundle' ? scopeId : '',
        applicationId: scopeType === 'application' ? scopeId : undefined,
        parentId: String((feature as any).insertedId || (feature as any)._id || ''),
        milestoneIds: [ms.id],
        scopeRef,
        scopeDerivation
      }, actor);
    }
  }

  if (sprintDurationWeeks && sprintDurationWeeks > 0) {
    const totalWeeks = milestoneCount * milestoneDurationWeeks;
    const sprintCount = Math.ceil(totalWeeks / sprintDurationWeeks);
    for (let i = 1; i <= sprintCount; i += 1) {
      const spStart = new Date(startDate.getTime() + (i - 1) * sprintDurationWeeks * 7 * 24 * 60 * 60 * 1000);
      const spEnd = new Date(spStart.getTime() + sprintDurationWeeks * 7 * 24 * 60 * 60 * 1000);
      await saveSprint({
        name: `Sprint ${i}`,
        startDate: spStart.toISOString(),
        endDate: spEnd.toISOString(),
        status: 'PLANNED',
        bundleId: scopeType === 'bundle' ? scopeId : undefined,
        applicationId: scopeType === 'application' ? scopeId : undefined
      } as any);
    }
  }

  return { epicId, scopeRef, scopeDerivation, goLiveDate, uatStartDate, uatEndDate };
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
        case 'my': {
          const myClauses: any[] = [];
          if (filters.currentUserId) {
            const match = safeIdMatch(String(filters.currentUserId));
            if (match) myClauses.push({ assigneeUserIds: match });
          }
          const assignedToCandidates = [
            filters.currentUserName,
            filters.currentUsername,
            filters.currentUserEmail,
            filters.currentUser
          ].map((v: any) => (v ? String(v) : '')).filter(Boolean);
          if (assignedToCandidates.length) {
            const regexes = assignedToCandidates.map((v) => new RegExp(`^${escapeRegExp(v)}$`, 'i'));
            myClauses.push({ assignedTo: { $in: regexes } });
          }
          if (myClauses.length) andClauses.push({ $or: myClauses });
          break;
        }
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

  const computeRiskSeverity = (risk?: any) => {
    if (!risk?.probability || !risk?.impact) return undefined;
    const score = Number(risk.probability) * Number(risk.impact);
    if (score <= 4) return 'low';
    if (score <= 9) return 'medium';
    if (score <= 16) return 'high';
    return 'critical';
  };

  if (data.type === WorkItemType.RISK && data.risk) {
    data.risk = { ...data.risk, severity: computeRiskSeverity(data.risk) };
  }

  if (data.type === WorkItemType.DEPENDENCY) {
    data.dependency = { ...(data.dependency || {}), blocking: data.dependency?.blocking !== false };
  }

  if (!data.context && data.bundleId) {
    data.context = { bundleId: String(data.bundleId), appId: data.applicationId ? String(data.applicationId) : undefined };
  }

  if (_id && ObjectId.isValid(_id as string)) {
    const existing = await db.collection('workitems').findOne({ _id: new ObjectId(_id) });
    if (!existing) throw new Error("Work item not found");

    const activities: any[] = [];
    const fieldsToTrack = ['status', 'priority', 'assignedTo', 'title', 'description', 'storyPoints', 'parentId', 'milestoneIds', 'timeEstimate', 'timeLogged', 'isFlagged', 'attachments', 'links', 'aiWorkPlan', 'checklists', 'isArchived'];
    
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

    if (data.type === WorkItemType.RISK && data.risk) {
      data.risk = { ...data.risk, severity: computeRiskSeverity(data.risk) };
    }
    if (data.type === WorkItemType.DEPENDENCY) {
      data.dependency = { ...(data.dependency || {}), blocking: data.dependency?.blocking !== false };
    }
    if (!data.context && (data.bundleId || existing?.bundleId)) {
      data.context = { bundleId: String(data.bundleId || existing.bundleId), appId: data.applicationId ? String(data.applicationId) : (existing.applicationId ? String(existing.applicationId) : undefined) };
    }

    const finalSet = { ...data, updatedAt: now, updatedBy: userName };
    const finalPush = { activity: { $each: activities } };

    const updateResult = await db.collection('workitems').updateOne(
      { _id: new ObjectId(_id) },
      { $set: finalSet, $push: finalPush } as any
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
    } as any
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
  let items = await fetchWorkItems(filters);
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

  if (filters.quickFilter === 'my' && items.length > 0) {
    const byId = new Map<string, any>();
    items.forEach((item) => {
      const id = String(item._id || item.id || '');
      if (id) byId.set(id, item);
    });
    for (const item of [...items]) {
      let parentId = item.parentId ? String(item.parentId) : '';
      while (parentId) {
        if (byId.has(parentId)) break;
        const parent = await fetchWorkItemById(parentId);
        if (!parent) break;
        const parentKey = String(parent._id || parent.id || '');
        if (parentKey) {
          byId.set(parentKey, parent);
          items.push(parent);
        }
        parentId = parent.parentId ? String(parent.parentId) : '';
      }
    }
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

export const fetchDiagramTemplates = async (filters: any = {}) => {
  try {
    const db = await getDb();
    await ensureDiagramTemplateIndexes(db);
    const query: any = filters.includeInactive ? {} : { isActive: { $ne: false } };
    if (filters.diagramType) query.diagramType = filters.diagramType;
    if (filters.format) query.format = filters.format;
    return await db.collection('diagram_templates').find(query).sort({ isDefault: -1, name: 1 }).toArray();
  } catch {
    return [];
  }
};

export const fetchDiagramTemplateById = async (id: string) => {
  try {
    const db = await getDb();
    await ensureDiagramTemplateIndexes(db);
    if (ObjectId.isValid(id)) {
      return await db.collection('diagram_templates').findOne({ _id: new ObjectId(id) });
    }
    return await db.collection('diagram_templates').findOne({ id });
  } catch {
    return null;
  }
};

const ensureDiagramTemplateIndexes = async (db: any) => {
  try {
    await db.collection('diagram_templates').createIndex({ key: 1 }, { unique: true });
    await db.collection('diagram_templates').createIndex({ diagramType: 1, format: 1, isActive: 1 });
    await db.collection('diagram_templates').createIndex(
      { diagramType: 1, format: 1, isDefault: 1 },
      { unique: true, partialFilterExpression: { isDefault: true } }
    );
  } catch {}
};

export const saveDiagramTemplate = async (template: any, user?: { name?: string }) => {
  const db = await getDb();
  await ensureDiagramTemplateIndexes(db);
  const now = new Date().toISOString();
  const actor = user?.name || 'System';
  const { _id, ...data } = template;

  if (_id && ObjectId.isValid(_id)) {
    if (data.isDefault && data.diagramType && data.format) {
      await db.collection('diagram_templates').updateMany(
        { diagramType: data.diagramType, format: data.format, isDefault: true, _id: { $ne: new ObjectId(_id) } },
        { $set: { isDefault: false, updatedAt: now, updatedBy: actor } }
      );
    }
    return await db.collection('diagram_templates').updateOne(
      { _id: new ObjectId(_id) },
      { $set: { ...data, updatedAt: now, updatedBy: actor } }
    );
  }
  const result = await db.collection('diagram_templates').insertOne({
    ...data,
    createdAt: now,
    updatedAt: now,
    createdBy: actor,
    updatedBy: actor
  });
  if (data.isDefault && data.diagramType && data.format) {
    await db.collection('diagram_templates').updateMany(
      { diagramType: data.diagramType, format: data.format, isDefault: true, _id: { $ne: result.insertedId } },
      { $set: { isDefault: false, updatedAt: now, updatedBy: actor } }
    );
  }
  return result;
};

export const deleteDiagramTemplate = async (id: string) => {
  const db = await getDb();
  await ensureDiagramTemplateIndexes(db);
  if (ObjectId.isValid(id)) {
    return await db.collection('diagram_templates').deleteOne({ _id: new ObjectId(id) });
  }
  return await db.collection('diagram_templates').deleteOne({ id });
};

export const fetchArchitectureDiagramsWithReviewSummary = async (filters: any = {}) => {
  try {
    const db = await getDb();
    const diagrams = await fetchArchitectureDiagrams(filters);
    if (!diagrams.length) return diagrams;

    const diagramIds = diagrams
      .map((d: any) => String(d._id || d.id || ''))
      .filter(Boolean);
    if (!diagramIds.length) return diagrams;

    await ensureReviewIndexes(db);
    const reviews = await db.collection('reviews').find({
      'resource.type': 'architecture_diagram',
      'resource.id': { $in: diagramIds }
    }).toArray();

    const reviewByResourceId = new Map<string, any>();
    const reviewerIdSet = new Set<string>();
    const reviewStoryPairs: Array<{ reviewId: string; cycleId: string }> = [];

    reviews.forEach((review: any) => {
      const resourceId = String(review.resource?.id || '');
      if (!resourceId) return;
      const currentCycle = (review.cycles || []).find((c: any) => c.cycleId === review.currentCycleId);
      const reviewerUserIds = (currentCycle?.reviewerUserIds || review.currentReviewerUserIds || []).map((id: any) => String(id));
      reviewerUserIds.forEach((id: string) => reviewerIdSet.add(id));
      const cycleId = String(review.currentCycleId || '');
      const reviewKey = `${review.resource?.type}:${review.resource?.id}`;
      const reviewObjectId = review._id ? String(review._id) : '';
      if (cycleId) {
        reviewStoryPairs.push({ reviewId: reviewKey, cycleId });
        if (reviewObjectId) reviewStoryPairs.push({ reviewId: reviewObjectId, cycleId });
      }
      reviewByResourceId.set(resourceId, {
        reviewId: reviewObjectId || reviewKey,
        reviewKeyId: reviewKey,
        currentCycleId: cycleId,
        currentCycleStatus: currentCycle?.status || review.currentCycleStatus,
        currentCycleNumber: currentCycle?.number,
        currentDueAt: currentCycle?.dueAt || review.currentDueAt,
        currentReviewerUserIds: reviewerUserIds
      });
    });

    const reviewerUsers = reviewerIdSet.size ? await fetchUsersByIds(Array.from(reviewerIdSet)) : [];
    const reviewerMap = new Map<string, any>();
    reviewerUsers.forEach((u: any) => reviewerMap.set(String(u._id || u.id), u));

    const storyMap = new Map<string, { id: string; key: string }>();
    if (reviewStoryPairs.length) {
      const orClauses = reviewStoryPairs.map((pair) => ({
        reviewId: pair.reviewId,
        reviewCycleId: pair.cycleId
      }));
      const stories = await db.collection('workitems').find({ $or: orClauses }).project({ _id: 1, key: 1, reviewId: 1, reviewCycleId: 1 }).toArray();
      stories.forEach((story: any) => {
        const mapKey = `${String(story.reviewId)}:${String(story.reviewCycleId)}`;
        storyMap.set(mapKey, { id: String(story._id || story.id || ''), key: String(story.key || '') });
      });
    }

    return diagrams.map((diagram: any) => {
      const resourceId = String(diagram._id || diagram.id || '');
      const summary = reviewByResourceId.get(resourceId);
      if (!summary) return diagram;
      const reviewers = (summary.currentReviewerUserIds || []).map((id: string) => {
        const user = reviewerMap.get(id);
        return {
          userId: id,
          displayName: user?.name || user?.email || 'Reviewer',
          email: user?.email
        };
      });
      const storyKey = summary.currentCycleId ? `${summary.reviewId}:${summary.currentCycleId}` : '';
      const storyKeyAlt = summary.currentCycleId ? `${summary.reviewKeyId}:${summary.currentCycleId}` : '';
      const story = storyMap.get(storyKey) || storyMap.get(storyKeyAlt) || null;
      return {
        ...diagram,
        reviewSummary: {
          reviewId: summary.reviewId,
          reviewKeyId: summary.reviewKeyId,
          currentCycleId: summary.currentCycleId,
          currentCycleStatus: summary.currentCycleStatus,
          currentCycleNumber: summary.currentCycleNumber,
          currentDueAt: summary.currentDueAt,
          reviewers,
          story
        }
      };
    });
  } catch {
    return await fetchArchitectureDiagrams(filters);
  }
};

export const fetchArchitectureDiagramById = async (id: string) => {
  try {
    const db = await getDb();
    if (ObjectId.isValid(id)) {
      return await db.collection('architecture_diagrams').findOne({ _id: new ObjectId(id) });
    }
    return await db.collection('architecture_diagrams').findOne({ id });
  } catch {
    return null;
  }
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
