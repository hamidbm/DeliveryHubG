import { EntityReference, EntityType, EvidenceItem, PortfolioReportProvenance } from '../../types/ai';

const ENTITY_LABELS: Record<EntityType, string> = {
  workitem: 'Work Items',
  application: 'Applications',
  bundle: 'Bundles',
  milestone: 'Milestones',
  review: 'Reviews'
};

const uniqEntities = (items: EntityReference[]) => {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${item.type}:${item.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const parseCountSecondary = (text: string) => {
  const normalized = text.toLowerCase();
  const outOf = normalized.match(/(\d+)\s+(?:out of|of)\s+(\d+)/i);
  if (outOf) return `${outOf[1]} of ${outOf[2]}`;
  const leading = normalized.match(/^(\d+)\b/);
  if (leading) return leading[1];
  return undefined;
};

const pushGroup = (target: EntityReference[], type: EntityType, id: string, label: string, secondary?: string) => {
  target.push({
    type,
    id,
    label,
    ...(secondary ? { secondary } : {})
  });
};

const extractEntityRefsFromText = (text: string): EntityReference[] => {
  const refs: EntityReference[] = [];
  const normalized = text.toLowerCase();
  const countSecondary = parseCountSecondary(text);

  const pushRegexMatches = (regex: RegExp, type: EntityType, makeLabel?: (id: string) => string) => {
    const matches = normalized.match(regex) || [];
    matches.forEach((id) => {
      refs.push({
        type,
        id,
        label: makeLabel ? makeLabel(id) : `${ENTITY_LABELS[type].slice(0, -1)} ${id.toUpperCase()}`
      });
    });
  };

  pushRegexMatches(/\bwi-[a-z0-9_-]+\b/g, 'workitem', (id) => `Work Item ${id.toUpperCase()}`);
  pushRegexMatches(/\bapp-[a-z0-9_-]+\b/g, 'application', (id) => `Application ${id.toUpperCase()}`);
  pushRegexMatches(/\bbundle-[a-z0-9_-]+\b/g, 'bundle', (id) => `Bundle ${id.toUpperCase()}`);
  pushRegexMatches(/\bmilestone-[a-z0-9_-]+\b/g, 'milestone', (id) => `Milestone ${id.toUpperCase()}`);
  pushRegexMatches(/\breview-[a-z0-9_-]+\b/g, 'review', (id) => `Review ${id.toUpperCase()}`);

  if (/\bwork\s*items?\b/.test(normalized) || /\bitem(s)?\b/.test(normalized)) {
    if (normalized.includes('unassigned')) {
      pushGroup(refs, 'workitem', 'unassigned', 'Unassigned Work Items', countSecondary);
    }
    if (normalized.includes('blocked')) {
      pushGroup(refs, 'workitem', 'blocked', 'Blocked Work Items', countSecondary);
    }
    if (normalized.includes('overdue')) {
      pushGroup(refs, 'workitem', 'overdue', 'Overdue Work Items', countSecondary);
    }
    if (normalized.includes('in progress')) {
      pushGroup(refs, 'workitem', 'in-progress', 'In-Progress Work Items', countSecondary);
    }
  }

  if (normalized.includes('application') || normalized.includes('app ')) {
    if (normalized.includes('critical')) {
      pushGroup(refs, 'application', 'critical', 'Critical Applications', countSecondary);
    } else if (normalized.includes('warning')) {
      pushGroup(refs, 'application', 'warning', 'Warning Applications', countSecondary);
    } else {
      pushGroup(refs, 'application', 'all', 'Applications', countSecondary);
    }
  }

  if (normalized.includes('bundle')) {
    pushGroup(refs, 'bundle', 'all', 'Bundles', countSecondary);
  }

  if (normalized.includes('milestone')) {
    if (normalized.includes('overdue') || normalized.includes('late')) {
      pushGroup(refs, 'milestone', 'overdue', 'Overdue Milestones', countSecondary);
    } else {
      pushGroup(refs, 'milestone', 'all', 'Milestones', countSecondary);
    }
  }

  if (normalized.includes('review')) {
    if (normalized.includes('overdue')) {
      pushGroup(refs, 'review', 'overdue', 'Overdue Reviews', countSecondary);
    } else if (normalized.includes('open')) {
      pushGroup(refs, 'review', 'open', 'Open Reviews', countSecondary);
    } else {
      pushGroup(refs, 'review', 'all', 'Reviews', countSecondary);
    }
  }

  return uniqEntities(refs).slice(0, 6);
};

const toEvidenceText = (item: any) => {
  if (typeof item === 'string') return item.trim();
  if (typeof item?.text === 'string') return item.text.trim();
  if (typeof item?.label === 'string' && typeof item?.value === 'string') return `${item.label}: ${item.value}`.trim();
  return '';
};

const normalizeEntityReferences = (entities: unknown): EntityReference[] => {
  if (!Array.isArray(entities)) return [];
  return uniqEntities(
    entities
      .map((entity: any) => {
        const type = String(entity?.type || '').toLowerCase() as EntityType;
        const id = String(entity?.id || '').trim();
        const label = String(entity?.label || '').trim();
        if (!type || !id || !label) return null;
        if (!['workitem', 'application', 'bundle', 'milestone', 'review'].includes(type)) return null;
        return {
          type,
          id,
          label,
          ...(typeof entity?.secondary === 'string' && entity.secondary.trim()
            ? { secondary: entity.secondary.trim() }
            : {})
        } as EntityReference;
      })
      .filter(Boolean) as EntityReference[]
  );
};

export const toEvidenceItem = (
  raw: unknown,
  provenance?: PortfolioReportProvenance
): EvidenceItem | null => {
  const text = toEvidenceText(raw);
  if (!text) return null;
  const explicitEntities = normalizeEntityReferences((raw as any)?.entities);
  const entities = explicitEntities.length > 0 ? explicitEntities : extractEntityRefsFromText(text);
  return {
    text,
    entities,
    ...(provenance ? { provenance } : {})
  };
};

export const toEvidenceItems = (
  raw: unknown,
  provenance?: PortfolioReportProvenance,
  maxItems = 6
): EvidenceItem[] => {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => toEvidenceItem(item, provenance))
    .filter(Boolean)
    .slice(0, maxItems) as EvidenceItem[];
};

export const resolveEntityHref = (entity: EntityReference): string => {
  if (entity.type === 'workitem') {
    if (['unassigned', 'blocked', 'overdue', 'in-progress', 'all'].includes(entity.id)) {
      return '/?tab=work-items&view=tree';
    }
    return `/work-items/${encodeURIComponent(entity.id)}`;
  }
  if (entity.type === 'application') {
    if (['all', 'critical', 'warning'].includes(entity.id)) return '/applications?view=apps';
    return `/applications/${encodeURIComponent(entity.id)}`;
  }
  if (entity.type === 'bundle') {
    if (entity.id === 'all') return '/applications?view=bundles';
    return `/applications/bundles/${encodeURIComponent(entity.id)}`;
  }
  if (entity.type === 'milestone') {
    if (['all', 'overdue'].includes(entity.id)) return '/?tab=work-items&view=milestone-plan';
    return `/?tab=work-items&view=milestone-plan&milestoneId=${encodeURIComponent(entity.id)}`;
  }
  if (['all', 'open', 'overdue'].includes(entity.id)) {
    return '/activities/reviews';
  }
  return `/activities/reviews/${encodeURIComponent(entity.id)}`;
};
