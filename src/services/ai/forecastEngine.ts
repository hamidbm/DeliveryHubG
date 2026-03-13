import { ForecastSignal, PortfolioSnapshot, PortfolioTrendSignal, StructuredPortfolioReport } from '../../types/ai';
import { toEvidenceItems } from './evidenceEntities';
import { derivePortfolioSignals } from './portfolioSignals';
import { extractMilestoneStats, extractReviewStats } from './knowledgeExtractors';

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

const severityWeight: Record<'low' | 'medium' | 'high', number> = {
  low: 1,
  medium: 2,
  high: 3
};

const trendByMetric = (trends: PortfolioTrendSignal[], metric: PortfolioTrendSignal['metric']) =>
  trends.find((item) => item.metric === metric);

const trendStrengthFrom = (trend?: PortfolioTrendSignal) => {
  if (!trend) return 0.2;
  return clamp01(Math.abs(trend.delta) / 20);
};

const dataCompleteness = (snapshot: PortfolioSnapshot, report: StructuredPortfolioReport) => {
  let score = 0;
  if (snapshot.workItems.total > 0) score += 0.25;
  if ((snapshot.milestones.items || []).length > 0) score += 0.2;
  if ((snapshot.reviews.items || []).length > 0) score += 0.2;
  if ((report.trendSignals || []).length > 0) score += 0.2;
  if ((report.alerts || []).length > 0 || report.healthScore) score += 0.15;
  return clamp01(score);
};

const confidenceScore = (
  trendStrength: number,
  completeness: number,
  consistency: number
) => clamp01(trendStrength * 0.5 + completeness * 0.3 + consistency * 0.2);

const makeSignalId = (category: ForecastSignal['category'], suffix: string) => `${category}-${suffix}`;

export const generateForecastSignals = (
  snapshot: PortfolioSnapshot,
  report: StructuredPortfolioReport,
  trends: PortfolioTrendSignal[] = []
): ForecastSignal[] => {
  const out: ForecastSignal[] = [];
  const signals = derivePortfolioSignals(snapshot);
  const milestones = extractMilestoneStats(snapshot);
  const reviews = extractReviewStats(snapshot);
  const completeness = dataCompleteness(snapshot, report);

  const overdueTrend = trendByMetric(trends, 'overdueWorkItems');
  const blockedTrend = trendByMetric(trends, 'blockedWorkItems');
  const unassignedTrend = trendByMetric(trends, 'unassignedWorkItems');
  const activeTrend = trendByMetric(trends, 'activeWorkItems');

  // 1) Milestone Slip Risk
  milestones.forEach((milestone) => {
    if (milestone.relatedWorkItemCount <= 0) return;
    const overdueRatio = milestone.overdueWorkItemCount / Math.max(1, milestone.relatedWorkItemCount);
    const remainingTasks = milestone.relatedWorkItemCount - milestone.activeWorkItemCount;
    if (overdueRatio < 0.2 || remainingTasks < 5) return;

    const severity: ForecastSignal['severity'] = overdueRatio > 0.3 ? 'high' : 'medium';
    const confidence = confidenceScore(
      trendStrengthFrom(overdueTrend),
      completeness,
      overdueTrend?.direction === 'rising' ? 0.9 : 0.6
    );

    out.push({
      id: makeSignalId('milestone_risk', milestone.milestoneId),
      title: `${milestone.name} may slip`,
      category: 'milestone_risk',
      severity,
      confidence,
      summary: `Overdue work ratio is ${(overdueRatio * 100).toFixed(1)}% with ${remainingTasks} remaining linked tasks, indicating delivery date pressure.`,
      evidence: toEvidenceItems([
        {
          text: `${milestone.overdueWorkItemCount} overdue tasks linked to milestone ${milestone.name}.`,
          entities: [{ type: 'milestone', id: milestone.milestoneId, label: milestone.name }]
        },
        {
          text: `Completion pressure: ${remainingTasks} remaining linked tasks out of ${milestone.relatedWorkItemCount}.`,
          entities: [{ type: 'milestone', id: milestone.milestoneId, label: milestone.name }]
        },
        overdueTrend ? `Overdue-work trend: ${overdueTrend.direction} (${overdueTrend.delta >= 0 ? '+' : ''}${overdueTrend.delta}) over ${overdueTrend.timeframeDays} days.` : 'Overdue-work trend unavailable.'
      ], 'deterministic', 4),
      relatedEntities: [{ type: 'milestone', id: milestone.milestoneId, label: milestone.name }]
    });
  });

  // 2) Execution Slowdown
  const slowdownCondition = blockedTrend?.direction === 'rising' && activeTrend?.direction === 'falling';
  if (slowdownCondition) {
    const blockedGrowth = Math.abs(blockedTrend?.delta || 0);
    const severity: ForecastSignal['severity'] = blockedGrowth >= 6 ? 'high' : 'medium';
    const confidence = confidenceScore(
      (trendStrengthFrom(blockedTrend) + trendStrengthFrom(activeTrend)) / 2,
      completeness,
      0.9
    );

    out.push({
      id: makeSignalId('execution_slowdown', 'portfolio'),
      title: 'Execution throughput is likely slowing down',
      category: 'execution_slowdown',
      severity,
      confidence,
      summary: 'Blocked work is increasing while active execution is decreasing, indicating near-term throughput slowdown risk.',
      evidence: toEvidenceItems([
        blockedTrend ? `Blocked-work trend: ${blockedTrend.direction} (${blockedTrend.delta >= 0 ? '+' : ''}${blockedTrend.delta}) over ${blockedTrend.timeframeDays} days.` : 'Blocked-work trend unavailable.',
        activeTrend ? `Active-work trend: ${activeTrend.direction} (${activeTrend.delta >= 0 ? '+' : ''}${activeTrend.delta}) over ${activeTrend.timeframeDays} days.` : 'Active-work trend unavailable.',
        `Current blocked ratio: ${(signals.blockedRatio * 100).toFixed(1)}%. Active-work ratio: ${(signals.activeWorkRatio * 100).toFixed(1)}%.`
      ], 'deterministic', 4)
    });
  }

  // 3) Backlog Growth
  const backlogCondition = unassignedTrend?.direction === 'rising' && (activeTrend?.direction === 'stable' || activeTrend?.direction === 'falling');
  if (backlogCondition) {
    const severity: ForecastSignal['severity'] = (unassignedTrend?.delta || 0) >= 8 ? 'high' : 'medium';
    const confidence = confidenceScore(
      trendStrengthFrom(unassignedTrend),
      completeness,
      0.85
    );

    out.push({
      id: makeSignalId('backlog_growth', 'portfolio'),
      title: 'Backlog growth is outpacing execution',
      category: 'backlog_growth',
      severity,
      confidence,
      summary: 'Unassigned backlog is rising while active execution is not increasing, creating likely near-term delivery drag.',
      evidence: toEvidenceItems([
        unassignedTrend ? `Unassigned-work trend: ${unassignedTrend.direction} (${unassignedTrend.delta >= 0 ? '+' : ''}${unassignedTrend.delta}) over ${unassignedTrend.timeframeDays} days.` : 'Unassigned-work trend unavailable.',
        activeTrend ? `Active-work trend: ${activeTrend.direction} (${activeTrend.delta >= 0 ? '+' : ''}${activeTrend.delta}) over ${activeTrend.timeframeDays} days.` : 'Active-work trend unavailable.',
        `Current unassigned ratio: ${(signals.unassignedRatio * 100).toFixed(1)}%.`
      ], 'deterministic', 4)
    });
  }

  // 4) Ownership Risk
  if (signals.unassignedRatio > 0.25) {
    const severity: ForecastSignal['severity'] = signals.unassignedRatio > 0.4 ? 'high' : 'medium';
    const confidence = confidenceScore(
      trendStrengthFrom(unassignedTrend),
      completeness,
      signals.unassignedRatio > 0.4 ? 0.95 : 0.8
    );

    out.push({
      id: makeSignalId('ownership_risk', 'portfolio'),
      title: 'Ownership risk from unassigned workload',
      category: 'ownership_risk',
      severity,
      confidence,
      summary: `${signals.unassignedWorkItems} work items are unassigned (${(signals.unassignedRatio * 100).toFixed(1)}%), increasing near-term execution uncertainty.`,
      evidence: toEvidenceItems([
        `${signals.unassignedWorkItems} unassigned work items out of ${signals.totalWorkItems}.`,
        unassignedTrend ? `Unassigned-work trend: ${unassignedTrend.direction} (${unassignedTrend.delta >= 0 ? '+' : ''}${unassignedTrend.delta}) over ${unassignedTrend.timeframeDays} days.` : 'Unassigned-work trend unavailable.'
      ], 'deterministic', 3),
      relatedEntities: [{ type: 'workitem', id: 'unassigned', label: 'Unassigned Work Items', secondary: `${signals.unassignedWorkItems}` }]
    });
  }

  // 5) Review Bottleneck
  const overdueReviews = reviews.filter((item) => item.overdue).length;
  const openReviewsTrend = trendByMetric(trends, 'overdueMilestones');
  if ((snapshot.reviews.open > 0 && overdueReviews >= 2) || (snapshot.reviews.open > 4 && overdueReviews > 0)) {
    const severity: ForecastSignal['severity'] = overdueReviews >= 5 ? 'high' : 'medium';
    const confidence = confidenceScore(
      trendStrengthFrom(openReviewsTrend),
      completeness,
      0.75
    );

    out.push({
      id: makeSignalId('review_bottleneck', 'portfolio'),
      title: 'Review cycle bottleneck risk',
      category: 'review_bottleneck',
      severity,
      confidence,
      summary: `${snapshot.reviews.open} open reviews with ${overdueReviews} overdue suggest review throughput may constrain delivery flow.`,
      evidence: toEvidenceItems([
        `${snapshot.reviews.open} review cycles are open.`,
        `${overdueReviews} review cycles are overdue.`,
        openReviewsTrend ? `Related milestone pressure trend: ${openReviewsTrend.direction} (${openReviewsTrend.delta >= 0 ? '+' : ''}${openReviewsTrend.delta}) over ${openReviewsTrend.timeframeDays} days.` : 'No trend context available for review bottleneck.'
      ], 'deterministic', 4),
      relatedEntities: [{ type: 'review', id: 'open', label: 'Open Reviews', secondary: `${snapshot.reviews.open}` }]
    });
  }

  return out
    .slice()
    .sort((a, b) => {
      const sev = severityWeight[b.severity] - severityWeight[a.severity];
      if (sev !== 0) return sev;
      return b.confidence - a.confidence;
    })
    .slice(0, 8);
};
