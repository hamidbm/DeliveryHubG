export const extractMentionTokens = (text: string) => {
  if (!text) return [];
  const regex = /@([a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}|[a-zA-Z0-9._-]+)/g;
  const matches = Array.from(text.matchAll(regex));
  const tokens = matches.map((m) => m[1]).filter(Boolean);
  return Array.from(new Set(tokens));
};
