import { getDb } from '../db';
import { PortfolioSnapshot } from '../../types/ai';

const isDoneLikeStatus = (value: unknown) => {
  const status = String(value || '').trim().toLowerCase();
  return status === 'done' || status === 'closed' || status === 'completed';
};

const classifyHealth = (value: unknown) => {
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
    db.collection('applications').find({}, { projection: { _id: 1, health: 1, status: 1 } }).toArray(),
    db.collection('bundles').countDocuments({}),
    db.collection('workitems').find(
      {},
      { projection: { _id: 1, status: 1, dueDate: 1, blocked: 1, assignee: 1, assignedTo: 1 } }
    ).toArray(),
    db.collection('reviews').find({}, { projection: { _id: 1, status: 1, dueDate: 1 } }).toArray(),
    db.collection('milestones').find({}, { projection: { _id: 1, targetDate: 1, status: 1 } }).toArray()
  ]);

  const appsByHealth = { healthy: 0, warning: 0, critical: 0, unknown: 0 };
  for (const app of applications) {
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

  return {
    generatedAt: nowIso,
    applications: {
      total: applications.length,
      byHealth: appsByHealth
    },
    bundles: {
      total: bundles
    },
    workItems: {
      total: workItems.length,
      overdue: workOverdue,
      blocked: workBlocked,
      unassigned: workUnassigned,
      byStatus: workByStatus
    },
    reviews: {
      open: openReviews,
      overdue: overdueReviews
    },
    milestones: {
      total: milestones.length,
      overdue: overdueMilestones
    }
  };
}
