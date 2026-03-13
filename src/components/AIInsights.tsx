import React, { useEffect, useRef, useState } from 'react';
import { Application, Bundle } from '../types';
import { PortfolioSummaryResponse } from '../types/ai';
import MarkdownRenderer from './MarkdownRenderer';
import { marked } from 'marked';
import DOMPurify from 'isomorphic-dompurify';

type AnalysisState = 'loading' | 'success' | 'error' | 'cached' | 'empty';
let lastAutoLoadAt = 0;

interface AIInsightsProps {
  applications?: Application[];
  bundles?: Bundle[];
}

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

const escapePdfText = (value: string) => value
  .replace(/[^\x00-\x7F]/g, '?')
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
    context.font = `${bold ? 700 : 400} ${size}px Arial`;
    // Convert CSS px-ish width to PDF points.
    return context.measureText(text).width * 0.75;
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

  const pushToken = (token: PdfTextSegment) => {
    const width = measure(token.text, fontSize, token.bold);
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

    lines.forEach((lineSegments) => {
      ensureSpace(block.lineHeight + block.spacingAfter);
      const x = marginLeft + indent;
      const y = currentY;
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
      if (block.headingLevel === 1) {
        const underlineY = y - 6;
        commands.push('0.514 0.361 0.965 RG');
        commands.push('1.4 w');
        commands.push(`${x.toFixed(2)} ${underlineY.toFixed(2)} m ${(x + 180).toFixed(2)} ${underlineY.toFixed(2)} l S`);
      }
      if (block.headingLevel === 2) {
        const left = x - 8;
        const top = y + 3;
        const bottom = y - block.lineHeight + 3;
        commands.push('0.024 0.714 0.831 RG');
        commands.push('2 w');
        commands.push(`${left.toFixed(2)} ${top.toFixed(2)} m ${left.toFixed(2)} ${bottom.toFixed(2)} l S`);
      }
      currentY -= block.lineHeight;
    });
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

const AIInsights: React.FC<AIInsightsProps> = ({ applications = [], bundles = [] }) => {
  const [state, setState] = useState<AnalysisState>('loading');
  const [report, setReport] = useState<PortfolioSummaryResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [auroraCss, setAuroraCss] = useState<string>('');
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
      setReport(data);
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
      setReport(data);
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
  const reportMarkdown = report?.report?.executiveSummary || '';
  const hasExportableReport = Boolean(reportMarkdown && (state === 'success' || state === 'cached'));

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

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center space-x-2">
            <i className="fas fa-robot text-blue-600"></i>
            <span>AI Portfolio Insights</span>
          </h1>
          <p className="text-slate-500">Automated risk assessment and delivery forecasting powered by the configured AI provider.</p>
        </div>
        <button
          onClick={generateAIReport}
          disabled={state === 'loading'}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition disabled:opacity-50 flex items-center space-x-2"
        >
          <i className={`fas ${state === 'loading' ? 'fa-spinner fa-spin' : 'fa-sync-alt'}`}></i>
          <span>{state === 'empty' ? 'Generate Analysis' : 'Regenerate Analysis'}</span>
        </button>
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
              <div className="wiki-content theme-aurora">
                <MarkdownRenderer content={reportMarkdown || 'Analysis unavailable.'} />
              </div>
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
