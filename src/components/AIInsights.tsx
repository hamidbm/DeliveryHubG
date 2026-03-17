import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Application, Bundle } from '../types';
import {
  EntityReference,
  EntityType,
  EvidenceItem,
  Notification,
  PortfolioAlert,
  PortfolioQueryResponse,
  PortfolioSuggestion,
  PortfolioSummaryResponse,
  PortfolioTrendSignal,
  RelatedEntitiesMeta,
  SavedInvestigation,
  Watcher,
  WatcherType
} from '../types/ai';
import MarkdownRenderer from './MarkdownRenderer';
import { marked } from 'marked';
import DOMPurify from 'isomorphic-dompurify';
import { derivePortfolioSignals } from '../services/ai/portfolioSignals';
import { generatePortfolioSuggestions } from '../services/ai/suggestionGenerator';
import EntityEvidenceList from './ui/EntityEvidenceList';
import RelatedEntitiesSection from './ui/RelatedEntitiesSection';
import TrendSignalCard from './ui/TrendSignalCard';
import HealthScoreCard from './ui/HealthScoreCard';
import AlertCard from './ui/AlertCard';
import QueryHistoryPanel, { QueryHistoryItem } from './ai/QueryHistoryPanel';
import InvestigationPanel from './ai/InvestigationPanel';
import PinnedInsightsPanel from './ai/PinnedInsightsPanel';
import NotificationCenter from './ai/NotificationCenter';
import WatcherList from './ai/WatcherList';
import WatcherConfigForm from './ai/WatcherConfigForm';
import StrategicAdvisorPanel from './ai/StrategicAdvisorPanel';
import ActionPlanPanel from './ai/ActionPlanPanel';
import WorkflowRulePanel from './ai/WorkflowRulePanel';
import ScenarioPlannerPanel from './ai/ScenarioPlannerPanel';

type AnalysisState = 'loading' | 'success' | 'error' | 'cached' | 'empty';
type InsightsWorkspaceTab = 'risks' | 'actions' | 'strategy' | 'simulation';
let lastAutoLoadAt = 0;

interface AIInsightsProps {
  applications?: Application[];
  bundles?: Bundle[];
}

type WatcherPreset = Partial<{
  type: WatcherType;
  targetId: string;
  condition: Record<string, any>;
  enabled: boolean;
  deliveryPreferences: Watcher['deliveryPreferences'];
}>;

type WikiTheme = {
  key: string;
  css?: string;
};

const pad2 = (value: number) => String(value).padStart(2, '0');

const formatExportFileStamp = (isoDate?: string) => {
  const date = isoDate ? new Date(isoDate) : new Date();
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}-${pad2(date.getHours())}-${pad2(date.getMinutes())}`;
};

const formatAgeLabel = (generatedAt?: string) => {
  if (!generatedAt) return 'Unknown age';
  const ageMs = Date.now() - new Date(generatedAt).getTime();
  if (Number.isNaN(ageMs) || ageMs < 0) return 'Unknown age';
  const minutes = Math.floor(ageMs / (60 * 1000));
  if (minutes < 1) return 'Generated just now';
  if (minutes < 60) return `Generated ${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Generated ${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  return `Generated ${days} day${days === 1 ? '' : 's'} ago`;
};

const healthBadgeStyle: Record<string, string> = {
  green: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  amber: 'bg-amber-100 text-amber-800 border-amber-200',
  red: 'bg-rose-100 text-rose-800 border-rose-200',
  unknown: 'bg-slate-100 text-slate-700 border-slate-200'
};

const urgencyLabel = (urgency?: string) => {
  if (urgency === 'now') return 'Now';
  if (urgency === '7d') return 'Next 7 Days';
  if (urgency === '30d') return 'Next 30 Days';
  return 'Later';
};

const severityWeight: Record<string, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1
};

const alertSeverityWeight = severityWeight;

const HealthBadge = ({ value }: { value?: string }) => {
  const level = (value || 'unknown').toLowerCase();
  return (
    <span className={`px-3 py-1 rounded-full border text-xs font-bold uppercase ${healthBadgeStyle[level] || healthBadgeStyle.unknown}`}>
      {level}
    </span>
  );
};

const SeverityBadge = ({ value }: { value?: string }) => {
  const level = (value || 'medium').toLowerCase();
  const styleMap: Record<string, string> = {
    critical: 'bg-rose-100 text-rose-700 border-rose-200',
    high: 'bg-orange-100 text-orange-700 border-orange-200',
    medium: 'bg-amber-100 text-amber-700 border-amber-200',
    low: 'bg-slate-100 text-slate-700 border-slate-200'
  };
  return (
    <span className={`text-[11px] px-2 py-0.5 rounded-full border uppercase font-bold ${styleMap[level] || styleMap.medium}`}>
      {level}
    </span>
  );
};

const UrgencyBadge = ({ value }: { value?: string }) => {
  const level = (value || 'later').toLowerCase();
  const styleMap: Record<string, string> = {
    now: 'bg-rose-100 text-rose-700 border-rose-200',
    '7d': 'bg-orange-100 text-orange-700 border-orange-200',
    '30d': 'bg-amber-100 text-amber-700 border-amber-200',
    later: 'bg-blue-100 text-blue-700 border-blue-200'
  };
  return (
    <span className={`text-[11px] px-2 py-0.5 rounded-full border uppercase font-bold ${styleMap[level] || styleMap.later}`}>
      {urgencyLabel(level)}
    </span>
  );
};

const SectionCard = ({
  icon,
  title,
  children
}: {
  icon: string;
  title: string;
  children: React.ReactNode;
}) => (
  <section className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
    <div className="flex items-center gap-2 mb-3">
      <i className={`fas ${icon} text-slate-400 text-xs`}></i>
      <h3 className="text-sm font-black uppercase tracking-widest text-slate-500">{title}</h3>
    </div>
    {children}
  </section>
);

type PdfTextSegment = {
  text: string;
  bold?: boolean;
};

type PdfBlock =
  | {
      type: 'text';
      segments: PdfTextSegment[];
      fontSize: number;
      lineHeight: number;
      spacingBefore: number;
      spacingAfter: number;
      indent?: number;
      color?: [number, number, number];
      headingLevel?: 1 | 2 | 3 | 4 | 5 | 6;
    }
  | {
      type: 'rule';
      spacingBefore: number;
      spacingAfter: number;
      color?: [number, number, number];
    };

const escapePdfText = (value: string) => Array.from(value)
  .map((char) => (char.charCodeAt(0) > 0x7f ? '?' : char))
  .join('')
  .replace(/\\/g, '\\\\')
  .replace(/\(/g, '\\(')
  .replace(/\)/g, '\\)')
  .replace(/\r/g, '');

const createPdfMeasurer = () => {
  if (typeof document === 'undefined') {
    return (text: string, size: number) => text.length * size * 0.46;
  }
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) {
    return (text: string, size: number) => text.length * size * 0.46;
  }
  return (text: string, size: number, bold = false) => {
    // PDF sizes are in points; canvas expects px. Convert pt -> px for accurate width,
    // then convert measured px back to pt.
    const pxSize = size * (96 / 72);
    context.font = `${bold ? 700 : 400} ${pxSize}px Arial`;
    return context.measureText(text).width * (72 / 96);
  };
};

const extractInlineSegments = (node: Node, forceBold = false): PdfTextSegment[] => {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = (node.textContent || '').replace(/\s+/g, ' ');
    return text ? [{ text, bold: forceBold }] : [];
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return [];
  const element = node as HTMLElement;
  const tag = element.tagName.toLowerCase();
  if (tag === 'br') return [{ text: '\n', bold: forceBold }];
  if (tag === 'code') {
    const text = (element.textContent || '').replace(/\s+/g, ' ');
    return text ? [{ text: `\`${text}\``, bold: forceBold }] : [];
  }
  const nextBold = forceBold || tag === 'strong' || tag === 'b';
  const chunks: PdfTextSegment[] = [];
  element.childNodes.forEach((child) => {
    chunks.push(...extractInlineSegments(child, nextBold));
  });
  return chunks;
};

const blocksFromRenderedHtml = (html: string): PdfBlock[] => {
  if (typeof DOMParser === 'undefined') return [];
  const parser = new DOMParser();
  const doc = parser.parseFromString(`<section>${html}</section>`, 'text/html');
  const root = doc.body.firstElementChild as HTMLElement | null;
  if (!root) return [];

  const blocks: PdfBlock[] = [];
  const headingSizes: Record<string, number> = {
    h1: 20,
    h2: 16,
    h3: 14,
    h4: 13,
    h5: 12,
    h6: 11
  };

  const pushTextBlock = (
    segments: PdfTextSegment[],
    fontSize: number,
    lineHeight: number,
    spacingBefore: number,
    spacingAfter: number,
    indent = 0
  ) => {
    if (!segments.some((segment) => segment.text.trim().length > 0)) return;
    blocks.push({ type: 'text', segments, fontSize, lineHeight, spacingBefore, spacingAfter, indent });
  };

  const walk = (element: Element) => {
    const tag = element.tagName.toLowerCase();
    if (tag in headingSizes) {
      const level = Number(tag.replace('h', '')) as 1 | 2 | 3 | 4 | 5 | 6;
      const blockColor: [number, number, number] =
        level === 1 ? [11, 18, 32]
          : level === 2 ? [29, 78, 216]
            : [30, 41, 59];
      blocks.push({
        type: 'text',
        segments: extractInlineSegments(element, true),
        fontSize: headingSizes[tag],
        lineHeight: headingSizes[tag] + 4,
        spacingBefore: 10,
        spacingAfter: 8,
        color: blockColor,
        headingLevel: level
      });
      return;
    }
    if (tag === 'p') {
      pushTextBlock(extractInlineSegments(element), 11, 17, 2, 8);
      return;
    }
    if (tag === 'blockquote') {
      pushTextBlock(extractInlineSegments(element), 11, 16, 4, 8, 16);
      return;
    }
    if (tag === 'hr') {
      blocks.push({ type: 'rule', spacingBefore: 8, spacingAfter: 8 });
      return;
    }
    if (tag === 'ul' || tag === 'ol') {
      const items = Array.from(element.querySelectorAll(':scope > li'));
      items.forEach((item, index) => {
        const prefix = tag === 'ol' ? `${index + 1}. ` : '- ';
        const itemSegments = extractInlineSegments(item);
        blocks.push({
          type: 'text',
          segments: [{ text: prefix, bold: true }, ...itemSegments],
          fontSize: 11,
          lineHeight: 16,
          spacingBefore: 2,
          spacingAfter: 3,
          indent: 16,
          color: [15, 23, 42]
        });
      });
      blocks.push({ type: 'text', segments: [{ text: '' }], fontSize: 1, lineHeight: 1, spacingBefore: 0, spacingAfter: 6 });
      return;
    }
    if (tag === 'table') {
      const rows = Array.from(element.querySelectorAll('tr'));
      rows.forEach((row) => {
        const cells = Array.from(row.querySelectorAll('th,td')).map((cell) => ({
          text: (cell.textContent || '').trim(),
          bold: cell.tagName.toLowerCase() === 'th'
        }));
        const joined: PdfTextSegment[] = [];
        cells.forEach((cell, idx) => {
          if (idx > 0) joined.push({ text: ' | ', bold: false });
          joined.push(cell);
        });
        pushTextBlock(joined, 10.5, 15, 2, 2);
      });
      blocks.push({ type: 'rule', spacingBefore: 4, spacingAfter: 8 });
      return;
    }

    const children = Array.from(element.children);
    if (children.length === 0) {
      pushTextBlock(extractInlineSegments(element), 11, 16, 2, 6);
      return;
    }
    children.forEach((child) => walk(child));
  };

  Array.from(root.children).forEach((child) => walk(child));
  return blocks;
};

const wrapSegmentsToLines = (
  segments: PdfTextSegment[],
  maxWidth: number,
  fontSize: number,
  measure: (text: string, size: number, bold?: boolean) => number
) => {
  const lines: PdfTextSegment[][] = [];
  let line: PdfTextSegment[] = [];
  let lineWidth = 0;

  const pushLine = () => {
    if (line.length > 0) lines.push(line);
    line = [];
    lineWidth = 0;
  };

  const splitTokenToFit = (token: PdfTextSegment, width: number): PdfTextSegment[] => {
    if (measure(token.text, fontSize, token.bold) <= width) return [token];
    const parts: PdfTextSegment[] = [];
    let current = '';
    for (const ch of token.text) {
      const candidate = current + ch;
      if (current && measure(candidate, fontSize, token.bold) > width) {
        parts.push({ text: current, bold: token.bold });
        current = ch;
      } else {
        current = candidate;
      }
    }
    if (current) parts.push({ text: current, bold: token.bold });
    return parts.length > 0 ? parts : [token];
  };

  const pushToken = (token: PdfTextSegment) => {
    const width = measure(token.text, fontSize, token.bold);
    if (width > maxWidth && token.text.trim().length > 0) {
      const subTokens = splitTokenToFit(token, maxWidth);
      subTokens.forEach((subToken) => pushToken(subToken));
      return;
    }
    if (lineWidth + width <= maxWidth || line.length === 0) {
      line.push(token);
      lineWidth += width;
      return;
    }
    if (!token.text.trim()) return;
    pushLine();
    line.push(token);
    lineWidth = width;
  };

  segments.forEach((segment) => {
    const pieces = segment.text.split('\n');
    pieces.forEach((piece, pieceIndex) => {
      const tokens = piece.split(/(\s+)/).filter((token) => token.length > 0);
      tokens.forEach((token) => {
        pushToken({ text: token, bold: segment.bold });
      });
      if (pieceIndex < pieces.length - 1) {
        pushLine();
      }
    });
  });

  pushLine();
  return lines;
};

const buildStyledPdf = (blocks: PdfBlock[]) => {
  const encoder = new TextEncoder();
  const measure = createPdfMeasurer();
  const pageWidth = 612;
  const pageHeight = 792;
  const marginLeft = 56;
  const marginRight = 56;
  const marginTop = 54;
  const marginBottom = 54;
  const pageStreams: string[] = [];
  let commands: string[] = [];
  let currentY = pageHeight - marginTop;

  const flushPage = () => {
    pageStreams.push(commands.join('\n'));
    commands = [];
    currentY = pageHeight - marginTop;
  };

  const ensureSpace = (requiredHeight: number) => {
    if (currentY - requiredHeight < marginBottom) {
      flushPage();
    }
  };

  blocks.forEach((block) => {
    currentY -= block.spacingBefore;
    if (block.type === 'rule') {
      ensureSpace(10 + block.spacingAfter);
      const y = currentY - 4;
      const [rr, rg, rb] = block.color || [226, 232, 240];
      commands.push(`${(rr / 255).toFixed(3)} ${(rg / 255).toFixed(3)} ${(rb / 255).toFixed(3)} RG`);
      commands.push('0.8 w');
      commands.push(`${marginLeft} ${y} m ${pageWidth - marginRight} ${y} l S`);
      currentY -= 8;
      currentY -= block.spacingAfter;
      return;
    }

    const indent = block.indent || 0;
    const maxWidth = pageWidth - marginLeft - marginRight - indent;
    const lines = wrapSegmentsToLines(block.segments, maxWidth, block.fontSize, measure);
    let firstBaselineY: number | null = null;
    let lastBaselineY: number | null = null;

    lines.forEach((lineSegments) => {
      ensureSpace(block.lineHeight + block.spacingAfter);
      const x = marginLeft + indent;
      const y = currentY;
      if (firstBaselineY === null) firstBaselineY = y;
      lastBaselineY = y;
      const [r, g, b] = block.color || [15, 23, 42];
      commands.push(`${(r / 255).toFixed(3)} ${(g / 255).toFixed(3)} ${(b / 255).toFixed(3)} rg`);
      commands.push('BT');
      commands.push(`1 0 0 1 ${x.toFixed(2)} ${y.toFixed(2)} Tm`);
      let activeFont: 'regular' | 'bold' | null = null;
      lineSegments.forEach((segment) => {
        const font = segment.bold ? 'bold' : 'regular';
        if (activeFont !== font) {
          commands.push(`/${font === 'bold' ? 'F2' : 'F1'} ${block.fontSize} Tf`);
          activeFont = font;
        }
        commands.push(`(${escapePdfText(segment.text)}) Tj`);
      });
      commands.push('ET');
      currentY -= block.lineHeight;
    });
    if (block.headingLevel === 1 && firstBaselineY !== null) {
      const x = marginLeft + indent;
      const underlineY = firstBaselineY - block.fontSize * 0.35;
      commands.push('0.514 0.361 0.965 RG');
      commands.push('1.4 w');
      commands.push(`${x.toFixed(2)} ${underlineY.toFixed(2)} m ${(x + 180).toFixed(2)} ${underlineY.toFixed(2)} l S`);
    }
    if (block.headingLevel === 2 && firstBaselineY !== null && lastBaselineY !== null) {
      const x = marginLeft + indent;
      // Align accent bar to heading glyph box (more ascent than descent).
      const top = firstBaselineY + block.fontSize * 0.72;
      const bottom = lastBaselineY - block.fontSize * 0.28;
      const left = x - 8;
      commands.push('0.024 0.714 0.831 RG');
      commands.push('2 w');
      commands.push(`${left.toFixed(2)} ${top.toFixed(2)} m ${left.toFixed(2)} ${bottom.toFixed(2)} l S`);
    }
    currentY -= block.spacingAfter;
  });

  if (commands.length > 0 || pageStreams.length === 0) {
    flushPage();
  }

  const objects: string[] = [];
  const fontRegularId = 3;
  const fontBoldId = 4;
  const contentObjectIds: number[] = [];
  const pageObjectIds: number[] = [];

  const pushObject = (id: number, body: string) => {
    objects[id - 1] = `${id} 0 obj\n${body}\nendobj\n`;
  };

  let nextId = 1;
  const catalogId = nextId++;
  const pagesId = nextId++;
  nextId += 2; // reserve font object ids

  for (const pageStream of pageStreams) {
    const contentId = nextId++;
    const pageId = nextId++;
    contentObjectIds.push(contentId);
    pageObjectIds.push(pageId);
    const contentLength = encoder.encode(pageStream).length;
    pushObject(contentId, `<< /Length ${contentLength} >>\nstream\n${pageStream}\nendstream`);
    pushObject(
      pageId,
      `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 ${fontRegularId} 0 R /F2 ${fontBoldId} 0 R >> >> /Contents ${contentId} 0 R >>`
    );
  }

  pushObject(catalogId, `<< /Type /Catalog /Pages ${pagesId} 0 R >>`);
  pushObject(pagesId, `<< /Type /Pages /Count ${pageObjectIds.length} /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(' ')}] >>`);
  pushObject(fontRegularId, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  pushObject(fontBoldId, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>');

  const header = '%PDF-1.4\n';
  const orderedObjects = objects.filter(Boolean);
  const offsets: number[] = [0];
  let body = '';

  for (const obj of orderedObjects) {
    offsets.push(header.length + body.length);
    body += obj;
  }

  const xrefStart = header.length + body.length;
  let xref = `xref\n0 ${orderedObjects.length + 1}\n`;
  xref += '0000000000 65535 f \n';
  for (let i = 1; i < offsets.length; i++) {
    xref += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }

  const trailer = `trailer\n<< /Size ${orderedObjects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
  return encoder.encode(header + body + xref + trailer);
};

const SnapshotMetric = ({ label, value }: { label: string; value: number | string }) => (
  <div className="bg-white rounded-xl border border-slate-200 px-4 py-3">
    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</p>
    <p className="text-2xl font-black text-slate-800 mt-1">{value}</p>
  </div>
);

const WorkspaceTabButton = ({
  id,
  label,
  active,
  onClick
}: {
  id: InsightsWorkspaceTab;
  label: string;
  active: boolean;
  onClick: (id: InsightsWorkspaceTab) => void;
}) => (
  <button
    type="button"
    onClick={() => onClick(id)}
    className={`inline-flex items-center gap-2 border-b-2 px-1 py-3 text-[11px] font-black uppercase tracking-widest transition ${
      active
        ? 'border-blue-600 text-slate-900'
        : 'border-transparent text-slate-400 hover:text-slate-700'
    }`}
  >
    <span>{label}</span>
  </button>
);

const buildEntityGroupsFromEvidence = (
  evidence: EvidenceItem[] = [],
  meta: RelatedEntitiesMeta = {}
): Array<{ type: EntityType; entities: EntityReference[]; secondaryMeta: Record<string, string> }> => {
  const grouped: Record<EntityType, EntityReference[]> = {
    workitem: [],
    milestone: [],
    review: [],
    application: [],
    bundle: []
  };
  const seen = new Set<string>();
  evidence.forEach((item) => {
    (item.entities || []).forEach((entity) => {
      const key = `${entity.type}:${entity.id}`;
      if (seen.has(key)) return;
      seen.add(key);
      grouped[entity.type].push(entity);
    });
  });
  return (Object.keys(grouped) as EntityType[])
    .map((type) => ({
      type,
      entities: grouped[type],
      secondaryMeta: (meta[type] || {}) as Record<string, string>
    }))
    .filter((group) => group.entities.length > 0);
};

const AIInsights: React.FC<AIInsightsProps> = ({ applications = [], bundles = [] }) => {
  const [state, setState] = useState<AnalysisState>('loading');
  const [report, setReport] = useState<PortfolioSummaryResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [auroraCss, setAuroraCss] = useState<string>('');
  const [showNarrative, setShowNarrative] = useState(false);
  const [queryInput, setQueryInput] = useState('');
  const [lastQueryQuestion, setLastQueryQuestion] = useState('');
  const [queryLoading, setQueryLoading] = useState(false);
  const [queryError, setQueryError] = useState('');
  const [queryResponse, setQueryResponse] = useState<PortfolioQueryResponse | null>(null);
  const [suggestions, setSuggestions] = useState<PortfolioSuggestion[]>([]);
  const [queryHistory, setQueryHistory] = useState<QueryHistoryItem[]>([]);
  const [savedInvestigations, setSavedInvestigations] = useState<SavedInvestigation[]>([]);
  const [investigationBusyId, setInvestigationBusyId] = useState<string | null>(null);
  const [watchers, setWatchers] = useState<Watcher[]>([]);
  const [watcherUsage, setWatcherUsage] = useState<{ used: number; max: number }>({ used: 0, max: 100 });
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isAdminUser, setIsAdminUser] = useState(false);
  const [watcherFormOpen, setWatcherFormOpen] = useState(false);
  const [watcherPreset, setWatcherPreset] = useState<WatcherPreset | undefined>(undefined);
  const [activeWorkspaceTab, setActiveWorkspaceTab] = useState<InsightsWorkspaceTab>('risks');
  const [riskVisibleCount, setRiskVisibleCount] = useState(3);
  const [alertVisibleCount, setAlertVisibleCount] = useState(3);
  const [actionVisibleCount, setActionVisibleCount] = useState(3);
  const [trendVisibleCount, setTrendVisibleCount] = useState(3);
  const hasAutoLoadedRef = useRef(false);
  const inFlightRef = useRef(false);

  const loadCachedReport = async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setState('loading');
    setErrorMessage('');
    try {
      const res = await fetch('/api/ai/portfolio-summary', {
        method: 'GET'
      });
      const data = (await res.json()) as PortfolioSummaryResponse;
      if (!res.ok) {
        setReport(null);
        setState('error');
        setErrorMessage(data.error?.message || 'Unable to load AI analysis.');
        return;
      }
      if (data.status === 'empty') {
        setReport(null);
        setState('empty');
        return;
      }
      if (data.status === 'error') {
        setReport(null);
        setState('error');
        setErrorMessage(data.error?.message || 'AI analysis failed.');
        return;
      }
      setShowNarrative(false);
      setReport(data);
      if (data.snapshot) {
        const generated = generatePortfolioSuggestions(derivePortfolioSignals(data.snapshot), data.report);
        setSuggestions(generated);
      }
      setState(data.metadata?.cached ? 'cached' : 'success');
    } catch {
      setReport(null);
      setState('error');
      setErrorMessage('AI provider request failed. Try again later.');
    }
    finally {
      inFlightRef.current = false;
    }
  };

  const generateAIReport = async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setState('loading');
    setErrorMessage('');
    try {
      const res = await fetch('/api/ai/portfolio-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = (await res.json()) as PortfolioSummaryResponse;
      if (!res.ok || data.status === 'error') {
        setReport(null);
        setState('error');
        setErrorMessage(data.error?.message || 'AI analysis failed.');
        return;
      }
      if (data.status === 'empty') {
        setReport(null);
        setState('empty');
        return;
      }
      setShowNarrative(false);
      setReport(data);
      if (data.snapshot) {
        const generated = generatePortfolioSuggestions(derivePortfolioSignals(data.snapshot), data.report);
        setSuggestions(generated);
      }
      setState(data.metadata?.cached ? 'cached' : 'success');
    } catch {
      setReport(null);
      setState('error');
      setErrorMessage('AI provider request failed. Try again later.');
    }
    finally {
      inFlightRef.current = false;
    }
  };

  useEffect(() => {
    const now = Date.now();
    if (now - lastAutoLoadAt < 1500) return;
    if (hasAutoLoadedRef.current) return;
    lastAutoLoadAt = now;
    hasAutoLoadedRef.current = true;
    loadCachedReport();
  }, []);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('aiInsights.queryHistory');
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return;
      setQueryHistory(parsed.slice(0, 20));
    } catch {
      // Ignore history load failures
    }
  }, []);

  useEffect(() => {
    const loadInvestigations = async () => {
      try {
        const res = await fetch('/api/ai/investigations');
        if (!res.ok) return;
        const data = await res.json();
        if (data?.status === 'success' && Array.isArray(data.items)) {
          setSavedInvestigations(data.items);
        }
      } catch {
        // Ignore panel load failures
      }
    };
    loadInvestigations();
  }, []);

  useEffect(() => {
    const loadWatcherAndNotifications = async () => {
      try {
        await Promise.all([refreshWatchers(), refreshNotifications()]);
      } catch {
        // Ignore watcher/notification load failures
      }
    };
    loadWatcherAndNotifications();
  }, []);

  useEffect(() => {
    const checkAdmin = async () => {
      try {
        const res = await fetch('/api/admin/check');
        if (!res.ok) return;
        const data = await res.json();
        setIsAdminUser(Boolean(data?.isAdmin || data?.isCmo));
      } catch {
        // Ignore admin check failures.
      }
    };
    checkAdmin();
  }, []);

  useEffect(() => {
    const loadAuroraTheme = async () => {
      try {
        const res = await fetch('/api/wiki/themes?active=true');
        if (!res.ok) return;
        const themes = (await res.json()) as WikiTheme[];
        if (!Array.isArray(themes)) return;
        const aurora = themes.find((theme) => String(theme.key || '').toLowerCase() === 'aurora');
        if (aurora?.css) {
          setAuroraCss(aurora.css);
        }
      } catch {
        // Keep default markdown styling if theme lookup fails.
      }
    };
    loadAuroraTheme();
  }, []);

  const snapshot = report?.snapshot;
  const metadata = report?.metadata;
  const structuredReport = report?.report;
  const relatedEntitiesMeta = report?.relatedEntitiesMeta || {};
  const reportMarkdown = structuredReport?.markdownReport || structuredReport?.executiveSummary || '';
  const hasExportableReport = Boolean(reportMarkdown && (state === 'success' || state === 'cached'));
  const pinnedItems = savedInvestigations.filter((item) => item.pinned).slice(0, 6);
  const topRisks = structuredReport?.topRisks || [];
  const recommendedActions = structuredReport?.recommendedActions || [];
  const alerts = structuredReport?.alerts || [];
  const trendSignals = structuredReport?.trendSignals || [];
  const concentrationSignals = structuredReport?.concentrationSignals || [];
  const questionsToAsk = structuredReport?.questionsToAsk || [];
  const sortedRisks = useMemo(
    () => topRisks.slice().sort((a, b) => (severityWeight[b.severity] || 0) - (severityWeight[a.severity] || 0)),
    [topRisks]
  );
  const sortedAlerts = useMemo(
    () => alerts.slice().sort((a, b) => (alertSeverityWeight[b.severity] || 0) - (alertSeverityWeight[a.severity] || 0)),
    [alerts]
  );
  const workspaceTabs: Array<{ id: InsightsWorkspaceTab; label: string }> = [
    { id: 'risks', label: 'Risks' },
    { id: 'actions', label: 'Actions' },
    { id: 'strategy', label: 'Strategy' },
    { id: 'simulation', label: 'Simulation' }
  ];

  const refreshWatchers = async () => {
    const res = await fetch('/api/ai/watchers');
    if (!res.ok) return;
    const data = await res.json();
    if (data?.status === 'success' && Array.isArray(data.watchers)) {
      setWatchers(data.watchers);
      if (data.usage && Number.isFinite(data.usage.used) && Number.isFinite(data.usage.max)) {
        setWatcherUsage({ used: Number(data.usage.used), max: Number(data.usage.max) });
      }
    }
  };

  const refreshNotifications = async () => {
    const res = await fetch('/api/ai/notifications');
    if (!res.ok) return;
    const data = await res.json();
    if (data?.status === 'success' && Array.isArray(data.notifications)) {
      setNotifications(data.notifications);
    }
  };

  const toQueryResponseFromSaved = (item: SavedInvestigation): PortfolioQueryResponse => ({
    answer: item.answer,
    explanation: item.explanation,
    evidence: item.evidence || [],
    followUps: item.followUps || [],
    relatedEntitiesMeta: item.relatedEntitiesMeta,
    entities: item.entities || []
  });

  const refreshInvestigations = async () => {
    const res = await fetch('/api/ai/investigations');
    if (!res.ok) return;
    const data = await res.json();
    if (data?.status === 'success' && Array.isArray(data.items)) {
      setSavedInvestigations(data.items);
    }
  };

  const submitQuery = async (seedQuestion?: string) => {
    const question = (seedQuestion ?? queryInput).trim();
    if (!question) return;
    setLastQueryQuestion(question);
    setQueryLoading(true);
    setQueryError('');
    try {
      const res = await fetch('/api/ai/portfolio-query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question })
      });
      const data = await res.json();
      if (!res.ok) {
        setQueryError(data?.error || 'Unable to answer question.');
        return;
      }
      const parsed = data as PortfolioQueryResponse;
      setQueryResponse(parsed);
      const historyItem: QueryHistoryItem = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        question,
        timestamp: new Date().toISOString(),
        result: parsed
      };
      setQueryHistory((prev) => {
        const deduped = [historyItem, ...prev.filter((entry) => entry.question.toLowerCase() !== question.toLowerCase())].slice(0, 20);
        try {
          sessionStorage.setItem('aiInsights.queryHistory', JSON.stringify(deduped));
        } catch {
          // Ignore storage failures
        }
        return deduped;
      });
      if (snapshot) {
        const nextSuggestions = generatePortfolioSuggestions(
          derivePortfolioSignals(snapshot),
          structuredReport,
          parsed.followUps || []
        );
        setSuggestions(nextSuggestions);
      }
      if (!seedQuestion) setQueryInput('');
    } catch {
      setQueryError('Unable to answer question.');
    } finally {
      setQueryLoading(false);
    }
  };

  const saveInvestigation = async (question: string, result: PortfolioQueryResponse) => {
    const normalizedQuestion = question.trim();
    if (!normalizedQuestion) return;
    const res = await fetch('/api/ai/investigations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: normalizedQuestion, queryResult: result })
    });
    if (!res.ok) return;
    await refreshInvestigations();
  };

  const saveAlertAsInvestigation = async (alert: PortfolioAlert) => {
    const queryResult: PortfolioQueryResponse = {
      answer: `${alert.title} (${alert.severity})`,
      explanation: alert.rationale,
      evidence: alert.evidence || [],
      alerts: [alert],
      followUps: [
        'Which entities are driving this alert?',
        'What should be fixed in the next 7 days?',
        'Is this alert trend improving or worsening?'
      ],
      relatedEntitiesMeta,
      entities: alert.entities || []
    };
    await saveInvestigation(alert.title, queryResult);
  };

  const createWatcher = async (payload: {
    type: WatcherType;
    targetId: string;
    condition: Record<string, any>;
    enabled: boolean;
    deliveryPreferences?: Watcher['deliveryPreferences'];
  }) => {
    const res = await fetch('/api/ai/watchers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({} as any));
      if (data?.error) {
        setQueryError(String(data.error));
      }
      return;
    }
    await Promise.all([refreshWatchers(), refreshNotifications()]);
    setWatcherFormOpen(false);
    setWatcherPreset(undefined);
  };

  const openWatcherWithPreset = (preset: WatcherPreset) => {
    setWatcherPreset(preset);
    setWatcherFormOpen(true);
  };

  const handleWatchAlert = (alert: PortfolioAlert) => {
    openWatcherWithPreset({
      type: 'alert',
      targetId: alert.id,
      condition: { minSeverity: alert.severity },
      enabled: true
    });
  };

  const handleWatchTrend = (signal: PortfolioTrendSignal) => {
    openWatcherWithPreset({
      type: 'trend',
      targetId: signal.metric,
      condition: { direction: 'rising' },
      enabled: true
    });
  };

  const handleWatchHealth = (threshold: number) => {
    openWatcherWithPreset({
      type: 'health',
      targetId: 'healthScore',
      condition: { operator: '<=', threshold },
      enabled: true
    });
  };

  const toggleWatcher = async (watcher: Watcher, enabled: boolean) => {
    const res = await fetch(`/api/ai/watchers/${encodeURIComponent(watcher.id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled })
    });
    if (!res.ok) return;
    await refreshWatchers();
  };

  const deleteWatcher = async (watcher: Watcher) => {
    const res = await fetch(`/api/ai/watchers/${encodeURIComponent(watcher.id)}`, { method: 'DELETE' });
    if (!res.ok) return;
    await refreshWatchers();
  };

  const markNotificationRead = async (notificationId: string, read: boolean) => {
    const res = await fetch(`/api/ai/notifications/${encodeURIComponent(notificationId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ read })
    });
    if (!res.ok) return;
    await refreshNotifications();
  };

  const handleRunSaved = async (item: SavedInvestigation) => {
    setQueryInput(item.question);
    await submitQuery(item.question);
  };

  const handleRefreshSaved = async (item: SavedInvestigation) => {
    setInvestigationBusyId(item.id);
    try {
      const res = await fetch(`/api/ai/investigations/${encodeURIComponent(item.id)}/refresh`, { method: 'POST' });
      if (!res.ok) return;
      const data = await res.json();
      if (data?.status === 'success' && data.investigation) {
        setSavedInvestigations((prev) => prev.map((p) => p.id === item.id ? data.investigation : p));
        setQueryResponse(toQueryResponseFromSaved(data.investigation));
      }
    } finally {
      setInvestigationBusyId(null);
    }
  };

  const handleTogglePinSaved = async (item: SavedInvestigation, forcePinned?: boolean) => {
    setInvestigationBusyId(item.id);
    try {
      const pinned = typeof forcePinned === 'boolean' ? forcePinned : !item.pinned;
      const res = await fetch(`/api/ai/investigations/${encodeURIComponent(item.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pinned })
      });
      if (!res.ok) return;
      const data = await res.json();
      if (data?.status === 'success' && data.item) {
        setSavedInvestigations((prev) => prev.map((p) => p.id === item.id ? data.item : p));
      }
    } finally {
      setInvestigationBusyId(null);
    }
  };

  const handleDeleteSaved = async (item: SavedInvestigation) => {
    setInvestigationBusyId(item.id);
    try {
      const res = await fetch(`/api/ai/investigations/${encodeURIComponent(item.id)}`, { method: 'DELETE' });
      if (!res.ok) return;
      setSavedInvestigations((prev) => prev.filter((p) => p.id !== item.id));
    } finally {
      setInvestigationBusyId(null);
    }
  };

  const buildReportHeader = () => {
    const generatedAt = metadata?.generatedAt || new Date().toISOString();
    return [
      '# AI Portfolio Insights Report',
      '',
      `- Generated At: ${generatedAt}`,
      '',
      '---',
      ''
    ].join('\n');
  };

  const downloadMarkdown = () => {
    if (!hasExportableReport) return;
    const filename = `deliveryhub-ai-insights-${formatExportFileStamp(metadata?.generatedAt)}.md`;
    const body = `${buildReportHeader()}${reportMarkdown}`;
    const blob = new Blob([body], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const downloadPdf = () => {
    if (!hasExportableReport) return;
    const filename = `deliveryhub-ai-insights-${formatExportFileStamp(metadata?.generatedAt)}.pdf`;
    const generatedAt = metadata?.generatedAt || new Date().toISOString();
    const renderedHtml = marked.parse(reportMarkdown || '', { gfm: true, breaks: true });
    const sanitizedHtml = DOMPurify.sanitize(typeof renderedHtml === 'string' ? renderedHtml : String(renderedHtml));
    const blocks: PdfBlock[] = [
      {
        type: 'text',
        segments: [{ text: 'AI Portfolio Insights Report', bold: true }],
        fontSize: 22,
        lineHeight: 28,
        spacingBefore: 0,
        spacingAfter: 8,
        color: [11, 18, 32],
        headingLevel: 1
      },
      {
        type: 'text',
        segments: [{ text: 'Generated At: ', bold: true }, { text: generatedAt }],
        fontSize: 11,
        lineHeight: 16,
        spacingBefore: 0,
        spacingAfter: 2,
        color: [71, 85, 105]
      },
      { type: 'text', segments: [{ text: '' }], fontSize: 1, lineHeight: 1, spacingBefore: 0, spacingAfter: 6 },
      { type: 'rule', spacingBefore: 6, spacingAfter: 8, color: [203, 213, 225] },
      ...blocksFromRenderedHtml(sanitizedHtml)
    ];
    const pdfBytes = buildStyledPdf(blocks);
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const renderWorkspace = () => {
    if (!structuredReport) return null;

    if (activeWorkspaceTab === 'risks') {
      return (
        <div className="space-y-5">
          <SectionCard icon="fa-triangle-exclamation" title={`Top Risks (${sortedRisks.length})`}>
            <div className="space-y-3">
              {sortedRisks.slice(0, riskVisibleCount).map((risk) => {
                const summary = (risk.summary || '').trim() || risk.evidence?.[0]?.text || 'No summary provided.';
                const detailGroups = buildEntityGroupsFromEvidence(risk.evidence || [], relatedEntitiesMeta);
                return (
                  <div key={risk.id} className="border border-slate-200 rounded-lg p-3 bg-slate-50">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-semibold text-slate-800 break-words">{risk.title}</p>
                      <SeverityBadge value={risk.severity} />
                    </div>
                    <p className="text-sm text-slate-600 mt-1 break-words">{summary}</p>
                    <RelatedEntitiesSection groups={detailGroups} compact />
                    {(risk.evidence?.length || detailGroups.length) ? (
                      <details className="mt-3 group">
                        <summary className="cursor-pointer list-none text-xs font-semibold text-blue-700 hover:text-blue-800">
                          <span className="group-open:hidden">View details</span>
                          <span className="hidden group-open:inline">Hide details</span>
                        </summary>
                        <div className="mt-3 space-y-3">
                          <EntityEvidenceList evidence={risk.evidence} />
                          <RelatedEntitiesSection groups={detailGroups} />
                        </div>
                      </details>
                    ) : null}
                  </div>
                );
              })}
              {sortedRisks.length === 0 ? (
                <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">
                  No major risks identified at this time.
                </div>
              ) : null}
              {sortedRisks.length > riskVisibleCount ? (
                <button type="button" onClick={() => setRiskVisibleCount((value) => value + 3)} className="text-xs font-semibold text-blue-700 hover:text-blue-800">
                  Show more risks
                </button>
              ) : null}
            </div>
          </SectionCard>

          <SectionCard icon="fa-bell" title={`Portfolio Alerts (${sortedAlerts.length})`}>
            <div className="space-y-3">
              {sortedAlerts.slice(0, alertVisibleCount).map((alert) => (
                <AlertCard
                  key={alert.id}
                  alert={alert}
                  relatedEntitiesMeta={relatedEntitiesMeta}
                  onSaveInvestigation={saveAlertAsInvestigation}
                  onWatchAlert={handleWatchAlert}
                />
              ))}
              {sortedAlerts.length === 0 ? (
                <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">
                  No active alerts in this report.
                </div>
              ) : null}
              {sortedAlerts.length > alertVisibleCount ? (
                <button type="button" onClick={() => setAlertVisibleCount((value) => value + 3)} className="text-xs font-semibold text-blue-700 hover:text-blue-800">
                  Show more alerts
                </button>
              ) : null}
            </div>
          </SectionCard>

          <SectionCard icon="fa-bullseye" title={`Concentration Signals (${concentrationSignals.length})`}>
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
              {concentrationSignals.map((signal) => {
                const summary = (signal.summary || '').trim() || signal.evidence?.[0]?.text || 'No summary provided.';
                return (
                  <div key={signal.id} className="border border-slate-200 rounded-lg p-3 bg-slate-50">
                    <p className="font-semibold text-slate-800 break-words">{signal.title}</p>
                    <p className="text-sm text-slate-600 mt-1 break-words">{summary}</p>
                    {signal.impact ? <p className="text-xs text-slate-500 mt-2">Impact: {signal.impact}</p> : null}
                    <RelatedEntitiesSection groups={buildEntityGroupsFromEvidence(signal.evidence || [], relatedEntitiesMeta)} compact />
                  </div>
                );
              })}
              {concentrationSignals.length === 0 ? (
                <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500 xl:col-span-2">
                  No concentration signals identified.
                </div>
              ) : null}
            </div>
          </SectionCard>

          <SectionCard icon="fa-chart-line" title={`Trend Signals (${trendSignals.length})`}>
            <div className="space-y-3">
              {trendSignals.slice(0, trendVisibleCount).map((signal, index) => (
                <TrendSignalCard key={`${signal.metric}-${signal.timeframeDays}-${index}`} signal={signal} onWatch={handleWatchTrend} />
              ))}
              {trendSignals.length === 0 ? (
                <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">
                  Trend analysis needs at least two historical snapshots. Generate more reports over time to unlock this section.
                </div>
              ) : null}
              {trendSignals.length > trendVisibleCount ? (
                <button type="button" onClick={() => setTrendVisibleCount((value) => value + 3)} className="text-xs font-semibold text-blue-700 hover:text-blue-800">
                  Show more trend signals
                </button>
              ) : null}
            </div>
          </SectionCard>
        </div>
      );
    }

    if (activeWorkspaceTab === 'actions') {
      return (
        <div className="space-y-5">
          <SectionCard icon="fa-list-check" title={`Recommended Actions (${recommendedActions.length})`}>
            <div className="space-y-3">
              {recommendedActions.slice(0, actionVisibleCount).map((action) => {
                const summary = (action.summary || '').trim() || action.evidence?.[0]?.text || 'No summary provided.';
                const detailGroups = buildEntityGroupsFromEvidence(action.evidence || [], relatedEntitiesMeta);
                return (
                  <div key={action.id} className="border border-slate-200 rounded-lg p-3 bg-slate-50">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-semibold text-slate-800 break-words">{action.title}</p>
                      <UrgencyBadge value={action.urgency} />
                    </div>
                    <p className="text-sm text-slate-600 mt-1 break-words">{summary}</p>
                    {action.ownerHint ? <p className="text-xs text-slate-500 mt-2">Owner Hint: {action.ownerHint}</p> : null}
                    <RelatedEntitiesSection groups={detailGroups} compact />
                    {(action.evidence?.length || detailGroups.length) ? (
                      <details className="mt-3 group">
                        <summary className="cursor-pointer list-none text-xs font-semibold text-blue-700 hover:text-blue-800">
                          <span className="group-open:hidden">View details</span>
                          <span className="hidden group-open:inline">Hide details</span>
                        </summary>
                        <div className="mt-3 space-y-3">
                          <EntityEvidenceList evidence={action.evidence} />
                          <RelatedEntitiesSection groups={detailGroups} />
                        </div>
                      </details>
                    ) : null}
                  </div>
                );
              })}
              {recommendedActions.length === 0 ? (
                <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">
                  No recommended actions available.
                </div>
              ) : null}
              {recommendedActions.length > actionVisibleCount ? (
                <button type="button" onClick={() => setActionVisibleCount((value) => value + 3)} className="text-xs font-semibold text-blue-700 hover:text-blue-800">
                  Show more actions
                </button>
              ) : null}
            </div>
          </SectionCard>

          <ActionPlanPanel />
          <WorkflowRulePanel />

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
            <WatcherList
              watchers={watchers}
              usage={watcherUsage}
              onCreate={() => setWatcherFormOpen((value) => !value)}
              onToggle={toggleWatcher}
              onDelete={deleteWatcher}
            />
            {watcherFormOpen ? (
              <WatcherConfigForm
                initial={watcherPreset}
                usage={watcherUsage}
                onCancel={() => {
                  setWatcherFormOpen(false);
                  setWatcherPreset(undefined);
                }}
                onSubmit={createWatcher}
              />
            ) : (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                Configure watcher subscriptions to receive in-app notifications when alerts, trends, investigations, or health thresholds trigger.
              </div>
            )}
          </div>
        </div>
      );
    }

    if (activeWorkspaceTab === 'strategy') {
      return (
        <div className="space-y-5">
          <StrategicAdvisorPanel relatedEntitiesMeta={relatedEntitiesMeta} showActionPlan={false} showWorkflowRules={false} showScenarioPlanner={false} />

          <SectionCard icon="fa-circle-question" title={`Questions To Ask (${questionsToAsk.length})`}>
            <div className="space-y-2">
              {questionsToAsk.map((item) => (
                <div key={item.id} className="border border-slate-200 rounded-lg p-3 bg-slate-50">
                  <p className="text-sm font-semibold text-slate-800 break-words">{item.question}</p>
                  {item.rationale ? <p className="text-xs text-slate-500 mt-1 break-words">{item.rationale}</p> : null}
                </div>
              ))}
              {questionsToAsk.length === 0 ? (
                <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">
                  No follow-up questions suggested.
                </div>
              ) : null}
            </div>
          </SectionCard>

          {structuredReport.markdownReport ? (
            <section className="bg-white border border-slate-200 rounded-xl p-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-black uppercase tracking-widest text-slate-500">Full Narrative Report</h3>
                <button onClick={() => setShowNarrative((open) => !open)} className="text-xs font-semibold text-blue-700 hover:text-blue-800">
                  {showNarrative ? 'Hide' : 'Show'}
                </button>
              </div>
              {showNarrative ? (
                <div className="wiki-content theme-aurora mt-3">
                  <MarkdownRenderer content={structuredReport.markdownReport} />
                </div>
              ) : (
                <p className="mt-3 text-sm text-slate-500">
                  Expand the full narrative when you need the complete AI-written portfolio interpretation.
                </p>
              )}
            </section>
          ) : null}
        </div>
      );
    }

    return (
      <div className="space-y-5">
        <SectionCard icon="fa-flask" title="Scenario Planning">
          <p className="text-sm text-slate-600">
            Model delivery changes, rerun assumptions, and compare likely outcomes before applying operational changes.
          </p>
        </SectionCard>
        <ScenarioPlannerPanel />
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center space-x-2">
            <i className="fas fa-robot text-blue-600"></i>
            <span>AI Portfolio Insights</span>
          </h1>
          <p className="text-slate-500">Automated risk assessment and delivery forecasting powered by the configured AI provider.</p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="/ai/executive-insights"
            className="px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-700 text-xs font-bold uppercase tracking-widest hover:bg-slate-50"
          >
            Executive Insights
          </a>
          <NotificationCenter
            notifications={notifications}
            onRefresh={refreshNotifications}
            onMarkRead={markNotificationRead}
            isAdmin={isAdminUser}
          />
          <button
            onClick={generateAIReport}
            disabled={state === 'loading'}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition disabled:opacity-50 flex items-center space-x-2"
          >
            <i className={`fas ${state === 'loading' ? 'fa-spinner fa-spin' : 'fa-sync-alt'}`}></i>
            <span>{state === 'empty' ? 'Generate Analysis' : 'Regenerate Analysis'}</span>
          </button>
        </div>
      </div>

      {state === 'cached' && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900 text-sm font-medium">
          Displaying cached analysis from the latest persisted report.
        </div>
      )}

      {(state === 'success' || state === 'cached') && metadata?.freshnessStatus === 'stale' && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900 text-sm font-medium">
          This analysis is older than the current freshness window and may not reflect the latest portfolio state.
        </div>
      )}

      {snapshot && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <SnapshotMetric label="Applications" value={snapshot.applications.total} />
          <SnapshotMetric label="Critical Apps" value={snapshot.applications.byHealth.critical} />
          <SnapshotMetric label="Overdue Work" value={snapshot.workItems.overdue} />
          <SnapshotMetric label="Blocked Work" value={snapshot.workItems.blocked} />
          <SnapshotMetric label="Open Reviews" value={snapshot.reviews.open} />
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden min-h-[420px]">
        <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center space-x-2">
          <div className={`w-2 h-2 rounded-full ${state === 'error' ? 'bg-rose-500' : 'bg-blue-500'} ${state === 'loading' ? 'animate-pulse' : ''}`}></div>
          <span className="text-sm font-bold text-slate-600 uppercase tracking-widest">Executive Intelligence Report</span>
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={downloadMarkdown}
              disabled={!hasExportableReport}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-50"
            >
              <i className="fas fa-file-lines mr-1"></i>
              Download Markdown
            </button>
            <button
              onClick={downloadPdf}
              disabled={!hasExportableReport}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-50"
            >
              <i className="fas fa-file-pdf mr-1"></i>
              Download PDF
            </button>
          </div>
        </div>
        <div className="p-8">
          {state === 'loading' && (
            <div className="space-y-4">
              <p className="text-slate-500 font-medium">Generating AI portfolio insights...</p>
              <div className="h-4 bg-slate-100 rounded w-3/4 animate-pulse"></div>
              <div className="h-4 bg-slate-100 rounded w-1/2 animate-pulse"></div>
              <div className="h-4 bg-slate-100 rounded w-5/6 animate-pulse"></div>
            </div>
          )}

          {state === 'error' && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-rose-800 whitespace-pre-wrap">
              {errorMessage}
            </div>
          )}

          {state === 'empty' && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-slate-700">
              <p className="font-semibold text-slate-800">No AI portfolio analysis exists yet.</p>
              <p className="text-sm mt-1">Generate the first report to create a persisted executive summary.</p>
            </div>
          )}

          {(state === 'success' || state === 'cached') && (
            <div className="space-y-4">
              {auroraCss && <style dangerouslySetInnerHTML={{ __html: auroraCss }} />}
              {metadata?.legacyCacheNormalized && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                  This report was normalized from an older cached AI format. Some structured sections were inferred.
                </div>
              )}
              {structuredReport ? (
                <div className="space-y-5">
                  <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,0.75fr)] gap-5">
                    <SectionCard icon="fa-gauge-high" title="Portfolio Health">
                      <div className="space-y-3">
                        <HealthScoreCard score={structuredReport.healthScore} onWatchThreshold={handleWatchHealth} />
                        <div className="flex items-start justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                          <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Overall Health</p>
                            <div className="mt-2">
                              <HealthBadge value={structuredReport.overallHealth} />
                            </div>
                          </div>
                          <p className="text-sm text-slate-600">
                            {structuredReport.executiveSummary
                              ? structuredReport.executiveSummary.split('. ').slice(0, 1).join('. ').trim()
                              : 'Insufficient data available to determine portfolio health context.'}
                          </p>
                        </div>
                      </div>
                    </SectionCard>

                    <SectionCard icon="fa-bell" title="Alert Snapshot">
                      <div className="space-y-3">
                        {sortedAlerts.slice(0, 3).map((alert) => (
                          <div key={alert.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-sm font-semibold text-slate-800 break-words">{alert.title}</p>
                              <SeverityBadge value={alert.severity} />
                            </div>
                            <p className="mt-1 text-xs text-slate-500 break-words">{alert.rationale}</p>
                          </div>
                        ))}
                        {sortedAlerts.length === 0 ? (
                          <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">
                            No active alerts in this report.
                          </div>
                        ) : null}
                      </div>
                    </SectionCard>
                  </div>

                  <SectionCard icon="fa-align-left" title="Executive Summary">
                    <p className="text-slate-700 leading-7 whitespace-pre-wrap break-words">
                      {structuredReport.executiveSummary || 'Summary unavailable.'}
                    </p>
                  </SectionCard>

                  <div className="flex flex-wrap gap-2">
                    {workspaceTabs.map((tab) => (
                      <WorkspaceTabButton
                        key={tab.id}
                        id={tab.id}
                        label={tab.label}
                        active={activeWorkspaceTab === tab.id}
                        onClick={setActiveWorkspaceTab}
                      />
                    ))}
                  </div>

                  <div className="grid grid-cols-1 2xl:grid-cols-[minmax(0,1fr)_360px] gap-6 items-start">
                    <div className="min-w-0">
                      {renderWorkspace()}
                    </div>

                    <aside className="space-y-5 2xl:sticky 2xl:top-6">
                      <SectionCard icon="fa-comments" title="Ask DeliveryHub AI">
                        <div className="space-y-3">
                          <div className="flex flex-col gap-2">
                            <input
                              value={queryInput}
                              onChange={(e) => setQueryInput(e.target.value)}
                              placeholder="Ask about risks, milestones, reviews, or delivery blockers..."
                              className="flex-1 px-3 py-2 rounded-lg border border-slate-300 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-200"
                            />
                            <button
                              onClick={() => submitQuery()}
                              disabled={queryLoading || !queryInput.trim()}
                              className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50"
                            >
                              {queryLoading ? 'Analyzing...' : 'Ask'}
                            </button>
                          </div>

                          {suggestions.length > 0 ? (
                            <div className="flex flex-wrap gap-2">
                              {suggestions.slice(0, 3).map((item) => (
                                <button
                                  key={item.id}
                                  onClick={() => submitQuery(item.prompt)}
                                  disabled={queryLoading}
                                  className="px-2.5 py-1 rounded-full border border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-50"
                                >
                                  {item.prompt}
                                </button>
                              ))}
                            </div>
                          ) : null}

                          {queryError ? (
                            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{queryError}</div>
                          ) : null}

                          {queryResponse ? (
                            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-2">
                              <p className="text-sm font-semibold text-slate-800">{queryResponse.answer}</p>
                              <p className="text-sm text-slate-600">{queryResponse.explanation}</p>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => saveInvestigation(lastQueryQuestion || queryInput, queryResponse)}
                                  className="px-2 py-1 rounded border border-blue-200 bg-blue-50 text-xs font-semibold text-blue-700 hover:bg-blue-100"
                                >
                                  Save Investigation
                                </button>
                              </div>
                              {queryResponse.followUps?.length ? (
                                <div className="flex flex-wrap gap-2">
                                  {queryResponse.followUps.slice(0, 4).map((item, idx) => (
                                    <button
                                      key={`qfu-${idx}`}
                                      onClick={() => submitQuery(item)}
                                      disabled={queryLoading}
                                      className="px-3 py-1 rounded-full border border-blue-200 bg-blue-50 text-xs font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-50"
                                    >
                                      {item}
                                    </button>
                                  ))}
                                </div>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      </SectionCard>

                      {pinnedItems.length ? (
                        <PinnedInsightsPanel
                          items={pinnedItems}
                          busyId={investigationBusyId}
                          onView={(item) => {
                            setQueryInput(item.question);
                            setQueryResponse(toQueryResponseFromSaved(item));
                          }}
                          onRefresh={handleRefreshSaved}
                          onUnpin={(item) => handleTogglePinSaved(item, false)}
                        />
                      ) : null}

                      {queryHistory.length ? (
                        <QueryHistoryPanel
                          items={queryHistory}
                          onRunAgain={(question) => submitQuery(question)}
                          onSave={(item) => saveInvestigation(item.question, item.result)}
                        />
                      ) : null}

                      {savedInvestigations.length ? (
                        <InvestigationPanel
                          items={savedInvestigations}
                          busyId={investigationBusyId}
                          onRun={handleRunSaved}
                          onRefresh={handleRefreshSaved}
                          onTogglePin={handleTogglePinSaved}
                          onDelete={handleDeleteSaved}
                          onWatch={(item) => openWatcherWithPreset({
                            type: 'investigation',
                            targetId: item.id,
                            condition: {},
                            enabled: true
                          })}
                        />
                      ) : null}
                    </aside>
                  </div>
                </div>
              ) : (
                <div className="wiki-content theme-aurora">
                  <MarkdownRenderer content={reportMarkdown || 'Analysis unavailable.'} />
                </div>
              )}
              {metadata && (
                <div className="text-xs text-slate-500 border-t border-slate-100 pt-4">
                  <p>{formatAgeLabel(metadata.generatedAt)}</p>
                  <p>Generated at {new Date(metadata.generatedAt).toLocaleString()}</p>
                  {metadata.freshnessStatus && <p>Freshness: {metadata.freshnessStatus.toUpperCase()}</p>}
                  {metadata.cached && <p>Showing cached analysis</p>}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="hidden">
        {applications.length}
        {bundles.length}
      </div>
    </div>
  );
};

export default AIInsights;
