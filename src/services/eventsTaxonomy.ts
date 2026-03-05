type EventCategory = 'governance' | 'scope' | 'dependency' | 'criticalpath' | 'integrations' | 'notifications' | 'security' | 'perf' | 'other';

const aliasMap: Record<string, string> = {
  'workitem.github.linked': 'workitem.github.pr.linked',
  'workitem.github.merged': 'workitem.github.pr.merged'
};

const categoryRules: Array<{ prefix: RegExp; category: EventCategory }> = [
  { prefix: /^milestones\.milestone\./, category: 'governance' },
  { prefix: /^milestones\.commitdrift\./, category: 'governance' },
  { prefix: /^milestones\.baseline\./, category: 'scope' },
  { prefix: /^sprints\.sprint\./, category: 'governance' },
  { prefix: /^milestones\.scope\./, category: 'scope' },
  { prefix: /^dependency\./, category: 'dependency' },
  { prefix: /^criticalpath\./, category: 'criticalpath' },
  { prefix: /^integrations\./, category: 'integrations' },
  { prefix: /^workitem\.github\./, category: 'integrations' },
  { prefix: /^notifications\./, category: 'notifications' },
  { prefix: /^security\./, category: 'security' },
  { prefix: /^perf\./, category: 'perf' }
];

export const normalizeEventType = (rawType: string) => {
  const raw = String(rawType || '').trim();
  const canonicalType = aliasMap[raw] || raw;
  const modulePrefix = canonicalType.split('.')[0] || 'unknown';
  const category = getEventCategory(canonicalType);
  return { canonicalType, category, modulePrefix };
};

export const getEventCategory = (type: string): EventCategory => {
  const raw = String(type || '').trim();
  for (const rule of categoryRules) {
    if (rule.prefix.test(raw)) return rule.category;
  }
  return 'other';
};

export const getEventAliases = () => ({ ...aliasMap });
