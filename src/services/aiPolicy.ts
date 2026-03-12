type ProviderId = 'OPENAI' | 'OPEN_ROUTER' | 'GEMINI' | 'ANTHROPIC' | 'HUGGINGFACE' | 'COHERE';

const MODEL_KEYS = new Set([
  'openaiModelDefault',
  'openaiModelHigh',
  'openaiModelFast',
  'openRouterModel',
  'geminiFlashModel',
  'geminiProModel',
  'anthropicModel',
  'huggingfaceModel',
  'cohereModel'
]);

export const resolveModel = (aiSettings: any, modelRef?: string, fallback?: string) => {
  if (!modelRef) return fallback || '';
  if (MODEL_KEYS.has(modelRef) && aiSettings?.[modelRef]) return aiSettings[modelRef];
  return modelRef;
};

export const isProviderEnabled = (aiSettings: any, provider: ProviderId) => {
  const toggles = aiSettings?.providerToggles || {};
  if (typeof toggles[provider] === 'boolean') return toggles[provider];
  return provider === 'OPENAI' || provider === 'GEMINI';
};

export const chooseFallbackProvider = (aiSettings: any, preferred: ProviderId): ProviderId => {
  if (isProviderEnabled(aiSettings, preferred)) return preferred;
  const order: ProviderId[] = ['OPEN_ROUTER', 'OPENAI', 'GEMINI', 'ANTHROPIC', 'HUGGINGFACE', 'COHERE'];
  for (const candidate of order) {
    if (isProviderEnabled(aiSettings, candidate)) return candidate;
  }
  return preferred;
};

export const resolveTaskRouting = (aiSettings: any, taskKey: string, defaultProvider: ProviderId) => {
  const routing = aiSettings?.taskRouting?.[taskKey] || {};
  const provider = chooseFallbackProvider(aiSettings, (routing.provider as ProviderId) || defaultProvider);
  const model = resolveModel(aiSettings, routing.model, '');
  return { provider, model };
};

export const getRetentionDays = (aiSettings: any, key: string, fallback: number) => {
  const value = aiSettings?.retentionDays?.[key];
  return typeof value === 'number' ? value : fallback;
};

export const getRateLimitPerHour = (aiSettings: any, fallback: number) => {
  const value = aiSettings?.rateLimits?.perUserPerHour;
  return typeof value === 'number' ? value : fallback;
};

export const getRequestIdentity = (request: Request) => {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return request.headers.get('x-real-ip') || 'unknown';
};
