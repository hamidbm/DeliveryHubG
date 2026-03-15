import {
  ActionPlan,
  ActionStep,
  EntityReference,
  EvidenceItem,
  ForecastSignal,
  PortfolioAlert,
  PortfolioTrendSignal,
  RiskPropagationSignal,
  StructuredPortfolioReport,
  TaskSuggestion
} from '../../types/ai';

const priorityScore: Record<ActionStep['priority'], number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1
};

const dedupeEntities = (entities: EntityReference[] = []) => {
  const seen = new Set<string>();
  const out: EntityReference[] = [];
  entities.forEach((entity) => {
    const key = `${entity.type}:${entity.id}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push(entity);
  });
  return out;
};

const fromAlerts = (alerts: PortfolioAlert[] = []) => alerts.flatMap((item) => item.entities || []);
const fromForecast = (signals: ForecastSignal[] = []) => signals.flatMap((item) => item.relatedEntities || []);
const fromPropagation = (signals: RiskPropagationSignal[] = []) => signals.flatMap((item) => item.relatedEntities || []);

const toTaskTitle = (step: ActionStep, index: number) => {
  const base = step.description.replace(/\.$/, '');
  return base.length > 90 ? `${base.slice(0, 87)}...` : `${index + 1}. ${base}`;
};

const toTaskSuggestion = (step: ActionStep, index: number): TaskSuggestion => ({
  id: `task-${step.id}`,
  title: toTaskTitle(step, index),
  description: step.description,
  relatedEntities: step.relatedEntities,
  priority: step.priority,
  evidence: step.evidence
});

const findTrend = (trendSignals: PortfolioTrendSignal[], metric: PortfolioTrendSignal['metric']) =>
  trendSignals.find((item) => item.metric === metric);

const addStep = (
  steps: ActionStep[],
  step: Omit<ActionStep, 'relatedEntities'> & { relatedEntities?: EntityReference[] }
) => {
  steps.push({
    ...step,
    relatedEntities: dedupeEntities(step.relatedEntities || [])
  });
};

export const generateActionPlan = (
  report: StructuredPortfolioReport | undefined,
  trendSignals: PortfolioTrendSignal[] = [],
  forecastSignals: ForecastSignal[] = [],
  propagationSignals: RiskPropagationSignal[] = []
): ActionPlan => {
  const steps: ActionStep[] = [];
  const alerts = (report?.alerts || []).slice();
  const topRisks = (report?.topRisks || []).slice(0, 4);
  const blockedTrend = findTrend(trendSignals, 'blockedWorkItems');
  const unassignedTrend = findTrend(trendSignals, 'unassignedWorkItems');
  const overdueTrend = findTrend(trendSignals, 'overdueWorkItems');

  if (unassignedTrend && unassignedTrend.direction === 'rising' && unassignedTrend.delta >= 4) {
    addStep(steps, {
      id: 'reassign-unowned-work',
      description: `Reassign unowned work items this sprint (unassigned increased by ${unassignedTrend.delta.toFixed(1)}).`,
      priority: unassignedTrend.delta >= 10 ? 'critical' : 'high',
      suggestedBy: 'deterministic',
      evidence: [
        {
          text: unassignedTrend.summary || `Unassigned work trend is rising by ${unassignedTrend.delta.toFixed(1)} over ${unassignedTrend.timeframeDays} days.`,
          entities: []
        }
      ],
      relatedEntities: dedupeEntities(fromAlerts(alerts).concat(fromForecast(forecastSignals)))
    });
  }

  if (blockedTrend && blockedTrend.direction === 'rising' && blockedTrend.delta >= 3) {
    addStep(steps, {
      id: 'resolve-blockers',
      description: 'Run a blocker triage and assign owner/date for each blocked item before next standup.',
      priority: blockedTrend.delta >= 8 ? 'critical' : 'high',
      suggestedBy: 'deterministic',
      evidence: [
        {
          text: blockedTrend.summary || `Blocked work increased by ${blockedTrend.delta.toFixed(1)} over ${blockedTrend.timeframeDays} days.`,
          entities: []
        }
      ],
      relatedEntities: dedupeEntities(fromForecast(forecastSignals).concat(fromPropagation(propagationSignals)))
    });
  }

  const highMilestoneRisk = forecastSignals
    .filter((signal) => signal.category === 'milestone_risk' && signal.severity !== 'low')
    .slice(0, 3);
  if (highMilestoneRisk.length > 0) {
    addStep(steps, {
      id: 'stabilize-milestones',
      description: 'Reprioritize milestone scope and re-sequence dependent tasks for at-risk milestones.',
      priority: highMilestoneRisk.some((item) => item.severity === 'high') ? 'critical' : 'high',
      suggestedBy: 'deterministic',
      evidence: highMilestoneRisk.map((item) => ({
        text: `${item.title} (${item.severity}, ${(item.confidence * 100).toFixed(0)}% confidence).`,
        entities: item.relatedEntities || []
      })),
      relatedEntities: dedupeEntities(highMilestoneRisk.flatMap((item) => item.relatedEntities || []))
    });
  }

  const reviewBacklogSignal = forecastSignals.find((signal) => signal.category === 'review_bottleneck');
  if (reviewBacklogSignal) {
    addStep(steps, {
      id: 'reduce-review-backlog',
      description: 'Increase reviewer capacity and enforce 24-hour review SLA for overdue approvals.',
      priority: reviewBacklogSignal.severity === 'high' ? 'high' : 'medium',
      suggestedBy: 'deterministic',
      evidence: [
        {
          text: reviewBacklogSignal.summary,
          entities: reviewBacklogSignal.relatedEntities || []
        }
      ],
      relatedEntities: reviewBacklogSignal.relatedEntities || []
    });
  }

  const propagationHigh = propagationSignals
    .filter((signal) => signal.severity !== 'low')
    .slice(0, 2);
  if (propagationHigh.length > 0) {
    addStep(steps, {
      id: 'contain-upstream-risk',
      description: 'Focus execution on upstream dependency hotspots to prevent cross-project propagation.',
      priority: propagationHigh.some((item) => item.severity === 'high') ? 'high' : 'medium',
      suggestedBy: 'deterministic',
      evidence: propagationHigh.map((item) => ({
        text: item.summary,
        entities: item.relatedEntities || []
      })),
      relatedEntities: dedupeEntities(propagationHigh.flatMap((item) => item.relatedEntities || []))
    });
  }

  if (overdueTrend && overdueTrend.direction === 'rising' && overdueTrend.delta >= 4) {
    addStep(steps, {
      id: 'recover-overdue-flow',
      description: 'Create a 7-day recovery queue for overdue items and track daily burn-down.',
      priority: overdueTrend.delta >= 10 ? 'high' : 'medium',
      suggestedBy: 'deterministic',
      evidence: [
        {
          text: overdueTrend.summary || `Overdue work increased by ${overdueTrend.delta.toFixed(1)} over ${overdueTrend.timeframeDays} days.`,
          entities: []
        }
      ],
      relatedEntities: dedupeEntities(fromAlerts(alerts))
    });
  }

  if (!steps.length) {
    addStep(steps, {
      id: 'maintain-health-rhythm',
      description: 'Maintain current delivery rhythm; run weekly risk review and validate ownership hygiene.',
      priority: 'low',
      suggestedBy: 'deterministic',
      evidence: [
        {
          text: 'No high-confidence deterioration signals were detected.',
          entities: []
        }
      ],
      relatedEntities: dedupeEntities(topRisks.flatMap((risk) => risk.evidence.flatMap((item) => item.entities || [])))
    });
  }

  const ranked = steps
    .slice()
    .sort((a, b) => (priorityScore[b.priority] || 0) - (priorityScore[a.priority] || 0))
    .slice(0, 8);

  const suggestTasks = ranked.slice(0, 6).map((step, index) => toTaskSuggestion(step, index));
  const summary = ranked[0]
    ? `Prioritize ${ranked[0].description.charAt(0).toLowerCase()}${ranked[0].description.slice(1)}`
    : 'No urgent action steps detected.';

  return {
    generatedAt: new Date().toISOString(),
    summary,
    steps: ranked,
    suggestTasks,
    relatedSignals: {
      alerts,
      forecast: forecastSignals,
      propagation: propagationSignals
    }
  };
};
