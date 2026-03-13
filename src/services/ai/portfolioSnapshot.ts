import { getDb } from '../db';
import { PortfolioSnapshot } from '../../types/ai';

const isDoneLikeStatus = (value: unknown) => {
  const status = String(value || '').trim().toLowerCase();
  return status === 'done' || status === 'closed' || status === 'completed';
};

const classifyHealth = (value: unknown): 'healthy' | 'warning' | 'critical' | 'unknown' => {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized.includes('critical')) return 'critical';
  if (normalized.includes('warning') || normalized.includes('at risk')) return 'warning';
  if (normalized.includes('healthy') || normalized.includes('green')) return 'healthy';
  return 'unknown';
};

export async function buildPortfolioIntelligenceSnapshot(): Promise<PortfolioSnapshot> {
  const db = await getDb();
  const now = new Date();
  const nowIso = now.toISOString();

  const [applications, bundles, workItems, reviews, milestones] = await Promise.all([
    db.collection('applications').find({}, { projection: { _id: 1, id: 1, aid: 1, name: 1, health: 1, status: 1, bundleId: 1 } }).toArray(),
    db.collection('bundles').find({}, { projection: { _id: 1, id: 1, key: 1, name: 1, title: 1 } }).toArray(),
    db.collection('workitems').find(
      {},
      {
        projection: {
          _id: 1, id: 1, key: 1, title: 1, name: 1,
          status: 1, dueDate: 1, blocked: 1, assignee: 1, assignedTo: 1,
          bundleId: 1, applicationId: 1, milestoneId: 1, milestoneIds: 1, priority: 1
        }
      }
    ).toArray(),
    db.collection('reviews').find({}, { projection: { _id: 1, id: 1, status: 1, currentCycleStatus: 1, dueDate: 1, currentDueAt: 1, applicationId: 1, bundleId: 1, title: 1, resource: 1 } }).toArray(),
    db.collection('milestones').find({}, { projection: { _id: 1, id: 1, name: 1, title: 1, targetDate: 1, dueDate: 1, endDate: 1, status: 1, bundleId: 1 } }).toArray()
  ]);

  const appsByHealth = { healthy: 0, warning: 0, critical: 0, unknown: 0 };
  for (const app of applications as any[]) {
    const healthInput = (app as any).health ?? (app as any).status?.health;
    const key = classifyHealth(healthInput);
    appsByHealth[key] += 1;
  }

  const workByStatus: Record<string, number> = {};
  let workOverdue = 0;
  let workBlocked = 0;
  let workUnassigned = 0;

  for (const item of workItems as any[]) {
    const statusRaw = String(item.status || 'UNKNOWN');
    workByStatus[statusRaw] = (workByStatus[statusRaw] || 0) + 1;

    const dueDate = item.dueDate ? new Date(item.dueDate) : null;
    if (dueDate && !Number.isNaN(dueDate.getTime()) && dueDate.toISOString() < nowIso && !isDoneLikeStatus(item.status)) {
      workOverdue += 1;
    }
    if (item.blocked === true || String(item.status || '').toUpperCase() === 'BLOCKED') {
      workBlocked += 1;
    }
    const assignee = (item.assignee || item.assignedTo || '').toString().trim();
    if (!assignee) {
      workUnassigned += 1;
    }
  }

  let openReviews = 0;
  let overdueReviews = 0;
  for (const review of reviews as any[]) {
    if (!isDoneLikeStatus(review.status)) {
      openReviews += 1;
      const dueDate = review.dueDate ? new Date(review.dueDate) : null;
      if (dueDate && !Number.isNaN(dueDate.getTime()) && dueDate.toISOString() < nowIso) {
        overdueReviews += 1;
      }
    }
  }

  let overdueMilestones = 0;
  for (const milestone of milestones as any[]) {
    const targetDate = milestone.targetDate ? new Date(milestone.targetDate) : null;
    const status = String(milestone.status || '').trim().toLowerCase();
    const isCompleted = status === 'completed' || status === 'done' || status === 'released';
    if (targetDate && !Number.isNaN(targetDate.getTime()) && targetDate.toISOString() < nowIso && !isCompleted) {
      overdueMilestones += 1;
    }
  }

  const appItems = (applications as any[]).slice(0, 500).map((app) => ({
    id: String(app._id || app.id || app.aid || app.name || ''),
    name: String(app.name || app.id || app.aid || app._id || 'Application'),
    health: classifyHealth((app as any).health ?? (app as any).status?.health),
    bundleId: app.bundleId ? String(app.bundleId) : undefined
  })).filter((item) => item.id);

  const bundleItems = (bundles as any[]).slice(0, 300).map((bundle) => ({
    id: String(bundle._id || bundle.id || bundle.key || ''),
    name: String(bundle.name || bundle.title || bundle.key || bundle.id || bundle._id || 'Bundle')
  })).filter((item) => item.id);

  const workItemItems = (workItems as any[]).slice(0, 1500).map((item) => {
    const milestoneIdsRaw = Array.isArray(item.milestoneIds) ? item.milestoneIds : (item.milestoneId ? [item.milestoneId] : []);
    return {
      id: String(item._id || item.id || item.key || ''),
      key: item.key ? String(item.key) : undefined,
      title: String(item.title || item.name || item.key || item.id || item._id || 'Work Item'),
      status: String(item.status || 'UNKNOWN'),
      blocked: item.blocked === true || String(item.status || '').toUpperCase() === 'BLOCKED',
      assignee: (item.assignee || item.assignedTo || '').toString().trim() || undefined,
      dueDate: item.dueDate ? new Date(item.dueDate).toISOString() : undefined,
      bundleId: item.bundleId ? String(item.bundleId) : undefined,
      applicationId: item.applicationId ? String(item.applicationId) : undefined,
      milestoneIds: milestoneIdsRaw.map((id: any) => String(id)).filter(Boolean),
      priority: item.priority ? String(item.priority) : undefined
    };
  }).filter((item) => item.id);

  const reviewItems = (reviews as any[]).slice(0, 800).map((review) => ({
    id: String(review._id || review.id || ''),
    status: String(review.currentCycleStatus || review.status || 'UNKNOWN'),
    dueDate: (review.currentDueAt || review.dueDate) ? new Date(review.currentDueAt || review.dueDate).toISOString() : undefined,
    applicationId: review.applicationId
      ? String(review.applicationId)
      : (review.resource?.applicationId ? String(review.resource.applicationId) : undefined),
    bundleId: review.bundleId
      ? String(review.bundleId)
      : (review.resource?.bundleId ? String(review.resource.bundleId) : undefined),
    title: review.title ? String(review.title) : undefined
  })).filter((item) => item.id);

  const milestoneItems = (milestones as any[]).slice(0, 800).map((milestone) => ({
    id: String(milestone._id || milestone.id || milestone.name || ''),
    name: String(milestone.name || milestone.title || milestone.id || milestone._id || 'Milestone'),
    status: String(milestone.status || 'UNKNOWN'),
    targetDate: (milestone.targetDate || milestone.dueDate || milestone.endDate)
      ? new Date(milestone.targetDate || milestone.dueDate || milestone.endDate).toISOString()
      : undefined,
    bundleId: milestone.bundleId ? String(milestone.bundleId) : undefined
  })).filter((item) => item.id);

  return {
    generatedAt: nowIso,
    applications: {
      total: applications.length,
      byHealth: appsByHealth,
      items: appItems
    },
    bundles: {
      total: bundles.length,
      items: bundleItems
    },
    workItems: {
      total: workItems.length,
      overdue: workOverdue,
      blocked: workBlocked,
      unassigned: workUnassigned,
      byStatus: workByStatus,
      items: workItemItems
    },
    reviews: {
      open: openReviews,
      overdue: overdueReviews,
      items: reviewItems
    },
    milestones: {
      total: milestones.length,
      overdue: overdueMilestones,
      items: milestoneItems
    }
  };
}
