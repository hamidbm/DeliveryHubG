/* Legacy compatibility layer.
 * Do not add new domain persistence logic here.
 * Repositories own domain persistence, shared/db owns DB infrastructure,
 * shared/events owns centralized event emission, and shared/bootstrap owns
 * bootstrap/seed entry points.
 */
import { ObjectId } from 'mongodb';
import { WikiPage, WikiSpace, WikiTheme, WikiTemplate, CommentThread, CommentMessage, ReviewRecord, ReviewCycle, ReviewReviewer, FeedbackPackage, UserEventState, Bundle, Application, TaxonomyCategory, TaxonomyDocumentType, WorkItem, WorkItemType, WorkItemStatus, WorkItemActivity, Sprint, Milestone, Notification, ArchitectureDiagram, BusinessCapability, AppInterface, WikiAsset, BundleAssignment, AssignmentType, BundleProfile, AttachmentRef, CommentAuthor } from '../types';
import { computeBundleVelocity, forecastMilestoneCompletion } from './forecasting';
import { runMonteCarloForecast } from './monteCarlo';
import { getDeliveryPolicy, getEffectivePolicyForBundle, getStrictestPolicyForBundles } from './policy';
import { fetchArchitectureDiagramsWithReviewSummary as fetchArchitectureDiagramsWithReviewSummaryFromService } from './architectureDiagramSummaries';
import { computeBundleHealth as computeBundleHealthFromService } from './bundleAnalytics';
import { closeReviewWorkItemRecord, syncReviewCycleWorkItemRecord } from './reviewWorkItemOrchestration';
import {
  addReviewCycleAttachments as addReviewCycleAttachmentsFromService,
  appendReviewCycle as appendReviewCycleFromService,
  buildReviewCycle as buildReviewCycleFromService,
  fetchAssignedCmoReviewers as fetchAssignedCmoReviewersFromService,
  updateReviewCycleNote as updateReviewCycleNoteFromService,
  updateReviewCycleStatus as updateReviewCycleStatusFromService
} from './reviewCycles';
import {
  computeMilestoneRollup as computeMilestoneRollupFromService,
  computeMilestoneRollups as computeMilestoneRollupsFromService,
  computeSprintRollups as computeSprintRollupsFromService
} from './rollupAnalytics';
import {
  saveWorkItemWithSideEffects,
  updateWorkItemStatusWithSideEffects
} from './workItemOrchestration';
import { createReviewWorkItemRecord, createSimpleWorkPlanFromIntakeRecord } from './workPlanOrchestration';
import { evaluateWorkItemStaleness } from '../lib/staleness';
import { computeMilestoneCriticalPath } from './criticalPath';
import { listApplications, saveApplicationRecord } from '../server/db/repositories/applicationsRepo';
import {
  checkAndIncrementAiRateLimitRecord,
  getAiAnalysisCache,
  listWikiAssetAiHistory,
  listWikiQaHistory,
  saveAiAnalysisCacheRecord,
  saveAiAuditLogRecord,
  saveWikiAssetAiHistoryRecord,
  saveWikiQaHistoryRecord
} from '../server/db/repositories/aiSupportRepo';
import { deleteAdminRecord, hasAdminRecord, listAdmins, saveAdminRecord } from '../server/db/repositories/adminsRepo';
import {
  deleteArchitectureDiagramRecord,
  deleteCapabilityRecord,
  deleteDiagramTemplateRecord,
  deleteInterfaceRecord,
  getArchitectureDiagramById,
  getDiagramTemplateById,
  listArchitectureDiagrams,
  listCapabilities,
  listDiagramTemplates,
  listInterfaces,
  saveArchitectureDiagramRecord,
  saveCapabilityRecord,
  saveDiagramTemplateRecord,
  saveInterfaceRecord
} from '../server/db/repositories/architectureRepo';
import { listBundleAssignments, patchBundleAssignment, saveBundleAssignment } from '../server/db/repositories/bundleAssignmentsRepo';
import { getBundleProfile, listBundleProfiles, listBundles, saveBundleProfile, saveBundleRecord } from '../server/db/repositories/bundlesRepo';
import { listBundleCapacity, saveBundleCapacity } from '../server/db/repositories/bundleCapacityRepo';
import { countUnreadEvents, getUserEventStateRecord, listEvents, saveUserEventStateRecord } from '../server/db/repositories/eventsRepo';
import { closeFeedbackPackageRecord, listFeedbackPackages, saveFeedbackPackageRecord } from '../server/db/repositories/feedbackPackagesRepo';
import { deleteMilestoneRecord, listMilestones, listSprints, saveMilestoneRecord, saveSprintRecord } from '../server/db/repositories/milestonesRepo';
import {
  insertClassicNotification,
  listClassicNotificationsByRecipient,
  markClassicNotificationRead
} from '../server/db/repositories/notificationPlatformRepo';
import { getAiSettingsDoc, getLegacyGlobalConfigDoc, saveAiSettingsDoc } from '../server/db/repositories/systemSettingsRepo';
import {
  addWorkItemLinkRecord,
  detectBlocksCycle as detectBlocksCycleFromRepo,
  deriveWorkItemLinkSummary as deriveWorkItemLinkSummaryFromRepo,
  ensureWorkItemsIndexes as ensureWorkItemsIndexesInRepo,
  removeWorkItemLinkRecord,
  fetchWorkItemById as fetchWorkItemByIdFromRepo,
  fetchWorkItemByKeyOrId as fetchWorkItemByKeyOrIdFromRepo,
  fetchWorkItemTree as fetchWorkItemTreeFromRepo,
  fetchWorkItems as fetchWorkItemsFromRepo,
  fetchWorkItemsBoard as fetchWorkItemsBoardFromRepo
} from '../server/db/repositories/workItemsRepo';
import { findWorkGeneratorByEventType, seedBuiltInWorkBlueprints, seedBuiltInWorkGenerators } from '../server/db/repositories/workAutomationRepo';
import {
  ensureUserIndexesInRepo,
  getAdminBootstrapEmailsFromEnv,
  listUsersByIds,
  resolveUsersForMentions,
  searchUsersByQuery
} from '../server/db/repositories/usersRepo';
import {
  listTaxonomyCategories,
  listTaxonomyDocumentTypes,
  saveTaxonomyCategoryRecord,
  saveTaxonomyDocumentTypeRecord
} from '../server/db/repositories/taxonomyRepo';
import {
  addCommentMessageRecord,
  countUnreadCommentThreads,
  createCommentThreadRecord,
  getCommentLastSeen as getCommentLastSeenFromRepo,
  getCommentThreadById as getCommentThreadByIdFromRepo,
  listCommentMessages,
  listCommentThreads,
  listCommentThreadsInbox,
  setCommentLastSeen as setCommentLastSeenInRepo,
  setCommentThreadStatus
} from '../server/db/repositories/commentThreadsRepo';
import {
  getReviewById as getReviewByIdFromRepo,
  getReviewByResource,
  saveReviewRecord
} from '../server/db/repositories/reviewsRepo';
import {
  addWikiCommentRecord,
  clearWikiAiInsightRecords,
  listWikiComments,
  listWikiHistory,
  listWikiAiInsights,
  deactivateWikiTemplateRecord,
  deleteWikiThemeRecord,
  getWikiAssetById as getWikiAssetByIdFromRepo,
  getWikiPageById as getWikiPageByIdFromRepo,
  listWikiAssets,
  listWikiSpaces,
  listWikiPages,
  listWikiTemplates,
  listWikiThemes,
  revertWikiPageRecord,
  saveWikiAiInsightRecord,
  saveWikiSpaceRecord,
  saveWikiTemplateRecord,
  saveWikiAssetRecord,
  saveWikiPageRecord,
  saveWikiThemeRecord
} from '../server/db/repositories/wikiRepo';
import { getDb } from '../shared/db/client';
import { emitEvent } from '../shared/events/emitEvent';
export { getDb, emitEvent };

const SUPPORTED_AI_PROVIDERS = ['OPENAI', 'OPEN_ROUTER', 'GEMINI', 'ANTHROPIC', 'HUGGINGFACE', 'COHERE'] as const;
type AiProviderId = (typeof SUPPORTED_AI_PROVIDERS)[number];

const normalizeAiProvider = (value?: string | null): AiProviderId | null => {
  if (!value) return null;
  const normalized = String(value).trim().toUpperCase().replace(/[\s-]+/g, '_');
  const mapped = normalized === 'HUGGING_FACE' ? 'HUGGINGFACE' : normalized;
  return (SUPPORTED_AI_PROVIDERS as readonly string[]).includes(mapped) ? (mapped as AiProviderId) : null;
};

const defaultAiSettings = {
  defaultProvider: null as AiProviderId | null,
  taskRoutingVersion: 2,
  openaiModelDefault: 'gpt-5.2',
  openaiModelHigh: 'gpt-5.2-pro',
  openaiModelFast: 'gpt-5.2-chat-latest',
  openRouterModel: 'qwen/qwen3-coder',
  geminiFlashModel: 'gemini-3-flash-preview',
  geminiProModel: 'gemini-3-pro-preview',
  anthropicModel: 'claude-3-5-sonnet-20240620',
  huggingfaceModel: '',
  cohereModel: '',
  providerToggles: {
    OPENAI: true,
    GEMINI: true,
    OPEN_ROUTER: true,
    ANTHROPIC: true,
    HUGGINGFACE: true,
    COHERE: true
  },
  taskRouting: {},
  retentionDays: {
    wikiQa: 30,
    assetQa: 30,
    assetAi: 30,
    auditLogs: 30
  },
  rateLimits: {
    perUserPerHour: 30
  },
  fallbackOrder: ['OPEN_ROUTER', 'OPENAI', 'GEMINI', 'ANTHROPIC', 'HUGGINGFACE', 'COHERE'] as AiProviderId[]
};

const normalizeAiSettings = (doc: any) => {
  const providers = doc?.providers || {};
  const openaiModels = providers.OPENAI?.models || {};
  const openaiModelDefault = openaiModels.default || doc?.openaiModelDefault || doc?.openaiModel || doc?.defaultModel || defaultAiSettings.openaiModelDefault;
  const openaiModelHigh = openaiModels.highReasoning || doc?.openaiModelHigh || defaultAiSettings.openaiModelHigh;
  const openaiModelFast = openaiModels.fast || doc?.openaiModelFast || defaultAiSettings.openaiModelFast;
  const openRouterModels = providers.OPEN_ROUTER?.models || {};
  const openRouterModel = openRouterModels.default || providers.OPEN_ROUTER?.model || doc?.openRouterModel || defaultAiSettings.openRouterModel;
  const geminiModels = providers.GEMINI?.models || {};
  const geminiFlashModel = geminiModels.flash || providers.GEMINI?.flashModel || doc?.geminiFlashModel || doc?.flashModel || defaultAiSettings.geminiFlashModel;
  const geminiProModel = geminiModels.pro || providers.GEMINI?.proModel || doc?.geminiProModel || doc?.proModel || defaultAiSettings.geminiProModel;
  const anthropicModels = providers.ANTHROPIC?.models || {};
  const anthropicModel = anthropicModels.default || providers.ANTHROPIC?.model || doc?.anthropicModel || defaultAiSettings.anthropicModel;
  const huggingfaceModels = providers.HUGGINGFACE?.models || {};
  const huggingfaceModel = huggingfaceModels.default || providers.HUGGINGFACE?.model || doc?.huggingfaceModel || defaultAiSettings.huggingfaceModel;
  const cohereModels = providers.COHERE?.models || {};
  const cohereModel = cohereModels.default || providers.COHERE?.model || doc?.cohereModel || defaultAiSettings.cohereModel;

  const providerToggles = { ...defaultAiSettings.providerToggles, ...(doc?.providerToggles || {}) };
  const taskRoutingVersion = typeof doc?.taskRoutingVersion === 'number' ? doc.taskRoutingVersion : 1;
  const taskRouting = { ...defaultAiSettings.taskRouting, ...(doc?.taskRouting || {}) };
  if (taskRoutingVersion < 2) {
    const legacyPortfolio = taskRouting.portfolioSummary || {};
    if (legacyPortfolio.provider === 'OPENAI' && legacyPortfolio.model === 'openaiModelDefault') {
      taskRouting.portfolioSummary = { model: 'openaiModelDefault' };
    }
  }
  const retentionDays = doc?.retentionDays || defaultAiSettings.retentionDays;
  const rateLimits = doc?.rateLimits || defaultAiSettings.rateLimits;
  const fallbackOrder = Array.isArray(doc?.fallbackOrder) && doc.fallbackOrder.length
    ? doc.fallbackOrder.map((entry: string) => normalizeAiProvider(entry)).filter(Boolean) as AiProviderId[]
    : defaultAiSettings.fallbackOrder;
  const envDefaultProvider = normalizeAiProvider(process.env.AI_DEFAULT_PROVIDER || null);

  const credentialByProvider: Record<AiProviderId, boolean> = {
    OPENAI: Boolean(process.env.OPENAI_API_KEY),
    OPEN_ROUTER: Boolean(process.env.OPENROUTER_API_KEY),
    GEMINI: Boolean(process.env.GEMINI_API_KEY),
    ANTHROPIC: Boolean(process.env.ANTHROPIC_API_KEY),
    HUGGINGFACE: Boolean(process.env.HUGGINGFACE_API_KEY),
    COHERE: Boolean(process.env.COHERE_API_KEY)
  };
  const configuredByProvider: Record<AiProviderId, boolean> = {
    OPENAI: credentialByProvider.OPENAI && Boolean(openaiModelDefault),
    OPEN_ROUTER: credentialByProvider.OPEN_ROUTER && Boolean(openRouterModel),
    GEMINI: credentialByProvider.GEMINI && Boolean(geminiFlashModel || geminiProModel),
    ANTHROPIC: credentialByProvider.ANTHROPIC && Boolean(anthropicModel),
    HUGGINGFACE: credentialByProvider.HUGGINGFACE && Boolean(huggingfaceModel),
    COHERE: credentialByProvider.COHERE && Boolean(cohereModel)
  };
  const healthyByProvider: Record<AiProviderId, boolean> = {
    OPENAI: providers.OPENAI?.healthy !== false,
    OPEN_ROUTER: providers.OPEN_ROUTER?.healthy !== false,
    GEMINI: providers.GEMINI?.healthy !== false,
    ANTHROPIC: providers.ANTHROPIC?.healthy !== false,
    HUGGINGFACE: providers.HUGGINGFACE?.healthy !== false,
    COHERE: providers.COHERE?.healthy !== false
  };
  const defaultEligibleByProvider: Record<AiProviderId, boolean> = {
    OPENAI: Boolean(providerToggles.OPENAI) && configuredByProvider.OPENAI && healthyByProvider.OPENAI,
    OPEN_ROUTER: Boolean(providerToggles.OPEN_ROUTER) && configuredByProvider.OPEN_ROUTER && healthyByProvider.OPEN_ROUTER,
    GEMINI: Boolean(providerToggles.GEMINI) && configuredByProvider.GEMINI && healthyByProvider.GEMINI,
    ANTHROPIC: Boolean(providerToggles.ANTHROPIC) && configuredByProvider.ANTHROPIC && healthyByProvider.ANTHROPIC,
    HUGGINGFACE: Boolean(providerToggles.HUGGINGFACE) && configuredByProvider.HUGGINGFACE && healthyByProvider.HUGGINGFACE,
    COHERE: Boolean(providerToggles.COHERE) && configuredByProvider.COHERE && healthyByProvider.COHERE
  };
  const isOperational = (provider: AiProviderId) => defaultEligibleByProvider[provider];
  const selectedDefaultProvider = normalizeAiProvider(doc?.selectedDefaultProvider || doc?.defaultProvider) || null;
  const resolvedDefaultProvider =
    (selectedDefaultProvider && isOperational(selectedDefaultProvider) ? selectedDefaultProvider : null)
    || (envDefaultProvider && isOperational(envDefaultProvider) ? envDefaultProvider : null)
    || null;

  const providerMetadata = {
    OPENAI: {
      ...(providers.OPENAI || {}),
      displayName: providers.OPENAI?.displayName || 'OpenAI',
      credentialSource: 'env',
      credentialEnvVar: 'OPENAI_API_KEY',
      credentialPresent: credentialByProvider.OPENAI,
      enabled: Boolean(providerToggles.OPENAI),
      configured: configuredByProvider.OPENAI,
      healthy: healthyByProvider.OPENAI,
      defaultEligible: defaultEligibleByProvider.OPENAI,
      status: defaultEligibleByProvider.OPENAI ? 'HEALTHY' : (credentialByProvider.OPENAI ? 'UNHEALTHY' : 'MISSING_CREDENTIALS'),
      statusReason: defaultEligibleByProvider.OPENAI ? null : (credentialByProvider.OPENAI ? 'Provider not eligible as default.' : 'Missing OPENAI_API_KEY'),
      baseUrl: providers.OPENAI?.baseUrl || 'https://api.openai.com/v1',
      models: {
        default: openaiModelDefault,
        highReasoning: openaiModelHigh,
        fast: openaiModelFast
      }
    },
    OPEN_ROUTER: {
      ...(providers.OPEN_ROUTER || {}),
      displayName: providers.OPEN_ROUTER?.displayName || 'Open Router',
      credentialSource: 'env',
      credentialEnvVar: 'OPENROUTER_API_KEY',
      credentialPresent: credentialByProvider.OPEN_ROUTER,
      enabled: Boolean(providerToggles.OPEN_ROUTER),
      configured: configuredByProvider.OPEN_ROUTER,
      healthy: healthyByProvider.OPEN_ROUTER,
      defaultEligible: defaultEligibleByProvider.OPEN_ROUTER,
      status: defaultEligibleByProvider.OPEN_ROUTER ? 'HEALTHY' : (credentialByProvider.OPEN_ROUTER ? 'UNHEALTHY' : 'MISSING_CREDENTIALS'),
      statusReason: defaultEligibleByProvider.OPEN_ROUTER ? null : (credentialByProvider.OPEN_ROUTER ? 'Provider not eligible as default.' : 'Missing OPENROUTER_API_KEY'),
      baseUrl: providers.OPEN_ROUTER?.baseUrl || 'https://openrouter.ai/api/v1',
      models: { default: openRouterModel }
    },
    GEMINI: {
      ...(providers.GEMINI || {}),
      displayName: providers.GEMINI?.displayName || 'Google Gemini',
      credentialSource: 'env',
      credentialEnvVar: 'GEMINI_API_KEY',
      credentialPresent: credentialByProvider.GEMINI,
      enabled: Boolean(providerToggles.GEMINI),
      configured: configuredByProvider.GEMINI,
      healthy: healthyByProvider.GEMINI,
      defaultEligible: defaultEligibleByProvider.GEMINI,
      status: defaultEligibleByProvider.GEMINI ? 'HEALTHY' : (credentialByProvider.GEMINI ? 'UNHEALTHY' : 'MISSING_CREDENTIALS'),
      statusReason: defaultEligibleByProvider.GEMINI ? null : (credentialByProvider.GEMINI ? 'Provider not eligible as default.' : 'Missing GEMINI_API_KEY'),
      models: {
        flash: geminiFlashModel,
        pro: geminiProModel
      }
    },
    ANTHROPIC: {
      ...(providers.ANTHROPIC || {}),
      displayName: providers.ANTHROPIC?.displayName || 'Anthropic',
      credentialSource: 'env',
      credentialEnvVar: 'ANTHROPIC_API_KEY',
      credentialPresent: credentialByProvider.ANTHROPIC,
      enabled: Boolean(providerToggles.ANTHROPIC),
      configured: configuredByProvider.ANTHROPIC,
      healthy: healthyByProvider.ANTHROPIC,
      defaultEligible: defaultEligibleByProvider.ANTHROPIC,
      status: defaultEligibleByProvider.ANTHROPIC ? 'HEALTHY' : (credentialByProvider.ANTHROPIC ? 'UNHEALTHY' : 'MISSING_CREDENTIALS'),
      statusReason: defaultEligibleByProvider.ANTHROPIC ? null : (credentialByProvider.ANTHROPIC ? 'Provider not eligible as default.' : 'Missing ANTHROPIC_API_KEY'),
      models: { default: anthropicModel }
    },
    HUGGINGFACE: {
      ...(providers.HUGGINGFACE || {}),
      displayName: providers.HUGGINGFACE?.displayName || 'Hugging Face',
      credentialSource: 'env',
      credentialEnvVar: 'HUGGINGFACE_API_KEY',
      credentialPresent: credentialByProvider.HUGGINGFACE,
      enabled: Boolean(providerToggles.HUGGINGFACE),
      configured: configuredByProvider.HUGGINGFACE,
      healthy: healthyByProvider.HUGGINGFACE,
      defaultEligible: defaultEligibleByProvider.HUGGINGFACE,
      status: defaultEligibleByProvider.HUGGINGFACE ? 'HEALTHY' : (credentialByProvider.HUGGINGFACE ? 'UNHEALTHY' : 'MISSING_CREDENTIALS'),
      statusReason: defaultEligibleByProvider.HUGGINGFACE ? null : (credentialByProvider.HUGGINGFACE ? 'Provider not eligible as default.' : 'Missing HUGGINGFACE_API_KEY'),
      models: { default: huggingfaceModel }
    },
    COHERE: {
      ...(providers.COHERE || {}),
      displayName: providers.COHERE?.displayName || 'Cohere',
      credentialSource: 'env',
      credentialEnvVar: 'COHERE_API_KEY',
      credentialPresent: credentialByProvider.COHERE,
      enabled: Boolean(providerToggles.COHERE),
      configured: configuredByProvider.COHERE,
      healthy: healthyByProvider.COHERE,
      defaultEligible: defaultEligibleByProvider.COHERE,
      status: defaultEligibleByProvider.COHERE ? 'HEALTHY' : (credentialByProvider.COHERE ? 'UNHEALTHY' : 'MISSING_CREDENTIALS'),
      statusReason: defaultEligibleByProvider.COHERE ? null : (credentialByProvider.COHERE ? 'Provider not eligible as default.' : 'Missing COHERE_API_KEY'),
      models: { default: cohereModel }
    }
  };

  return {
    key: 'ai_settings',
    ai: {
      selectedDefaultProvider,
      activeEffectiveDefaultProvider: resolvedDefaultProvider,
      envDefaultProvider: envDefaultProvider || null,
      fallbackOrder,
      providers: providerMetadata,
      defaultProvider: resolvedDefaultProvider || null,
      openaiModelDefault,
      openaiModelHigh,
      openaiModelFast,
      openRouterModel,
      geminiFlashModel,
      geminiProModel,
      anthropicModel,
      huggingfaceModel,
      cohereModel,
      providerToggles,
      taskRouting,
      taskRoutingVersion: defaultAiSettings.taskRoutingVersion,
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
    const aiSettings = await getAiSettingsDoc();
    if (aiSettings) {
      return normalizeAiSettings(aiSettings);
    }

    const legacy = await getLegacyGlobalConfigDoc();
    if (legacy?.ai) {
      const normalized = normalizeAiSettings({
        ...legacy.ai,
        defaultProvider: legacy.ai.defaultProvider || legacy.defaultProvider
      });
      await saveSystemSettings(normalized);
      return normalized;
    }

    return normalizeAiSettings({});
  } catch { return null; }
};

export const saveSystemSettings = async (settings: any) => {
  const db = await getDb();
  const ai = settings?.ai || {};
  const selectedDefaultProvider = normalizeAiProvider(ai.selectedDefaultProvider || ai.defaultProvider) || null;
  const doc = {
    key: 'ai_settings',
    selectedDefaultProvider,
    fallbackOrder: Array.isArray(ai.fallbackOrder) && ai.fallbackOrder.length
      ? ai.fallbackOrder.map((entry: string) => normalizeAiProvider(entry)).filter(Boolean)
      : defaultAiSettings.fallbackOrder,
    providerToggles: ai.providerToggles || defaultAiSettings.providerToggles,
    taskRouting: ai.taskRouting || defaultAiSettings.taskRouting,
    taskRoutingVersion: typeof ai.taskRoutingVersion === 'number' ? ai.taskRoutingVersion : defaultAiSettings.taskRoutingVersion,
    retentionDays: ai.retentionDays || defaultAiSettings.retentionDays,
    rateLimits: ai.rateLimits || defaultAiSettings.rateLimits,
    providers: {
      OPENAI: {
        displayName: ai.providers?.OPENAI?.displayName || 'OpenAI',
        baseUrl: ai.providers?.OPENAI?.baseUrl || 'https://api.openai.com/v1',
        healthy: ai.providers?.OPENAI?.healthy !== false,
        models: {
          default: ai.openaiModelDefault || ai.openaiModel || ai.defaultModel || defaultAiSettings.openaiModelDefault,
          highReasoning: ai.openaiModelHigh || defaultAiSettings.openaiModelHigh,
          fast: ai.openaiModelFast || defaultAiSettings.openaiModelFast
        }
      },
      OPEN_ROUTER: {
        displayName: ai.providers?.OPEN_ROUTER?.displayName || 'Open Router',
        baseUrl: ai.providers?.OPEN_ROUTER?.baseUrl || 'https://openrouter.ai/api/v1',
        healthy: ai.providers?.OPEN_ROUTER?.healthy !== false,
        models: {
          default: ai.openRouterModel || defaultAiSettings.openRouterModel
        }
      },
      GEMINI: {
        displayName: ai.providers?.GEMINI?.displayName || 'Google Gemini',
        healthy: ai.providers?.GEMINI?.healthy !== false,
        models: {
          flash: ai.geminiFlashModel || ai.flashModel || defaultAiSettings.geminiFlashModel,
          pro: ai.geminiProModel || ai.proModel || defaultAiSettings.geminiProModel
        }
      },
      ANTHROPIC: {
        displayName: ai.providers?.ANTHROPIC?.displayName || 'Anthropic',
        healthy: ai.providers?.ANTHROPIC?.healthy !== false,
        models: {
          default: ai.anthropicModel || defaultAiSettings.anthropicModel
        }
      },
      HUGGINGFACE: {
        displayName: ai.providers?.HUGGINGFACE?.displayName || 'Hugging Face',
        healthy: ai.providers?.HUGGINGFACE?.healthy !== false,
        models: {
          default: ai.huggingfaceModel || defaultAiSettings.huggingfaceModel
        }
      },
      COHERE: {
        displayName: ai.providers?.COHERE?.displayName || 'Cohere',
        healthy: ai.providers?.COHERE?.healthy !== false,
        models: {
          default: ai.cohereModel || defaultAiSettings.cohereModel
        }
      }
    }
  };

  return await saveAiSettingsDoc(doc);
};

export const fetchBundleAssignments = async (filters: {
  bundleId?: string;
  userId?: string;
  assignmentType?: AssignmentType;
  active?: boolean;
}) => listBundleAssignments(filters);

export const upsertBundleAssignment = async (assignment: Partial<BundleAssignment>, userId?: string) =>
  saveBundleAssignment(assignment, userId);

export const updateBundleAssignment = async (id: string, updates: Partial<BundleAssignment>, userId?: string) =>
  patchBundleAssignment(id, updates, userId);

export const fetchBundleProfile = async (bundleId: string) => getBundleProfile(bundleId);

export const fetchBundleProfiles = async (bundleIds?: string[]) => listBundleProfiles(bundleIds);

export const upsertBundleProfile = async (bundleId: string, profile: Partial<BundleProfile>) =>
  saveBundleProfile(bundleId, profile);

export const fetchBundleCapacity = async (bundleIds?: string[]) => listBundleCapacity(bundleIds);

export const upsertBundleCapacity = async (bundleId: string, capacity: { unit: 'POINTS_PER_SPRINT' | 'POINTS_PER_WEEK'; value: number }, userId?: string) =>
  saveBundleCapacity(bundleId, capacity, userId);

export const computeBundleHealth = async (bundleIds: string[]) => await computeBundleHealthFromService(bundleIds);

export const fetchAssignedCmoReviewers = async (bundleId: string): Promise<ReviewReviewer[]> =>
  await fetchAssignedCmoReviewersFromService(bundleId);

export const buildReviewCycle = async (input: {
  bundleId: string;
  cycleNumber: number;
  requestedBy: { userId: string; displayName: string; email?: string };
  reviewers?: ReviewReviewer[];
  status?: ReviewCycle['status'];
  notes?: string;
  dueAt?: string;
}): Promise<ReviewCycle> => await buildReviewCycleFromService(input);

export const addReviewCycleAttachments = async (input: {
  review: ReviewRecord;
  cycleId: string;
  attachments: AttachmentRef[];
}) => await addReviewCycleAttachmentsFromService(input);

export const appendReviewCycle = async (input: {
  review: ReviewRecord;
  bundleId: string;
  requestedBy: { userId: string; displayName: string; email?: string };
  notes?: string;
  dueAt?: string;
  reviewers?: ReviewReviewer[];
}) => await appendReviewCycleFromService(input);

export const updateReviewCycleStatus = async (input: {
  review: ReviewRecord;
  cycleId: string;
  status: ReviewCycle['status'];
  notes?: string;
  dueAt?: string;
  actor?: { userId: string; displayName: string; email?: string };
}) => await updateReviewCycleStatusFromService(input);

export const updateReviewCycleNote = async (input: {
  review: ReviewRecord;
  cycleId: string;
  reviewerNote?: { body: string; createdAt: string; createdBy: CommentAuthor };
  vendorResponse?: { body: string; submittedAt: string; submittedBy: CommentAuthor };
}) => await updateReviewCycleNoteFromService(input);

export const fetchFeedbackPackages = async (resourceType: string, resourceId: string) =>
  listFeedbackPackages(resourceType, resourceId);

export const createFeedbackPackage = async (pkg: Omit<FeedbackPackage, '_id'>) => saveFeedbackPackageRecord(pkg);

export const closeFeedbackPackage = async (id: string, userId: string) => closeFeedbackPackageRecord(id, userId);

export const fetchNotifications = async (userEmail: string) => {
  return await listClassicNotificationsByRecipient(userEmail);
};

export const saveNotification = async (notification: Partial<Notification>) => {
  const { _id, ...rest } = notification as any;
  return await insertClassicNotification({
    ...rest,
    read: false,
    createdAt: new Date().toISOString()
  });
};

export const markNotificationRead = async (id: string) => {
  return await markClassicNotificationRead(id);
};

export const fetchWikiPages = async () => {
  return await listWikiPages();
};

export const fetchWikiPageById = async (id: string) => {
  return await getWikiPageByIdFromRepo(id);
};

export const fetchWikiAssets = async () => {
  return await listWikiAssets();
};

export const fetchWikiAssetById = async (id: string) => {
  return await getWikiAssetByIdFromRepo(id);
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
}) => await saveWikiAiInsightRecord({ targetId, targetType, type, content });

export const fetchWikiAiInsights = async (targetId: string, targetType: 'page' | 'asset') => {
  return await listWikiAiInsights(targetId, targetType);
};

export const clearWikiAiInsights = async (targetId: string, targetType: 'page' | 'asset') => {
  return await clearWikiAiInsightRecords(targetId, targetType);
};

export const saveWikiAsset = async (asset: Partial<WikiAsset>) => {
  return await saveWikiAssetRecord(asset);
};

export const saveWikiPage = async (page: Partial<WikiPage>) => {
  return await saveWikiPageRecord(page);
};

export const fetchWikiHistory = async (pageId: string) => listWikiHistory(pageId);

export const revertWikiPage = async (pageId: string, versionId: string) => {
  return await revertWikiPageRecord(pageId, versionId);
};

export const fetchWikiSpaces = async () => listWikiSpaces();

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
}) => saveWikiQaHistoryRecord({ targetId, targetType, ttlDays, question, answer, provider, model, userEmail });

export const fetchWikiQaHistory = async (targetId: string, targetType: 'page' | 'asset' = 'page', limit: number = 10) =>
  listWikiQaHistory(targetId, targetType, limit);

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
}) => saveWikiAssetAiHistoryRecord({ assetId, task, result, provider, model, userEmail, ttlDays });

export const fetchWikiAssetAiHistory = async (assetId: string, limit: number = 10) =>
  listWikiAssetAiHistory(assetId, limit);

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
}) => saveAiAuditLogRecord({ task, provider, model, targetType, targetId, success, error, latencyMs, identity, ttlDays });

export const checkAndIncrementAiRateLimit = async (identity: string, limit: number) =>
  checkAndIncrementAiRateLimitRecord(identity, limit);

export const fetchAiAnalysisCache = async (key: string) => getAiAnalysisCache(key);

export const saveAiAnalysisCache = async (key: string, report: any) => saveAiAnalysisCacheRecord(key, report);

export const saveWikiSpace = async (space: Partial<WikiSpace>) => saveWikiSpaceRecord(space);

export const fetchWikiComments = async (pageId: string) => listWikiComments(pageId);

export const saveWikiComment = async (commentData: any) => addWikiCommentRecord(commentData);

export const fetchBundles = async (activeOnly: boolean = false) => listBundles(activeOnly);

export const saveBundle = async (bundle: Partial<Bundle>, user?: any) => saveBundleRecord(bundle);

export const fetchWikiThemes = async (activeOnly: boolean = false) => listWikiThemes(activeOnly);

export const saveWikiTheme = async (theme: Partial<WikiTheme>) => saveWikiThemeRecord(theme);

export const deleteWikiTheme = async (id: string) => deleteWikiThemeRecord(id);

export const fetchWikiTemplates = async ({
  documentTypeId,
  activeOnly = false
}: {
  documentTypeId?: string;
  activeOnly?: boolean;
}) => listWikiTemplates({ documentTypeId, activeOnly });

export const saveWikiTemplate = async (template: Partial<WikiTemplate>, user?: any) =>
  saveWikiTemplateRecord(template, user);

export const deactivateWikiTemplate = async (id: string, user?: any) =>
  deactivateWikiTemplateRecord(id, user);

export const fetchEvents = async (params: {
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
}) => listEvents(params);

export const getUserEventState = async (userId: string) => getUserEventStateRecord(userId);

const makeCommentStateKey = (resourceType: string, resourceId: string) => {
  return Buffer.from(`${resourceType}::${resourceId}`).toString('base64url');
};

export const setUserEventState = async (userId: string, lastSeenAt: string) =>
  saveUserEventStateRecord(userId, lastSeenAt);

export const getCommentLastSeen = async (userId: string, resourceType: string, resourceId: string) => {
  return await getCommentLastSeenFromRepo(userId, resourceType, resourceId);
};

export const setCommentLastSeen = async (
  userId: string,
  resourceType: string,
  resourceId: string,
  lastSeenAt: string
) => {
  return await setCommentLastSeenInRepo(userId, resourceType, resourceId, lastSeenAt);
};

export const fetchCommentUnreadCount = async (userId: string, resourceType: string, resourceId: string) => {
  return await countUnreadCommentThreads(userId, resourceType, resourceId);
};

export const fetchUnreadEventsCount = async (userId: string) => countUnreadEvents(userId);

export const fetchCommentThreads = async (resourceType: string, resourceId: string) => {
  return await listCommentThreads(resourceType, resourceId);
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
  return await createCommentThreadRecord({ resource, anchor, body, author, mentions, reviewId, reviewCycleId });
};

export const fetchCommentMessages = async (threadId: string) => {
  return await listCommentMessages(threadId);
};

export const fetchCommentThreadById = async (threadId: string) => {
  return await getCommentThreadByIdFromRepo(threadId);
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
  return await addCommentMessageRecord({ threadId, body, author, mentions });
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
  return await listCommentThreadsInbox({ userId, resourceType, status, mentionsOnly, participatingOnly, since, search, limit });
};

export const updateCommentThreadStatus = async (threadId: string, status: 'open' | 'resolved') => {
  return await setCommentThreadStatus(threadId, status);
};

export const fetchReview = async (resourceType: string, resourceId: string): Promise<ReviewRecord | null> => {
  return await getReviewByResource(resourceType, resourceId);
};

export const fetchReviewById = async (reviewId: string): Promise<ReviewRecord | null> => {
  return await getReviewByIdFromRepo(reviewId);
};

export const saveReview = async (review: Partial<ReviewRecord>) => {
  return await saveReviewRecord(review);
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
  const outcome = await syncReviewCycleWorkItemRecord({
    reviewId,
    cycleId,
    actorDisplayName: actor.displayName || actor.email || 'System'
  });
  return outcome?.item || null;
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

export const fetchApplications = async (bundleId?: string, activeOnly: boolean = false) =>
  listApplications(bundleId, activeOnly);

export const saveApplication = async (app: Partial<Application>, user?: any) => saveApplicationRecord(app);

export const fetchTaxonomyCategories = async (activeOnly: boolean = false) => listTaxonomyCategories(activeOnly);

export const saveTaxonomyCategory = async (cat: Partial<TaxonomyCategory>) => saveTaxonomyCategoryRecord(cat);

export const fetchTaxonomyDocumentTypes = async (activeOnly: boolean = false, categoryId?: string) =>
  listTaxonomyDocumentTypes(activeOnly, categoryId);

export const saveTaxonomyDocumentType = async (type: Partial<TaxonomyDocumentType>) =>
  saveTaxonomyDocumentTypeRecord(type);

export const ensureWorkItemsIndexes = async (_db?: any) => {
  await ensureWorkItemsIndexesInRepo();
};

const ensureMilestonesIndexes = async (db: any) => {
  // Status/date queries for roadmap + rollups
  await db.collection('milestones').createIndex({ status: 1, startDate: 1, endDate: 1 });
};

const ensureSprintsIndexes = async (db: any) => {
  await db.collection('workitems_sprints').createIndex({ startDate: 1, endDate: 1, status: 1 });
  await db.collection('workitems_sprints').createIndex({ bundleId: 1, status: 1 });
};

let warnedLegacyWorkItems = false;
const warnLegacyWorkItems = async (db: any) => {
  if (warnedLegacyWorkItems) return;
  warnedLegacyWorkItems = true;
  try {
    const legacyCount = await db.collection('work_items').countDocuments({}, { limit: 1 });
    if (legacyCount > 0) {
      console.warn('Legacy collection work_items contains data. Work Items now use workitems; consider migrating.');
    }
  } catch {
    // Best-effort warning only.
  }
};

const canonicalWorkItemLinkTypes = new Set(['BLOCKS', 'RELATES_TO', 'DUPLICATES']);

const normalizeWorkItemId = (item: any) => {
  const id = item?._id || item?.id || '';
  return id ? String(id) : '';
};

const collectWorkItemIdCandidates = (ids: string[]) => {
  const candidates: Array<string | ObjectId> = [];
  ids.forEach((id) => {
    if (!id) return;
    candidates.push(id);
    if (ObjectId.isValid(id)) candidates.push(new ObjectId(id));
  });
  return candidates;
};

const addUniqueLinkSummary = (
  list: any[],
  seen: Set<string>,
  entry: { type: string; targetId: string; targetKey?: string; targetTitle?: string; targetStatus?: string }
) => {
  const key = `${entry.type}:${entry.targetId}`;
  if (seen.has(key)) return;
  seen.add(key);
  list.push(entry);
};

export const deriveWorkItemLinkSummary = async (items: any[]) =>
  await deriveWorkItemLinkSummaryFromRepo(items);

export const detectBlocksCycle = async (sourceId: string, targetId: string) => {
  return await detectBlocksCycleFromRepo(sourceId, targetId);
};

const ensureWorkItemAttachmentIndexes = async (db: any) => {
  await db.collection('workitems_attachments').createIndex({ workItemId: 1, createdAt: -1 });
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

export const createReviewWorkItem = async (input: {
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
}) => await createReviewWorkItemRecord(input);

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
  const outcome = await closeReviewWorkItemRecord({
    reviewId,
    cycleId,
    actorDisplayName: actor.displayName,
    resolution
  });
  if (!outcome) return null;
  try {
    await emitEvent({
      ts: outcome.now,
      type: 'workitems.item.statuschanged',
      actor: { userId: actor.userId, displayName: actor.displayName, email: actor.email },
      resource: { type: 'workitems.item', id: String(outcome.item._id || outcome.item.id), title: outcome.item.title },
      context: { bundleId: outcome.item.bundleId, appId: outcome.item.applicationId },
      payload: { from: outcome.item.status, to: WorkItemStatus.DONE }
    });
  } catch {}
  return outcome.item;
};

export const createWorkPlanFromIntake = async (input: {
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
}) => await createSimpleWorkPlanFromIntakeRecord(input);

export const fetchWorkItems = async (filters: any) => await fetchWorkItemsFromRepo(filters);

export const fetchWorkItemById = async (id: string) => await fetchWorkItemByIdFromRepo(id);

export const fetchWorkItemByKeyOrId = async (input: string) => await fetchWorkItemByKeyOrIdFromRepo(input);

export const addWorkItemLink = async (sourceId: string, targetId: string, type: string, user?: any) => {
  if (!sourceId || !targetId) throw new Error('Missing link identifiers');
  if (sourceId === targetId) throw new Error('Self link not allowed');
  if (!canonicalWorkItemLinkTypes.has(type)) throw new Error('Invalid link type');
  const userName = user?.name || 'DeliveryHub System';
  return await addWorkItemLinkRecord(sourceId, targetId, type, userName);
};

export const removeWorkItemLink = async (sourceId: string, targetId: string, type: string, user?: any) => {
  if (!sourceId || !targetId) throw new Error('Missing link identifiers');
  if (!canonicalWorkItemLinkTypes.has(type)) throw new Error('Invalid link type');
  const userName = user?.name || 'DeliveryHub System';
  return await removeWorkItemLinkRecord(sourceId, targetId, type, userName);
};

export const saveWorkItem = async (item: Partial<WorkItem>, user?: any) => {
  return await saveWorkItemWithSideEffects(item, user, emitEvent);
};

export const updateWorkItemStatus = async (id: string, toStatus: string, newRank: number, user: any) => {
  return await updateWorkItemStatusWithSideEffects(id, toStatus, newRank, user, emitEvent);
};

export const fetchMilestones = async (filters: any) => listMilestones(filters || {});

export const saveMilestone = async (milestone: Partial<Milestone>) => saveMilestoneRecord(milestone);

export const deleteMilestone = async (id: string) => deleteMilestoneRecord(id);

export const computeMilestoneRollup = async (milestoneId: string) => await computeMilestoneRollupFromService(milestoneId);

export const computeMilestoneRollups = async (milestoneIds: string[]) => await computeMilestoneRollupsFromService(milestoneIds);

export const searchUsers = async (query: string) => {
  return await searchUsersByQuery(query);
};

export const fetchAdmins = async () => {
  return await listAdmins();
};

export const fetchUsersByIds = async (ids: string[]) => {
  return await listUsersByIds(ids);
};

export const resolveMentionUsers = async (tokens: string[]) => {
  return await resolveUsersForMentions(tokens);
};

export const fetchWorkItemsBoard = async (filters: any) => await fetchWorkItemsBoardFromRepo(filters);

export const fetchSprints = async (filters: any) => listSprints(filters || {});

export const computeSprintRollups = async (filters: {
  bundleId?: string;
  milestoneId?: string;
  sprintIds?: string[];
  status?: string;
  limit?: number;
}) => await computeSprintRollupsFromService(filters);

export const saveSprint = async (sprint: Partial<Sprint>) => saveSprintRecord(sprint);

export const fetchWorkItemTree = async (filters: any) => await fetchWorkItemTreeFromRepo(filters);

export const fetchArchitectureDiagrams = async (filters: any = {}) => {
  return await listArchitectureDiagrams(filters);
};

export const fetchDiagramTemplates = async (filters: any = {}) => listDiagramTemplates(filters);

export const fetchDiagramTemplateById = async (id: string) => getDiagramTemplateById(id);

export const saveDiagramTemplate = async (template: any, user?: { name?: string }) =>
  saveDiagramTemplateRecord(template, user);

export const deleteDiagramTemplate = async (id: string) => deleteDiagramTemplateRecord(id);

export const fetchArchitectureDiagramsWithReviewSummary = async (filters: any = {}) =>
  await fetchArchitectureDiagramsWithReviewSummaryFromService(filters);

export const fetchArchitectureDiagramById = async (id: string) => getArchitectureDiagramById(id);

export const saveArchitectureDiagram = async (diagram: Partial<ArchitectureDiagram>, user: any) =>
  saveArchitectureDiagramRecord(diagram, user);

export const deleteArchitectureDiagram = async (id: string) => deleteArchitectureDiagramRecord(id);

export const fetchCapabilities = async () => listCapabilities();

export const saveCapability = async (capability: Partial<BusinessCapability>) => saveCapabilityRecord(capability);

export const deleteCapability = async (id: string) => deleteCapabilityRecord(id);

export const fetchInterfaces = async (appId?: string) => listInterfaces(appId);

export const saveInterface = async (data: Partial<AppInterface>) => saveInterfaceRecord(data);

export const deleteInterface = async (id: string) => deleteInterfaceRecord(id);
