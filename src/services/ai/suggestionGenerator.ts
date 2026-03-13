import { PortfolioSuggestion, StructuredPortfolioReport } from '../../types/ai';
import { PortfolioSignalSummary } from './portfolioSignals';

const pushUnique = (target: PortfolioSuggestion[], item: PortfolioSuggestion) => {
  if (!target.some((existing) => existing.prompt.toLowerCase() === item.prompt.toLowerCase())) {
    target.push(item);
  }
};

export const generatePortfolioSuggestions = (
  signals: PortfolioSignalSummary,
  report?: StructuredPortfolioReport,
  followUps: string[] = []
): PortfolioSuggestion[] => {
  const suggestions: PortfolioSuggestion[] = [];

  if (signals.unassignedRatio >= 0.5) {
    pushUnique(suggestions, {
      id: 'sugg-unassigned-bundles',
      label: 'Unassigned hotspots',
      prompt: 'Which bundles contain the most unassigned work?',
      category: 'delivery',
      provenance: 'deterministic'
    });
  }

  if (signals.blockedWorkItems > 0) {
    pushUnique(suggestions, {
      id: 'sugg-blocked-risk',
      label: 'Blocked milestones',
      prompt: 'Which blocked work items threaten upcoming milestones?',
      category: 'risk',
      provenance: 'deterministic'
    });
  }

  if (signals.reviewsOpen > 0 || signals.reviewsOverdue > 0) {
    pushUnique(suggestions, {
      id: 'sugg-review-bottlenecks',
      label: 'Review bottlenecks',
      prompt: 'Which applications have overdue or open reviews?',
      category: 'review',
      provenance: 'deterministic'
    });
  }

  if (signals.activeWorkRatio < 0.2 && signals.totalWorkItems > 0) {
    pushUnique(suggestions, {
      id: 'sugg-throughput',
      label: 'Active delivery focus',
      prompt: 'What is currently blocking delivery progress?',
      category: 'capacity',
      provenance: 'deterministic'
    });
  }

  if (signals.milestonesOverdue > 0) {
    pushUnique(suggestions, {
      id: 'sugg-milestone-risk',
      label: 'Milestone exposure',
      prompt: 'Which milestones are at risk or overdue?',
      category: 'risk',
      provenance: 'deterministic'
    });
  }

  if (signals.totalWorkItems > 0) {
    pushUnique(suggestions, {
      id: 'sugg-owner-load',
      label: 'Owner workload',
      prompt: 'Which owners have the most blocked or overdue work?',
      category: 'capacity',
      provenance: 'deterministic'
    });
    pushUnique(suggestions, {
      id: 'sugg-bundle-risk',
      label: 'Bundle ranking',
      prompt: 'Which bundles have the highest delivery risk?',
      category: 'risk',
      provenance: 'deterministic'
    });
  }

  const trendSignals = report?.trendSignals || [];
  const trendByMetric = (metric: string) => trendSignals.find((item) => item.metric === metric);
  const unassignedTrend = trendByMetric('unassignedWorkItems');
  const blockedTrend = trendByMetric('blockedWorkItems');
  const milestoneTrend = trendByMetric('overdueMilestones');

  if (unassignedTrend?.direction === 'rising') {
    pushUnique(suggestions, {
      id: 'sugg-trend-unassigned',
      label: 'Unassigned trend',
      prompt: 'Why is unassigned work increasing over time?',
      category: 'capacity',
      provenance: 'deterministic'
    });
  }

  if (blockedTrend?.direction === 'rising') {
    pushUnique(suggestions, {
      id: 'sugg-trend-blocked',
      label: 'Blocked trend',
      prompt: 'Which bundles caused the rise in blocked tasks?',
      category: 'risk',
      provenance: 'deterministic'
    });
  }

  if (milestoneTrend?.direction === 'rising') {
    pushUnique(suggestions, {
      id: 'sugg-trend-milestones',
      label: 'Milestone trend',
      prompt: 'Which milestones are newly at risk?',
      category: 'risk',
      provenance: 'deterministic'
    });
  }

  if (trendSignals.length > 0) {
    pushUnique(suggestions, {
      id: 'sugg-trend-delivery',
      label: 'Delivery trend',
      prompt: 'Is delivery improving over time?',
      category: 'delivery',
      provenance: 'deterministic'
    });
  }

  const activeAlerts = report?.alerts || [];
  if (activeAlerts.length > 0) {
    pushUnique(suggestions, {
      id: 'sugg-alerts-active',
      label: 'Active alerts',
      prompt: 'What alerts are active now?',
      category: 'alert',
      provenance: 'deterministic'
    });
    pushUnique(suggestions, {
      id: 'sugg-alerts-emerging',
      label: 'Emerging risks',
      prompt: 'Show me emerging portfolio risks.',
      category: 'alert',
      provenance: 'deterministic'
    });
  }

  const healthScore = report?.healthScore;
  if (healthScore) {
    pushUnique(suggestions, {
      id: 'sugg-health-score',
      label: 'Health score',
      prompt: 'Check delivery execution health score.',
      category: 'health',
      provenance: 'deterministic'
    });
    if (healthScore.overall < 70) {
      pushUnique(suggestions, {
        id: 'sugg-health-low',
        label: 'Low health drivers',
        prompt: 'Which signals are driving the low portfolio health score?',
        category: 'health',
        provenance: 'deterministic'
      });
    }
  }

  (report?.questionsToAsk || []).forEach((question, index) => {
    pushUnique(suggestions, {
      id: `sugg-report-${index + 1}`,
      label: 'From report',
      prompt: question.question,
      category: 'risk',
      provenance: question.provenance === 'ai' ? 'ai' : 'deterministic'
    });
  });

  followUps.forEach((prompt, index) => {
    pushUnique(suggestions, {
      id: `sugg-followup-${index + 1}`,
      label: 'Follow-up',
      prompt,
      category: 'delivery',
      provenance: 'ai'
    });
  });

  return suggestions.slice(0, 6);
};
