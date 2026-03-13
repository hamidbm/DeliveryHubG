import { PortfolioSnapshot } from '../../types/ai';

export interface PortfolioSignalSummary {
  totalApps: number;
  criticalApps: number;
  totalWorkItems: number;
  applicationsTotal: number;
  healthyApplications: number;
  warningApplications: number;
  criticalApplications: number;
  workItemsTotal: number;
  unassignedWorkItems: number;
  overdueWorkItems: number;
  blockedWorkItems: number;
  inProgressWorkItems: number;
  reviewsOpen: number;
  reviewsOverdue: number;
  milestonesTotal: number;
  milestonesOverdue: number;
  unassignedRatio: number;
  overdueRatio: number;
  blockedRatio: number;
  activeWorkRatio: number;
  notableSignals: string[];
}

export const derivePortfolioSignals = (snapshot: PortfolioSnapshot): PortfolioSignalSummary => {
  const notableSignals: string[] = [];
  const total = snapshot.workItems.total || 0;
  const unassigned = snapshot.workItems.unassigned || 0;
  const blocked = snapshot.workItems.blocked || 0;
  const overdue = snapshot.workItems.overdue || 0;
  const inProgress = snapshot.workItems.byStatus?.IN_PROGRESS || 0;
  const safeTotal = total > 0 ? total : 1;

  if (total > 0) {
    notableSignals.push(`${unassigned} of ${total} work items are unassigned.`);
  }
  notableSignals.push(`${inProgress} work items are currently in progress.`);
  notableSignals.push(`${blocked} work items are currently blocked.`);
  notableSignals.push(`${overdue} work items are overdue.`);
  notableSignals.push(`${snapshot.reviews.open} review cycles remain open.`);
  notableSignals.push(`${snapshot.milestones.overdue} milestones are overdue.`);
  notableSignals.push(`${snapshot.applications.byHealth.critical} applications are rated critical health.`);

  return {
    totalApps: snapshot.applications.total || 0,
    criticalApps: snapshot.applications.byHealth.critical || 0,
    totalWorkItems: total,
    applicationsTotal: snapshot.applications.total || 0,
    healthyApplications: snapshot.applications.byHealth.healthy || 0,
    warningApplications: snapshot.applications.byHealth.warning || 0,
    criticalApplications: snapshot.applications.byHealth.critical || 0,
    workItemsTotal: total,
    unassignedWorkItems: unassigned,
    overdueWorkItems: overdue,
    blockedWorkItems: blocked,
    inProgressWorkItems: inProgress,
    reviewsOpen: snapshot.reviews.open || 0,
    reviewsOverdue: snapshot.reviews.overdue || 0,
    milestonesTotal: snapshot.milestones.total || 0,
    milestonesOverdue: snapshot.milestones.overdue || 0,
    unassignedRatio: total > 0 ? unassigned / safeTotal : 0,
    overdueRatio: total > 0 ? overdue / safeTotal : 0,
    blockedRatio: total > 0 ? blocked / safeTotal : 0,
    activeWorkRatio: total > 0 ? inProgress / safeTotal : 0,
    notableSignals
  };
};
