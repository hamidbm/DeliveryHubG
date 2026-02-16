type OpenAiReasoningEffort = 'low' | 'medium' | 'high' | 'xhigh';

const extractOutputText = (data: any) => {
  if (typeof data?.output_text === 'string') return data.output_text;
  if (Array.isArray(data?.output_text)) return data.output_text.join('');
  const output = Array.isArray(data?.output) ? data.output : [];
  for (const item of output) {
    const content = Array.isArray(item?.content) ? item.content : [];
    for (const part of content) {
      if (typeof part?.text === 'string') return part.text;
    }
  }
  return '';
};

const fetchWithTimeout = async (url: string, options: RequestInit, timeoutMs: number) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
};

export const generateOpenAiResponse = async ({
  prompt,
  model,
  apiKey,
  reasoningEffort,
  timeoutMs = 120000
}: {
  prompt: string;
  model: string;
  apiKey: string;
  reasoningEffort?: OpenAiReasoningEffort;
  timeoutMs?: number;
}) => {
  const body: any = {
    model,
    input: prompt
  };
  if (reasoningEffort) {
    body.reasoning = { effort: reasoningEffort };
  }

  const requestInit: RequestInit = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify(body)
  };

  const maxAttempts = 2;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await fetchWithTimeout('https://api.openai.com/v1/responses', requestInit, timeoutMs);
      const data = await response.json();
      if (data?.error) {
        throw new Error(data.error.message || 'OpenAI API Error');
      }
      return extractOutputText(data) || 'AI response unavailable.';
    } catch (error: any) {
      const code = error?.cause?.code || error?.code;
      if (attempt < maxAttempts && (code === 'UND_ERR_HEADERS_TIMEOUT' || error?.name === 'AbortError')) {
        continue;
      }
      throw error;
    }
  }
  return 'AI response unavailable.';
};

export const pickOpenAiReasoningEffort = (model: string) => {
  if (model.startsWith('gpt-5.2-pro')) return 'xhigh';
  if (model.startsWith('gpt-5')) return 'high';
  return undefined;
};
