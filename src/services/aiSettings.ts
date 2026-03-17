import { getDb } from '../shared/db/client';
import { getAiSettingsDoc, getLegacyGlobalConfigDoc, saveAiSettingsDoc } from '../server/db/repositories/systemSettingsRepo';

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
      defaultModel: openaiModelDefault,
      flashModel: geminiFlashModel,
      proModel: geminiProModel
    }
  };
};

export const fetchSystemSettings = async () => {
  try {
    const aiSettings = await getAiSettingsDoc();
    if (aiSettings) return normalizeAiSettings(aiSettings);

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
  } catch {
    return null;
  }
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
        healthy: ai.providers?.OPENAI?.healthy !== false,
        baseUrl: ai.providers?.OPENAI?.baseUrl || 'https://api.openai.com/v1',
        models: {
          default: ai.openaiModelDefault || ai.defaultModel || defaultAiSettings.openaiModelDefault,
          highReasoning: ai.openaiModelHigh || defaultAiSettings.openaiModelHigh,
          fast: ai.openaiModelFast || defaultAiSettings.openaiModelFast
        }
      },
      OPEN_ROUTER: {
        displayName: ai.providers?.OPEN_ROUTER?.displayName || 'Open Router',
        healthy: ai.providers?.OPEN_ROUTER?.healthy !== false,
        baseUrl: ai.providers?.OPEN_ROUTER?.baseUrl || 'https://openrouter.ai/api/v1',
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
