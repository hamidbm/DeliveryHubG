import { ExecutiveSummary, PortfolioAlert, PortfolioRiskSeverity, PortfolioTrendSignal, StructuredPortfolioReport } from '../../types/ai';

const severityWeight: Record<PortfolioRiskSeverity, number> = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4
};

const metricLabel: Record<PortfolioTrendSignal['metric'], string> = {
  unassignedWorkItems: 'Unassigned work',
  blockedWorkItems: 'Blocked work',
  overdueWorkItems: 'Overdue work',
  activeWorkItems: 'Active work',
  criticalApplications: 'Critical applications',
  overdueMilestones: 'Overdue milestones'
};

const healthLabelFromScore = (score: number): ExecutiveSummary['portfolioHealth']['healthLabel'] => {
  if (score >= 80) return 'healthy';
  if (score >= 60) return 'moderate_risk';
  return 'high_risk';
};

const toRecommendationSet = (report: StructuredPortfolioReport, trendHighlights: PortfolioTrendSignal[]) => {
  const rec = new Set<string>();

  const health = report.healthScore;
  if (health) {
    if (health.components.unassigned <= 70) {
      rec.add('Reassign unowned tasks in bundles with the largest unassigned backlog.');
    }
    if (health.components.overdue <= 70) {
      rec.add('Prioritize overdue work items to stabilize delivery cadence.');
    }
    if (health.components.blocked <= 70) {
      rec.add('Investigate blocking issues and escalate ownership for blocker removal.');
    }
    if (health.overall < 60) {
      rec.add('Focus on reducing overall delivery risk by cutting blocked, overdue, and unassigned work in the next cycle.');
    }
  }

  for (const trend of trendHighlights) {
    if (trend.direction !== 'rising') continue;
    if (trend.metric === 'overdueWorkItems') {
      rec.add('Create a two-week overdue burn-down plan with accountable owners and daily tracking.');
    }
    if (trend.metric === 'blockedWorkItems') {
      rec.add('Run blocker triage with engineering and architecture leads to remove critical dependency constraints.');
    }
    if (trend.metric === 'unassignedWorkItems') {
      rec.add('Assign ownership for rising unassigned work and enforce assignment SLAs for new tasks.');
    }
    if (trend.metric === 'overdueMilestones') {
      rec.add('Review milestone commitments and rebaseline dates where exposure is increasing.');
    }
  }

  const highAlerts = (report.alerts || []).filter((alert) => severityWeight[alert.severity] >= severityWeight.high);
  if (highAlerts.length > 0) {
    rec.add('Address high-severity alerts first and track mitigation progress in weekly executive review.');
  }

  if (rec.size === 0) {
    rec.add('Maintain current execution controls and monitor trend movement weekly for early risk detection.');
  }

  return Array.from(rec).slice(0, 6);
};

const toObservation = (trend: PortfolioTrendSignal) => {
  const metric = metricLabel[trend.metric] || trend.metric;
  const delta = Math.abs(Number(trend.delta || 0));
  if (trend.direction === 'rising') {
    return `${metric} increased by ${delta} over the last ${trend.timeframeDays} days.`;
  }
  if (trend.direction === 'falling') {
    return `${metric} decreased by ${delta} over the last ${trend.timeframeDays} days.`;
  }
  return `${metric} remained stable over the last ${trend.timeframeDays} days.`;
};

const isSignificantTrend = (trend: PortfolioTrendSignal) => {
  const delta = Math.abs(Number(trend.delta || 0));
  return delta >= 2 || trend.direction !== 'stable';
};

const toConcern = (alert: PortfolioAlert) => {
  return `${alert.title}: ${alert.summary}`;
};

export async function buildExecutiveSummary(report: StructuredPortfolioReport): Promise<ExecutiveSummary> {
  const health = report.healthScore;
  const overallScore = Math.max(0, Math.min(100, Number(health?.overall || 0)));
  const components: Record<string, number> = {
    unassigned: Number(health?.components?.unassigned || 0),
    blocked: Number(health?.components?.blocked || 0),
    overdue: Number(health?.components?.overdue || 0),
    active: Number(health?.components?.active || 0),
    criticalApps: Number(health?.components?.criticalApps || 0),
    milestoneOverdue: Number(health?.components?.milestoneOverdue || 0)
  };

  const topAlerts = (report.alerts || [])
    .slice()
    .sort((a, b) => severityWeight[b.severity] - severityWeight[a.severity])
    .slice(0, 5);

  const trendHighlights = (report.trendSignals || [])
    .filter(isSignificantTrend)
    .slice()
    .sort((a, b) => Math.abs(Number(b.delta || 0)) - Math.abs(Number(a.delta || 0)))
    .slice(0, 6);

  const keyObservations = trendHighlights.length
    ? trendHighlights.map(toObservation)
    : ['No significant portfolio trend movement was detected in the current analysis window.'];

  const strategicConcerns = [
    ...topAlerts
      .filter((alert) => severityWeight[alert.severity] >= severityWeight.high)
      .map(toConcern)
      .slice(0, 4)
  ];

  if (overallScore < 60) {
    strategicConcerns.unshift(`Portfolio health score is ${overallScore}/100, indicating elevated delivery risk.`);
  }

  const uniqueConcerns = Array.from(new Set(strategicConcerns)).slice(0, 6);

  return {
    portfolioHealth: {
      overallScore,
      components,
      healthLabel: healthLabelFromScore(overallScore)
    },
    keyObservations,
    strategicConcerns: uniqueConcerns.length ? uniqueConcerns : ['No high-severity strategic concerns are currently active.'],
    topAlerts,
    trendHighlights,
    recommendations: toRecommendationSet(report, trendHighlights),
    generatedAt: new Date().toISOString()
  };
}
