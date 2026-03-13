import { PortfolioQueryResponse, StructuredPortfolioReport } from '../../types/ai';
import { PortfolioSignalSummary } from './portfolioSignals';
import { toEvidenceItems } from './evidenceEntities';

const normalizeQuestion = (question: string) => question.trim().toLowerCase();

const severityScore: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };

const topRisk = (report?: StructuredPortfolioReport) => {
  const risks = (report?.topRisks || []).slice().sort((a, b) => (severityScore[b.severity] || 0) - (severityScore[a.severity] || 0));
  return risks[0];
};

const buildDefaultEvidence = (signals: PortfolioSignalSummary) => toEvidenceItems([
  `Total work items: ${signals.totalWorkItems}`,
  `Unassigned work: ${signals.unassignedWorkItems} (${(signals.unassignedRatio * 100).toFixed(1)}%)`,
  `Blocked work: ${signals.blockedWorkItems} (${(signals.blockedRatio * 100).toFixed(1)}%)`,
  `Overdue work: ${signals.overdueWorkItems} (${(signals.overdueRatio * 100).toFixed(1)}%)`,
  `Open reviews: ${signals.reviewsOpen}`,
  `Overdue milestones: ${signals.milestonesOverdue}`
], 'deterministic', 6);

export const answerPortfolioQuestionDeterministically = (
  question: string,
  signals: PortfolioSignalSummary,
  report?: StructuredPortfolioReport
): PortfolioQueryResponse => {
  const q = normalizeQuestion(question);
  const defaultEvidence = buildDefaultEvidence(signals);

  if (q.includes('unassigned')) {
    return {
      answer: `${signals.unassignedWorkItems} of ${signals.totalWorkItems} work items are currently unassigned.`,
      explanation: `Unassigned ratio is ${(signals.unassignedRatio * 100).toFixed(1)}%. This is a strong delivery ownership risk signal.`,
      evidence: toEvidenceItems([
        `${signals.unassignedWorkItems} work items are unassigned.`,
        `Unassigned ratio is ${(signals.unassignedRatio * 100).toFixed(1)}%.`
      ], 'deterministic', 6),
      followUps: [
        'Which milestones are impacted by unassigned work?',
        'Which bundles should receive assignment triage first?'
      ]
    };
  }

  if (q.includes('milestone') && q.includes('risk')) {
    const risk = topRisk(report);
    return {
      answer: risk
        ? `Highest risk milestone pressure is linked to "${risk.title}" (${risk.severity}).`
        : `Milestone risk is elevated with ${signals.milestonesOverdue} overdue milestones and ${signals.overdueWorkItems} overdue work items.`,
      explanation: 'Milestone risk is inferred from overdue milestones, overdue/blocked work, and top structured risk severity.',
      evidence: toEvidenceItems([
        `Overdue milestones: ${signals.milestonesOverdue}`,
        `Overdue work items: ${signals.overdueWorkItems}`,
        ...(risk ? [`Top structured risk: ${risk.title} (${risk.severity})`] : [])
      ], 'deterministic', 6),
      followUps: [
        'Which blocked items are mapped to near-term milestones?',
        'What actions can reduce milestone slip in the next 7 days?'
      ]
    };
  }

  if (q.includes('overdue review') || (q.includes('review') && q.includes('overdue'))) {
    return {
      answer: `${signals.reviewsOverdue} reviews are overdue out of ${signals.reviewsOpen} open reviews.`,
      explanation: 'Review-cycle delays can become a delivery bottleneck when approvals are gating work progression.',
      evidence: toEvidenceItems([
        `Open reviews: ${signals.reviewsOpen}`,
        `Overdue reviews: ${signals.reviewsOverdue}`
      ], 'deterministic', 6),
      followUps: [
        'Which applications have the most overdue reviews?',
        'Where should reviewer capacity be increased first?'
      ]
    };
  }

  if (q.includes('blocking') || q.includes('blocked')) {
    return {
      answer: `${signals.blockedWorkItems} work items are currently blocked and may be reducing active throughput.`,
      explanation: `Blocked ratio is ${(signals.blockedRatio * 100).toFixed(1)}%, while active work ratio is ${(signals.activeWorkRatio * 100).toFixed(1)}%.`,
      evidence: toEvidenceItems([
        `Blocked work items: ${signals.blockedWorkItems}`,
        `Blocked ratio: ${(signals.blockedRatio * 100).toFixed(1)}%`,
        `Active work ratio: ${(signals.activeWorkRatio * 100).toFixed(1)}%`
      ], 'deterministic', 6),
      followUps: [
        'Which blocked items are oldest and highest priority?',
        'Which teams own the highest number of blocked items?'
      ]
    };
  }

  const risk = topRisk(report);
  return {
    answer: risk
      ? `Primary portfolio concern is "${risk.title}" (${risk.severity}).`
      : `Portfolio health is ${report?.overallHealth || 'unknown'} with notable execution pressure from unassigned and blocked work.`,
    explanation: 'Answer is derived deterministically from current snapshot metrics and structured report rollups.',
    evidence: risk
      ? toEvidenceItems([
          `Top risk: ${risk.title} (${risk.severity})`,
          ...(risk.evidence || []).slice(0, 2).map((entry) => entry.text)
        ], 'deterministic', 6)
      : defaultEvidence.slice(0, 4),
    followUps: [
      'What is the biggest driver of execution risk right now?',
      'Which actions should be prioritized in the next 7 days?'
    ]
  };
};
