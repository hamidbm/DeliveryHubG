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
