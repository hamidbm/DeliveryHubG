import {
  HealthScore,
  PortfolioSnapshot,
  PortfolioTrendSignal,
  ScenarioChange,
  ScenarioDefinition,
  ScenarioResult,
  StructuredPortfolioReport
} from '../../types/ai';
import { derivePortfolioSignals } from './portfolioSignals';
import { computePortfolioHealthScore } from './healthScorer';
import { generateForecastSignals } from './forecastEngine';
import { generateRiskPropagationSignals } from './riskPropagation';
import { detectPortfolioAlerts } from './alertDetector';

const toIso = (value: string) => {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
};

const deepCloneSnapshot = (snapshot: PortfolioSnapshot): PortfolioSnapshot => JSON.parse(JSON.stringify(snapshot));

const matchesWorkItem = (itemId: string, ref: string) => {
  if (!ref) return false;
  const normalizedRef = String(ref).trim();
  return (
    itemId === normalizedRef
    || String(itemId).toLowerCase() === normalizedRef.toLowerCase()
  );
};

const applyReassignWorkItems = (snapshot: PortfolioSnapshot, change: Extract<ScenarioChange, { type: 'reassignWorkItems' }>) => {
  const targets = new Set(change.workItemIds.map((id) => String(id || '').trim()).filter(Boolean));
  (snapshot.workItems.items || []).forEach((item) => {
    if (!targets.size) return;
    const key = item.key || item.id;
    if (targets.has(item.id) || (key && targets.has(key)) || Array.from(targets).some((candidate) => matchesWorkItem(item.id, candidate))) {
      item.assignee = change.toOwner;
    }
  });
};

const applyAdjustMilestoneDate = (snapshot: PortfolioSnapshot, change: Extract<ScenarioChange, { type: 'adjustMilestoneDate' }>) => {
  const normalizedDate = toIso(change.newDate);
  if (!normalizedDate) return;
  (snapshot.milestones.items || []).forEach((item) => {
    if (item.id === change.milestoneId) {
      item.targetDate = normalizedDate;
    }
  });
};

const applyAdjustPriority = (snapshot: PortfolioSnapshot, change: Extract<ScenarioChange, { type: 'adjustPriority' }>) => {
  const targets = new Set(change.workItemIds.map((id) => String(id || '').trim()).filter(Boolean));
  (snapshot.workItems.items || []).forEach((item) => {
    const key = item.key || item.id;
    if (targets.has(item.id) || (key && targets.has(key))) {
      item.priority = String(change.newPriority);
    }
  });
};

const applyBundleResourceShift = (snapshot: PortfolioSnapshot, change: Extract<ScenarioChange, { type: 'bundleResourceShift' }>) => {
  if (change.count <= 0) return;
  const candidates = (snapshot.workItems.items || [])
    .filter((item) => item.bundleId === change.fromBundleId)
    .sort((a, b) => {
      const aScore = (a.blocked ? 2 : 0) + (!a.assignee ? 1 : 0);
      const bScore = (b.blocked ? 2 : 0) + (!b.assignee ? 1 : 0);
      return bScore - aScore;
    })
    .slice(0, change.count);

  candidates.forEach((item) => {
    item.bundleId = change.toBundleId;
  });
};

const applyScenarioChange = (snapshot: PortfolioSnapshot, change: ScenarioChange) => {
  if (change.type === 'reassignWorkItems') {
    applyReassignWorkItems(snapshot, change);
    return;
  }
  if (change.type === 'adjustMilestoneDate') {
    applyAdjustMilestoneDate(snapshot, change);
    return;
  }
  if (change.type === 'adjustPriority') {
    applyAdjustPriority(snapshot, change);
    return;
  }
  applyBundleResourceShift(snapshot, change);
};

const recalcDerivedSnapshotCounts = (snapshot: PortfolioSnapshot) => {
  const items = snapshot.workItems.items || [];
  const now = Date.now();

  const byStatus: Record<string, number> = {};
  let blocked = 0;
  let unassigned = 0;
  let overdue = 0;

  items.forEach((item) => {
    const status = String(item.status || 'UNKNOWN');
    byStatus[status] = (byStatus[status] || 0) + 1;
    if (item.blocked) blocked += 1;
    if (!item.assignee) unassigned += 1;
    if (item.dueDate && new Date(item.dueDate).getTime() < now && status.toLowerCase() !== 'done') overdue += 1;
  });

  snapshot.workItems.total = items.length;
  snapshot.workItems.blocked = blocked;
  snapshot.workItems.unassigned = unassigned;
  snapshot.workItems.overdue = overdue;
  snapshot.workItems.byStatus = byStatus;

  const milestones = snapshot.milestones.items || [];
  snapshot.milestones.total = milestones.length;
  snapshot.milestones.overdue = milestones.filter((milestone) => {
    if (!milestone.targetDate) return false;
    const status = String(milestone.status || '').toLowerCase();
    if (status.includes('done') || status.includes('completed')) return false;
    return new Date(milestone.targetDate).getTime() < now;
  }).length;
};

const buildDeltaMetrics = (
  baseHealth: HealthScore,
  simulatedHealth: HealthScore,
  baseSnapshot: PortfolioSnapshot,
  simulatedSnapshot: PortfolioSnapshot,
  baseForecastHighCount: number,
  simulatedForecastHighCount: number,
  basePropagationHighCount: number,
  simulatedPropagationHighCount: number
) => ({
  healthOverall: simulatedHealth.overall - baseHealth.overall,
  blockedWorkItems: simulatedSnapshot.workItems.blocked - baseSnapshot.workItems.blocked,
  overdueWorkItems: simulatedSnapshot.workItems.overdue - baseSnapshot.workItems.overdue,
  unassignedWorkItems: simulatedSnapshot.workItems.unassigned - baseSnapshot.workItems.unassigned,
  overdueMilestones: simulatedSnapshot.milestones.overdue - baseSnapshot.milestones.overdue,
  forecastHighRisks: simulatedForecastHighCount - baseForecastHighCount,
  propagationHighRisks: simulatedPropagationHighCount - basePropagationHighCount
});

const buildRecommendations = (metricDeltas: Record<string, number>) => {
  const recommendations: string[] = [];

  if (metricDeltas.healthOverall > 0) {
    recommendations.push(`Scenario improves overall portfolio health by ${metricDeltas.healthOverall} points; consider piloting this change in high-risk areas first.`);
  } else if (metricDeltas.healthOverall < 0) {
    recommendations.push(`Scenario reduces overall portfolio health by ${Math.abs(metricDeltas.healthOverall)} points; avoid broad rollout without mitigation controls.`);
  }

  if (metricDeltas.forecastHighRisks < 0) {
    recommendations.push(`High-severity forecast risks decrease by ${Math.abs(metricDeltas.forecastHighRisks)}; this change likely improves near-term delivery confidence.`);
  } else if (metricDeltas.forecastHighRisks > 0) {
    recommendations.push(`High-severity forecast risks increase by ${metricDeltas.forecastHighRisks}; reassess milestone and staffing assumptions before applying.`);
  }

  if (metricDeltas.propagationHighRisks < 0) {
    recommendations.push(`Cross-project propagation pressure is reduced; this lowers cascade risk across dependent entities.`);
  } else if (metricDeltas.propagationHighRisks > 0) {
    recommendations.push(`Propagation severity increases; avoid this scenario unless dependency bottlenecks are mitigated first.`);
  }

  if (metricDeltas.unassignedWorkItems < 0) {
    recommendations.push(`Unassigned workload improves by ${Math.abs(metricDeltas.unassignedWorkItems)} items; convert this into explicit owner assignments for durable gains.`);
  }

  if (!recommendations.length) {
    recommendations.push('Scenario impact is neutral in current deterministic signals; compare with an alternative scenario before deciding.');
  }

  return recommendations.slice(0, 6);
};

export const simulateScenario = (
  baseSnapshot: PortfolioSnapshot,
  scenario: ScenarioDefinition,
  baseReport?: StructuredPortfolioReport,
  trendSignals: PortfolioTrendSignal[] = []
): ScenarioResult => {
  const simulatedSnapshot = deepCloneSnapshot(baseSnapshot);
  scenario.changes.forEach((change) => applyScenarioChange(simulatedSnapshot, change));
  simulatedSnapshot.generatedAt = new Date().toISOString();
  recalcDerivedSnapshotCounts(simulatedSnapshot);

  const baseSignals = derivePortfolioSignals(baseSnapshot);
  const simulatedSignals = derivePortfolioSignals(simulatedSnapshot);
  const baseHealthScore = computePortfolioHealthScore(baseSignals, baseSnapshot);
  const simulatedHealthScore = computePortfolioHealthScore(simulatedSignals, simulatedSnapshot);

  const reportTemplate: StructuredPortfolioReport = {
    overallHealth: baseReport?.overallHealth || 'unknown',
    executiveSummary: baseReport?.executiveSummary || '',
    topRisks: baseReport?.topRisks || [],
    recommendedActions: baseReport?.recommendedActions || [],
    concentrationSignals: baseReport?.concentrationSignals || [],
    trendSignals,
    questionsToAsk: baseReport?.questionsToAsk || [],
    alerts: detectPortfolioAlerts(simulatedSnapshot, simulatedSignals, trendSignals, simulatedHealthScore),
    healthScore: simulatedHealthScore,
    markdownReport: baseReport?.markdownReport
  };

  const simulatedForecast = generateForecastSignals(simulatedSnapshot, reportTemplate, trendSignals);
  const simulatedPropagation = generateRiskPropagationSignals(simulatedSnapshot, reportTemplate, simulatedForecast);

  const baseForecast = baseReport ? generateForecastSignals(baseSnapshot, {
    ...baseReport,
    trendSignals: baseReport.trendSignals || trendSignals,
    alerts: baseReport.alerts || detectPortfolioAlerts(baseSnapshot, baseSignals, trendSignals, baseHealthScore),
    healthScore: baseReport.healthScore || baseHealthScore
  }, baseReport.trendSignals || trendSignals) : [];

  const basePropagation = baseReport ? generateRiskPropagationSignals(baseSnapshot, {
    ...baseReport,
    trendSignals: baseReport.trendSignals || trendSignals,
    alerts: baseReport.alerts || detectPortfolioAlerts(baseSnapshot, baseSignals, trendSignals, baseHealthScore),
    healthScore: baseReport.healthScore || baseHealthScore
  }, baseForecast) : [];

  const metricDeltas = buildDeltaMetrics(
    baseHealthScore,
    simulatedHealthScore,
    baseSnapshot,
    simulatedSnapshot,
    baseForecast.filter((signal) => signal.severity === 'high').length,
    simulatedForecast.filter((signal) => signal.severity === 'high').length,
    basePropagation.filter((signal) => signal.severity === 'high').length,
    simulatedPropagation.filter((signal) => signal.severity === 'high').length
  );

  const recommendations = buildRecommendations(metricDeltas);

  return {
    scenarioId: scenario.id,
    description: scenario.description,
    simulatedSnapshot,
    forecastSignals: simulatedForecast,
    riskPropagationSignals: simulatedPropagation,
    healthScore: simulatedHealthScore,
    metricDeltas,
    recommendations
  };
};
