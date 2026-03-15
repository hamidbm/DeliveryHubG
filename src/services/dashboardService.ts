import { ObjectId } from 'mongodb';
import {
  AtRiskBundleModel,
  BlockerHeatmapCell,
  BundleDashboardResponse,
  CapacityRow,
  DashboardAiInsight,
  DashboardFilters,
  DashboardTimeWindow,
  DependencyRiskItem,
  ExecutiveDashboardResponse,
  HealthPulseItem,
  MetricCard,
  MilestoneDashboardResponse,
  ProgressTrendPoint,
  RiskTrendPoint,
  VelocityPoint,
  WorkItemAgingBucket
} from '../types/dashboard';
import { getDb } from './db';
import { loadStrategicAdvisorContext } from './ai/strategicAdvisor';
import { generateActionPlan } from './ai/actionRecommender';

type CacheEntry<T> = {
  expiresAt: number;
  value: T;
};

const cache = new Map<string, CacheEntry<any>>();
const CACHE_TTL_MS = 45 * 1000;

type DashboardContext = {
  bundles: any[];
  applications: any[];
  milestones: any[];
  workItems: any[];
  users: any[];
  snapshots: any[];
};

const getWindowDays = (timeWindow?: DashboardTimeWindow) => {
  if (timeWindow === '7d') return 7;
  if (timeWindow === '90d') return 90;
  if (timeWindow === 'quarter') return 90;
  return 30;
};

const asDate = (value?: string | Date | null) => {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const weightForType = (type?: string) => {
  const t = String(type || '').toUpperCase();
  if (t === 'EPIC') return 10;
  if (t === 'FEATURE') return 5;
  if (t === 'STORY') return 2;
  return 1;
};

const normalizeFilters = (filters: DashboardFilters): Required<Pick<DashboardFilters, 'timeWindow'>> & DashboardFilters => ({
  ...filters,
  timeWindow: filters.timeWindow || '30d'
});

const buildCacheKey = (scope: string, filters: DashboardFilters) => `${scope}:${JSON.stringify(filters)}`;

const fromCache = <T>(key: string): T | null => {
  const entry = cache.get(key);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    cache.delete(key);
    return null;
  }
  return entry.value as T;
};

const toCache = <T>(key: string, value: T) => {
  cache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, value });
};

const filterByScope = (ctx: DashboardContext, filters: DashboardFilters) => {
  const bundleId = filters.bundleId ? String(filters.bundleId) : '';
  const appId = filters.applicationId ? String(filters.applicationId) : '';
  const teamId = filters.teamId ? String(filters.teamId) : '';
  const bundleSet = new Set(
    (bundleId ? [bundleId] : ctx.bundles.map((item) => String(item._id || item.id || ''))).filter(Boolean)
  );
  const scopedApps = ctx.applications.filter((item) => {
    const itemBundleId = String(item.bundleId || '');
    if (bundleSet.size && !bundleSet.has(itemBundleId)) return false;
    if (appId && String(item._id || item.id || '') !== appId) return false;
    return true;
  });
  const appSet = new Set(scopedApps.map((item) => String(item._id || item.id || '')));
  const scopedMilestones = ctx.milestones.filter((item) => {
    const itemBundleId = String(item.bundleId || '');
    return !bundleSet.size || bundleSet.has(itemBundleId);
  });
  const milestoneSet = new Set(scopedMilestones.map((item) => String(item._id || item.id || item.name || '')));
  const userByIdentity = new Map<string, any>();
  ctx.users.forEach((user) => {
    const keys = [user._id, user.id, user.email, user.name].map((value) => String(value || '').trim()).filter(Boolean);
    keys.forEach((key) => userByIdentity.set(key, user));
  });

  const scopedWorkItems = ctx.workItems.filter((item) => {
    const itemBundleId = String(item.bundleId || '');
    const itemAppId = String(item.applicationId || '');
    if (bundleSet.size && itemBundleId && !bundleSet.has(itemBundleId)) return false;
    if (appId && itemAppId && itemAppId !== appId) return false;
    if (teamId) {
      const assignee = String(item.assignedTo || item.assignee || '').trim();
      if (!assignee) return false;
      const user = userByIdentity.get(assignee);
      const resolvedTeam = String(user?.team || '');
      if (resolvedTeam !== teamId) return false;
    }
    return true;
  });

  return {
    bundles: ctx.bundles.filter((item) => !bundleSet.size || bundleSet.has(String(item._id || item.id || ''))),
    applications: scopedApps,
    milestones: scopedMilestones,
    workItems: scopedWorkItems,
    users: ctx.users,
    milestoneSet,
    appSet,
    userByIdentity
  };
};

const createDateBuckets = (days: number, buckets = 8) => {
  const now = new Date();
  const out: Date[] = [];
  for (let i = buckets - 1; i >= 0; i -= 1) {
    const d = new Date(now);
    d.setDate(now.getDate() - Math.floor((days / (buckets - 1)) * i));
    d.setHours(0, 0, 0, 0);
    out.push(d);
  }
  return out;
};

const labelForDate = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}`;

const metricStatus = (delta: number): MetricCard['status'] => {
  if (delta <= 0) return 'on_track';
  if (delta <= 5) return 'watch';
  if (delta <= 12) return 'at_risk';
  return 'critical';
};

const buildProgressTrend = (items: any[], milestones: any[], days: number): ProgressTrendPoint[] => {
  const buckets = createDateBuckets(days, 8);
  const weightsTotal = items.reduce((sum, item) => sum + weightForType(item.type), 0) || 1;
  const milestoneDates = milestones.flatMap((milestone) => [asDate(milestone.startDate), asDate(milestone.targetDate || milestone.endDate)]).filter(Boolean) as Date[];
  const planStart = milestoneDates.length ? new Date(Math.min(...milestoneDates.map((item) => item.getTime()))) : new Date(Date.now() - days * 86400000);
  const planEnd = milestoneDates.length ? new Date(Math.max(...milestoneDates.map((item) => item.getTime()))) : new Date();
  const duration = Math.max(1, planEnd.getTime() - planStart.getTime());

  return buckets.map((bucketDate) => {
    const completedWeight = items
      .filter((item) => {
        const status = String(item.status || '').toUpperCase();
        if (status !== 'DONE') return false;
        const completedAt = asDate(item.completedAt || item.doneAt || item.updatedAt || item.closedAt || item.resolvedAt);
        if (!completedAt) return false;
        return completedAt.getTime() <= bucketDate.getTime();
      })
      .reduce((sum, item) => sum + weightForType(item.type), 0);
    const actual = clamp((completedWeight / weightsTotal) * 100, 0, 100);
    const elapsed = clamp((bucketDate.getTime() - planStart.getTime()) / duration, 0, 1);
    const planned = clamp(elapsed * 100, 0, 100);
    return {
      bucket: labelForDate(bucketDate),
      planned: Number(planned.toFixed(1)),
      actual: Number(actual.toFixed(1)),
      variance: Number((actual - planned).toFixed(1)),
      completed: completedWeight,
      total: weightsTotal
    };
  });
};

const buildForecastRows = (bundles: any[], milestones: any[], items: any[], progressTrend: ProgressTrendPoint[]) => {
  const trendNow = progressTrend[progressTrend.length - 1];
  const plannedNow = trendNow?.planned || 0;
  const actualNow = trendNow?.actual || 0;
  const lagPercent = Math.max(0, plannedNow - actualNow);

  return bundles.map((bundle) => {
    const bundleId = String(bundle._id || bundle.id || '');
    const bundleMilestones = milestones.filter((item) => String(item.bundleId || '') === bundleId);
    const plannedDate = bundleMilestones
      .map((item) => asDate(item.targetDate || item.endDate))
      .filter(Boolean)
      .sort((a, b) => (a as Date).getTime() - (b as Date).getTime())
      .pop() as Date | null;
    const startDate = bundleMilestones
      .map((item) => asDate(item.startDate))
      .filter(Boolean)
      .sort((a, b) => (a as Date).getTime() - (b as Date).getTime())[0] as Date | null;
    const durationDays = plannedDate && startDate
      ? Math.max(1, Math.round((plannedDate.getTime() - startDate.getTime()) / 86400000))
      : 45;
    const bundleItems = items.filter((item) => String(item.bundleId || '') === bundleId);
    const completed = bundleItems.filter((item) => String(item.status || '').toUpperCase() === 'DONE').length;
    const completionPercent = bundleItems.length ? (completed / bundleItems.length) * 100 : 0;
    const slipDays = Math.round((lagPercent / 100) * durationDays);
    const forecastDate = plannedDate ? new Date(plannedDate.getTime() + slipDays * 86400000) : null;
    const blocked = bundleItems.filter((item) => String(item.status || '').toUpperCase() === 'BLOCKED').length;
    const overdue = bundleItems.filter((item) => {
      const due = asDate(item.dueDate);
      if (!due) return false;
      const status = String(item.status || '').toUpperCase();
      return status !== 'DONE' && due.getTime() < Date.now();
    }).length;
    const confidence: 'LOW' | 'MEDIUM' | 'HIGH' =
      bundleItems.length < 8 || blocked > 6 ? 'LOW' : overdue > 3 ? 'MEDIUM' : 'HIGH';

    return {
      bundleId,
      bundleName: String(bundle.name || bundle.title || bundleId),
      plannedGoLive: plannedDate ? plannedDate.toISOString() : undefined,
      forecastGoLive: forecastDate ? forecastDate.toISOString() : undefined,
      varianceDays: slipDays,
      confidence,
      riskLevel: slipDays > 14 ? 'AT_RISK' as const : slipDays > 5 ? 'WATCH' as const : 'ON_TRACK' as const,
      completionPercent: Number(completionPercent.toFixed(1))
    };
  });
};

const buildAtRiskBundles = (forecast: ExecutiveDashboardResponse['forecast'], items: any[], milestones: any[]): AtRiskBundleModel[] => {
  const milestoneByBundle = new Map<string, any[]>();
  milestones.forEach((milestone) => {
    const bundleId = String(milestone.bundleId || '');
    if (!milestoneByBundle.has(bundleId)) milestoneByBundle.set(bundleId, []);
    milestoneByBundle.get(bundleId)!.push(milestone);
  });

  return forecast.map((row) => {
    const bundleItems = items.filter((item) => String(item.bundleId || '') === row.bundleId);
    const total = Math.max(1, bundleItems.length);
    const blocked = bundleItems.filter((item) => String(item.status || '').toUpperCase() === 'BLOCKED').length;
    const overdue = bundleItems.filter((item) => {
      const due = asDate(item.dueDate);
      if (!due) return false;
      return String(item.status || '').toUpperCase() !== 'DONE' && due.getTime() < Date.now();
    }).length;
    const highCriticalRisks = bundleItems.filter((item) => {
      if (String(item.type || '').toUpperCase() !== 'RISK') return false;
      const severity = String(item.risk?.severity || item.severity || '').toUpperCase();
      return severity === 'HIGH' || severity === 'CRITICAL';
    }).length;
    const agingDrag = bundleItems.filter((item) => {
      if (String(item.status || '').toUpperCase() === 'DONE') return false;
      const created = asDate(item.createdAt);
      if (!created) return false;
      const ageDays = (Date.now() - created.getTime()) / 86400000;
      return ageDays > 30;
    }).length;
    const dependencies = bundleItems.reduce((sum, item) => sum + ((item.links || []).filter((link: any) => String(link.type || '').toUpperCase() === 'BLOCKS').length), 0);

    const completionVariance = Math.max(0, row.varianceDays / 30);
    const blockedRatio = blocked / total;
    const overdueRatio = overdue / total;
    const riskRatio = highCriticalRisks / total;
    const dependencyExposure = clamp(dependencies / total, 0, 1);
    const agingRatio = agingDrag / total;

    const score = clamp(
      (completionVariance * 25) +
      (blockedRatio * 20) +
      (overdueRatio * 20) +
      (riskRatio * 15) +
      (dependencyExposure * 10) +
      (agingRatio * 10),
      0,
      100
    );

    return {
      bundleId: row.bundleId,
      bundleName: row.bundleName,
      riskScore: Number(score.toFixed(1)),
      blocked,
      overdue,
      highCriticalRisks,
      forecastVarianceDays: row.varianceDays,
      band: (score >= 70 ? 'high' : score >= 45 ? 'medium' : 'low') as AtRiskBundleModel['band']
    };
  }).sort((a, b) => b.riskScore - a.riskScore);
};

const buildBlockerHeatmap = (items: any[], usersByIdentity: Map<string, any>): BlockerHeatmapCell[] => {
  const out = new Map<string, BlockerHeatmapCell>();
  items.forEach((item) => {
    if (String(item.status || '').toUpperCase() !== 'BLOCKED') return;
    const bundleKey = String(item.bundleId || 'unassigned');
    if (!out.has(bundleKey)) out.set(bundleKey, { key: bundleKey, label: bundleKey, blockers: 0 });
    out.get(bundleKey)!.blockers += 1;
    const assignee = String(item.assignedTo || item.assignee || '').trim();
    if (assignee) {
      const team = String(usersByIdentity.get(assignee)?.team || 'Unassigned');
      const teamKey = `team:${team}`;
      if (!out.has(teamKey)) out.set(teamKey, { key: teamKey, label: team, blockers: 0 });
      out.get(teamKey)!.blockers += 0;
    }
  });
  return Array.from(out.values())
    .sort((a, b) => b.blockers - a.blockers)
    .slice(0, 12);
};

const buildRiskTrend = (days: number, snapshots: any[], items: any[]): RiskTrendPoint[] => {
  const points = createDateBuckets(days, 8);
  const ordered = (snapshots || [])
    .map((row) => ({ ...row, createdAtDate: asDate(row.createdAt) }))
    .filter((row) => row.createdAtDate)
    .sort((a, b) => (a.createdAtDate as Date).getTime() - (b.createdAtDate as Date).getTime());

  if (!ordered.length) {
    const blocked = items.filter((item) => String(item.status || '').toUpperCase() === 'BLOCKED').length;
    const overdue = items.filter((item) => {
      const due = asDate(item.dueDate);
      return due && String(item.status || '').toUpperCase() !== 'DONE' && due.getTime() < Date.now();
    }).length;
    const highCritical = items.filter((item) => {
      if (String(item.type || '').toUpperCase() !== 'RISK') return false;
      const severity = String(item.risk?.severity || item.severity || '').toUpperCase();
      return severity === 'HIGH' || severity === 'CRITICAL';
    }).length;
    return points.map((date) => ({
      bucket: labelForDate(date),
      openRisks: blocked + overdue,
      highCriticalRisks: highCritical,
      blockedProxy: blocked
    }));
  }

  return points.map((date) => {
    const baseline = ordered.filter((row) => (row.createdAtDate as Date).getTime() <= date.getTime()).pop() || ordered[0];
    const blocked = Number(baseline.blockedWorkItems || 0);
    const overdue = Number(baseline.overdueWorkItems || 0);
    const highCritical = Number(baseline.criticalApplications || 0);
    return {
      bucket: labelForDate(date),
      openRisks: blocked + overdue,
      highCriticalRisks: highCritical,
      blockedProxy: blocked
    };
  });
};

const buildVelocityTrend = (items: any[], days: number): VelocityPoint[] => {
  const points = createDateBuckets(days, 8);
  return points.map((date, idx) => {
    const prev = idx === 0 ? null : points[idx - 1];
    const completed = items.filter((item) => {
      const status = String(item.status || '').toUpperCase();
      if (status !== 'DONE') return false;
      const at = asDate(item.completedAt || item.doneAt || item.updatedAt);
      if (!at) return false;
      if (!prev) return at.getTime() <= date.getTime();
      return at.getTime() > prev.getTime() && at.getTime() <= date.getTime();
    }).length;
    const committed = Math.max(completed, Math.round(completed * 1.18));
    return { bucket: labelForDate(date), completed, committed };
  });
};

const buildCapacityUtilization = (items: any[], users: any[], usersByIdentity: Map<string, any>): CapacityRow[] => {
  const byTeam = new Map<string, { availablePeople: number; allocated: number }>();
  users.forEach((user) => {
    const team = String(user.team || 'Unknown');
    if (!byTeam.has(team)) byTeam.set(team, { availablePeople: 0, allocated: 0 });
    byTeam.get(team)!.availablePeople += 1;
  });
  items.forEach((item) => {
    const assignee = String(item.assignedTo || item.assignee || '').trim();
    if (!assignee) return;
    const team = String(usersByIdentity.get(assignee)?.team || 'Unknown');
    if (!byTeam.has(team)) byTeam.set(team, { availablePeople: 0, allocated: 0 });
    if (String(item.status || '').toUpperCase() !== 'DONE') {
      byTeam.get(team)!.allocated += 1;
    }
  });

  return Array.from(byTeam.entries()).map(([team, stats]) => {
    const available = Math.max(1, stats.availablePeople * 10);
    const utilizationPercent = Number(((stats.allocated / available) * 100).toFixed(1));
    const status: CapacityRow['status'] =
      utilizationPercent < 80 ? 'UNDERUTILIZED'
        : utilizationPercent <= 100 ? 'HEALTHY'
          : utilizationPercent <= 115 ? 'WATCH'
            : 'OVERLOADED';
    return {
      team,
      available,
      allocated: stats.allocated,
      utilizationPercent,
      status
    };
  }).sort((a, b) => b.utilizationPercent - a.utilizationPercent).slice(0, 8);
};

const buildDependencyRiskMap = (items: any[]): DependencyRiskItem[] => {
  const byId = new Map<string, any>();
  items.forEach((item) => {
    const keys = [item._id, item.id, item.key].map((v) => String(v || '')).filter(Boolean);
    keys.forEach((key) => byId.set(key, item));
  });

  const out: DependencyRiskItem[] = [];
  items.forEach((item) => {
    (item.links || []).forEach((link: any) => {
      const type = String(link.type || '').toUpperCase();
      if (type !== 'BLOCKS' && type !== 'RELATES_TO') return;
      const target = byId.get(String(link.targetId || ''));
      const sourceBlocked = String(item.status || '').toUpperCase() === 'BLOCKED';
      const targetBlocked = String(target?.status || '').toUpperCase() === 'BLOCKED';
      const blocked = sourceBlocked || targetBlocked;
      const riskScore = (blocked ? 70 : 30) + (type === 'BLOCKS' ? 20 : 0);
      out.push({
        sourceId: String(item._id || item.id || ''),
        sourceLabel: String(item.title || item.key || 'Dependency Source'),
        sourceBundleId: item.bundleId ? String(item.bundleId) : undefined,
        targetId: String(target?._id || target?.id || link.targetId || ''),
        targetLabel: String(target?.title || target?.key || link.targetTitle || 'Dependency Target'),
        targetBundleId: target?.bundleId ? String(target.bundleId) : undefined,
        type,
        blocked,
        impactSeverity: riskScore >= 90 ? 'HIGH' : riskScore >= 60 ? 'MEDIUM' : 'LOW',
        affectedMilestones: (item.milestoneIds || []).map((m: any) => String(m)),
        riskScore
      });
    });
  });
  return out.sort((a, b) => b.riskScore - a.riskScore).slice(0, 20);
};

const buildAging = (items: any[]): WorkItemAgingBucket[] => {
  const buckets: WorkItemAgingBucket[] = [
    { bucket: '0-7', count: 0 },
    { bucket: '8-14', count: 0 },
    { bucket: '15-30', count: 0 },
    { bucket: '31+', count: 0 }
  ];
  items.forEach((item) => {
    if (String(item.status || '').toUpperCase() === 'DONE') return;
    const created = asDate(item.createdAt);
    if (!created) return;
    const age = Math.floor((Date.now() - created.getTime()) / 86400000);
    if (age <= 7) buckets[0].count += 1;
    else if (age <= 14) buckets[1].count += 1;
    else if (age <= 30) buckets[2].count += 1;
    else buckets[3].count += 1;
  });
  return buckets;
};

const buildApplicationDistribution = (applications: any[]) => {
  const byBundle = new Map<string, number>();
  applications.forEach((app) => {
    const key = String(app.bundleId || 'Unassigned');
    byBundle.set(key, (byBundle.get(key) || 0) + 1);
  });
  return {
    dimension: 'bundle' as const,
    items: Array.from(byBundle.entries())
      .map(([key, count]) => ({ key, label: key, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 12)
  };
};

const buildHealthPulse = (atRiskBundles: AtRiskBundleModel[]): HealthPulseItem[] => {
  const pulse: Record<HealthPulseItem['key'], number> = {
    healthy: 0,
    watch: 0,
    at_risk: 0,
    critical: 0
  };
  atRiskBundles.forEach((item) => {
    if (item.riskScore >= 80) pulse.critical += 1;
    else if (item.riskScore >= 60) pulse.at_risk += 1;
    else if (item.riskScore >= 35) pulse.watch += 1;
    else pulse.healthy += 1;
  });
  return [
    { key: 'healthy', label: 'Healthy', count: pulse.healthy },
    { key: 'watch', label: 'Watch', count: pulse.watch },
    { key: 'at_risk', label: 'At Risk', count: pulse.at_risk },
    { key: 'critical', label: 'Critical', count: pulse.critical }
  ];
};

const buildAiSummary = async (): Promise<DashboardAiInsight[]> => {
  const ctx = await loadStrategicAdvisorContext();
  if (!ctx) return [];
  const plan = generateActionPlan(ctx.report, ctx.trendSignals, ctx.forecastSignals, ctx.riskPropagationSignals);
  return plan.steps.slice(0, 5).map((step, idx) => {
    const priority = step.priority.toUpperCase();
    const primary = step.relatedEntities[0];
    const entityType = primary?.type === 'milestone'
      ? 'MILESTONE'
      : primary?.type === 'bundle'
        ? 'BUNDLE'
        : primary?.type === 'review'
          ? 'TEAM'
          : 'DEPENDENCY';
    const confidence: DashboardAiInsight['confidence'] =
      step.evidence.length >= 2 ? 'HIGH' : step.evidence.length === 1 ? 'MEDIUM' : 'LOW';
    return {
      id: step.id || `insight-${idx}`,
      severity: priority === 'CRITICAL' ? 'CRITICAL' : priority === 'HIGH' ? 'HIGH' : priority === 'MEDIUM' ? 'MEDIUM' : 'LOW',
      confidence,
      entityType,
      entityId: primary?.id || '',
      title: step.description,
      summary: step.evidence[0]?.text || 'Deterministic execution recommendation derived from portfolio signals.',
      recommendation: step.description,
      href: primary?.type === 'bundle' ? `/program?bundleIds=${encodeURIComponent(primary.id)}` : '/?tab=ai-insights',
      generatedAt: plan.generatedAt
    };
  });
};

const buildSummaryCards = (ctx: ReturnType<typeof filterByScope>, trend: ProgressTrendPoint[]): ExecutiveDashboardResponse['summary'] => {
  const overdueWork = ctx.workItems.filter((item) => {
    const due = asDate(item.dueDate);
    return due && String(item.status || '').toUpperCase() !== 'DONE' && due.getTime() < Date.now();
  }).length;
  const blocked = ctx.workItems.filter((item) => String(item.status || '').toUpperCase() === 'BLOCKED').length;
  const highCritical = ctx.workItems.filter((item) => {
    if (String(item.type || '').toUpperCase() !== 'RISK') return false;
    const severity = String(item.risk?.severity || item.severity || '').toUpperCase();
    return severity === 'HIGH' || severity === 'CRITICAL';
  }).length;
  const variance = Math.abs((trend[trend.length - 1]?.variance || 0));
  const noDelta = () => ({ delta: 0, deltaLabel: 'vs previous period', sparkline: trend.map((t) => t.actual) });

  return {
    bundles: {
      id: 'bundles',
      label: 'Bundles',
      value: ctx.bundles.length,
      ...noDelta(),
      status: metricStatus(0),
      href: '/program'
    },
    milestones: {
      id: 'milestones',
      label: 'Milestones',
      value: ctx.milestones.length,
      ...noDelta(),
      status: metricStatus(0),
      href: '/program'
    },
    workItems: {
      id: 'work-items',
      label: 'Work Items',
      value: ctx.workItems.length,
      ...noDelta(),
      status: metricStatus(variance),
      href: '/program'
    },
    blocked: {
      id: 'blocked',
      label: 'Blocked',
      value: blocked,
      ...noDelta(),
      status: metricStatus(blocked),
      href: '/program?quickFilter=blocked'
    },
    highCriticalRisks: {
      id: 'high-critical-risks',
      label: 'High/Critical Risks',
      value: highCritical,
      ...noDelta(),
      status: metricStatus(highCritical),
      href: '/program'
    },
    overdue: {
      id: 'overdue',
      label: 'Overdue',
      value: overdueWork,
      ...noDelta(),
      status: metricStatus(overdueWork),
      href: '/program?quickFilter=overdue'
    }
  };
};

const loadDashboardContext = async (): Promise<DashboardContext> => {
  const db = await getDb();
  const [bundles, applications, milestones, workItems, users, snapshots] = await Promise.all([
    db.collection('bundles').find({}).project({ _id: 1, id: 1, name: 1, title: 1 }).toArray(),
    db.collection('applications').find({}).project({ _id: 1, id: 1, bundleId: 1, name: 1, status: 1 }).toArray(),
    db.collection('milestones').find({}).project({ _id: 1, id: 1, bundleId: 1, name: 1, targetDate: 1, endDate: 1, startDate: 1, status: 1 }).toArray(),
    db.collection('workitems').find({ $or: [{ isArchived: { $exists: false } }, { isArchived: false }] })
      .project({
        _id: 1, id: 1, key: 1, title: 1, type: 1, status: 1, bundleId: 1, applicationId: 1, milestoneIds: 1,
        createdAt: 1, updatedAt: 1, completedAt: 1, dueDate: 1, assignedTo: 1, assignee: 1, risk: 1, severity: 1, links: 1
      }).toArray(),
    db.collection('users').find({}).project({ _id: 1, id: 1, email: 1, name: 1, team: 1, role: 1 }).toArray(),
    db.collection('portfolio_snapshots').find({}).project({
      createdAt: 1,
      blockedWorkItems: 1,
      overdueWorkItems: 1,
      criticalApplications: 1
    }).toArray()
  ]);
  return { bundles, applications, milestones, workItems, users, snapshots };
};

export const getExecutiveDashboard = async (rawFilters: DashboardFilters = {}): Promise<ExecutiveDashboardResponse> => {
  const filters = normalizeFilters(rawFilters);
  const cacheKey = buildCacheKey('executive', filters);
  const cached = fromCache<ExecutiveDashboardResponse>(cacheKey);
  if (cached) return cached;

  const base = await loadDashboardContext();
  const scoped = filterByScope(base, filters);
  const days = getWindowDays(filters.timeWindow);

  const progressTrend = buildProgressTrend(scoped.workItems, scoped.milestones, days);
  const forecast = buildForecastRows(scoped.bundles, scoped.milestones, scoped.workItems, progressTrend);
  const atRiskBundles = buildAtRiskBundles(forecast, scoped.workItems, scoped.milestones);
  const blockerHeatmap = buildBlockerHeatmap(scoped.workItems, scoped.userByIdentity);
  const riskTrend = buildRiskTrend(days, base.snapshots, scoped.workItems);
  const velocityTrend = buildVelocityTrend(scoped.workItems, days);
  const capacityUtilization = buildCapacityUtilization(scoped.workItems, scoped.users, scoped.userByIdentity);
  const dependencyRiskMap = buildDependencyRiskMap(scoped.workItems);
  const workItemAging = buildAging(scoped.workItems);
  const applicationDistribution = buildApplicationDistribution(scoped.applications);
  const healthPulse = buildHealthPulse(atRiskBundles);
  const aiSummary = await buildAiSummary();

  const executive: ExecutiveDashboardResponse = {
    filters,
    summary: buildSummaryCards(scoped, progressTrend),
    progressTrend,
    forecast,
    atRiskBundles,
    blockerHeatmap: { dimension: 'bundle', cells: blockerHeatmap },
    riskTrend,
    velocityTrend,
    milestoneBurndown: null,
    capacityUtilization,
    dependencyRiskMap,
    workItemAging,
    applicationDistribution,
    healthPulse,
    aiSummary
  };
  toCache(cacheKey, executive);
  return executive;
};

export const getDashboardKpis = async (filters: DashboardFilters = {}) => {
  const executive = await getExecutiveDashboard(filters);
  return executive.summary;
};

export const getDeliveryProgressTrend = async (filters: DashboardFilters = {}) => {
  const executive = await getExecutiveDashboard(filters);
  return executive.progressTrend;
};

export const getDeliveryForecast = async (filters: DashboardFilters = {}) => {
  const executive = await getExecutiveDashboard(filters);
  return executive.forecast;
};

export const getBlockerHeatmap = async (filters: DashboardFilters = {}) => {
  const executive = await getExecutiveDashboard(filters);
  return executive.blockerHeatmap;
};

export const getVelocityTrend = async (filters: DashboardFilters = {}) => {
  const executive = await getExecutiveDashboard(filters);
  return executive.velocityTrend;
};

export const getCapacityUtilization = async (filters: DashboardFilters = {}) => {
  const executive = await getExecutiveDashboard(filters);
  return executive.capacityUtilization;
};

export const getDependencyRiskMap = async (filters: DashboardFilters = {}) => {
  const executive = await getExecutiveDashboard(filters);
  return executive.dependencyRiskMap;
};

export const getWorkItemAging = async (filters: DashboardFilters = {}) => {
  const executive = await getExecutiveDashboard(filters);
  return executive.workItemAging;
};

export const getAiDashboardSummary = async (filters: DashboardFilters = {}) => {
  const executive = await getExecutiveDashboard(filters);
  return executive.aiSummary;
};

export const getBundleDashboard = async (bundleId: string, rawFilters: DashboardFilters = {}): Promise<BundleDashboardResponse> => {
  const db = await getDb();
  const bundle = ObjectId.isValid(bundleId)
    ? await db.collection('bundles').findOne({ _id: new ObjectId(bundleId) })
    : await db.collection('bundles').findOne({ id: bundleId });
  const executive = await getExecutiveDashboard({ ...rawFilters, bundleId });
  return {
    bundleId,
    bundleName: String(bundle?.name || bundle?.title || bundleId),
    executive
  };
};

export const getMilestoneDashboard = async (milestoneId: string, rawFilters: DashboardFilters = {}): Promise<MilestoneDashboardResponse> => {
  const db = await getDb();
  const milestone = ObjectId.isValid(milestoneId)
    ? await db.collection('milestones').findOne({ _id: new ObjectId(milestoneId) })
    : await db.collection('milestones').findOne({ $or: [{ id: milestoneId }, { name: milestoneId }] });
  if (!milestone) {
    return {
      milestoneId,
      milestoneName: milestoneId,
      metadata: {},
      progressTrend: [],
      burndown: [],
      blockedItems: 0,
      overdueItems: 0,
      unassignedItems: 0,
      dependencies: [],
      aiSummary: []
    };
  }

  const bundleId = String(milestone.bundleId || '');
  const executive = await getExecutiveDashboard({ ...rawFilters, bundleId });
  const milestoneItems = await (await getDb()).collection('workitems').find({
    $and: [
      {
        $or: [
          { milestoneIds: milestoneId },
          ...(ObjectId.isValid(milestoneId) ? [{ milestoneIds: new ObjectId(milestoneId) }] : []),
          { milestoneId }
        ]
      },
      { $or: [{ isArchived: { $exists: false } }, { isArchived: false }] }
    ]
  }).project({ status: 1, dueDate: 1, assignedTo: 1, links: 1 }).toArray();

  const blockedItems = milestoneItems.filter((item: any) => String(item.status || '').toUpperCase() === 'BLOCKED').length;
  const overdueItems = milestoneItems.filter((item: any) => {
    const due = asDate(item.dueDate);
    return due && String(item.status || '').toUpperCase() !== 'DONE' && due.getTime() < Date.now();
  }).length;
  const unassignedItems = milestoneItems.filter((item: any) => !String(item.assignedTo || '').trim()).length;

  return {
    milestoneId: String(milestone._id || milestone.id || milestoneId),
    milestoneName: String(milestone.name || milestoneId),
    metadata: {
      bundleId,
      targetDate: milestone.targetDate || milestone.endDate,
      startDate: milestone.startDate,
      status: milestone.status
    },
    progressTrend: executive.progressTrend,
    burndown: [],
    blockedItems,
    overdueItems,
    unassignedItems,
    dependencies: executive.dependencyRiskMap.slice(0, 10),
    aiSummary: executive.aiSummary
  };
};
