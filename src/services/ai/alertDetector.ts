import {
  EntityReference,
  HealthScore,
  PortfolioAlert,
  PortfolioSnapshot,
  PortfolioTrendSignal,
  PortfolioRiskSeverity
} from '../../types/ai';
import { PortfolioSignalSummary } from './portfolioSignals';
import { toEvidenceItems } from './evidenceEntities';
import { detectPredictiveRisks } from './predictiveRisk';

type AlertThresholds = {
  unassignedRatio: number;
  blockedRatio: number;
  overdueRatio: number;
  criticalApplications: number;
  milestoneOverdue: number;
  lowHealthScore: number;
};

const DEFAULT_THRESHOLDS: AlertThresholds = {
  unassignedRatio: 0.4,
  blockedRatio: 0.12,
  overdueRatio: 0.1,
  criticalApplications: 4,
  milestoneOverdue: 1,
  lowHealthScore: 60
};

const severityRank: Record<PortfolioRiskSeverity, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1
};

const nowIso = () => new Date().toISOString();

const uniqueEntities = (entities: EntityReference[], limit = 6) => {
  const out: EntityReference[] = [];
  const seen = new Set<string>();
  for (const entity of entities) {
    const key = `${entity.type}:${entity.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(entity);
    if (out.length >= limit) break;
  }
  return out;
};

const entitiesForMetric = (
  snapshot: PortfolioSnapshot,
  metric: PortfolioTrendSignal['metric']
): EntityReference[] => {
  if (metric === 'criticalApplications') {
    return uniqueEntities((snapshot.applications.items || [])
      .filter((item) => item.health === 'critical')
      .slice(0, 6)
      .map((item) => ({ type: 'application' as const, id: item.id, label: item.name })));
  }

  if (metric === 'overdueMilestones') {
    return uniqueEntities((snapshot.milestones.items || [])
      .filter((item) => Boolean(item.targetDate))
      .slice(0, 6)
      .map((item) => ({ type: 'milestone' as const, id: item.id, label: item.name })));
  }

  const items = (snapshot.workItems.items || []).filter((item) => {
    if (metric === 'blockedWorkItems') return item.blocked;
    if (metric === 'unassignedWorkItems') return !item.assignee;
    if (metric === 'overdueWorkItems') return Boolean(item.dueDate);
    if (metric === 'activeWorkItems') return String(item.status || '').toUpperCase() === 'IN_PROGRESS';
    return false;
  });

  return uniqueEntities(items.slice(0, 6).map((item) => ({
    type: 'workitem' as const,
    id: item.id,
    label: item.key || item.title,
    secondary: item.milestoneIds?.[0] ? `Milestone ${item.milestoneIds[0]}` : undefined
  })));
};

const makeAlert = (
  id: string,
  title: string,
  severity: PortfolioRiskSeverity,
  summary: string,
  rationale: string,
  evidenceTexts: string[],
  entities: EntityReference[],
  resultOf: PortfolioAlert['resultOf']
): PortfolioAlert => {
  const dedupedEntities = uniqueEntities(entities);
  const evidence = toEvidenceItems(
    evidenceTexts.map((text) => ({ text, entities: dedupedEntities })),
    'deterministic',
    6
  );

  return {
    id,
    title,
    severity,
    summary,
    rationale,
    evidence,
    entities: dedupedEntities,
    resultOf,
    timestamp: nowIso()
  };
};

const severityForTrend = (signal: PortfolioTrendSignal): PortfolioRiskSeverity => {
  const absDelta = Math.abs(signal.delta);
  if (signal.direction !== 'rising') return 'low';
  if (absDelta >= 12) return 'critical';
  if (absDelta >= 6) return 'high';
  if (absDelta >= 2) return 'medium';
  return 'low';
};

export const detectPortfolioAlerts = (
  snapshot: PortfolioSnapshot,
  signals: PortfolioSignalSummary,
  trendSignals: PortfolioTrendSignal[] = [],
  healthScore?: HealthScore,
  thresholds: Partial<AlertThresholds> = {}
): PortfolioAlert[] => {
  const cfg: AlertThresholds = { ...DEFAULT_THRESHOLDS, ...thresholds };
  const alerts: PortfolioAlert[] = [];

  trendSignals.forEach((signal) => {
    if (signal.direction !== 'rising') return;
    if (signal.metric === 'activeWorkItems') return;

    const metricTitle: Record<PortfolioTrendSignal['metric'], string> = {
      unassignedWorkItems: 'Rising Unassigned Workload',
      blockedWorkItems: 'Increasing Blocked Tasks',
      overdueWorkItems: 'Growing Overdue Work',
      activeWorkItems: 'Active Throughput Shift',
      criticalApplications: 'Critical Applications Increasing',
      overdueMilestones: 'Milestone Threat Rising'
    };

    alerts.push(makeAlert(
      `alert-trend-${signal.metric}`,
      metricTitle[signal.metric],
      severityForTrend(signal),
      signal.summary || `${signal.metric} is rising over recent snapshots.`,
      `Trend signal ${signal.metric} moved in a worsening direction (${signal.delta >= 0 ? '+' : ''}${signal.delta}) over ${signal.timeframeDays} days.`,
      [
        signal.summary || `${signal.metric} rising`,
        `Direction: ${signal.direction}, delta: ${signal.delta}, timeframe: ${signal.timeframeDays} days.`
      ],
      entitiesForMetric(snapshot, signal.metric),
      'trend'
    ));
  });

  if (signals.unassignedRatio >= cfg.unassignedRatio) {
    alerts.push(makeAlert(
      'alert-threshold-unassigned-ratio',
      'Unassigned Ownership Threshold Breach',
      signals.unassignedRatio >= 0.55 ? 'critical' : 'high',
      `Unassigned ratio is ${(signals.unassignedRatio * 100).toFixed(1)}%, above configured threshold.`,
      `Unassigned ratio crossed the threshold of ${(cfg.unassignedRatio * 100).toFixed(0)}%.`,
      [`Unassigned work items: ${signals.unassignedWorkItems} of ${signals.totalWorkItems}.`],
      entitiesForMetric(snapshot, 'unassignedWorkItems'),
      'threshold'
    ));
  }

  if (signals.blockedRatio >= cfg.blockedRatio) {
    alerts.push(makeAlert(
      'alert-threshold-blocked-ratio',
      'Blocked Work Threshold Breach',
      signals.blockedRatio >= 0.2 ? 'critical' : 'high',
      `Blocked ratio is ${(signals.blockedRatio * 100).toFixed(1)}%, above configured threshold.`,
      `Blocked ratio crossed the threshold of ${(cfg.blockedRatio * 100).toFixed(0)}%.`,
      [`Blocked work items: ${signals.blockedWorkItems}.`],
      entitiesForMetric(snapshot, 'blockedWorkItems'),
      'threshold'
    ));
  }

  if (signals.overdueRatio >= cfg.overdueRatio) {
    alerts.push(makeAlert(
      'alert-threshold-overdue-ratio',
      'Overdue Work Threshold Breach',
      signals.overdueRatio >= 0.18 ? 'high' : 'medium',
      `Overdue ratio is ${(signals.overdueRatio * 100).toFixed(1)}%, above configured threshold.`,
      `Overdue ratio crossed the threshold of ${(cfg.overdueRatio * 100).toFixed(0)}%.`,
      [`Overdue work items: ${signals.overdueWorkItems}.`],
      entitiesForMetric(snapshot, 'overdueWorkItems'),
      'threshold'
    ));
  }

  if (signals.criticalApplications >= cfg.criticalApplications) {
    alerts.push(makeAlert(
      'alert-threshold-critical-apps',
      'Critical Application Threshold Breach',
      signals.criticalApplications >= cfg.criticalApplications * 1.5 ? 'critical' : 'high',
      `${signals.criticalApplications} applications are in critical health.`,
      `Critical-application count crossed the threshold of ${cfg.criticalApplications}.`,
      [`Critical application count: ${signals.criticalApplications}.`],
      entitiesForMetric(snapshot, 'criticalApplications'),
      'threshold'
    ));
  }

  if (signals.milestonesOverdue >= cfg.milestoneOverdue) {
    alerts.push(makeAlert(
      'alert-threshold-overdue-milestones',
      'Overdue Milestone Exposure',
      signals.milestonesOverdue > 2 ? 'critical' : 'high',
      `${signals.milestonesOverdue} milestones are overdue.`,
      `Overdue milestone count exceeded threshold (${cfg.milestoneOverdue}).`,
      [`Overdue milestones: ${signals.milestonesOverdue}.`],
      entitiesForMetric(snapshot, 'overdueMilestones'),
      'threshold'
    ));
  }

  if (healthScore && healthScore.overall <= cfg.lowHealthScore) {
    alerts.push(makeAlert(
      'alert-health-low-overall',
      'Portfolio Health Score Low',
      healthScore.overall <= 40 ? 'critical' : 'high',
      `Portfolio health score is ${healthScore.overall}/100, indicating elevated delivery stress.`,
      `Overall health score dropped below configured threshold (${cfg.lowHealthScore}).`,
      [
        `Health score: ${healthScore.overall}/100`,
        `Component scores: unassigned ${healthScore.components.unassigned}, blocked ${healthScore.components.blocked}, overdue ${healthScore.components.overdue}, active ${healthScore.components.active}`
      ],
      [],
      'threshold'
    ));
  }

  const predictive = detectPredictiveRisks(snapshot, signals, trendSignals);
  predictive.forEach((risk) => {
    alerts.push({
      id: `alert-${risk.id}`,
      title: risk.title,
      severity: risk.severity,
      summary: risk.summary,
      rationale: 'Predictive risk rule triggered from current and trend signals.',
      evidence: risk.evidence,
      entities: risk.entities,
      resultOf: 'predictive',
      timestamp: nowIso()
    });
  });

  const deduped = new Map<string, PortfolioAlert>();
  alerts.forEach((alert) => {
    const existing = deduped.get(alert.title);
    if (!existing || severityRank[alert.severity] > severityRank[existing.severity]) {
      deduped.set(alert.title, alert);
    }
  });

  return Array.from(deduped.values())
    .sort((a, b) => severityRank[b.severity] - severityRank[a.severity])
    .slice(0, 12);
};
