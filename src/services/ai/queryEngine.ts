import { EntityReference, PortfolioQueryResponse, PortfolioSnapshot, StructuredPortfolioReport } from '../../types/ai';
import { PortfolioSignalSummary } from './portfolioSignals';
import {
  extractApplicationStats,
  extractBundleStats,
  extractMilestoneStats,
  extractOwnerStats,
  extractReviewStats,
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
  | 'risk-ranking'
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
  'risk-ranking': ['biggest risk', 'most risk', 'areas have risk', 'fix first', 'delivery risk'],
  general: []
};

const detectIntent = (q: string): Intent => {
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

export const answerPortfolioQuestionDeterministically = (
  question: string,
  signals: PortfolioSignalSummary,
  report?: StructuredPortfolioReport,
  snapshot?: PortfolioSnapshot
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
    case 'risk-ranking': return answerRiskRanking(signals, report);
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
