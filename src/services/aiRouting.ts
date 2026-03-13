import { resolveTaskRouting } from './aiPolicy';
import { generateGeminiText } from './geminiService';
import { generateOpenAiResponse, pickOpenAiReasoningEffort } from './openaiService';

export type AiProviderId = 'OPENAI' | 'OPEN_ROUTER' | 'GEMINI' | 'ANTHROPIC' | 'HUGGINGFACE' | 'COHERE';
export type AiErrorCode = 'AI_PROVIDER_NOT_CONFIGURED' | 'AI_PROVIDER_CREDENTIALS_MISSING' | 'AI_PROVIDER_RATE_LIMIT' | 'AI_PROVIDER_REQUEST_FAILED' | 'AI_UNKNOWN_ERROR';

export type AttemptedProvider = {
  provider: string;
  model: string;
};

type AiSettingsLike = {
  defaultProvider?: string;
  selectedDefaultProvider?: string;
  activeEffectiveDefaultProvider?: string;
  envDefaultProvider?: string;
  fallbackOrder?: string[];
  taskRouting?: Record<string, { provider?: string; model?: string }>;
  openaiModelDefault?: string;
  openaiModelHigh?: string;
  openaiModel?: string;
  defaultModel?: string;
  openRouterModel?: string;
  geminiFlashModel?: string;
  geminiProModel?: string;
  flashModel?: string;
  proModel?: string;
};

const SUPPORTED_PROVIDERS: AiProviderId[] = ['OPENAI', 'OPEN_ROUTER', 'GEMINI', 'ANTHROPIC', 'HUGGINGFACE', 'COHERE'];

const normalizeProvider = (value?: string | null): AiProviderId | null => {
  if (!value) return null;
  const normalized = String(value).trim().toUpperCase().replace(/[\s-]+/g, '_');
  if ((SUPPORTED_PROVIDERS as string[]).includes(normalized)) return normalized as AiProviderId;
  return null;
};

const inferDefaultProvider = (aiSettings: AiSettingsLike): AiProviderId | null => {
  return normalizeProvider(aiSettings.activeEffectiveDefaultProvider)
    || normalizeProvider(aiSettings.defaultProvider)
    || normalizeProvider(aiSettings.envDefaultProvider)
    || normalizeProvider(process.env.AI_DEFAULT_PROVIDER || null);
};

export const resolveAiTaskProvider = (aiSettings: AiSettingsLike, taskKey: string) => {
  const taskRouteProvider = normalizeProvider(aiSettings.taskRouting?.[taskKey]?.provider || null);
  const taskRouteModelRef = aiSettings.taskRouting?.[taskKey]?.model || null;
  const defaultProvider = inferDefaultProvider(aiSettings);
  const preferredProvider = taskRouteProvider || defaultProvider || null;
  const routed = preferredProvider
    ? resolveTaskRouting(aiSettings, taskKey, preferredProvider)
    : { provider: null, model: '' };
  const routedProvider = normalizeProvider(routed.provider) || preferredProvider;
  return {
    task: taskKey,
    taskRouteProvider: taskRouteProvider || null,
    taskRouteModelRef,
    adminSelectedDefault: aiSettings.selectedDefaultProvider || aiSettings.defaultProvider || null,
    activeEffectiveDefault: aiSettings.activeEffectiveDefaultProvider || aiSettings.defaultProvider || null,
    envDefault: aiSettings.envDefaultProvider || process.env.AI_DEFAULT_PROVIDER || null,
    fallbackOrder: aiSettings.fallbackOrder || null,
    routedProvider,
    routedModel: routed.model || '',
    openAiIntended: routedProvider === 'OPENAI' || routedProvider === 'OPEN_ROUTER',
    geminiProviderLabel: routedProvider === 'GEMINI' ? 'GEMINI' : 'GEMINI_FALLBACK'
  };
};

export const resolveOpenAiExecution = (
  aiSettings: AiSettingsLike,
  routedProvider: AiProviderId,
  routedModel: string,
  fallbackModel: string
) => {
  if (routedProvider !== 'OPENAI' && routedProvider !== 'OPEN_ROUTER') {
    return { available: false as const, reason: 'Provider is not OpenAI-compatible' };
  }

  const isOpenRouter = routedProvider === 'OPEN_ROUTER';
  const apiKey = isOpenRouter ? process.env.OPENROUTER_API_KEY : process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return {
      available: false as const,
      reason: isOpenRouter ? 'Missing OPENROUTER_API_KEY' : 'Missing OPENAI_API_KEY',
      provider: routedProvider
    };
  }

  const configuredModel = routedModel
    || (isOpenRouter ? aiSettings.openRouterModel : aiSettings.openaiModelDefault)
    || aiSettings.openaiModelHigh
    || aiSettings.openaiModel
    || aiSettings.defaultModel
    || fallbackModel;

  const model = !isOpenRouter && !configuredModel.startsWith('gpt-')
    ? fallbackModel
    : configuredModel;

  return {
    available: true as const,
    provider: routedProvider,
    providerLabel: isOpenRouter ? 'OPEN_ROUTER' : 'OPENAI',
    apiKey,
    model,
    baseUrl: isOpenRouter ? 'https://openrouter.ai/api/v1' : undefined,
    extraHeaders: isOpenRouter ? { 'HTTP-Referer': 'https://deliveryhub.local', 'X-Title': 'DeliveryHub' } : undefined
  };
};

export const logAiProviderResolution = (
  resolution: ReturnType<typeof resolveAiTaskProvider>,
  chosenProvider: string,
  fallbackReason: string | null
) => {
  console.info('AI provider resolution', {
    task: resolution.task,
    taskRouteProvider: resolution.taskRouteProvider,
    adminSelectedDefault: resolution.adminSelectedDefault,
    activeEffectiveDefault: resolution.activeEffectiveDefault,
    envDefault: resolution.envDefault,
    fallbackOrder: resolution.fallbackOrder,
    chosenProvider,
    fallbackReason
  });
};

const classifyProviderFailureCode = (message: string): AiErrorCode => {
  const lower = message.toLowerCase();
  if (lower.includes('missing openrouter_api_key') || lower.includes('missing openai_api_key') || lower.includes('gemini api key is missing')) {
    return 'AI_PROVIDER_CREDENTIALS_MISSING';
  }
  if (
    lower.includes('insufficient credits')
    || lower.includes('quota')
    || lower.includes('resource_exhausted')
    || lower.includes('rate limit')
    || lower.includes('429')
  ) {
    return 'AI_PROVIDER_RATE_LIMIT';
  }
  if (lower.includes('provider request failed') || lower.includes('timeout')) {
    return 'AI_PROVIDER_REQUEST_FAILED';
  }
  return 'AI_UNKNOWN_ERROR';
};

const createAiExecutionError = (
  message: string,
  attemptedProviders: AttemptedProvider[],
  code?: AiErrorCode
) => {
  const error = new Error(message) as Error & {
    code: AiErrorCode;
    attemptedProviders: AttemptedProvider[];
    lastAttemptedProvider: string | null;
    lastAttemptedModel: string | null;
  };
  error.code = code || classifyProviderFailureCode(message);
  error.attemptedProviders = attemptedProviders;
  const last = attemptedProviders[attemptedProviders.length - 1];
  error.lastAttemptedProvider = last?.provider || null;
  error.lastAttemptedModel = last?.model || null;
  return error;
};

export const executeAiTextTask = async ({
  aiSettings,
  taskKey,
  prompt,
  openAiFallbackModel,
  geminiModel,
  logDecision = true,
  timeoutMs = 20000
}: {
  aiSettings: AiSettingsLike;
  taskKey: string;
  prompt: string;
  openAiFallbackModel: string;
  geminiModel: string;
  logDecision?: boolean;
  timeoutMs?: number;
}) => {
  const resolution = resolveAiTaskProvider(aiSettings, taskKey);
  const attemptedProviders: AttemptedProvider[] = [];
  let fallbackReason: string | null = null;
  if (!resolution.routedProvider) {
    throw createAiExecutionError(
      'No default AI provider is configured. Ask an admin to set a default provider in Admin -> AI Settings, or set AI_DEFAULT_PROVIDER before starting the app.',
      attemptedProviders,
      'AI_PROVIDER_NOT_CONFIGURED'
    );
  }

  if (resolution.openAiIntended) {
    const isLegacyOpenAiModelRefOnOpenRouter =
      resolution.routedProvider === 'OPEN_ROUTER'
      && (resolution.taskRouteProvider === null || resolution.taskRouteProvider === 'OPEN_ROUTER')
      && (resolution.taskRouteModelRef === 'openaiModelDefault'
        || resolution.taskRouteModelRef === 'openaiModelHigh'
        || resolution.taskRouteModelRef === 'openaiModelFast');
    const routedModelForExecution = isLegacyOpenAiModelRefOnOpenRouter ? '' : resolution.routedModel;
    const openAiExecution = resolveOpenAiExecution(aiSettings, resolution.routedProvider, routedModelForExecution, openAiFallbackModel);
    if (openAiExecution.available) {
      attemptedProviders.push({ provider: openAiExecution.providerLabel, model: openAiExecution.model });
      if (logDecision) {
        console.info('AI provider attempt', {
          task: taskKey,
          provider: openAiExecution.providerLabel,
          model: openAiExecution.model
        });
      }
      try {
        const text = await generateOpenAiResponse({
          prompt,
          model: openAiExecution.model,
          apiKey: openAiExecution.apiKey,
          baseUrl: openAiExecution.baseUrl,
          extraHeaders: openAiExecution.extraHeaders,
          reasoningEffort: pickOpenAiReasoningEffort(openAiExecution.model),
          timeoutMs
        });
        if (!text || text.trim().toLowerCase() === 'ai response unavailable.') {
          throw new Error('Provider request failed: empty/unavailable response');
        }
        if (logDecision) {
          logAiProviderResolution(resolution, openAiExecution.providerLabel, null);
        }
        return {
          text,
          provider: openAiExecution.providerLabel,
          model: openAiExecution.model,
          resolution,
          fallbackReason: null as string | null
        };
      } catch (error: any) {
        fallbackReason = error?.message ? `Provider request failed: ${error.message}` : 'Provider request failed';
        if (logDecision) {
          console.warn('AI provider attempt failed', {
            task: taskKey,
            provider: openAiExecution.providerLabel,
            model: openAiExecution.model,
            reason: fallbackReason
          });
        }
      }
    } else {
      fallbackReason = openAiExecution.reason;
      if (logDecision) {
        console.warn('AI provider unavailable', {
          task: taskKey,
          provider: resolution.routedProvider,
          reason: fallbackReason
        });
      }
    }
  }

  if (!process.env.GEMINI_API_KEY) {
    throw createAiExecutionError('Gemini API key is missing.', attemptedProviders, 'AI_PROVIDER_CREDENTIALS_MISSING');
  }

  attemptedProviders.push({ provider: 'GEMINI', model: geminiModel });
  if (logDecision) {
    console.info('AI provider attempt', {
      task: taskKey,
      provider: 'GEMINI',
      model: geminiModel
    });
  }
  let text = '';
  try {
    text = await Promise.race([
      generateGeminiText(prompt, geminiModel),
      new Promise<string>((_, reject) =>
        setTimeout(() => reject(new Error(`Provider request failed: timeout after ${timeoutMs}ms`)), timeoutMs)
      )
    ]);
    if (!text || text.trim().toLowerCase() === 'ai response unavailable.') {
      throw new Error('Provider request failed: empty/unavailable response');
    }
  } catch (error: any) {
    const message = error?.message || fallbackReason || 'All configured providers are unavailable.';
    throw createAiExecutionError(message, attemptedProviders);
  }
  if (logDecision) {
    logAiProviderResolution(resolution, 'GEMINI', fallbackReason);
  }
  return {
    text,
    provider: resolution.geminiProviderLabel,
    model: geminiModel,
    resolution,
    fallbackReason
  };
};
