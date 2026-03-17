import { PortfolioSnapshot, PortfolioSnapshotHistory, PortfolioTrendSignal } from '../../types/ai';
import {
  deleteExpiredPortfolioSnapshotRecords,
  insertPortfolioSnapshotRecord,
  listRecentPortfolioSnapshotRecords
} from '../../server/db/repositories/aiWorkspaceRepo';

const MAX_HISTORY_READ = 14;
const DEFAULT_WINDOW = 7;
const RETENTION_DAYS = 90;

const DAY_MS = 24 * 60 * 60 * 1000;

const parseDate = (value?: string) => {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

const activeWorkItemsFromStatus = (statuses: Record<string, number> | undefined) => {
  if (!statuses) return 0;
  return Object.entries(statuses).reduce((sum, [key, value]) => (
    key.toUpperCase() === 'IN_PROGRESS' ? sum + (Number(value) || 0) : sum
  ), 0);
};

const summarizeSnapshot = (snapshot: PortfolioSnapshot): PortfolioSnapshotHistory => ({
  createdAt: snapshot.generatedAt || new Date().toISOString(),
  totalApplications: snapshot.applications.total || 0,
  criticalApplications: snapshot.applications.byHealth.critical || 0,
  totalWorkItems: snapshot.workItems.total || 0,
  unassignedWorkItems: snapshot.workItems.unassigned || 0,
  blockedWorkItems: snapshot.workItems.blocked || 0,
  overdueWorkItems: snapshot.workItems.overdue || 0,
  activeWorkItems: activeWorkItemsFromStatus(snapshot.workItems.byStatus),
  openReviews: snapshot.reviews.open || 0,
  overdueMilestones: snapshot.milestones.overdue || 0
});

const mapHistoryRow = (row: any): PortfolioSnapshotHistory => ({
  id: row._id ? String(row._id) : undefined,
  createdAt: String(row.createdAt || row.generatedAt || new Date().toISOString()),
  totalApplications: Number(row.totalApplications || 0),
  criticalApplications: Number(row.criticalApplications || 0),
  totalWorkItems: Number(row.totalWorkItems || 0),
  unassignedWorkItems: Number(row.unassignedWorkItems || 0),
  blockedWorkItems: Number(row.blockedWorkItems || 0),
  overdueWorkItems: Number(row.overdueWorkItems || 0),
  activeWorkItems: Number(row.activeWorkItems || 0),
  openReviews: Number(row.openReviews || 0),
  overdueMilestones: Number(row.overdueMilestones || 0)
});

const sortByCreatedAtAsc = <T extends { createdAt: string }>(rows: T[]) => rows
  .slice()
  .sort((a, b) => (parseDate(a.createdAt)?.getTime() || 0) - (parseDate(b.createdAt)?.getTime() || 0));

export const persistPortfolioSnapshot = async (snapshot: PortfolioSnapshot) => {
  const doc = summarizeSnapshot(snapshot);
  await insertPortfolioSnapshotRecord(doc as any);

  const retentionCutoff = new Date(Date.now() - RETENTION_DAYS * DAY_MS).toISOString();
  await deleteExpiredPortfolioSnapshotRecords(retentionCutoff);
};

export const loadRecentPortfolioSnapshots = async (limit = MAX_HISTORY_READ): Promise<PortfolioSnapshotHistory[]> => {
  const rows = await listRecentPortfolioSnapshotRecords(Math.max(2, Math.min(limit, MAX_HISTORY_READ)));

  return sortByCreatedAtAsc(rows.map(mapHistoryRow));
};

const stableThreshold = (a: number, b: number) => {
  const scale = Math.max(Math.abs(a), Math.abs(b));
  return Math.max(1, Math.round(scale * 0.03));
};

const metricSummary = (metric: PortfolioTrendSignal['metric'], direction: PortfolioTrendSignal['direction'], delta: number, timeframeDays: number) => {
  const absDelta = Math.abs(delta);
  const labelMap: Record<PortfolioTrendSignal['metric'], string> = {
    unassignedWorkItems: 'Unassigned workload',
    blockedWorkItems: 'Blocked tasks',
    overdueWorkItems: 'Overdue work items',
    activeWorkItems: 'Active work items',
    criticalApplications: 'Critical applications',
    overdueMilestones: 'Overdue milestones'
  };
  const label = labelMap[metric] || metric;
  if (direction === 'stable') return `${label} remained stable over the last ${timeframeDays} days.`;
  const verb = direction === 'rising' ? 'increased' : 'decreased';
  return `${label} ${verb} by ${absDelta} over the last ${timeframeDays} days.`;
};

export const computePortfolioTrendSignals = (
  history: PortfolioSnapshotHistory[],
  window = DEFAULT_WINDOW
): PortfolioTrendSignal[] => {
  const ordered = sortByCreatedAtAsc(history).slice(-Math.max(2, window));
  if (ordered.length < 2) return [];

  const first = ordered[0];
  const last = ordered[ordered.length - 1];
  const days = Math.max(
    1,
    Math.round(((parseDate(last.createdAt)?.getTime() || Date.now()) - (parseDate(first.createdAt)?.getTime() || Date.now())) / DAY_MS)
  );

  const metricDefs: Array<{ metric: PortfolioTrendSignal['metric']; key: keyof PortfolioSnapshotHistory }> = [
    { metric: 'unassignedWorkItems', key: 'unassignedWorkItems' },
    { metric: 'blockedWorkItems', key: 'blockedWorkItems' },
    { metric: 'overdueWorkItems', key: 'overdueWorkItems' },
    { metric: 'activeWorkItems', key: 'activeWorkItems' },
    { metric: 'criticalApplications', key: 'criticalApplications' },
    { metric: 'overdueMilestones', key: 'overdueMilestones' }
  ];

  return metricDefs.map(({ metric, key }) => {
    const start = Number(first[key] || 0);
    const end = Number(last[key] || 0);
    const delta = end - start;
    const threshold = stableThreshold(start, end);
    const direction: PortfolioTrendSignal['direction'] = Math.abs(delta) <= threshold
      ? 'stable'
      : delta > 0
        ? 'rising'
        : 'falling';

    return {
      metric,
      direction,
      delta,
      timeframeDays: days,
      summary: metricSummary(metric, direction, delta, days)
    };
  });
};

export const loadTrendSignals = async (snapshotLimit = MAX_HISTORY_READ, trendWindow = DEFAULT_WINDOW) => {
  const history = await loadRecentPortfolioSnapshots(snapshotLimit);
  const trendSignals = computePortfolioTrendSignals(history, trendWindow);
  return { history, trendSignals };
};
