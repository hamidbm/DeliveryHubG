import {
  EntityReference,
  ForecastSignal,
  PortfolioQueryResponse,
  PortfolioSnapshot,
  PortfolioSnapshotHistory,
  PortfolioTrendSignal,
  StructuredPortfolioReport
} from '../../types/ai';
import { PortfolioSignalSummary } from './portfolioSignals';
import {
  extractApplicationStats,
  extractBundleStats,
  extractMilestoneTrend,
  extractMilestoneStats,
  extractOwnerStats,
  extractRiskTrend,
  extractReviewStats,
  extractTrendMetrics,
  extractWorkloadTrend,
  extractWorkItemStats
} from './knowledgeExtractors';
import { toEvidenceItems } from './evidenceEntities';

const normalizeQuestion = (question: string) => question.trim().toLowerCase();
const severityScore: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };

type Intent =
  | 'workitem-overdue'
  | 'workitem-blocked'
  | 'workitem-unassigned'
  | 'workitem-urgent'
  | 'workitem-threaten-milestone'
  | 'bundle-unassigned'
  | 'bundle-blocked'
  | 'bundle-risk'
  | 'bundle-behind'
  | 'application-critical'
  | 'application-risk'
  | 'application-overdue-work'
  | 'milestone-risk'
  | 'milestone-overdue'
  | 'milestone-blocked-work'
  | 'milestone-no-active-work'
  | 'review-overdue'
  | 'review-open-by-app'
  | 'owner-workload'
  | 'owner-blocked'
  | 'owner-overdue'
  | 'trend-delivery-improving'
  | 'trend-risk-increasing'
  | 'trend-blocked-increasing'
  | 'trend-backlog-growing'
  | 'trend-milestone-health'
  | 'alerts-active'
  | 'emerging-risks'
  | 'predictive-risk'
  | 'health-score'
  | 'risk-ranking'
  | 'forecast-risks-soon'
  | 'forecast-milestone-slip'
  | 'forecast-execution-slowdown'
  | 'forecast-backlog-growth'
  | 'general';

const KEYWORDS: Record<Intent, string[]> = {
  'workitem-overdue': ['work item', 'workitem', 'overdue', 'late'],
  'workitem-blocked': ['work item', 'workitem', 'blocked', 'blocking'],
  'workitem-unassigned': ['work item', 'workitem', 'unassigned', 'ownerless'],
  'workitem-urgent': ['urgent', 'priority', 'most urgent', 'fix first'],
  'workitem-threaten-milestone': ['work item', 'threaten', 'milestone', 'impact milestone'],
  'bundle-unassigned': ['bundle', 'unassigned', 'ownership'],
  'bundle-blocked': ['bundle', 'blocked'],
  'bundle-risk': ['bundle', 'risk'],
  'bundle-behind': ['bundle', 'behind', 'schedule', 'late'],
  'application-critical': ['application', 'critical', 'unhealthy'],
  'application-risk': ['application', 'risk', 'delivery risk'],
  'application-overdue-work': ['application', 'overdue work', 'late work'],
  'milestone-risk': ['milestone', 'risk'],
  'milestone-overdue': ['milestone', 'overdue', 'late'],
  'milestone-blocked-work': ['milestone', 'blocked work', 'blocked'],
  'milestone-no-active-work': ['milestone', 'no active', 'inactive'],
  'review-overdue': ['review', 'overdue'],
  'review-open-by-app': ['review', 'open', 'application'],
  'owner-workload': ['owner', 'most work', 'workload', 'capacity'],
  'owner-blocked': ['owner', 'blocked'],
  'owner-overdue': ['owner', 'overdue'],
  'trend-delivery-improving': ['delivery improving', 'delivery trend', 'execution improving', 'improving over time'],
  'trend-risk-increasing': ['risk increasing', 'risk worsening', 'risk trend'],
  'trend-blocked-increasing': ['blocked tasks increasing', 'blocked trend', 'blocked tasks trend'],
  'trend-backlog-growing': ['backlog growing', 'unassigned increasing', 'ownerless increasing', 'workload growing'],
  'trend-milestone-health': ['milestones getting healthier', 'milestone trend', 'milestone health trend'],
  'alerts-active': ['alerts', 'active alerts', 'what alerts', 'warning alerts'],
  'emerging-risks': ['emerging risk', 'emerging portfolio risks', 'emerging delivery risks'],
  'predictive-risk': ['next 7 days', 'predictive risk', 'future risk', 'likely slip'],
  'health-score': ['health score', 'portfolio health score', 'execution health'],
  'risk-ranking': ['biggest risk', 'most risk', 'areas have risk', 'fix first', 'delivery risk'],
  'forecast-risks-soon': ['impact delivery soon', 'near-term risk', 'soon risk', 'delivery soon'],
  'forecast-milestone-slip': ['milestones likely to slip', 'milestone may slip', 'likely to slip'],
  'forecast-execution-slowdown': ['execution slowing down', 'throughput slowdown', 'delivery slowdown'],
  'forecast-backlog-growth': ['areas show growing backlog', 'growing backlog', 'backlog growth'],
  general: []
};

const detectIntent = (q: string): Intent => {
  if ((q.includes('delivery') || q.includes('execution')) && (q.includes('improving') || q.includes('getting better') || q.includes('improvement'))) {
    return 'trend-delivery-improving';
  }
  if (q.includes('risk') && (q.includes('increasing') || q.includes('worsening') || q.includes('getting worse'))) {
    return 'trend-risk-increasing';
  }
  if (q.includes('blocked') && (q.includes('increasing') || q.includes('upward') || q.includes('trending up'))) {
    return 'trend-blocked-increasing';
  }
  if ((q.includes('backlog') || q.includes('unassigned') || q.includes('ownerless')) && (q.includes('growing') || q.includes('increasing') || q.includes('rising'))) {
    return 'trend-backlog-growing';
  }
  if (q.includes('milestone') && (q.includes('healthier') || q.includes('improving') || q.includes('trend'))) {
    return 'trend-milestone-health';
  }
  if (q.includes('alert')) {
    return 'alerts-active';
  }
  if (q.includes('emerging') && q.includes('risk')) {
    return 'emerging-risks';
  }
  if (q.includes('next 7 days') || q.includes('predictive') || q.includes('future risk') || q.includes('likely slip')) {
    return 'predictive-risk';
  }
  if (q.includes('health score') || (q.includes('portfolio health') && q.includes('score'))) {
    return 'health-score';
  }
  if ((q.includes('risk') || q.includes('risks')) && (q.includes('impact delivery soon') || q.includes('delivery soon') || q.includes('near-term'))) {
    return 'forecast-risks-soon';
  }
  if (q.includes('milestone') && (q.includes('likely') || q.includes('may')) && q.includes('slip')) {
    return 'forecast-milestone-slip';
  }
  if (q.includes('execution') && q.includes('slowing down')) {
    return 'forecast-execution-slowdown';
  }
  if (q.includes('growing backlog')) {
    return 'forecast-backlog-growth';
  }

  const scores: Array<{ intent: Intent; score: number }> = [];
  (Object.keys(KEYWORDS) as Intent[]).forEach((intent) => {
    if (intent === 'general') return;
    const words = KEYWORDS[intent];
    let score = 0;
    words.forEach((word) => {
      if (q.includes(word)) score += 1;
    });
    if (score > 0) scores.push({ intent, score });
  });
  if (!scores.length) return 'general';
  scores.sort((a, b) => b.score - a.score);
  return scores[0].intent;
};

export const detectPortfolioQueryIntent = (question: string): string => detectIntent(normalizeQuestion(question));

const topRisk = (report?: StructuredPortfolioReport) => {
  const risks = (report?.topRisks || []).slice().sort((a, b) => (severityScore[b.severity] || 0) - (severityScore[a.severity] || 0));
  return risks[0];
};

const firstN = <T,>(rows: T[], n = 5) => rows.slice(0, n);

const asEvidence = (texts: Array<string | { text: string; entities: EntityReference[] }>) => toEvidenceItems(texts, 'deterministic', 8);

const withEntities = (response: Omit<PortfolioQueryResponse, 'entities'>): PortfolioQueryResponse => {
  const entities: EntityReference[] = [];
  const seen = new Set<string>();
  (response.evidence || []).forEach((item) => {
    (item.entities || []).forEach((entity) => {
      const key = `${entity.type}:${entity.id}`;
      if (seen.has(key)) return;
      seen.add(key);
      entities.push(entity);
    });
  });
  return { ...response, entities: entities.slice(0, 15) };
};

const defaultEvidence = (signals: PortfolioSignalSummary) => asEvidence([
  `Total work items: ${signals.totalWorkItems}`,
  `Unassigned work: ${signals.unassignedWorkItems} (${(signals.unassignedRatio * 100).toFixed(1)}%)`,
  `Blocked work: ${signals.blockedWorkItems} (${(signals.blockedRatio * 100).toFixed(1)}%)`,
  `Overdue work: ${signals.overdueWorkItems} (${(signals.overdueRatio * 100).toFixed(1)}%)`,
  `Open reviews: ${signals.reviewsOpen}`,
  `Overdue milestones: ${signals.milestonesOverdue}`
]);

const findTrendSignal = (
  trendSignals: PortfolioTrendSignal[] = [],
  metric: PortfolioTrendSignal['metric']
) => trendSignals.find((item) => item.metric === metric);

const trendEvidenceLine = (signal?: PortfolioTrendSignal) => {
  if (!signal) return null;
  const absDelta = Math.abs(signal.delta);
  const deltaLabel = signal.delta > 0 ? `+${signal.delta}` : `${signal.delta}`;
  return `${signal.metric}: ${signal.direction} (${deltaLabel}) over ${signal.timeframeDays} days${absDelta > 0 ? '' : ' (no material change)'}.`;
};

const answerWorkItemList = (
  snapshot: PortfolioSnapshot,
  signals: PortfolioSignalSummary,
  mode: 'overdue' | 'blocked' | 'unassigned' | 'urgent' | 'threatenMilestones'
): PortfolioQueryResponse => {
  const items = extractWorkItemStats(snapshot);
  let filtered = items.slice();
  if (mode === 'overdue') filtered = filtered.filter((item) => item.overdue);
  if (mode === 'blocked') filtered = filtered.filter((item) => item.blocked);
  if (mode === 'unassigned') filtered = filtered.filter((item) => item.unassigned);
  if (mode === 'urgent') {
    filtered = filtered.sort((a, b) => {
      const pa = String(a.priority || '').toLowerCase().includes('high') ? 1 : 0;
      const pb = String(b.priority || '').toLowerCase().includes('high') ? 1 : 0;
      if (pb !== pa) return pb - pa;
      return Number(a.overdue) - Number(b.overdue);
    }).reverse();
  }
  if (mode === 'threatenMilestones') {
    filtered = filtered.filter((item) => (item.blocked || item.overdue) && item.milestoneIds.length > 0);
  }
  const top = firstN(filtered, 5);
  const label = mode === 'overdue'
    ? 'overdue'
    : mode === 'blocked'
      ? 'blocked'
      : mode === 'unassigned'
        ? 'unassigned'
        : mode === 'urgent'
          ? 'urgent'
          : 'milestone-threatening';

  return withEntities({
    answer: `${filtered.length} work items are ${label.replace('-', ' ')}.`,
    explanation: 'Result is derived deterministically from snapshot work item attributes (status, blocked, assignment, due date, milestone linkage).',
    evidence: asEvidence(top.map((item) => ({
      text: `${item.title}${item.dueDate ? ` – due ${new Date(item.dueDate).toLocaleDateString()}` : ''}${item.blocked ? ' – blocked' : ''}${item.unassigned ? ' – unassigned' : ''}`,
      entities: [{ type: 'workitem', id: item.id, label: item.key || item.title }]
    }))),
    followUps: [
      'Which bundles contain most of these work items?',
      'Which milestones are exposed by these items?',
      'Who should own the highest-priority unassigned items?'
    ]
  });
};

const answerBundleRanking = (
  snapshot: PortfolioSnapshot,
  mode: 'unassigned' | 'blocked' | 'risk' | 'behind'
): PortfolioQueryResponse => {
  const rows = extractBundleStats(snapshot);
  const ranked = rows
    .slice()
    .sort((a, b) => {
      const av = mode === 'unassigned'
        ? a.unassignedCount
        : mode === 'blocked'
          ? a.blockedCount
          : mode === 'behind'
            ? a.overdueCount
            : (a.unassignedCount + a.blockedCount + a.overdueCount + a.criticalApps * 2);
      const bv = mode === 'unassigned'
        ? b.unassignedCount
        : mode === 'blocked'
          ? b.blockedCount
          : mode === 'behind'
            ? b.overdueCount
            : (b.unassignedCount + b.blockedCount + b.overdueCount + b.criticalApps * 2);
      return bv - av;
    })
    .filter((row) => row.totalWorkItems > 0);
  const top = firstN(ranked, 5);
  const metricLabel = mode === 'unassigned' ? 'unassigned workload' : mode === 'blocked' ? 'blocked work' : mode === 'behind' ? 'schedule pressure' : 'delivery risk';
  return withEntities({
    answer: top.length
      ? `Top bundles by ${metricLabel}: ${top.map((row, idx) => `${idx + 1}. ${row.bundleName}`).join(', ')}.`
      : 'No bundle-level workload data is currently available in the snapshot.',
    explanation: 'Bundles are ranked deterministically using aggregated work-item and application health signals.',
    evidence: asEvidence(top.map((row) => ({
      text: `${row.bundleName}: ${row.unassignedCount} unassigned, ${row.blockedCount} blocked, ${row.overdueCount} overdue`,
      entities: [{ type: 'bundle', id: row.bundleId, label: row.bundleName }]
    }))),
    followUps: [
      'Which work items are driving risk in the top bundle?',
      'Which milestones depend on those bundles?',
      'What can be fixed in the next 7 days to reduce bundle risk?'
    ]
  });
};

const answerApplicationQuery = (
  snapshot: PortfolioSnapshot,
  mode: 'critical' | 'risk' | 'overdueWork'
): PortfolioQueryResponse => {
  const rows = extractApplicationStats(snapshot);
  const filtered = rows
    .slice()
    .filter((row) => {
      if (mode === 'critical') return String(row.health).toLowerCase() === 'critical';
      if (mode === 'overdueWork') return row.overdueWorkItems > 0;
      return String(row.health).toLowerCase() !== 'healthy' || row.overdueWorkItems > 0 || row.blockedWorkItems > 0 || row.overdueReviews > 0;
    })
    .sort((a, b) => {
      const av = a.overdueWorkItems + a.blockedWorkItems + a.overdueReviews;
      const bv = b.overdueWorkItems + b.blockedWorkItems + b.overdueReviews;
      return bv - av;
    });
  const top = firstN(filtered, 5);
  return withEntities({
    answer: `${filtered.length} applications match this condition.`,
    explanation: 'Application ranking combines health state with delivery/review pressure where available.',
    evidence: asEvidence(top.map((row) => ({
      text: `${row.name}: health ${row.health}, ${row.overdueWorkItems} overdue work, ${row.blockedWorkItems} blocked work`,
      entities: [{ type: 'application', id: row.applicationId, label: row.name }]
    }))),
    followUps: [
      'Which bundles contain these applications?',
      'Which reviews are overdue for these applications?',
      'Which milestones are most exposed?'
    ]
  });
};

const answerMilestoneQuery = (
  snapshot: PortfolioSnapshot,
  mode: 'risk' | 'overdue' | 'blockedWork' | 'noActive'
): PortfolioQueryResponse => {
  const rows = extractMilestoneStats(snapshot);
  const filtered = rows
    .slice()
    .filter((row) => {
      if (mode === 'overdue') return row.overdue;
      if (mode === 'blockedWork') return row.blockedWorkItemCount > 0;
      if (mode === 'noActive') return row.relatedWorkItemCount > 0 && row.activeWorkItemCount === 0;
      return row.overdue || row.blockedWorkItemCount > 0 || row.overdueWorkItemCount > 0;
    })
    .sort((a, b) => {
      const av = Number(a.overdue) * 10 + a.blockedWorkItemCount + a.overdueWorkItemCount;
      const bv = Number(b.overdue) * 10 + b.blockedWorkItemCount + b.overdueWorkItemCount;
      return bv - av;
    });
  const top = firstN(filtered, 5);
  return withEntities({
    answer: `${filtered.length} milestones match this risk profile.`,
    explanation: 'Milestone exposure is derived from target date status and linked blocked/overdue work-item pressure.',
    evidence: asEvidence(top.map((row) => ({
      text: `${row.name}: ${row.overdue ? 'overdue' : 'active'}, ${row.blockedWorkItemCount} blocked linked work items, ${row.overdueWorkItemCount} overdue linked work items`,
      entities: [{ type: 'milestone', id: row.milestoneId, label: row.name }]
    }))),
    followUps: [
      'Which work items are causing this milestone exposure?',
      'Which owners should be assigned to unblock these milestones?',
      'Which bundles are most affected by these milestones?'
    ]
  });
};

const answerReviewQuery = (snapshot: PortfolioSnapshot, mode: 'overdue' | 'openByApp'): PortfolioQueryResponse => {
  const rows = extractReviewStats(snapshot);
  const filtered = rows.filter((row) => mode === 'overdue' ? row.overdue : String(row.status).toLowerCase() !== 'closed');
  const top = firstN(filtered, 5);
  return withEntities({
    answer: `${filtered.length} review cycles match this query.`,
    explanation: 'Review status is computed deterministically from cycle status and due-date data in the snapshot.',
    evidence: asEvidence(top.map((row) => ({
      text: `${row.title || row.reviewId}: ${row.status}${row.overdue ? ' • Overdue' : ''}${row.dueDate ? ` • Due ${new Date(row.dueDate).toLocaleDateString()}` : ''}`,
      entities: [{ type: 'review', id: row.reviewId, label: row.title || `Review ${row.reviewId}` }]
    }))),
    followUps: [
      'Which applications have the most overdue reviews?',
      'Which reviews are blocking release readiness?',
      'Where should reviewer capacity be increased?'
    ]
  });
};

const answerOwnerQuery = (snapshot: PortfolioSnapshot, mode: 'workload' | 'blocked' | 'overdue'): PortfolioQueryResponse => {
  const rows = extractOwnerStats(snapshot);
  const sorted = rows
    .slice()
    .sort((a, b) => {
      const av = mode === 'blocked' ? a.blockedCount : mode === 'overdue' ? a.overdueCount : a.workItemCount;
      const bv = mode === 'blocked' ? b.blockedCount : mode === 'overdue' ? b.overdueCount : b.workItemCount;
      return bv - av;
    })
    .filter((row) => row.owner);
  const top = firstN(sorted, 5);
  return withEntities({
    answer: top.length
      ? `Owner ranking by ${mode}: ${top.map((row) => `${row.owner} (${mode === 'blocked' ? row.blockedCount : mode === 'overdue' ? row.overdueCount : row.workItemCount})`).join(', ')}.`
      : 'Owner-level workload signals are unavailable in the current snapshot.',
    explanation: 'Owner load is computed from deterministic assignee/work-item aggregates.',
    evidence: asEvidence(top.map((row) => `Owner ${row.owner}: ${row.workItemCount} items, ${row.blockedCount} blocked, ${row.overdueCount} overdue`)),
    followUps: [
      'Which specific work items are driving top owner overload?',
      'Which unassigned items should be distributed first?',
      'Which milestones are impacted by overloaded owners?'
    ]
  });
};

const answerRiskRanking = (
  signals: PortfolioSignalSummary,
  report?: StructuredPortfolioReport
): PortfolioQueryResponse => {
  const risk = topRisk(report);
  const rankedSignals = [
    { label: 'Unassigned ratio', value: signals.unassignedRatio, text: `${(signals.unassignedRatio * 100).toFixed(1)}%` },
    { label: 'Blocked ratio', value: signals.blockedRatio, text: `${(signals.blockedRatio * 100).toFixed(1)}%` },
    { label: 'Overdue ratio', value: signals.overdueRatio, text: `${(signals.overdueRatio * 100).toFixed(1)}%` }
  ].sort((a, b) => b.value - a.value);
  const top = rankedSignals[0];
  return withEntities({
    answer: risk
      ? `The biggest delivery risk is "${risk.title}" (${risk.severity}).`
      : `The biggest delivery risk signal is ${top.label} at ${top.text}.`,
    explanation: 'Risk ranking blends deterministic ratio signals with structured report severity when available.',
    evidence: asEvidence([
      `${top.label}: ${top.text}`,
      `Unassigned work items: ${signals.unassignedWorkItems}`,
      `Blocked work items: ${signals.blockedWorkItems}`,
      `Overdue work items: ${signals.overdueWorkItems}`,
      ...(risk ? risk.evidence.slice(0, 2).map((e) => ({ text: e.text, entities: e.entities || [] })) : [])
    ]),
    followUps: [
      'Which bundles contribute most to this risk?',
      'Which milestones are currently exposed?',
      'What should be fixed first this week?'
    ]
  });
};

const answerTrendQuery = (
  mode: 'delivery-improving' | 'risk-increasing' | 'blocked-increasing' | 'backlog-growing' | 'milestone-health',
  trendSignals: PortfolioTrendSignal[] = [],
  snapshotHistory: PortfolioSnapshotHistory[] = []
): PortfolioQueryResponse => {
  const trendMetrics = extractTrendMetrics(snapshotHistory, trendSignals);
  const effectiveTrendSignals: PortfolioTrendSignal[] = trendSignals.length > 0
    ? trendSignals
    : trendMetrics.map((item) => ({
      metric: item.metric,
      direction: item.direction,
      delta: item.delta,
      timeframeDays: item.timeframeDays
    }));
  if (trendMetrics.length === 0) {
    return withEntities({
      answer: 'Trend analysis is not available yet.',
      explanation: 'At least two historical portfolio snapshots are required. Generate additional reports to establish time-based trend intelligence.',
      evidence: asEvidence(['Snapshot history currently has fewer than two entries.']),
      followUps: [
        'Generate another AI Insights report and ask again.',
        'Which areas currently show the highest immediate risk?',
        'Which bundles have the most blocked work right now?'
      ]
    });
  }

  const risk = extractRiskTrend(snapshotHistory, trendSignals);
  const workload = extractWorkloadTrend(snapshotHistory, trendSignals);
  const milestone = extractMilestoneTrend(snapshotHistory, trendSignals);
  const blockedTrend = findTrendSignal(effectiveTrendSignals, 'blockedWorkItems');
  const unassignedTrend = findTrendSignal(effectiveTrendSignals, 'unassignedWorkItems');

  if (mode === 'delivery-improving') {
    const improving = risk.verdict === 'improving' || workload.verdict === 'improving';
    return withEntities({
      answer: improving
        ? 'Delivery is improving based on recent trend signals.'
        : risk.verdict === 'worsening' || workload.verdict === 'worsening'
          ? 'Delivery is not improving; trend signals indicate increasing execution pressure.'
          : 'Delivery trend appears stable based on recent snapshots.',
      explanation: 'Delivery trend is computed deterministically from historical changes in unassigned, blocked, overdue, and active work metrics.',
      evidence: asEvidence([
        risk.summary,
        workload.summary,
        trendEvidenceLine(blockedTrend),
        trendEvidenceLine(unassignedTrend)
      ].filter(Boolean) as string[]),
      followUps: [
        'Which bundles are driving the negative trend?',
        'Which owners can absorb unassigned work next?',
        'Which milestones are now newly exposed?'
      ]
    });
  }

  if (mode === 'risk-increasing') {
    const increasing = risk.verdict === 'worsening';
    return withEntities({
      answer: increasing
        ? 'Yes, portfolio risk is increasing across recent snapshots.'
        : risk.verdict === 'improving'
          ? 'No, portfolio risk is improving based on recent snapshots.'
          : 'Portfolio risk trend is currently stable.',
      explanation: 'Risk trend uses historical movement in unassigned, blocked, overdue work, critical applications, and overdue milestones.',
      evidence: asEvidence([
        risk.summary,
        trendEvidenceLine(findTrendSignal(effectiveTrendSignals, 'overdueWorkItems')),
        trendEvidenceLine(findTrendSignal(effectiveTrendSignals, 'criticalApplications')),
        trendEvidenceLine(findTrendSignal(effectiveTrendSignals, 'overdueMilestones'))
      ].filter(Boolean) as string[]),
      followUps: [
        'Which bundles contributed most to increased risk?',
        'Which milestones are now red or overdue?',
        'What should be fixed in the next 7 days?'
      ]
    });
  }

  if (mode === 'blocked-increasing') {
    const blockedIncreasing = blockedTrend?.direction === 'rising';
    return withEntities({
      answer: blockedIncreasing
        ? `Yes, blocked tasks are increasing (${blockedTrend?.delta && blockedTrend.delta > 0 ? `+${blockedTrend.delta}` : blockedTrend?.delta || 0} over ${blockedTrend?.timeframeDays || 7} days).`
        : blockedTrend?.direction === 'falling'
          ? 'No, blocked tasks are decreasing across recent snapshots.'
          : 'Blocked tasks are stable across recent snapshots.',
      explanation: 'The answer is derived from historical blocked-work snapshot deltas.',
      evidence: asEvidence([
        trendEvidenceLine(blockedTrend) || 'Blocked work trend is unavailable.',
        `Historical snapshots analyzed: ${snapshotHistory.length}`
      ]),
      followUps: [
        'Which bundles contain the newly blocked tasks?',
        'Which blocked tasks threaten milestones?',
        'Which owners are carrying most blocked work?'
      ]
    });
  }

  if (mode === 'backlog-growing') {
    const backlogGrowing = unassignedTrend?.direction === 'rising';
    return withEntities({
      answer: backlogGrowing
        ? `Yes, backlog/ownerless workload is growing (${unassignedTrend?.delta && unassignedTrend.delta > 0 ? `+${unassignedTrend.delta}` : unassignedTrend?.delta || 0} over ${unassignedTrend?.timeframeDays || 7} days).`
        : unassignedTrend?.direction === 'falling'
          ? 'No, ownerless backlog is shrinking over time.'
          : 'Backlog trend is stable in recent snapshots.',
      explanation: 'Backlog growth is proxied by unassigned work-item trend over historical snapshots.',
      evidence: asEvidence([
        trendEvidenceLine(unassignedTrend) || 'Unassigned-work trend is unavailable.',
        workload.summary
      ]),
      followUps: [
        'Which bundles drove the backlog increase?',
        'Which unassigned items are highest priority?',
        'Which teams can absorb this workload next?'
      ]
    });
  }

  return withEntities({
    answer: milestone.verdict === 'improving'
      ? 'Milestones are getting healthier over recent snapshots.'
      : milestone.verdict === 'worsening'
        ? 'Milestone health is deteriorating; overdue milestone exposure is increasing.'
        : milestone.verdict === 'stable'
          ? 'Milestone health trend is stable.'
          : 'Milestone trend is not yet available.',
    explanation: 'Milestone health trend is derived from historical overdue-milestone movement.',
    evidence: asEvidence([
      milestone.summary,
      trendEvidenceLine(findTrendSignal(effectiveTrendSignals, 'overdueMilestones'))
    ].filter(Boolean) as string[]),
    followUps: [
      'Which milestones are newly overdue?',
      'Which blocked work items threaten those milestones?',
      'Which bundles are most exposed to milestone slippage?'
    ]
  });
};

const answerHealthScoreQuery = (report?: StructuredPortfolioReport): PortfolioQueryResponse => {
  const score = report?.healthScore;
  if (!score) {
    return withEntities({
      answer: 'Health score is not available in the current report.',
      explanation: 'Generate or refresh the portfolio summary to compute deterministic health scoring.',
      evidence: asEvidence(['No health score found on the current structured report.']),
      followUps: [
        'Regenerate AI Insights report now.',
        'What alerts are active now?',
        'Show me emerging portfolio risks.'
      ]
    });
  }
  return withEntities({
    answer: `Portfolio health score is ${score.overall}/100.`,
    explanation: 'Health score is deterministic and weighted across unassigned, blocked, overdue, active throughput, critical applications, and overdue milestones.',
    evidence: asEvidence([
      `Unassigned component: ${score.components.unassigned}/100`,
      `Blocked component: ${score.components.blocked}/100`,
      `Overdue component: ${score.components.overdue}/100`,
      `Active component: ${score.components.active}/100`,
      `Critical apps component: ${score.components.criticalApps}/100`,
      `Milestone overdue component: ${score.components.milestoneOverdue}/100`
    ]),
    followUps: [
      'Which component is dragging health score down the most?',
      'What alerts are active now?',
      'Is delivery trend improving?'
    ]
  });
};

const answerAlertQuery = (
  report: StructuredPortfolioReport | undefined,
  mode: 'active' | 'emerging' | 'predictive'
): PortfolioQueryResponse => {
  const allAlerts = (report?.alerts || []).slice();
  const alerts = mode === 'predictive'
    ? allAlerts.filter((item) => item.resultOf === 'predictive')
    : mode === 'emerging'
      ? allAlerts.filter((item) => item.resultOf === 'trend' || item.resultOf === 'predictive')
      : allAlerts;

  if (alerts.length === 0) {
    return withEntities({
      answer: 'No active alerts are currently triggered.',
      explanation: 'Alert rules did not detect threshold, trend, or predictive deterioration in the current report context.',
      evidence: asEvidence(['Alert detector returned zero active alerts.']),
      alerts: [],
      followUps: [
        'Is delivery improving over time?',
        'Which bundles have the highest delivery risk?',
        'What is the current portfolio health score?'
      ]
    });
  }

  const top = alerts.slice(0, 5);
  return withEntities({
    answer: `${alerts.length} alert${alerts.length === 1 ? '' : 's'} active. Top alert: ${top[0].title} (${top[0].severity}).`,
    explanation: mode === 'predictive'
      ? 'Predictive alerts combine current stress signals with trend deterioration to flag near-term execution threats.'
      : mode === 'emerging'
        ? 'Emerging risk alerts combine worsening trends and predictive rules.'
        : 'Alerts include trend, threshold, and predictive categories generated deterministically.',
    evidence: asEvidence(top.flatMap((alert) => (
      alert.evidence?.length
        ? alert.evidence.slice(0, 1).map((item) => ({ text: `${alert.title}: ${item.text}`, entities: alert.entities || item.entities || [] }))
        : [{ text: `${alert.title}: ${alert.summary}`, entities: alert.entities || [] }]
    ))),
    alerts: top,
    followUps: [
      'Save the top alert as an investigation.',
      'Which entities are driving these alerts?',
      'What actions should be prioritized this week?'
    ]
  });
};

const answerForecastQuery = (
  forecastSignals: ForecastSignal[] = [],
  mode: 'soon' | 'milestone-slip' | 'execution-slowdown' | 'backlog-growth'
): PortfolioQueryResponse => {
  if (!forecastSignals.length) {
    return withEntities({
      answer: 'Forecast signals are not available yet.',
      explanation: 'Generate portfolio forecast signals first to answer this question deterministically.',
      evidence: asEvidence(['No forecast signals were found in cache.']),
      followUps: [
        'Generate portfolio forecast now.',
        'What alerts are active now?',
        'Is delivery trend improving over time?'
      ]
    });
  }

  const filtered = forecastSignals.filter((signal) => {
    if (mode === 'milestone-slip') return signal.category === 'milestone_risk';
    if (mode === 'execution-slowdown') return signal.category === 'execution_slowdown';
    if (mode === 'backlog-growth') return signal.category === 'backlog_growth';
    return true;
  });

  const rows = (filtered.length > 0 ? filtered : forecastSignals).slice(0, 5);
  const label = mode === 'milestone-slip'
    ? 'milestone slip'
    : mode === 'execution-slowdown'
      ? 'execution slowdown'
      : mode === 'backlog-growth'
        ? 'backlog growth'
        : 'near-term delivery';

  return withEntities({
    answer: `${rows.length} forecast signal${rows.length === 1 ? '' : 's'} identified for ${label} risk.`,
    explanation: 'Answer is generated from deterministic forecast heuristics over snapshot, trend, and structured report signals.',
    evidence: asEvidence(rows.flatMap((signal) => [
      { text: `${signal.title} (${signal.severity}, ${(signal.confidence * 100).toFixed(0)}% confidence): ${signal.summary}`, entities: signal.relatedEntities || [] },
      ...(signal.evidence || []).slice(0, 1).map((item) => ({ text: item.text, entities: item.entities || signal.relatedEntities || [] }))
    ])),
    followUps: [
      'Which entities are most exposed to these forecast signals?',
      'What should be prioritized in the next 7 days?',
      'How do these forecasts compare with active alerts?'
    ]
  });
};

export const answerPortfolioQuestionDeterministically = (
  question: string,
  signals: PortfolioSignalSummary,
  report: StructuredPortfolioReport | undefined,
  snapshot: PortfolioSnapshot | undefined,
  trendSignals: PortfolioTrendSignal[] = [],
  snapshotHistory: PortfolioSnapshotHistory[] = [],
  forecastSignals: ForecastSignal[] = []
): PortfolioQueryResponse => {
  const q = normalizeQuestion(question);
  const intent = detectIntent(q);
  const safeSnapshot: PortfolioSnapshot = snapshot || {
    generatedAt: new Date().toISOString(),
    applications: { total: 0, byHealth: { healthy: 0, warning: 0, critical: 0, unknown: 0 } },
    bundles: { total: 0 },
    workItems: { total: 0, overdue: 0, blocked: 0, unassigned: 0, byStatus: {} },
    reviews: { open: 0, overdue: 0 },
    milestones: { total: 0, overdue: 0 }
  };

  switch (intent) {
    case 'workitem-overdue': return answerWorkItemList(safeSnapshot, signals, 'overdue');
    case 'workitem-blocked': return answerWorkItemList(safeSnapshot, signals, 'blocked');
    case 'workitem-unassigned': return answerWorkItemList(safeSnapshot, signals, 'unassigned');
    case 'workitem-urgent': return answerWorkItemList(safeSnapshot, signals, 'urgent');
    case 'workitem-threaten-milestone': return answerWorkItemList(safeSnapshot, signals, 'threatenMilestones');
    case 'bundle-unassigned': return answerBundleRanking(safeSnapshot, 'unassigned');
    case 'bundle-blocked': return answerBundleRanking(safeSnapshot, 'blocked');
    case 'bundle-risk': return answerBundleRanking(safeSnapshot, 'risk');
    case 'bundle-behind': return answerBundleRanking(safeSnapshot, 'behind');
    case 'application-critical': return answerApplicationQuery(safeSnapshot, 'critical');
    case 'application-risk': return answerApplicationQuery(safeSnapshot, 'risk');
    case 'application-overdue-work': return answerApplicationQuery(safeSnapshot, 'overdueWork');
    case 'milestone-risk': return answerMilestoneQuery(safeSnapshot, 'risk');
    case 'milestone-overdue': return answerMilestoneQuery(safeSnapshot, 'overdue');
    case 'milestone-blocked-work': return answerMilestoneQuery(safeSnapshot, 'blockedWork');
    case 'milestone-no-active-work': return answerMilestoneQuery(safeSnapshot, 'noActive');
    case 'review-overdue': return answerReviewQuery(safeSnapshot, 'overdue');
    case 'review-open-by-app': return answerReviewQuery(safeSnapshot, 'openByApp');
    case 'owner-workload': return answerOwnerQuery(safeSnapshot, 'workload');
    case 'owner-blocked': return answerOwnerQuery(safeSnapshot, 'blocked');
    case 'owner-overdue': return answerOwnerQuery(safeSnapshot, 'overdue');
    case 'trend-delivery-improving': return answerTrendQuery('delivery-improving', trendSignals, snapshotHistory);
    case 'trend-risk-increasing': return answerTrendQuery('risk-increasing', trendSignals, snapshotHistory);
    case 'trend-blocked-increasing': return answerTrendQuery('blocked-increasing', trendSignals, snapshotHistory);
    case 'trend-backlog-growing': return answerTrendQuery('backlog-growing', trendSignals, snapshotHistory);
    case 'trend-milestone-health': return answerTrendQuery('milestone-health', trendSignals, snapshotHistory);
    case 'alerts-active': return answerAlertQuery(report, 'active');
    case 'emerging-risks': return answerAlertQuery(report, 'emerging');
    case 'predictive-risk': return answerAlertQuery(report, 'predictive');
    case 'health-score': return answerHealthScoreQuery(report);
    case 'risk-ranking': return answerRiskRanking(signals, report);
    case 'forecast-risks-soon': return answerForecastQuery(forecastSignals, 'soon');
    case 'forecast-milestone-slip': return answerForecastQuery(forecastSignals, 'milestone-slip');
    case 'forecast-execution-slowdown': return answerForecastQuery(forecastSignals, 'execution-slowdown');
    case 'forecast-backlog-growth': return answerForecastQuery(forecastSignals, 'backlog-growth');
    default: {
      const risk = topRisk(report);
      const fallback = withEntities({
        answer: risk
          ? `Primary portfolio concern is "${risk.title}" (${risk.severity}).`
          : `Portfolio health is ${report?.overallHealth || 'unknown'} with execution pressure from unassigned and blocked work.`,
        explanation: 'Answer is derived deterministically from snapshot metrics and structured report rollups.',
        evidence: risk
          ? asEvidence([
              `Top risk: ${risk.title} (${risk.severity})`,
              ...risk.evidence.slice(0, 2).map((entry) => ({ text: entry.text, entities: entry.entities || [] }))
            ])
          : defaultEvidence(signals).slice(0, 4),
        followUps: [
          'Which bundles have the most unassigned work?',
          'Which milestones are at risk right now?',
          'Who owns the most blocked work items?'
        ]
      });
      return fallback;
    }
  }
};
