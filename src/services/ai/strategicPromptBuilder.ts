import {
  ForecastSignal,
  PortfolioAlert,
  PortfolioSnapshot,
  PortfolioTrendSignal,
  RiskPropagationSignal,
  ScenarioResult,
  StructuredPortfolioReport
} from '../../types/ai';

export type StrategicPromptContext = {
  question: string;
  snapshot: PortfolioSnapshot;
  report?: StructuredPortfolioReport;
  trendSignals: PortfolioTrendSignal[];
  forecastSignals: ForecastSignal[];
  riskPropagationSignals: RiskPropagationSignal[];
  alerts: PortfolioAlert[];
  healthScore?: StructuredPortfolioReport['healthScore'];
  scenarioResults?: ScenarioResult[];
  deterministicBaseline: {
    answer: string;
    explanation: string;
    followUps: string[];
  };
};

const trimList = <T,>(items: T[], max = 8) => items.slice(0, max);

export const buildStrategicPrompt = (context: StrategicPromptContext) => {
  const report = context.report;
  const trendSignals = trimList(context.trendSignals || [], 8);
  const forecastSignals = trimList(context.forecastSignals || [], 8);
  const propagationSignals = trimList(context.riskPropagationSignals || [], 6);
  const alerts = trimList(context.alerts || [], 8);
  const scenarioResults = trimList(context.scenarioResults || [], 5).map((item) => ({
    scenarioId: item.scenarioId,
    description: item.description,
    metricDeltas: item.metricDeltas,
    healthScore: item.healthScore?.overall,
    recommendations: item.recommendations?.slice(0, 3) || []
  }));

  return `SYSTEM:\nYou are DeliveryHub Strategic AI Advisor.\nYou must remain grounded in provided deterministic data only.\nDo not speculate beyond the context.\nIf data is insufficient, say so clearly.\n\nCONTEXT:\n-- Portfolio Health --\n${JSON.stringify({
    overallHealth: report?.overallHealth || 'unknown',
    healthScore: context.healthScore || report?.healthScore || null,
    executiveSummary: report?.executiveSummary || ''
  }, null, 2)}\n\n-- Trend Signals --\n${JSON.stringify(trendSignals, null, 2)}\n\n-- Forecast Signals --\n${JSON.stringify(forecastSignals, null, 2)}\n\n-- Risk Propagation --\n${JSON.stringify(propagationSignals, null, 2)}\n\n-- Active Alerts --\n${JSON.stringify(alerts, null, 2)}\n\n-- Snapshot Digest --\n${JSON.stringify({
    generatedAt: context.snapshot.generatedAt,
    applications: context.snapshot.applications,
    bundles: context.snapshot.bundles,
    workItems: {
      total: context.snapshot.workItems.total,
      blocked: context.snapshot.workItems.blocked,
      overdue: context.snapshot.workItems.overdue,
      unassigned: context.snapshot.workItems.unassigned
    },
    reviews: context.snapshot.reviews,
    milestones: context.snapshot.milestones
  }, null, 2)}\n\n-- Scenario Outcomes (if available) --\n${JSON.stringify(scenarioResults, null, 2)}\n\n-- Deterministic Baseline --\n${JSON.stringify(context.deterministicBaseline, null, 2)}\n\nQUESTION:\n${context.question}\n\nOUTPUT INSTRUCTIONS:\nReturn strict JSON only with shape:\n{\n  "answer": "string",\n  "explanation": "string",\n  "evidence": [{"text":"string","entities":[{"type":"workitem|application|bundle|milestone|review","id":"string","label":"string","secondary":"optional"}]}],\n  "relatedEntities": [{"type":"workitem|application|bundle|milestone|review","id":"string","label":"string","secondary":"optional"}],\n  "followUps": ["string"]\n}\nConstraints:\n- answer concise and executive-ready\n- explanation can be multi-sentence but factual\n- include 3 to 8 evidence entries\n- include at most 12 relatedEntities\n- include 3 to 6 followUps\n- never invent entity ids or numeric metrics.`;
};
