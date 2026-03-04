import { WorkItemStatus } from '../types';

const DEFAULT_THRESHOLDS = {
  workItemStale: 7,
  criticalStale: 3,
  blockedStale: 5,
  unassignedStale: 2,
  githubStale: 5,
  inProgressNoPrStale: 5
} as const;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const toDate = (value?: string | Date | null) => {
  if (!value) return null;
  if (value instanceof Date) return value;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
};

const diffDays = (from?: string | Date | null, now = Date.now()) => {
  const date = toDate(from);
  if (!date) return null;
  const delta = now - date.getTime();
  if (delta < 0) return 0;
  return Math.ceil(delta / MS_PER_DAY);
};

const hasAssignee = (item: any) => {
  if (item?.assignedTo) return true;
  if (Array.isArray(item?.assigneeUserIds) && item.assigneeUserIds.length > 0) return true;
  return false;
};

const isOpenStatus = (item: any) => String(item?.status || '') !== WorkItemStatus.DONE;

export const resolveWorkItemUpdatedAt = (item: any) => {
  return item?.updatedAt || item?.createdAt || item?.completedAt || null;
};

export const resolveWorkItemCreatedAt = (item: any) => {
  return item?.createdAt || item?.updatedAt || null;
};

const resolveGithubStaleness = (item: any, now = Date.now(), thresholds = DEFAULT_THRESHOLDS) => {
  const prs = Array.isArray(item?.github?.prs) ? item.github.prs : [];
  const openPrs = prs.filter((pr: any) => String(pr?.state || '').toLowerCase() === 'open');
  if (openPrs.length > 0) {
    const sorted = openPrs.slice().sort((a: any, b: any) => {
      const ta = new Date(a.updatedAt || 0).getTime();
      const tb = new Date(b.updatedAt || 0).getTime();
      return tb - ta;
    });
    const pr = sorted[0];
    const days = diffDays(pr.updatedAt, now);
    const stale = typeof days === 'number' && days > thresholds.githubStale;
    return {
      hasOpenPr: true,
      prNumber: pr?.number,
      prTitle: pr?.title,
      prUpdatedAt: pr?.updatedAt,
      daysSinceUpdate: days,
      stale
    };
  }

  if (String(item?.status || '') === WorkItemStatus.IN_PROGRESS) {
    const days = diffDays(resolveWorkItemUpdatedAt(item), now);
    const stale = typeof days === 'number' && days > thresholds.inProgressNoPrStale;
    return {
      hasOpenPr: false,
      prNumber: undefined,
      prTitle: undefined,
      prUpdatedAt: undefined,
      daysSinceUpdate: days,
      stale
    };
  }

  return {
    hasOpenPr: false,
    prNumber: undefined,
    prTitle: undefined,
    prUpdatedAt: undefined,
    daysSinceUpdate: null,
    stale: false
  };
};

const resolveThresholds = (policy?: any) => ({
  workItemStale: typeof policy?.staleness?.thresholdsDays?.workItemStale === 'number'
    ? policy.staleness.thresholdsDays.workItemStale
    : DEFAULT_THRESHOLDS.workItemStale,
  criticalStale: typeof policy?.staleness?.thresholdsDays?.criticalStale === 'number'
    ? policy.staleness.thresholdsDays.criticalStale
    : DEFAULT_THRESHOLDS.criticalStale,
  blockedStale: typeof policy?.staleness?.thresholdsDays?.blockedStale === 'number'
    ? policy.staleness.thresholdsDays.blockedStale
    : DEFAULT_THRESHOLDS.blockedStale,
  unassignedStale: typeof policy?.staleness?.thresholdsDays?.unassignedStale === 'number'
    ? policy.staleness.thresholdsDays.unassignedStale
    : DEFAULT_THRESHOLDS.unassignedStale,
  githubStale: typeof policy?.staleness?.thresholdsDays?.githubStale === 'number'
    ? policy.staleness.thresholdsDays.githubStale
    : DEFAULT_THRESHOLDS.githubStale,
  inProgressNoPrStale: typeof policy?.staleness?.thresholdsDays?.inProgressNoPrStale === 'number'
    ? policy.staleness.thresholdsDays.inProgressNoPrStale
    : DEFAULT_THRESHOLDS.inProgressNoPrStale
});

export const evaluateWorkItemStaleness = (item: any, options?: { isCritical?: boolean; now?: number; policy?: any }) => {
  const now = options?.now ?? Date.now();
  const thresholds = resolveThresholds(options?.policy);
  const updatedAt = resolveWorkItemUpdatedAt(item);
  const createdAt = resolveWorkItemCreatedAt(item);
  const daysSinceUpdate = diffDays(updatedAt, now);
  const daysSinceCreate = diffDays(createdAt, now);
  const isOpen = isOpenStatus(item);
  const github = resolveGithubStaleness(item, now, thresholds);

  const stale = isOpen && typeof daysSinceUpdate === 'number' && daysSinceUpdate > thresholds.workItemStale;
  const criticalStale = Boolean(options?.isCritical) && isOpen && typeof daysSinceUpdate === 'number' && daysSinceUpdate > thresholds.criticalStale;
  const blockedStale = isOpen && (item?.isBlocked || item?.status === WorkItemStatus.BLOCKED)
    && typeof daysSinceUpdate === 'number' && daysSinceUpdate > thresholds.blockedStale;
  const unassignedStale = isOpen && !hasAssignee(item)
    && typeof daysSinceCreate === 'number' && daysSinceCreate > thresholds.unassignedStale;
  const githubStale = Boolean(github.stale);

  return {
    stale,
    criticalStale,
    blockedStale,
    unassignedStale,
    githubStale,
    daysSinceUpdate,
    daysSinceCreate,
    github
  };
};
