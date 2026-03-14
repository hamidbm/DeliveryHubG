import {
  EntityReference,
  EvidenceItem,
  ForecastSignal,
  PortfolioSnapshot,
  PortfolioTrendSignal,
  RiskPropagationSignal,
  ScenarioResult,
  StrategicQueryResponse,
  StructuredPortfolioReport
} from '../../types/ai';

type StrategicDeterministicContext = {
  question: string;
  snapshot: PortfolioSnapshot;
  report?: StructuredPortfolioReport;
  trendSignals: PortfolioTrendSignal[];
  forecastSignals: ForecastSignal[];
  riskPropagationSignals: RiskPropagationSignal[];
  scenarioResults?: ScenarioResult[];
};

export type DeterministicStrategicResult = StrategicQueryResponse & {
  confidence: 'high' | 'medium' | 'low';
  matchedIntent: 'top-risks' | 'compare-bundles' | 'resource-allocation' | 'milestone-risk' | 'scenario-analysis' | 'summary';
};

const severityScore: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };

const normalizeQuestion = (question: string) => question.trim().toLowerCase();

const uniqueEntities = (entities: EntityReference[]) => {
  const seen = new Set<string>();
  return entities.filter((entity) => {
    const key = `${entity.type}:${entity.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const uniqueFromEvidence = (evidence: EvidenceItem[]) => uniqueEntities(
  evidence.flatMap((item) => item.entities || [])
).slice(0, 12);

const withDefaults = (partial: Omit<DeterministicStrategicResult, 'success'>): DeterministicStrategicResult => ({
  success: true,
  ...partial
});

const summarizeTopRisks = (context: StrategicDeterministicContext): DeterministicStrategicResult => {
  const risks = (context.report?.topRisks || []).slice().sort((a, b) => (severityScore[b.severity] || 0) - (severityScore[a.severity] || 0));
  const forecast = (context.forecastSignals || []).slice().sort((a, b) => (severityScore[b.severity] || 0) - (severityScore[a.severity] || 0));
  const propagation = (context.riskPropagationSignals || []).slice().sort((a, b) => (severityScore[b.severity] || 0) - (severityScore[a.severity] || 0));

  const evidence: EvidenceItem[] = [];
  risks.slice(0, 3).forEach((risk) => {
    evidence.push({
      text: `${risk.title} (${risk.severity}): ${risk.summary}`,
      entities: uniqueEntities(risk.evidence.flatMap((item) => item.entities || [])).slice(0, 4)
    });
  });

  forecast.slice(0, 2).forEach((signal) => {
    evidence.push({
      text: `Forecast: ${signal.title} (${signal.severity}, ${(signal.confidence * 100).toFixed(0)}% confidence)`,
      entities: (signal.relatedEntities || []).slice(0, 4)
    });
  });

  propagation.slice(0, 2).forEach((signal) => {
    evidence.push({
      text: `Propagation: ${signal.title} (${signal.severity})`,
      entities: (signal.relatedEntities || []).slice(0, 4)
    });
  });

  if (!evidence.length) {
    evidence.push({
      text: `Portfolio currently has ${context.snapshot.workItems.blocked} blocked, ${context.snapshot.workItems.overdue} overdue, and ${context.snapshot.workItems.unassigned} unassigned work items.`,
      entities: []
    });
  }

  const relatedEntities = uniqueFromEvidence(evidence);
  return withDefaults({
    answer: 'Top strategic delivery risks are concentrated in blocked execution flow, milestone pressure, and dependency propagation.',
    explanation: 'Risk ranking is computed from current structured risk severity, near-term forecast signals, and cross-project propagation analysis.',
    evidence: evidence.slice(0, 8),
    relatedEntities,
    followUps: [
      'Which risks can be reduced within 7 days?',
      'Which bundles own the highest-severity risk entities?',
      'What actions have the highest expected risk reduction?'
    ],
    confidence: evidence.length >= 3 ? 'high' : 'medium',
    matchedIntent: 'top-risks'
  });
};

const compareBundles = (context: StrategicDeterministicContext): DeterministicStrategicResult => {
  const bundleItems = context.snapshot.bundles.items || [];
  const workItems = context.snapshot.workItems.items || [];
  const appItems = context.snapshot.applications.items || [];

  const stats = bundleItems.map((bundle) => {
    const bundleWork = workItems.filter((item) => item.bundleId === bundle.id);
    const bundleApps = appItems.filter((app) => app.bundleId === bundle.id);
    const blocked = bundleWork.filter((item) => item.blocked).length;
    const overdue = bundleWork.filter((item) => Boolean(item.dueDate && new Date(item.dueDate).getTime() < Date.now())).length;
    const unassigned = bundleWork.filter((item) => !item.assignee).length;
    const criticalApps = bundleApps.filter((app) => app.health === 'critical').length;
    const score = (blocked * 3) + (overdue * 2) + (unassigned * 2) + (criticalApps * 4);
    return {
      bundle,
      score,
      blocked,
      overdue,
      unassigned,
      criticalApps
    };
  }).sort((a, b) => b.score - a.score);

  const top = stats.slice(0, 3);
  const evidence: EvidenceItem[] = top.map((row) => ({
    text: `${row.bundle.name}: riskScore ${row.score} (blocked ${row.blocked}, overdue ${row.overdue}, unassigned ${row.unassigned}, critical apps ${row.criticalApps})`,
    entities: [{ type: 'bundle', id: row.bundle.id, label: row.bundle.name }]
  }));

  const answer = top.length
    ? `Highest bundle risk concentration is in ${top.map((row) => row.bundle.name).join(', ')}.`
    : 'Bundle comparison is currently limited because bundle-level snapshot details are missing.';

  return withDefaults({
    answer,
    explanation: 'Bundle comparison uses deterministic score weighting across blocked/overdue/unassigned work and critical application concentration.',
    evidence: evidence.length ? evidence : [{ text: 'No bundle-level snapshot items were available for deterministic comparison.', entities: [] }],
    relatedEntities: uniqueFromEvidence(evidence),
    followUps: [
      'Which milestones depend on the highest-risk bundles?',
      'Which bundle risks can be mitigated with immediate staffing?',
      'How do bundle risks map to executive priorities?'
    ],
    confidence: top.length >= 2 ? 'high' : 'medium',
    matchedIntent: 'compare-bundles'
  });
};

const resourceAllocationAdvice = (context: StrategicDeterministicContext): DeterministicStrategicResult => {
  const items = context.snapshot.workItems.items || [];
  const byBundle = new Map<string, { blocked: number; overdue: number; unassigned: number; title: string }>();

  const ensure = (bundleId: string, title: string) => {
    if (!byBundle.has(bundleId)) {
      byBundle.set(bundleId, { blocked: 0, overdue: 0, unassigned: 0, title });
    }
    return byBundle.get(bundleId)!;
  };

  items.forEach((item) => {
    if (!item.bundleId) return;
    const bundle = context.snapshot.bundles.items?.find((b) => b.id === item.bundleId);
    const acc = ensure(item.bundleId, bundle?.name || item.bundleId);
    if (item.blocked) acc.blocked += 1;
    if (!item.assignee) acc.unassigned += 1;
    if (item.dueDate && new Date(item.dueDate).getTime() < Date.now()) acc.overdue += 1;
  });

  const rows = Array.from(byBundle.entries()).map(([bundleId, value]) => ({
    bundleId,
    ...value,
    pressure: (value.blocked * 3) + (value.unassigned * 2) + (value.overdue * 2)
  })).sort((a, b) => b.pressure - a.pressure);

  const highPressure = rows[0];
  const lowPressure = rows[rows.length - 1];
  const evidence: EvidenceItem[] = rows.slice(0, 4).map((row) => ({
    text: `${row.title}: pressure ${row.pressure} (blocked ${row.blocked}, unassigned ${row.unassigned}, overdue ${row.overdue})`,
    entities: [{ type: 'bundle', id: row.bundleId, label: row.title }]
  }));

  const answer = highPressure
    ? `Prioritize staffing toward ${highPressure.title}; it has the highest delivery pressure footprint right now.`
    : 'Resource reallocation advice is limited because bundle-level work ownership data is not available.';

  const explanation = highPressure && lowPressure
    ? `Deterministic reallocation heuristic indicates the largest risk reduction comes from shifting capacity from lower-pressure bundles such as ${lowPressure.title} to ${highPressure.title}.`
    : 'Deterministic reallocation uses blocked, overdue, and unassigned workload concentration by bundle.';

  return withDefaults({
    answer,
    explanation,
    evidence: evidence.length ? evidence : [{ text: 'No bundle-linked work items were available for deterministic resource allocation analysis.', entities: [] }],
    relatedEntities: uniqueFromEvidence(evidence),
    followUps: [
      'Which specific work items should be reassigned first?',
      'Which milestones would benefit most from this reallocation?',
      'What are the trade-offs for the source bundle?'
    ],
    confidence: highPressure ? 'medium' : 'low',
    matchedIntent: 'resource-allocation'
  });
};

const milestoneRiskAdvice = (context: StrategicDeterministicContext): DeterministicStrategicResult => {
  const milestoneItems = context.snapshot.milestones.items || [];
  const workItems = context.snapshot.workItems.items || [];
  const risky = milestoneItems
    .map((milestone) => {
      const linked = workItems.filter((item) => (item.milestoneIds || []).includes(milestone.id));
      const blocked = linked.filter((item) => item.blocked).length;
      const overdue = linked.filter((item) => Boolean(item.dueDate && new Date(item.dueDate).getTime() < Date.now())).length;
      const pressure = blocked * 3 + overdue * 2;
      return { milestone, linkedCount: linked.length, blocked, overdue, pressure };
    })
    .sort((a, b) => b.pressure - a.pressure);

  const top = risky[0];
  const evidence: EvidenceItem[] = risky.slice(0, 4).map((item) => ({
    text: `${item.milestone.name}: linked ${item.linkedCount}, blocked ${item.blocked}, overdue ${item.overdue}`,
    entities: [{ type: 'milestone', id: item.milestone.id, label: item.milestone.name }]
  }));

  return withDefaults({
    answer: top
      ? `${top.milestone.name} has the strongest current risk profile among tracked milestones.`
      : 'Milestone-specific risk could not be determined from current snapshot details.',
    explanation: 'Milestone risk is derived deterministically from linked blocked and overdue work-item concentration.',
    evidence: evidence.length ? evidence : [{ text: 'No milestone-to-work-item link data is currently available.', entities: [] }],
    relatedEntities: uniqueFromEvidence(evidence),
    followUps: [
      'Which blockers are preventing milestone recovery?',
      'Which owners should be assigned to reduce milestone risk quickly?',
      'Does forecast indicate additional milestone slippage?'
    ],
    confidence: top ? 'high' : 'low',
    matchedIntent: 'milestone-risk'
  });
};

const summaryAdvice = (context: StrategicDeterministicContext): DeterministicStrategicResult => {
  const health = context.report?.overallHealth || 'unknown';
  const score = context.report?.healthScore?.overall;
  const topRisk = (context.report?.topRisks || [])[0];
  const evidence: EvidenceItem[] = [];

  if (topRisk) {
    evidence.push({
      text: `Top risk: ${topRisk.title} (${topRisk.severity})`,
      entities: uniqueEntities(topRisk.evidence.flatMap((item) => item.entities || [])).slice(0, 4)
    });
  }

  evidence.push({
    text: `Portfolio health is ${health}${typeof score === 'number' ? ` (${score}/100)` : ''}; blocked ${context.snapshot.workItems.blocked}, overdue ${context.snapshot.workItems.overdue}, unassigned ${context.snapshot.workItems.unassigned}.`,
    entities: []
  });

  return withDefaults({
    answer: topRisk
      ? `Portfolio is ${health}; the primary strategic concern is ${topRisk.title}.`
      : `Portfolio is ${health} with ongoing execution pressure from blocked/unassigned work.`,
    explanation: 'Summary is generated deterministically from structured report health, risk ranking, and workload bottleneck indicators.',
    evidence,
    relatedEntities: uniqueFromEvidence(evidence),
    followUps: [
      'What should leadership prioritize this quarter?',
      'Where should resources be reallocated for maximum impact?',
      'Which risks are likely to cascade across bundles?'
    ],
    confidence: topRisk ? 'medium' : 'low',
    matchedIntent: 'summary'
  });
};

const scenarioAdvice = (context: StrategicDeterministicContext): DeterministicStrategicResult => {
  const scenarioResults = (context.scenarioResults || []).slice(0, 5);
  if (!scenarioResults.length) {
    return withDefaults({
      answer: 'No recent scenario simulations are available to answer this what-if question.',
      explanation: 'Run a scenario from the Scenario Planner panel first, then ask strategic comparison or impact questions.',
      evidence: [{ text: 'Scenario result cache is empty for the current workspace context.', entities: [] }],
      relatedEntities: [],
      followUps: [
        'Run a scenario that reassigns work and compare health impact.',
        'What happens if we delay a high-risk milestone by one week?',
        'Which scenario gives the best risk reduction trade-off?'
      ],
      confidence: 'low',
      matchedIntent: 'scenario-analysis'
    });
  }

  const ranked = scenarioResults.slice().sort((a, b) => (b.metricDeltas?.healthOverall || 0) - (a.metricDeltas?.healthOverall || 0));
  const best = ranked[0];
  const worst = ranked[ranked.length - 1];

  const evidence = ranked.map((item) => ({
    text: `${item.description}: health delta ${item.metricDeltas?.healthOverall || 0}, forecast high-risk delta ${item.metricDeltas?.forecastHighRisks || 0}, propagation high-risk delta ${item.metricDeltas?.propagationHighRisks || 0}.`,
    entities: []
  }));

  return withDefaults({
    answer: best
      ? `Best recent scenario is "${best.description}" with a health score change of ${best.metricDeltas?.healthOverall || 0}.`
      : 'Scenario comparisons are available once at least one scenario result exists.',
    explanation: worst && best && worst.scenarioId !== best.scenarioId
      ? `Compared with "${worst.description}", the best scenario has stronger delivery health and lower projected systemic risk.`
      : 'Scenario recommendation is ranked by deterministic health, forecast-risk, and propagation-risk deltas.',
    evidence: evidence.slice(0, 5),
    relatedEntities: [],
    followUps: [
      'Compare the top two scenarios and list trade-offs.',
      'Which scenario reduces propagation risk the most?',
      'Should we save the best scenario as the next execution plan?'
    ],
    confidence: scenarioResults.length >= 2 ? 'high' : 'medium',
    matchedIntent: 'scenario-analysis'
  });
};

export const isStrategicIntentQuestion = (question: string) => {
  const q = normalizeQuestion(question);
  const strategicKeywords = [
    'strategic',
    'top 3',
    'top three',
    'prioritize',
    'recommend',
    'resource allocation',
    'reallocate',
    'compare',
    'leadership',
    'scenario',
    'what if',
    'trade-off',
    'tradeoff',
    'intervene',
    'quarter',
    'portfolio strategy'
  ];
  return strategicKeywords.some((keyword) => q.includes(keyword));
};

export const generateDeterministicStrategicAnswer = (
  context: StrategicDeterministicContext
): DeterministicStrategicResult => {
  const q = normalizeQuestion(context.question);

  if (q.includes('scenario') || q.includes('what if')) {
    return scenarioAdvice(context);
  }

  if (q.includes('compare') && q.includes('bundle')) {
    return compareBundles(context);
  }

  if (q.includes('reallocate') || q.includes('resource') || q.includes('staff') || q.includes('engineer')) {
    return resourceAllocationAdvice(context);
  }

  if (q.includes('milestone') && (q.includes('risk') || q.includes('at risk') || q.includes('why'))) {
    return milestoneRiskAdvice(context);
  }

  if ((q.includes('top') && q.includes('risk')) || q.includes('prioritize') || q.includes('leadership')) {
    return summarizeTopRisks(context);
  }

  return summaryAdvice(context);
};
