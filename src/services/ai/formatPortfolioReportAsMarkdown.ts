import {
  EvidenceItem,
  HealthScore,
  PortfolioAlert,
  PortfolioTrendSignal,
  StructuredPortfolioReport,
  StructuredActionItem,
  StructuredConcentrationSignal,
  StructuredQuestionItem,
  StructuredRiskItem
} from '../../types/ai';

const severityLabel = (value: StructuredRiskItem['severity']) => value.charAt(0).toUpperCase() + value.slice(1);

const urgencyLabel = (value: StructuredActionItem['urgency']) => {
  if (value === 'now') return 'Now';
  if (value === '7d') return 'Next 7 Days';
  if (value === '30d') return 'Next 30 Days';
  return 'Later';
};

const healthLabel = (value: StructuredPortfolioReport['overallHealth']) => value.charAt(0).toUpperCase() + value.slice(1);

const joinEvidence = (evidence?: EvidenceItem[]) => (evidence && evidence.length > 0
  ? evidence.map((entry) => `  - ${entry.text}`).join('\n')
  : '  - No explicit evidence provided.');

const formatRisks = (items: StructuredRiskItem[]) => {
  if (items.length === 0) return '_No major risks identified._';
  return items
    .map((item, index) => [
      `### ${index + 1}. ${item.title}`,
      `- Severity: ${severityLabel(item.severity)}`,
      `- Summary: ${item.summary}`,
      '- Evidence:',
      joinEvidence(item.evidence)
    ].join('\n'))
    .join('\n\n');
};

const formatActions = (items: StructuredActionItem[]) => {
  if (items.length === 0) return '_No recommended actions available._';
  return items
    .map((item, index) => {
      const lines = [
        `### ${index + 1}. ${item.title}`,
        `- Urgency: ${urgencyLabel(item.urgency)}`,
        `- Summary: ${item.summary}`
      ];
      if (item.ownerHint) lines.push(`- Owner Hint: ${item.ownerHint}`);
      if (item.evidence?.length) {
        lines.push('- Evidence:', joinEvidence(item.evidence));
      }
      return lines.join('\n');
    })
    .join('\n\n');
};

const formatSignals = (items: StructuredConcentrationSignal[]) => {
  if (items.length === 0) return '_No concentration signals identified._';
  return items
    .map((item, index) => {
      const lines = [
        `### ${index + 1}. ${item.title}`,
        `- Summary: ${item.summary}`
      ];
      if (item.impact) lines.push(`- Impact: ${item.impact}`);
      if (item.evidence?.length) lines.push('- Evidence:', joinEvidence(item.evidence));
      return lines.join('\n');
    })
    .join('\n\n');
};

const formatQuestions = (items: StructuredQuestionItem[]) => {
  if (items.length === 0) return '_No follow-up questions available._';
  return items
    .map((item, index) => {
      const rationale = item.rationale ? ` — ${item.rationale}` : '';
      return `${index + 1}. ${item.question}${rationale}`;
    })
    .join('\n');
};

const trendMetricLabel = (metric: PortfolioTrendSignal['metric']) => {
  const labels: Record<PortfolioTrendSignal['metric'], string> = {
    unassignedWorkItems: 'Unassigned Workload',
    blockedWorkItems: 'Blocked Tasks',
    overdueWorkItems: 'Overdue Work',
    activeWorkItems: 'Active Work',
    criticalApplications: 'Critical Applications',
    overdueMilestones: 'Overdue Milestones'
  };
  return labels[metric] || metric;
};

const formatTrendSignals = (items: PortfolioTrendSignal[] = []) => {
  if (items.length === 0) return '_No trend signals available yet. Generate additional reports over time to unlock trend analysis._';
  return items
    .map((item, index) => {
      const direction = item.direction === 'stable'
        ? 'Stable'
        : item.direction === 'rising'
          ? 'Rising'
          : 'Falling';
      const deltaText = item.delta > 0 ? `+${item.delta}` : `${item.delta}`;
      const summary = item.summary || `${trendMetricLabel(item.metric)} is ${item.direction}.`;
      return [
        `### ${index + 1}. ${trendMetricLabel(item.metric)}`,
        `- Direction: ${direction}`,
        `- Delta: ${deltaText}`,
        `- Timeframe: ${item.timeframeDays} days`,
        `- Summary: ${summary}`
      ].join('\n');
    })
    .join('\n\n');
};

const formatHealthScore = (score?: HealthScore) => {
  if (!score) return '_Health score is not available._';
  return [
    `- Overall: ${score.overall}/100`,
    `- Unassigned: ${score.components.unassigned}/100`,
    `- Blocked: ${score.components.blocked}/100`,
    `- Overdue: ${score.components.overdue}/100`,
    `- Active: ${score.components.active}/100`,
    `- Critical Apps: ${score.components.criticalApps}/100`,
    `- Milestone Overdue: ${score.components.milestoneOverdue}/100`
  ].join('\n');
};

const formatAlerts = (items: PortfolioAlert[] = []) => {
  if (items.length === 0) return '_No active alerts at this time._';
  return items
    .map((item, index) => [
      `### ${index + 1}. ${item.title}`,
      `- Severity: ${severityLabel(item.severity)}`,
      `- Type: ${item.resultOf}`,
      `- Summary: ${item.summary}`,
      `- Rationale: ${item.rationale}`,
      '- Evidence:',
      joinEvidence(item.evidence)
    ].join('\n'))
    .join('\n\n');
};

export const formatPortfolioReportAsMarkdown = (report: StructuredPortfolioReport) => {
  return [
    `## Overall Health: ${healthLabel(report.overallHealth)}`,
    '',
    '## Executive Summary',
    report.executiveSummary || 'Summary unavailable.',
    '',
    '## Top Risks',
    formatRisks(report.topRisks || []),
    '',
    '## Recommended Actions',
    formatActions(report.recommendedActions || []),
    '',
    '## Concentration Signals',
    formatSignals(report.concentrationSignals || []),
    '',
    '## Portfolio Health Score',
    formatHealthScore(report.healthScore),
    '',
    '## Portfolio Trends',
    formatTrendSignals(report.trendSignals || []),
    '',
    '## Alerts',
    formatAlerts(report.alerts || []),
    '',
    '## Questions To Ask',
    formatQuestions(report.questionsToAsk || [])
  ].join('\n');
};
