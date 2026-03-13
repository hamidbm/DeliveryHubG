import { EntityReference, PortfolioSnapshot, PortfolioTrendSignal, PredictiveRisk } from '../../types/ai';
import { PortfolioSignalSummary } from './portfolioSignals';
import { toEvidenceItems } from './evidenceEntities';

const severityOrder = ['critical', 'high', 'medium', 'low'] as const;

const trendByMetric = (
  trendSignals: PortfolioTrendSignal[] = [],
  metric: PortfolioTrendSignal['metric']
) => trendSignals.find((item) => item.metric === metric);

const topEntities = (entities: EntityReference[], max = 5) => {
  const seen = new Set<string>();
  const output: EntityReference[] = [];
  for (const entity of entities) {
    const key = `${entity.type}:${entity.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(entity);
    if (output.length >= max) break;
  }
  return output;
};

const blockedWorkEntities = (snapshot: PortfolioSnapshot): EntityReference[] =>
  (snapshot.workItems.items || [])
    .filter((item) => item.blocked)
    .slice(0, 6)
    .map((item) => ({
      type: 'workitem' as const,
      id: item.id,
      label: item.key || item.title,
      secondary: item.milestoneIds?.[0] ? `Milestone ${item.milestoneIds[0]}` : undefined
    }));

const overdueMilestoneEntities = (snapshot: PortfolioSnapshot): EntityReference[] =>
  (snapshot.milestones.items || [])
    .filter((item) => {
      const status = String(item.status || '').toLowerCase();
      return status !== 'done' && status !== 'completed' && status !== 'released' && Boolean(item.targetDate);
    })
    .slice(0, 6)
    .map((item) => ({
      type: 'milestone' as const,
      id: item.id,
      label: item.name
    }));

const reviewEntities = (snapshot: PortfolioSnapshot): EntityReference[] =>
  (snapshot.reviews.items || [])
    .filter((item) => {
      const status = String(item.status || '').toLowerCase();
      return status !== 'done' && status !== 'completed' && status !== 'closed' && Boolean(item.dueDate);
    })
    .slice(0, 6)
    .map((item) => ({
      type: 'review' as const,
      id: item.id,
      label: item.title || `Review ${item.id}`
    }));

const withEvidence = (texts: string[], entities: EntityReference[]) => toEvidenceItems(
  texts.map((text) => ({ text, entities })),
  'deterministic',
  6
);

const makeRisk = (
  id: string,
  title: string,
  severity: PredictiveRisk['severity'],
  summary: string,
  evidenceTexts: string[],
  entities: EntityReference[]
): PredictiveRisk => ({
  id,
  title,
  severity,
  summary,
  evidence: withEvidence(evidenceTexts, entities),
  entities,
  provenance: 'deterministic'
});

export const detectPredictiveRisks = (
  snapshot: PortfolioSnapshot,
  signals: PortfolioSignalSummary,
  trendSignals: PortfolioTrendSignal[] = []
): PredictiveRisk[] => {
  const risks: PredictiveRisk[] = [];

  const blockedTrend = trendByMetric(trendSignals, 'blockedWorkItems');
  const unassignedTrend = trendByMetric(trendSignals, 'unassignedWorkItems');
  const overdueTrend = trendByMetric(trendSignals, 'overdueWorkItems');
  const milestoneTrend = trendByMetric(trendSignals, 'overdueMilestones');

  if (
    blockedTrend?.direction === 'rising'
    && (signals.unassignedRatio >= 0.35 || signals.blockedRatio >= 0.15)
  ) {
    const entities = topEntities(blockedWorkEntities(snapshot));
    const severity: PredictiveRisk['severity'] = signals.blockedRatio >= 0.25 ? 'critical' : 'high';
    risks.push(makeRisk(
      'predictive-execution-risk',
      'Execution Risk Escalation',
      severity,
      'Blocked delivery pressure is rising while ownership/execution stress remains elevated.',
      [
        `Blocked work trend is ${blockedTrend.direction} (${blockedTrend.delta >= 0 ? '+' : ''}${blockedTrend.delta}) over ${blockedTrend.timeframeDays} days.`,
        `Blocked ratio is ${(signals.blockedRatio * 100).toFixed(1)}% and unassigned ratio is ${(signals.unassignedRatio * 100).toFixed(1)}%.`
      ],
      entities
    ));
  }

  if (
    (milestoneTrend?.direction === 'rising' || snapshot.milestones.overdue > 0)
    && overdueTrend?.direction === 'rising'
  ) {
    const entities = topEntities([
      ...overdueMilestoneEntities(snapshot),
      ...blockedWorkEntities(snapshot)
    ]);
    const severity: PredictiveRisk['severity'] = snapshot.milestones.overdue > 2 ? 'critical' : 'high';
    risks.push(makeRisk(
      'predictive-milestone-slip',
      'Milestone Slip Risk',
      severity,
      'Milestone exposure is increasing alongside worsening overdue execution pressure.',
      [
        `Overdue work trend is rising (${overdueTrend.delta >= 0 ? '+' : ''}${overdueTrend.delta} over ${overdueTrend.timeframeDays} days).`,
        `Overdue milestones: ${snapshot.milestones.overdue}.`
      ],
      entities
    ));
  }

  if (signals.reviewsOverdue > 0 && unassignedTrend?.direction === 'rising') {
    const entities = topEntities([
      ...reviewEntities(snapshot),
      ...blockedWorkEntities(snapshot)
    ]);
    const severity: PredictiveRisk['severity'] = signals.reviewsOverdue >= 5 ? 'high' : 'medium';
    risks.push(makeRisk(
      'predictive-review-congestion',
      'Review Congestion Risk',
      severity,
      'Review backlog and ownership pressure indicate likely review-cycle congestion.',
      [
        `Overdue reviews: ${signals.reviewsOverdue}.`,
        `Unassigned workload trend is ${unassignedTrend.direction} (${unassignedTrend.delta >= 0 ? '+' : ''}${unassignedTrend.delta} over ${unassignedTrend.timeframeDays} days).`
      ],
      entities
    ));
  }

  if (signals.activeWorkRatio < 0.2 && unassignedTrend?.direction === 'rising') {
    const entities = topEntities(blockedWorkEntities(snapshot));
    const severity: PredictiveRisk['severity'] = signals.activeWorkRatio < 0.1 ? 'high' : 'medium';
    risks.push(makeRisk(
      'predictive-capacity-pressure',
      'Capacity Pressure Risk',
      severity,
      'Active throughput is low while backlog pressure continues to rise.',
      [
        `Active work ratio is ${(signals.activeWorkRatio * 100).toFixed(1)}%.`,
        `Unassigned trend is rising (${unassignedTrend.delta >= 0 ? '+' : ''}${unassignedTrend.delta} over ${unassignedTrend.timeframeDays} days).`
      ],
      entities
    ));
  }

  return risks
    .sort((a, b) => severityOrder.indexOf(a.severity) - severityOrder.indexOf(b.severity))
    .slice(0, 8);
};
