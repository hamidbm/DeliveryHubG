import {
  StructuredPortfolioReport,
  PortfolioHealthSignal,
  PortfolioRiskSeverity,
  StructuredRiskItem,
  StructuredActionItem,
  StructuredConcentrationSignal,
  StructuredQuestionItem
} from '../../types/ai';
import { PortfolioSignalSummary } from './portfolioSignals';
import { formatPortfolioReportAsMarkdown } from './formatPortfolioReportAsMarkdown';

const HEALTH_VALUES: PortfolioHealthSignal[] = ['green', 'amber', 'red', 'unknown'];
const RISK_VALUES: PortfolioRiskSeverity[] = ['low', 'medium', 'high', 'critical'];
const URGENCY_VALUES = ['now', '7d', '30d', 'later'] as const;

const asString = (value: unknown, fallback = '') => {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  return trimmed || fallback;
};

const asStringArray = (value: unknown, maxItems = 5) => {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => asString(entry))
    .filter(Boolean)
    .slice(0, maxItems);
};

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

const defaultExecutiveSummary = (signals: PortfolioSignalSummary) => [
  `Portfolio includes ${signals.applicationsTotal} applications and ${signals.workItemsTotal} tracked work items.`,
  `${signals.unassignedWorkItems} work items are unassigned, ${signals.blockedWorkItems} are blocked, and ${signals.overdueWorkItems} are overdue.`,
  `${signals.reviewsOpen} review cycles are open and ${signals.milestonesOverdue} milestones are currently overdue.`
].join(' ');

const synthesizeRisks = (signals: PortfolioSignalSummary): StructuredRiskItem[] => {
  const risks: StructuredRiskItem[] = [];
  if (signals.unassignedWorkItems > 0) {
    risks.push({
      id: 'risk-1',
      title: 'High unassigned workload',
      severity: signals.unassignedWorkItems > 50 ? 'high' : 'medium',
      summary: 'A large share of portfolio work is unassigned, reducing execution predictability.',
      evidence: [`${signals.unassignedWorkItems} of ${signals.workItemsTotal} work items are unassigned.`]
    });
  }
  if (signals.blockedWorkItems > 0) {
    risks.push({
      id: `risk-${risks.length + 1}`,
      title: 'Blocked delivery trend',
      severity: signals.blockedWorkItems >= 5 ? 'high' : 'medium',
      summary: 'Blocked work is creating delivery friction and potential milestone slippage.',
      evidence: [`${signals.blockedWorkItems} work items are blocked.`]
    });
  }
  if (signals.overdueWorkItems > 0 || signals.milestonesOverdue > 0) {
    risks.push({
      id: `risk-${risks.length + 1}`,
      title: 'Schedule pressure',
      severity: signals.milestonesOverdue > 0 ? 'high' : 'medium',
      summary: 'Overdue execution artifacts indicate schedule compression risk.',
      evidence: [
        `${signals.overdueWorkItems} work items are overdue.`,
        `${signals.milestonesOverdue} milestones are overdue.`
      ].filter((item) => !item.startsWith('0 '))
    });
  }
  return risks.slice(0, 5);
};

const synthesizeActions = (signals: PortfolioSignalSummary): StructuredActionItem[] => {
  const actions: StructuredActionItem[] = [];
  if (signals.unassignedWorkItems > 0) {
    actions.push({
      id: 'action-1',
      title: 'Assign owners to priority unassigned work',
      urgency: 'now',
      summary: 'Assign accountable owners to the highest-impact unassigned work items.',
      ownerHint: 'Delivery Leads',
      evidence: [`${signals.unassignedWorkItems} work items are currently unassigned.`]
    });
  }
  if (signals.blockedWorkItems > 0) {
    actions.push({
      id: `action-${actions.length + 1}`,
      title: 'Triage blocked items in a focused unblock review',
      urgency: '7d',
      summary: 'Run a cross-functional unblock review to clear blockers tied to milestone delivery.',
      ownerHint: 'Program Manager',
      evidence: [`${signals.blockedWorkItems} work items are blocked.`]
    });
  }
  if (signals.reviewsOpen > 0 || signals.reviewsOverdue > 0) {
    actions.push({
      id: `action-${actions.length + 1}`,
      title: 'Stabilize review throughput',
      urgency: '30d',
      summary: 'Rebalance reviewer capacity and tighten SLAs for open review cycles.',
      ownerHint: 'Review Governance Lead',
      evidence: [`${signals.reviewsOpen} reviews are open, ${signals.reviewsOverdue} are overdue.`]
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
      evidence: [`${signals.inProgressWorkItems} work items are in progress out of ${signals.workItemsTotal}.`]
    });
  }
  if (signals.unassignedWorkItems > 0) {
    items.push({
      id: `signal-${items.length + 1}`,
      title: 'Portfolio workload concentrated in unowned items',
      summary: 'Delivery capacity risk is concentrated in work without assigned owners.',
      evidence: [`${signals.unassignedWorkItems} work items are unassigned.`]
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
      ]
    });
  }
  return items.slice(0, 5);
};

const synthesizeQuestions = (signals: PortfolioSignalSummary): StructuredQuestionItem[] => [
  {
    id: 'question-1',
    question: 'Which bundles contain the largest share of unassigned work?',
    rationale: 'Unassigned work is a leading execution risk.'
  },
  {
    id: 'question-2',
    question: 'Which blocked work items threaten near-term milestones?',
    rationale: 'Blocked work may delay committed delivery.'
  },
  ...(signals.reviewsOpen > 0
    ? [{
        id: 'question-3',
        question: 'Where is review capacity most constrained?',
        rationale: 'Open reviews can become delivery bottlenecks.'
      }]
    : [])
].slice(0, 6);

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

const normalizeLegacyMarkdownReport = (raw: unknown, signals: PortfolioSignalSummary): StructuredPortfolioReport => {
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
    severity: 'medium' as PortfolioRiskSeverity,
    summary: entry,
    evidence: []
  }));
  const recommendedActions = actionBullets.slice(0, 5).map((entry, index) => ({
    id: `action-${index + 1}`,
    title: entry.slice(0, 100),
    urgency: '7d' as const,
    summary: entry
  }));
  const concentrationSignals = signalBullets.slice(0, 5).map((entry, index) => ({
    id: `signal-${index + 1}`,
    title: entry.slice(0, 100),
    summary: entry
  }));
  const questionsToAsk = questionBullets.slice(0, 6).map((entry, index) => ({
    id: `question-${index + 1}`,
    question: entry
  }));

  const mergedRisks = topRisks.length > 0 ? topRisks : synthesizeRisks(signals);
  const mergedActions = recommendedActions.length > 0 ? recommendedActions : synthesizeActions(signals);
  const mergedSignals = concentrationSignals.length > 0 ? concentrationSignals : synthesizeConcentrationSignals(signals);
  const mergedQuestions = questionsToAsk.length >= 2 ? questionsToAsk : synthesizeQuestions(signals);

  return {
    overallHealth: inferHealthFallback(signals),
    executiveSummary,
    topRisks: mergedRisks,
    recommendedActions: mergedActions,
    concentrationSignals: mergedSignals,
    questionsToAsk: mergedQuestions,
    markdownReport: markdown || formatPortfolioReportAsMarkdown({
      overallHealth: inferHealthFallback(signals),
      executiveSummary,
      topRisks: mergedRisks,
      recommendedActions: mergedActions,
      concentrationSignals: mergedSignals,
      questionsToAsk: mergedQuestions
    })
  };
};

export const normalizePortfolioReport = (
  raw: unknown,
  signals: PortfolioSignalSummary
): { report: StructuredPortfolioReport; normalizationFallbackUsed: boolean } => {
  const parsed = parseRawToObject(raw);
  if (!parsed) {
    return { report: normalizeLegacyMarkdownReport(raw, signals), normalizationFallbackUsed: true };
  }

  const hasStructuredShape = Object.prototype.hasOwnProperty.call(parsed, 'overallHealth')
    || Object.prototype.hasOwnProperty.call(parsed, 'topRisks')
    || Object.prototype.hasOwnProperty.call(parsed, 'recommendedActions')
    || Object.prototype.hasOwnProperty.call(parsed, 'concentrationSignals')
    || Object.prototype.hasOwnProperty.call(parsed, 'questionsToAsk');

  if (!hasStructuredShape) {
    return { report: normalizeLegacyMarkdownReport(parsed, signals), normalizationFallbackUsed: true };
  }

  const healthCandidate = asString(parsed.overallHealth, '').toLowerCase() as PortfolioHealthSignal;
  const overallHealth = HEALTH_VALUES.includes(healthCandidate) ? healthCandidate : inferHealthFallback(signals);
  const executiveSummary = asString(parsed.executiveSummary, defaultExecutiveSummary(signals)).slice(0, 1200);

  const topRisks = (Array.isArray(parsed.topRisks) ? parsed.topRisks : [])
    .slice(0, 5)
    .map((item: any, index: number) => {
      const severityCandidate = asString(item?.severity, 'medium').toLowerCase() as PortfolioRiskSeverity;
      return {
        id: `risk-${index + 1}`,
        title: asString(item?.title, `Risk ${index + 1}`),
        severity: RISK_VALUES.includes(severityCandidate) ? severityCandidate : 'medium',
        summary: asString(item?.summary, 'No summary provided.'),
        evidence: asStringArray(item?.evidence, 5)
      };
    });

  const recommendedActions = (Array.isArray(parsed.recommendedActions) ? parsed.recommendedActions : [])
    .slice(0, 5)
    .map((item: any, index: number) => {
      const urgencyCandidate = asString(item?.urgency, '30d').toLowerCase();
      return {
        id: `action-${index + 1}`,
        title: asString(item?.title, `Action ${index + 1}`),
        urgency: (URGENCY_VALUES as readonly string[]).includes(urgencyCandidate) ? urgencyCandidate as (typeof URGENCY_VALUES)[number] : '30d',
        summary: asString(item?.summary, 'No summary provided.'),
        ownerHint: asString(item?.ownerHint, '') || undefined,
        evidence: asStringArray(item?.evidence, 5)
      };
    });

  const concentrationSignals = (Array.isArray(parsed.concentrationSignals) ? parsed.concentrationSignals : [])
    .slice(0, 5)
    .map((item: any, index: number) => ({
      id: `signal-${index + 1}`,
      title: asString(item?.title, `Signal ${index + 1}`),
      summary: asString(item?.summary, 'No summary provided.'),
      impact: asString(item?.impact, '') || undefined,
      evidence: asStringArray(item?.evidence, 5)
    }));

  const questionsToAsk = (Array.isArray(parsed.questionsToAsk) ? parsed.questionsToAsk : [])
    .slice(0, 6)
    .map((item: any, index: number) => ({
      id: `question-${index + 1}`,
      question: asString(item?.question, `Question ${index + 1}`),
      rationale: asString(item?.rationale, '') || undefined
    }));

  const mergedRisks = topRisks.length > 0 ? topRisks : synthesizeRisks(signals);
  const mergedActions = recommendedActions.length > 0 ? recommendedActions : synthesizeActions(signals);
  const mergedSignals = concentrationSignals.length > 0 ? concentrationSignals : synthesizeConcentrationSignals(signals);
  const mergedQuestions = questionsToAsk.length >= 2 ? questionsToAsk : synthesizeQuestions(signals);

  const report: StructuredPortfolioReport = {
    overallHealth,
    executiveSummary,
    topRisks: mergedRisks,
    recommendedActions: mergedActions,
    concentrationSignals: mergedSignals,
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

  return { report, normalizationFallbackUsed: fallbackUsed };
};
