import { PortfolioSnapshot } from '../../types/ai';

const asIso = (value?: string) => {
  if (!value) return undefined;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
};

const isDoneLike = (status?: string) => {
  const s = String(status || '').toLowerCase();
  return s === 'done' || s === 'closed' || s === 'completed' || s === 'released';
};

const isOverdue = (dueDate?: string, status?: string) => {
  if (!dueDate || isDoneLike(status)) return false;
  const d = new Date(dueDate);
  if (Number.isNaN(d.getTime())) return false;
  return d.getTime() < Date.now();
};

export type WorkItemMetric = {
  id: string;
  key?: string;
  title: string;
  status: string;
  blocked: boolean;
  unassigned: boolean;
  overdue: boolean;
  dueDate?: string;
  bundleId?: string;
  applicationId?: string;
  milestoneIds: string[];
  assignee?: string;
  priority?: string;
};

export type BundleMetric = {
  bundleId: string;
  bundleName: string;
  totalWorkItems: number;
  unassignedCount: number;
  blockedCount: number;
  overdueCount: number;
  criticalApps: number;
};

export type MilestoneMetric = {
  milestoneId: string;
  name: string;
  status: string;
  targetDate?: string;
  overdue: boolean;
  relatedWorkItemCount: number;
  blockedWorkItemCount: number;
  overdueWorkItemCount: number;
  activeWorkItemCount: number;
};

export type ApplicationMetric = {
  applicationId: string;
  name: string;
  health: string;
  totalWorkItems: number;
  overdueWorkItems: number;
  blockedWorkItems: number;
  openReviews: number;
  overdueReviews: number;
};

export type ReviewMetric = {
  reviewId: string;
  status: string;
  dueDate?: string;
  overdue: boolean;
  applicationId?: string;
  bundleId?: string;
  title?: string;
};

export type OwnerMetric = {
  owner: string;
  workItemCount: number;
  blockedCount: number;
  overdueCount: number;
  unassignedCount: number;
};

export const extractWorkItemStats = (snapshot: PortfolioSnapshot): WorkItemMetric[] =>
  (snapshot.workItems.items || []).map((item) => ({
    id: item.id,
    key: item.key,
    title: item.title,
    status: item.status,
    blocked: item.blocked === true || String(item.status || '').toUpperCase() === 'BLOCKED',
    unassigned: !item.assignee,
    overdue: isOverdue(item.dueDate, item.status),
    dueDate: asIso(item.dueDate),
    bundleId: item.bundleId,
    applicationId: item.applicationId,
    milestoneIds: Array.isArray(item.milestoneIds) ? item.milestoneIds : [],
    assignee: item.assignee,
    priority: item.priority
  }));

export const extractBundleStats = (snapshot: PortfolioSnapshot): BundleMetric[] => {
  const workItems = extractWorkItemStats(snapshot);
  const bundles = snapshot.bundles.items || [];
  const appByBundle = new Map<string, { total: number; critical: number }>();
  (snapshot.applications.items || []).forEach((app) => {
    if (!app.bundleId) return;
    const acc = appByBundle.get(app.bundleId) || { total: 0, critical: 0 };
    acc.total += 1;
    if (app.health === 'critical') acc.critical += 1;
    appByBundle.set(app.bundleId, acc);
  });

  const map = new Map<string, BundleMetric>();
  bundles.forEach((bundle) => {
    map.set(bundle.id, {
      bundleId: bundle.id,
      bundleName: bundle.name,
      totalWorkItems: 0,
      unassignedCount: 0,
      blockedCount: 0,
      overdueCount: 0,
      criticalApps: appByBundle.get(bundle.id)?.critical || 0
    });
  });

  workItems.forEach((item) => {
    if (!item.bundleId) return;
    const acc = map.get(item.bundleId) || {
      bundleId: item.bundleId,
      bundleName: `Bundle ${item.bundleId}`,
      totalWorkItems: 0,
      unassignedCount: 0,
      blockedCount: 0,
      overdueCount: 0,
      criticalApps: appByBundle.get(item.bundleId)?.critical || 0
    };
    acc.totalWorkItems += 1;
    if (item.unassigned) acc.unassignedCount += 1;
    if (item.blocked) acc.blockedCount += 1;
    if (item.overdue) acc.overdueCount += 1;
    map.set(item.bundleId, acc);
  });

  return Array.from(map.values());
};

export const extractMilestoneStats = (snapshot: PortfolioSnapshot): MilestoneMetric[] => {
  const workItems = extractWorkItemStats(snapshot);
  const milestones = snapshot.milestones.items || [];
  const map = new Map<string, MilestoneMetric>();
  milestones.forEach((milestone) => {
    map.set(milestone.id, {
      milestoneId: milestone.id,
      name: milestone.name,
      status: milestone.status,
      targetDate: asIso(milestone.targetDate),
      overdue: isOverdue(milestone.targetDate, milestone.status),
      relatedWorkItemCount: 0,
      blockedWorkItemCount: 0,
      overdueWorkItemCount: 0,
      activeWorkItemCount: 0
    });
  });
  workItems.forEach((item) => {
    (item.milestoneIds || []).forEach((milestoneId) => {
      const acc = map.get(milestoneId) || {
        milestoneId,
        name: `Milestone ${milestoneId}`,
        status: 'UNKNOWN',
        targetDate: undefined,
        overdue: false,
        relatedWorkItemCount: 0,
        blockedWorkItemCount: 0,
        overdueWorkItemCount: 0,
        activeWorkItemCount: 0
      };
      acc.relatedWorkItemCount += 1;
      if (item.blocked) acc.blockedWorkItemCount += 1;
      if (item.overdue) acc.overdueWorkItemCount += 1;
      if (String(item.status || '').toUpperCase() === 'IN_PROGRESS') acc.activeWorkItemCount += 1;
      map.set(milestoneId, acc);
    });
  });
  return Array.from(map.values());
};

export const extractApplicationStats = (snapshot: PortfolioSnapshot): ApplicationMetric[] => {
  const workItems = extractWorkItemStats(snapshot);
  const reviews = extractReviewStats(snapshot);
  const apps = snapshot.applications.items || [];
  const map = new Map<string, ApplicationMetric>();
  apps.forEach((app) => {
    map.set(app.id, {
      applicationId: app.id,
      name: app.name,
      health: app.health,
      totalWorkItems: 0,
      overdueWorkItems: 0,
      blockedWorkItems: 0,
      openReviews: 0,
      overdueReviews: 0
    });
  });
  workItems.forEach((item) => {
    if (!item.applicationId) return;
    const acc = map.get(item.applicationId) || {
      applicationId: item.applicationId,
      name: `Application ${item.applicationId}`,
      health: 'unknown',
      totalWorkItems: 0,
      overdueWorkItems: 0,
      blockedWorkItems: 0,
      openReviews: 0,
      overdueReviews: 0
    };
    acc.totalWorkItems += 1;
    if (item.overdue) acc.overdueWorkItems += 1;
    if (item.blocked) acc.blockedWorkItems += 1;
    map.set(item.applicationId, acc);
  });
  reviews.forEach((review) => {
    if (!review.applicationId) return;
    const acc = map.get(review.applicationId);
    if (!acc) return;
    if (!isDoneLike(review.status)) acc.openReviews += 1;
    if (review.overdue) acc.overdueReviews += 1;
  });
  return Array.from(map.values());
};

export const extractReviewStats = (snapshot: PortfolioSnapshot): ReviewMetric[] =>
  (snapshot.reviews.items || []).map((review) => ({
    reviewId: review.id,
    status: review.status,
    dueDate: asIso(review.dueDate),
    overdue: isOverdue(review.dueDate, review.status),
    applicationId: review.applicationId,
    bundleId: review.bundleId,
    title: review.title
  }));

export const extractOwnerStats = (snapshot: PortfolioSnapshot): OwnerMetric[] => {
  const workItems = extractWorkItemStats(snapshot);
  const byOwner = new Map<string, OwnerMetric>();
  workItems.forEach((item) => {
    const owner = item.assignee || 'Unassigned';
    const acc = byOwner.get(owner) || {
      owner,
      workItemCount: 0,
      blockedCount: 0,
      overdueCount: 0,
      unassignedCount: 0
    };
    acc.workItemCount += 1;
    if (item.blocked) acc.blockedCount += 1;
    if (item.overdue) acc.overdueCount += 1;
    if (!item.assignee) acc.unassignedCount += 1;
    byOwner.set(owner, acc);
  });
  return Array.from(byOwner.values());
};
