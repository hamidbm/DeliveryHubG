import { resolveTaskRouting } from './aiPolicy';
import { generateGeminiText } from './geminiService';
import { generateOpenAiResponse, pickOpenAiReasoningEffort } from './openaiService';

export type AiProviderId = 'OPENAI' | 'OPEN_ROUTER' | 'GEMINI' | 'ANTHROPIC' | 'HUGGINGFACE' | 'COHERE';

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
  const defaultProvider = inferDefaultProvider(aiSettings);
  const preferredProvider = taskRouteProvider || defaultProvider || null;
  const routed = preferredProvider
    ? resolveTaskRouting(aiSettings, taskKey, preferredProvider)
    : { provider: null, model: '' };
  const routedProvider = normalizeProvider(routed.provider) || preferredProvider;
  return {
    task: taskKey,
    taskRouteProvider: taskRouteProvider || null,
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

export const executeAiTextTask = async ({
  aiSettings,
  taskKey,
  prompt,
  openAiFallbackModel,
  geminiModel,
  logDecision = true
}: {
  aiSettings: AiSettingsLike;
  taskKey: string;
  prompt: string;
  openAiFallbackModel: string;
  geminiModel: string;
  logDecision?: boolean;
}) => {
  const resolution = resolveAiTaskProvider(aiSettings, taskKey);
  let fallbackReason: string | null = null;
  if (!resolution.routedProvider) {
    throw new Error('No default AI provider is configured. Ask an admin to set a default provider in Admin -> AI Settings, or set AI_DEFAULT_PROVIDER before starting the app.');
  }

  if (resolution.openAiIntended) {
    const openAiExecution = resolveOpenAiExecution(aiSettings, resolution.routedProvider, resolution.routedModel, openAiFallbackModel);
    if (openAiExecution.available) {
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
          reasoningEffort: pickOpenAiReasoningEffort(openAiExecution.model)
        });
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
    throw new Error('Gemini API key is missing.');
  }

  if (logDecision) {
    console.info('AI provider attempt', {
      task: taskKey,
      provider: 'GEMINI',
      model: geminiModel
    });
  }
  const text = await generateGeminiText(prompt, geminiModel);
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
