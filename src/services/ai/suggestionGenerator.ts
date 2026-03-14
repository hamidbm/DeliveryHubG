import { ForecastSignal, PortfolioSuggestion, RiskPropagationSignal, StructuredPortfolioReport } from '../../types/ai';
import { PortfolioSignalSummary } from './portfolioSignals';

const pushUnique = (target: PortfolioSuggestion[], item: PortfolioSuggestion) => {
  if (!target.some((existing) => existing.prompt.toLowerCase() === item.prompt.toLowerCase())) {
    target.push(item);
  }
};

export const generatePortfolioSuggestions = (
  signals: PortfolioSignalSummary,
  report?: StructuredPortfolioReport,
  followUps: string[] = [],
  forecastSignals: ForecastSignal[] = [],
  riskPropagationSignals: RiskPropagationSignal[] = []
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

  if (forecastSignals.length > 0) {
    pushUnique(suggestions, {
      id: 'sugg-forecast-delivery-soon',
      label: 'Near-term risks',
      prompt: 'What risks may impact delivery soon?',
      category: 'risk',
      provenance: 'deterministic'
    });
  }

  if (forecastSignals.some((item) => item.category === 'milestone_risk')) {
    pushUnique(suggestions, {
      id: 'sugg-forecast-milestone-slip',
      label: 'Likely milestone slips',
      prompt: 'Which milestones are likely to slip?',
      category: 'risk',
      provenance: 'deterministic'
    });
  }

  if (forecastSignals.some((item) => item.category === 'execution_slowdown')) {
    pushUnique(suggestions, {
      id: 'sugg-forecast-execution-slowdown',
      label: 'Execution slowdown',
      prompt: 'Is execution slowing down?',
      category: 'delivery',
      provenance: 'deterministic'
    });
  }

  if (forecastSignals.some((item) => item.category === 'backlog_growth')) {
    pushUnique(suggestions, {
      id: 'sugg-forecast-backlog-growth',
      label: 'Backlog growth',
      prompt: 'Which areas show growing backlog?',
      category: 'capacity',
      provenance: 'deterministic'
    });
  }

  if (riskPropagationSignals.length > 0) {
    pushUnique(suggestions, {
      id: 'sugg-propagation-risk-cascade',
      label: 'Risk cascade',
      prompt: 'Which delivery risks cascade into other areas?',
      category: 'risk',
      provenance: 'deterministic'
    });
    pushUnique(suggestions, {
      id: 'sugg-propagation-dependencies',
      label: 'Dependency risks',
      prompt: 'Show me dependencies contributing to delivery risk.',
      category: 'risk',
      provenance: 'deterministic'
    });
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

const pushSuggestionText = (target: string[], value: string) => {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return;
  if (!target.some((item) => item.toLowerCase() === normalized)) {
    target.push(value.trim());
  }
};

export const generateStrategicQuickSuggestions = (
  report?: StructuredPortfolioReport,
  forecastSignals: ForecastSignal[] = [],
  riskPropagationSignals: RiskPropagationSignal[] = []
): string[] => {
  const suggestions: string[] = [];

  [
    'What are the top 3 strategic delivery risks this quarter?',
    'Which milestones are most at risk and why?',
    'Where should resources be reallocated for maximal impact?',
    'How does backlog growth affect delivery timelines?',
    'Summarize the forecasted delivery outcomes.'
  ].forEach((item) => pushSuggestionText(suggestions, item));

  const topRisk = report?.topRisks?.[0];
  if (topRisk?.title) {
    pushSuggestionText(suggestions, `Summarize why "${topRisk.title}" is at risk and recommend the most impactful actions.`);
  }

  if ((report?.topRisks || []).length > 1) {
    pushSuggestionText(suggestions, 'Compare the risk profiles of the top bundles and recommend leadership interventions.');
  }

  if (forecastSignals.some((item) => item.category === 'milestone_risk')) {
    pushSuggestionText(suggestions, 'Which forecasted milestone slips should leadership address first?');
  }

  if (riskPropagationSignals.length > 0) {
    pushSuggestionText(suggestions, 'Which dependency cascades create the biggest downstream delivery risk?');
  }

  return suggestions.slice(0, 8);
};
