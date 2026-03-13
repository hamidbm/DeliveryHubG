import {
  HealthScore,
  PortfolioAlert,
  StructuredPortfolioReport,
  PortfolioHealthSignal,
  PortfolioRiskSeverity,
  PortfolioSnapshot,
  StructuredRiskItem,
  StructuredActionItem,
  StructuredConcentrationSignal,
  StructuredQuestionItem,
  PortfolioTrendSignal
} from '../../types/ai';
import { PortfolioSignalSummary } from './portfolioSignals';
import { formatPortfolioReportAsMarkdown } from './formatPortfolioReportAsMarkdown';
import { toEvidenceItems } from './evidenceEntities';
import { computePortfolioHealthScore } from './healthScorer';
import { detectPortfolioAlerts } from './alertDetector';

const HEALTH_VALUES: PortfolioHealthSignal[] = ['green', 'amber', 'red', 'unknown'];
const RISK_VALUES: PortfolioRiskSeverity[] = ['low', 'medium', 'high', 'critical'];
const URGENCY_VALUES = ['now', '7d', '30d', 'later'] as const;
const TREND_METRICS: PortfolioTrendSignal['metric'][] = [
  'unassignedWorkItems',
  'blockedWorkItems',
  'overdueWorkItems',
  'activeWorkItems',
  'criticalApplications',
  'overdueMilestones'
];

const asString = (value: unknown, fallback = '') => {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  return trimmed || fallback;
};

const asEvidenceTextArray = (value: unknown, maxItems = 5) => {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry: any) => {
      if (typeof entry === 'string') return entry.trim();
      if (typeof entry?.text === 'string') return entry.text.trim();
      if (typeof entry?.label === 'string' && typeof entry?.value === 'string') return `${entry.label}: ${entry.value}`.trim();
      return '';
    })
    .filter(Boolean)
    .slice(0, maxItems);
};

const evidenceFromTexts = (texts: string[], provenance: 'ai' | 'deterministic' | 'legacy') =>
  toEvidenceItems(texts, provenance, 5);

const stripMarkdownSyntax = (text: string) => text
  .replace(/```[\s\S]*?```/g, (block) => block.replace(/```/g, '').trim())
  .replace(/`([^`]+)`/g, '$1')
  .replace(/\*\*(.*?)\*\*/g, '$1')
  .replace(/\*(.*?)\*/g, '$1')
  .replace(/^#{1,6}\s+/gm, '')
  .replace(/^>\s?/gm, '')
  .replace(/^\s*[-*+]\s+/gm, '')
  .replace(/\r/g, '')
  .replace(/\n{3,}/g, '\n\n')
  .trim();

const inferHealthFallback = (signals: PortfolioSignalSummary): PortfolioHealthSignal => {
  if (signals.criticalApplications > 0 || signals.blockedWorkItems >= 10 || signals.milestonesOverdue >= 3) return 'red';
  if (signals.blockedWorkItems > 0 || signals.overdueWorkItems > 0 || signals.unassignedWorkItems > 0) return 'amber';
  if (signals.workItemsTotal === 0 && signals.applicationsTotal === 0) return 'unknown';
  return 'green';
};

const deterministicSeverityFromSignals = (signals: PortfolioSignalSummary): PortfolioRiskSeverity => {
  if (signals.unassignedRatio >= 0.75) return 'critical';
  if (signals.overdueRatio >= 0.15) return 'high';
  if (signals.blockedRatio >= 0.10) return 'medium';
  return 'low';
};

const ensureRiskEvidence = (evidenceTexts: string[], signals: PortfolioSignalSummary, provenance: 'ai' | 'deterministic' | 'legacy') => {
  const seeded = [...evidenceTexts];
  if (seeded.length === 0) {
    seeded.push(`${signals.unassignedWorkItems} out of ${signals.totalWorkItems} work items are unassigned.`);
  }
  if (seeded.length < 2) {
    seeded.push(`Only ${signals.inProgressWorkItems} work items (${(signals.activeWorkRatio * 100).toFixed(1)}%) are in progress.`);
  }
  return evidenceFromTexts(seeded.slice(0, 5), provenance);
};

const ensureActionEvidence = (
  evidenceTexts: string[],
  fallbackEvidence: string[],
  provenance: 'ai' | 'deterministic' | 'legacy'
) => {
  const seeded = [...evidenceTexts];
  if (seeded.length === 0 && fallbackEvidence.length > 0) {
    seeded.push(fallbackEvidence[0]);
  }
  if (seeded.length < 2 && fallbackEvidence.length > 1) {
    seeded.push(fallbackEvidence[1]);
  }
  return evidenceFromTexts(seeded.slice(0, 5), provenance);
};

const defaultExecutiveSummary = (signals: PortfolioSignalSummary) => [
  `Portfolio includes ${signals.applicationsTotal} applications and ${signals.workItemsTotal} tracked work items.`,
  `${signals.unassignedWorkItems} work items are unassigned, ${signals.blockedWorkItems} are blocked, and ${signals.overdueWorkItems} are overdue.`,
  `${signals.reviewsOpen} review cycles are open and ${signals.milestonesOverdue} milestones are currently overdue.`
].join(' ');

const synthesizeRisks = (signals: PortfolioSignalSummary): StructuredRiskItem[] => {
  const risks: StructuredRiskItem[] = [];
  const defaultSeverity = deterministicSeverityFromSignals(signals);
  if (signals.unassignedWorkItems > 0) {
    risks.push({
      id: 'risk-1',
      title: 'High unassigned workload',
      severity: defaultSeverity === 'low' ? 'medium' : defaultSeverity,
      summary: 'A large share of portfolio work is unassigned, reducing execution predictability.',
      evidence: ensureRiskEvidence([
        `${signals.unassignedWorkItems} out of ${signals.totalWorkItems} work items are unassigned.`,
        `Unassigned ratio is ${(signals.unassignedRatio * 100).toFixed(1)}%.`
      ], signals, 'deterministic'),
      provenance: 'deterministic'
    });
  }
  if (signals.blockedWorkItems > 0) {
    risks.push({
      id: `risk-${risks.length + 1}`,
      title: 'Blocked delivery trend',
      severity: signals.blockedRatio >= 0.1 ? 'high' : 'medium',
      summary: 'Blocked work is creating delivery friction and potential milestone slippage.',
      evidence: ensureRiskEvidence([
        `${signals.blockedWorkItems} work items are currently blocked.`,
        `Blocked ratio is ${(signals.blockedRatio * 100).toFixed(1)}%.`
      ], signals, 'deterministic'),
      provenance: 'deterministic'
    });
  }
  if (signals.overdueWorkItems > 0 || signals.milestonesOverdue > 0) {
    risks.push({
      id: `risk-${risks.length + 1}`,
      title: 'Schedule pressure',
      severity: signals.overdueRatio >= 0.15 || signals.milestonesOverdue > 0 ? 'high' : 'medium',
      summary: 'Overdue execution artifacts indicate schedule compression risk.',
      evidence: ensureRiskEvidence([
        `${signals.overdueWorkItems} work items are overdue.`,
        `${signals.milestonesOverdue} milestones are overdue.`
      ].filter((item) => !item.startsWith('0 ')), signals, 'deterministic'),
      provenance: 'deterministic'
    });
  }
  return risks.slice(0, 5);
};

const synthesizeActions = (signals: PortfolioSignalSummary): StructuredActionItem[] => {
  const actions: StructuredActionItem[] = [];
  const severity = deterministicSeverityFromSignals(signals);
  const mappedUrgency = severity === 'critical' ? 'now' : severity === 'high' ? '7d' : severity === 'medium' ? '30d' : 'later';
  if (signals.unassignedWorkItems > 0) {
    actions.push({
      id: 'action-1',
      title: 'Assign owners to priority unassigned work',
      urgency: mappedUrgency,
      summary: 'Assign accountable owners to the highest-impact unassigned work items.',
      ownerHint: 'Delivery Leads',
      evidence: [
        `${signals.unassignedWorkItems} work items are currently unassigned.`,
        `Unassigned ratio is ${(signals.unassignedRatio * 100).toFixed(1)}%.`
      ].map((entry) => evidenceFromTexts([entry], 'deterministic')[0]).filter(Boolean),
      provenance: 'deterministic'
    });
  }
  if (signals.blockedWorkItems > 0) {
    actions.push({
      id: `action-${actions.length + 1}`,
      title: 'Triage blocked items in a focused unblock review',
      urgency: '7d',
      summary: 'Run a cross-functional unblock review to clear blockers tied to milestone delivery.',
      ownerHint: 'Program Manager',
      evidence: [
        `${signals.blockedWorkItems} work items are blocked.`,
        `Blocked ratio is ${(signals.blockedRatio * 100).toFixed(1)}%.`
      ].map((entry) => evidenceFromTexts([entry], 'deterministic')[0]).filter(Boolean),
      provenance: 'deterministic'
    });
  }
  if (signals.reviewsOpen > 0 || signals.reviewsOverdue > 0) {
    actions.push({
      id: `action-${actions.length + 1}`,
      title: 'Stabilize review throughput',
      urgency: '30d',
      summary: 'Rebalance reviewer capacity and tighten SLAs for open review cycles.',
      ownerHint: 'Review Governance Lead',
      evidence: [
        `${signals.reviewsOpen} review cycles are open.`,
        `${signals.reviewsOverdue} review cycles are overdue.`
      ].map((entry) => evidenceFromTexts([entry], 'deterministic')[0]).filter(Boolean),
      provenance: 'deterministic'
    });
  }
  return actions.slice(0, 5);
};

const synthesizeConcentrationSignals = (signals: PortfolioSignalSummary): StructuredConcentrationSignal[] => {
  const items: StructuredConcentrationSignal[] = [];
  if (signals.inProgressWorkItems <= 3 && signals.workItemsTotal > 0) {
    items.push({
      id: 'signal-1',
      title: 'Execution throughput concentrated in a small active subset',
      summary: 'Only a small subset of total work is actively progressing.',
      evidence: [
        `${signals.inProgressWorkItems} work items are in progress out of ${signals.totalWorkItems}.`,
        `Active work ratio is ${(signals.activeWorkRatio * 100).toFixed(1)}%.`
      ].map((entry) => evidenceFromTexts([entry], 'deterministic')[0]).filter(Boolean),
      provenance: 'deterministic'
    });
  }
  if (signals.unassignedWorkItems > 0) {
    items.push({
      id: `signal-${items.length + 1}`,
      title: 'Portfolio workload concentrated in unowned items',
      summary: 'Delivery capacity risk is concentrated in work without assigned owners.',
      evidence: [
        `${signals.unassignedWorkItems} work items are unassigned.`,
        `Unassigned ratio is ${(signals.unassignedRatio * 100).toFixed(1)}%.`
      ].map((entry) => evidenceFromTexts([entry], 'deterministic')[0]).filter(Boolean),
      provenance: 'deterministic'
    });
  }
  if (signals.criticalApplications === 0 && (signals.blockedWorkItems > 0 || signals.overdueWorkItems > 0)) {
    items.push({
      id: `signal-${items.length + 1}`,
      title: 'Operational risk exceeds technical health signals',
      summary: 'Application health appears stable while execution indicators remain stressed.',
      evidence: [
        `${signals.criticalApplications} applications are critical.`,
        `${signals.blockedWorkItems} items are blocked and ${signals.overdueWorkItems} are overdue.`
      ].map((entry) => evidenceFromTexts([entry], 'deterministic')[0]).filter(Boolean),
      provenance: 'deterministic'
    });
  }
  return items.slice(0, 5);
};

const synthesizeQuestions = (signals: PortfolioSignalSummary): StructuredQuestionItem[] => ([
  {
    id: 'question-1',
    question: 'Which bundles contain the largest share of unassigned work?',
    rationale: `Unassigned ratio is ${(signals.unassignedRatio * 100).toFixed(1)}%, which indicates ownership risk.`,
    provenance: 'deterministic' as const
  },
  {
    id: 'question-2',
    question: 'Which blocked work items threaten near-term milestones?',
    rationale: `${signals.blockedWorkItems} items are blocked and may delay committed delivery.`,
    provenance: 'deterministic' as const
  },
  ...(signals.reviewsOpen > 0
    ? [{
        id: 'question-3',
        question: 'Where is review capacity most constrained?',
        rationale: `${signals.reviewsOpen} open reviews can become delivery bottlenecks.`,
        provenance: 'deterministic' as const
      }]
    : [])
]).slice(0, 6);

const parseRawToObject = (raw: unknown): any => {
  if (!raw) return null;
  if (typeof raw === 'object') return raw;
  if (typeof raw !== 'string') return null;
  const text = raw.trim();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    const first = text.indexOf('{');
    const last = text.lastIndexOf('}');
    if (first >= 0 && last > first) {
      try {
        return JSON.parse(text.slice(first, last + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
};

const extractMarkdownSections = (markdown: string) => {
  const lines = markdown.replace(/\r/g, '').split('\n');
  const sections: Record<string, string[]> = {};
  let current = '__preamble__';
  sections[current] = [];
  for (const line of lines) {
    const heading = line.match(/^#{1,6}\s+(.+?)\s*$/);
    if (heading) {
      current = heading[1].trim().toLowerCase();
      if (!sections[current]) sections[current] = [];
      continue;
    }
    sections[current].push(line);
  }
  const getSection = (...aliases: string[]) => {
    for (const alias of aliases) {
      const exact = sections[alias.toLowerCase()];
      if (exact && exact.join('\n').trim()) return exact.join('\n').trim();
      const key = Object.keys(sections).find((name) => name.includes(alias.toLowerCase()) && sections[name].join('\n').trim());
      if (key) return sections[key].join('\n').trim();
    }
    return '';
  };
  return { sections, getSection };
};

const parseBulletLines = (section: string) => section
  .split('\n')
  .map((line) => line.trim())
  .filter((line) => Boolean(line) && (/^[-*+]\s+/.test(line) || /^\d+\.\s+/.test(line)))
  .map((line) => line.replace(/^[-*+]\s+/, '').replace(/^\d+\.\s+/, '').trim());

const normalizeTrendSignals = (
  raw: unknown,
  fallback: PortfolioTrendSignal[] = []
): PortfolioTrendSignal[] => {
  const parsed = (Array.isArray(raw) ? raw : [])
    .slice(0, 12)
    .map((item: any) => {
      const metric = asString(item?.metric, '') as PortfolioTrendSignal['metric'];
      if (!TREND_METRICS.includes(metric)) return null;
      const direction = asString(item?.direction, '').toLowerCase();
      const normalizedDirection: PortfolioTrendSignal['direction'] = direction === 'rising' || direction === 'falling' || direction === 'stable'
        ? direction
        : 'stable';
      const delta = Number(item?.delta || 0);
      const timeframeDays = Math.max(1, Number(item?.timeframeDays || 7));
      return {
        metric,
        direction: normalizedDirection,
        delta: Number.isFinite(delta) ? delta : 0,
        timeframeDays: Number.isFinite(timeframeDays) ? timeframeDays : 7,
        summary: asString(item?.summary, '') || undefined
      };
    })
    .filter(Boolean) as PortfolioTrendSignal[];

  return parsed.length > 0 ? parsed : fallback.slice(0, 12);
};

const normalizeAlertList = (raw: unknown): PortfolioAlert[] => {
  return (Array.isArray(raw) ? raw : [])
    .slice(0, 12)
    .map((item: any, index) => {
      const severityCandidate = asString(item?.severity, 'medium').toLowerCase() as PortfolioRiskSeverity;
      const severity = RISK_VALUES.includes(severityCandidate) ? severityCandidate : 'medium';
      const resultOfRaw = asString(item?.resultOf, '').toLowerCase();
      const resultOf: PortfolioAlert['resultOf'] = resultOfRaw === 'trend' || resultOfRaw === 'threshold' || resultOfRaw === 'predictive'
        ? resultOfRaw
        : 'threshold';
      const entities = Array.isArray(item?.entities) ? item.entities : [];
      return {
        id: asString(item?.id, `alert-${index + 1}`),
        title: asString(item?.title, `Alert ${index + 1}`),
        severity,
        summary: asString(item?.summary, 'No summary provided.'),
        rationale: asString(item?.rationale, 'Derived from report normalization context.'),
        evidence: toEvidenceItems(item?.evidence, 'ai', 6),
        entities,
        resultOf,
        timestamp: asString(item?.timestamp, new Date().toISOString())
      } as PortfolioAlert;
    });
};

const normalizeLegacyMarkdownReport = (
  raw: unknown,
  signals: PortfolioSignalSummary,
  trendSignals: PortfolioTrendSignal[] = [],
  snapshot?: PortfolioSnapshot
): StructuredPortfolioReport => {
  const markdown = typeof raw === 'string'
    ? raw
    : asString((raw as any)?.markdownReport || (raw as any)?.executiveSummary || '', '');
  const parsed = extractMarkdownSections(markdown);
  const executiveSource = parsed.getSection('executive summary') || parsed.getSection('summary') || '';
  const executiveSummary = stripMarkdownSyntax(executiveSource || defaultExecutiveSummary(signals)).slice(0, 1200);

  const riskBullets = parseBulletLines(parsed.getSection('delivery risks') || parsed.getSection('risks'));
  const signalBullets = parseBulletLines(parsed.getSection('major portfolio signals') || parsed.getSection('observations') || parsed.getSection('signals'));
  const actionBullets = parseBulletLines(parsed.getSection('recommended actions') || parsed.getSection('actions'));
  const questionBullets = parseBulletLines(parsed.getSection('questions to ask') || parsed.getSection('questions'));

  const topRisks = riskBullets.slice(0, 5).map((entry, index) => ({
    id: `risk-${index + 1}`,
    title: entry.slice(0, 100),
    severity: deterministicSeverityFromSignals(signals),
    summary: entry,
    evidence: ensureRiskEvidence([entry], signals, 'legacy'),
    provenance: 'legacy' as const
  }));
  const recommendedActions = actionBullets.slice(0, 5).map((entry, index) => ({
    id: `action-${index + 1}`,
    title: entry.slice(0, 100),
    urgency: '7d' as const,
    summary: entry,
    evidence: ensureActionEvidence([entry], signals.notableSignals, 'legacy'),
    provenance: 'legacy' as const
  }));
  const concentrationSignals = signalBullets.slice(0, 5).map((entry, index) => ({
    id: `signal-${index + 1}`,
    title: entry.slice(0, 100),
    summary: entry,
    evidence: evidenceFromTexts([entry, ...signals.notableSignals].slice(0, 2), 'legacy'),
    provenance: 'legacy' as const
  }));
  const questionsToAsk = questionBullets.slice(0, 6).map((entry, index) => ({
    id: `question-${index + 1}`,
    question: entry,
    rationale: 'Inferred from legacy narrative content.',
    provenance: 'legacy' as const
  }));

  const mergedRisks = topRisks.length > 0 ? topRisks : synthesizeRisks(signals);
  const mergedActions = recommendedActions.length > 0 ? recommendedActions : synthesizeActions(signals);
  const mergedSignals = concentrationSignals.length > 0 ? concentrationSignals : synthesizeConcentrationSignals(signals);
  const mergedQuestions = questionsToAsk.length >= 2 ? questionsToAsk : synthesizeQuestions(signals);

  const healthScore: HealthScore = computePortfolioHealthScore(signals, snapshot);
  const alerts = snapshot
    ? detectPortfolioAlerts(snapshot, signals, trendSignals, healthScore)
    : [];

  return {
    overallHealth: inferHealthFallback(signals),
    executiveSummary,
    topRisks: mergedRisks,
    recommendedActions: mergedActions,
    concentrationSignals: mergedSignals,
    trendSignals: trendSignals.slice(0, 12),
    alerts,
    healthScore,
    questionsToAsk: mergedQuestions,
    markdownReport: markdown || formatPortfolioReportAsMarkdown({
      overallHealth: inferHealthFallback(signals),
      executiveSummary,
      topRisks: mergedRisks,
      recommendedActions: mergedActions,
      concentrationSignals: mergedSignals,
      trendSignals: trendSignals.slice(0, 12),
      alerts,
      healthScore,
      questionsToAsk: mergedQuestions
    })
  };
};

export const normalizePortfolioReport = (
  raw: unknown,
  signals: PortfolioSignalSummary,
  fallbackTrendSignals: PortfolioTrendSignal[] = [],
  snapshot?: PortfolioSnapshot
): {
  report: StructuredPortfolioReport;
  normalizationFallbackUsed: boolean;
  sectionsSynthesized: { risks: boolean; actions: boolean; signals: boolean; questions: boolean };
} => {
  const parsed = parseRawToObject(raw);
  if (!parsed) {
    return {
      report: normalizeLegacyMarkdownReport(raw, signals, fallbackTrendSignals, snapshot),
      normalizationFallbackUsed: true,
      sectionsSynthesized: { risks: true, actions: true, signals: true, questions: true }
    };
  }

  const hasStructuredShape = Object.prototype.hasOwnProperty.call(parsed, 'overallHealth')
    || Object.prototype.hasOwnProperty.call(parsed, 'topRisks')
    || Object.prototype.hasOwnProperty.call(parsed, 'recommendedActions')
    || Object.prototype.hasOwnProperty.call(parsed, 'concentrationSignals')
    || Object.prototype.hasOwnProperty.call(parsed, 'questionsToAsk')
    || Object.prototype.hasOwnProperty.call(parsed, 'trendSignals')
    || Object.prototype.hasOwnProperty.call(parsed, 'alerts')
    || Object.prototype.hasOwnProperty.call(parsed, 'healthScore');

  if (!hasStructuredShape) {
    return {
      report: normalizeLegacyMarkdownReport(parsed, signals, fallbackTrendSignals, snapshot),
      normalizationFallbackUsed: true,
      sectionsSynthesized: { risks: true, actions: true, signals: true, questions: true }
    };
  }

  const healthCandidate = asString(parsed.overallHealth, '').toLowerCase() as PortfolioHealthSignal;
  const overallHealth = HEALTH_VALUES.includes(healthCandidate) ? healthCandidate : inferHealthFallback(signals);
  const executiveSummary = asString(parsed.executiveSummary, defaultExecutiveSummary(signals)).slice(0, 1200);

  const topRisks = (Array.isArray(parsed.topRisks) ? parsed.topRisks : [])
    .slice(0, 5)
    .map((item: any, index: number) => {
      const severityCandidate = asString(item?.severity, 'medium').toLowerCase() as PortfolioRiskSeverity;
      const deterministicSeverity = deterministicSeverityFromSignals(signals);
      const chosenSeverity = RISK_VALUES.includes(severityCandidate) ? severityCandidate : 'medium';
      const effectiveSeverity = RISK_VALUES.indexOf(chosenSeverity) < RISK_VALUES.indexOf(deterministicSeverity)
        ? deterministicSeverity
        : chosenSeverity;
      const explicitEvidence = toEvidenceItems(item?.evidence, 'ai', 5);
      return {
        id: `risk-${index + 1}`,
        title: asString(item?.title, `Risk ${index + 1}`),
        severity: effectiveSeverity,
        summary: asString(item?.summary, 'No summary provided.'),
        evidence: explicitEvidence.length > 0
          ? explicitEvidence
          : ensureRiskEvidence(asEvidenceTextArray(item?.evidence, 5), signals, 'ai'),
        provenance: 'ai' as const
      };
    });

  const recommendedActions = (Array.isArray(parsed.recommendedActions) ? parsed.recommendedActions : [])
    .slice(0, 5)
    .map((item: any, index: number) => {
      const urgencyCandidate = asString(item?.urgency, '30d').toLowerCase();
      const defaultUrgency = deterministicSeverityFromSignals(signals) === 'critical'
        ? 'now'
        : deterministicSeverityFromSignals(signals) === 'high'
          ? '7d'
          : deterministicSeverityFromSignals(signals) === 'medium'
            ? '30d'
            : 'later';
      const explicitEvidence = toEvidenceItems(item?.evidence, 'ai', 5);
      return {
        id: `action-${index + 1}`,
        title: asString(item?.title, `Action ${index + 1}`),
        urgency: (URGENCY_VALUES as readonly string[]).includes(urgencyCandidate) ? urgencyCandidate as (typeof URGENCY_VALUES)[number] : defaultUrgency,
        summary: asString(item?.summary, 'No summary provided.'),
        ownerHint: asString(item?.ownerHint, '') || undefined,
        evidence: explicitEvidence.length > 0
          ? explicitEvidence
          : ensureActionEvidence(asEvidenceTextArray(item?.evidence, 5), signals.notableSignals, 'ai'),
        provenance: 'ai' as const
      };
    });

  const concentrationSignals = (Array.isArray(parsed.concentrationSignals) ? parsed.concentrationSignals : [])
    .slice(0, 5)
    .map((item: any, index: number) => ({
      id: `signal-${index + 1}`,
      title: asString(item?.title, `Signal ${index + 1}`),
      summary: asString(item?.summary, 'No summary provided.'),
      impact: asString(item?.impact, '') || undefined,
      evidence: asEvidenceTextArray(item?.evidence, 5).length > 0
        ? toEvidenceItems(item?.evidence, 'ai', 5)
        : evidenceFromTexts(signals.notableSignals.slice(0, 2), 'deterministic'),
      provenance: 'ai' as const
    }));

  const questionsToAsk = (Array.isArray(parsed.questionsToAsk) ? parsed.questionsToAsk : [])
    .slice(0, 6)
    .map((item: any, index: number) => ({
      id: `question-${index + 1}`,
      question: asString(item?.question, `Question ${index + 1}`),
      rationale: asString(item?.rationale, '') || 'Question generated from current portfolio signals.',
      provenance: 'ai' as const
    }));

  const mergedRisks = topRisks.length > 0 ? topRisks : synthesizeRisks(signals);
  const mergedActions = recommendedActions.length > 0 ? recommendedActions : synthesizeActions(signals);
  const mergedSignals = concentrationSignals.length > 0 ? concentrationSignals : synthesizeConcentrationSignals(signals);
  const mergedQuestions = questionsToAsk.length >= 2 ? questionsToAsk : synthesizeQuestions(signals);
  const mergedTrends = normalizeTrendSignals(parsed.trendSignals, fallbackTrendSignals);
  const aiAlerts = normalizeAlertList(parsed.alerts);
  const healthScore = computePortfolioHealthScore(signals, snapshot);
  const deterministicAlerts = snapshot
    ? detectPortfolioAlerts(snapshot, signals, mergedTrends, healthScore)
    : [];
  const mergedAlerts = [...deterministicAlerts];
  aiAlerts.forEach((item) => {
    if (!mergedAlerts.some((existing) => existing.title.toLowerCase() === item.title.toLowerCase())) {
      mergedAlerts.push(item);
    }
  });
  const sectionsSynthesized = {
    risks: topRisks.length === 0,
    actions: recommendedActions.length === 0,
    signals: concentrationSignals.length === 0,
    questions: questionsToAsk.length < 2
  };

  const report: StructuredPortfolioReport = {
    overallHealth,
    executiveSummary,
    topRisks: mergedRisks,
    recommendedActions: mergedActions,
    concentrationSignals: mergedSignals,
    trendSignals: mergedTrends,
    alerts: mergedAlerts.slice(0, 12),
    healthScore,
    questionsToAsk: mergedQuestions,
    markdownReport: asString(parsed.markdownReport, '')
  };

  if (!report.markdownReport) {
    report.markdownReport = formatPortfolioReportAsMarkdown(report);
  }

  const fallbackUsed = !HEALTH_VALUES.includes(healthCandidate)
    || !asString(parsed.executiveSummary, '')
    || !Array.isArray(parsed.topRisks)
    || !Array.isArray(parsed.recommendedActions)
    || !Array.isArray(parsed.concentrationSignals)
    || !Array.isArray(parsed.questionsToAsk);

  return { report, normalizationFallbackUsed: fallbackUsed, sectionsSynthesized };
};
