import { EntityReference, EvidenceItem, ForecastSignal, PortfolioSnapshot, RiskPropagationSignal, StructuredPortfolioReport } from '../../types/ai';
import { DependencyEdge, extractDependencyEdges } from './dependencyExtractor';
import { toEvidenceItems } from './evidenceEntities';

const severityScore: Record<string, number> = { low: 1, medium: 2, high: 3, critical: 4 };

const makeSourceKey = (entity: EntityReference) => `${entity.type}:${entity.id}`;

const uniqueEntities = (items: EntityReference[]) => {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${item.type}:${item.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const uniquePaths = (paths: RiskPropagationSignal['paths']) => {
  const seen = new Set<string>();
  return paths.filter((path) => {
    const key = `${path.from.type}:${path.from.id}->${path.to.type}:${path.to.id}:${path.linkType}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const sourceEntitiesFromReport = (report: StructuredPortfolioReport): Array<{ source: EntityReference; severity: number; reason: string }> => {
  const out: Array<{ source: EntityReference; severity: number; reason: string }> = [];

  (report.alerts || []).forEach((alert) => {
    const sev = severityScore[alert.severity] || 1;
    if (sev < 3) return;
    (alert.entities || []).forEach((entity) => {
      out.push({ source: entity, severity: sev, reason: `${alert.title} (${alert.severity})` });
    });
  });

  return out;
};

const sourceEntitiesFromForecast = (forecast: ForecastSignal[]): Array<{ source: EntityReference; severity: number; reason: string }> => {
  const out: Array<{ source: EntityReference; severity: number; reason: string }> = [];
  forecast.forEach((signal) => {
    const sev = signal.severity === 'high' ? 3 : signal.severity === 'medium' ? 2 : 1;
    if (sev < 2) return;
    (signal.relatedEntities || []).forEach((entity) => {
      out.push({ source: entity, severity: sev, reason: `${signal.title} (${signal.severity})` });
    });
  });
  return out;
};

const buildAdjacency = (edges: DependencyEdge[]) => {
  const map = new Map<string, DependencyEdge[]>();
  edges.forEach((edge) => {
    const key = makeSourceKey(edge.from);
    const arr = map.get(key) || [];
    arr.push(edge);
    map.set(key, arr);
  });
  return map;
};

const bfsPropagation = (
  source: EntityReference,
  adjacency: Map<string, DependencyEdge[]>,
  maxDepth = 2
): RiskPropagationSignal['paths'] => {
  const queue: Array<{ node: EntityReference; depth: number }> = [{ node: source, depth: 0 }];
  const visited = new Set<string>([makeSourceKey(source)]);
  const paths: RiskPropagationSignal['paths'] = [];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) break;
    if (current.depth >= maxDepth) continue;

    const outgoing = adjacency.get(makeSourceKey(current.node)) || [];
    outgoing.slice(0, 12).forEach((edge) => {
      paths.push({ from: edge.from, to: edge.to, linkType: edge.linkType });
      const key = makeSourceKey(edge.to);
      if (!visited.has(key)) {
        visited.add(key);
        queue.push({ node: edge.to, depth: current.depth + 1 });
      }
    });
  }

  return uniquePaths(paths).slice(0, 12);
};

const scorePropagationSeverity = (sourceSeverity: number, downstreamCount: number) => {
  const score = sourceSeverity + (downstreamCount >= 6 ? 2 : downstreamCount >= 3 ? 1 : 0);
  if (score >= 5) return 'high' as const;
  if (score >= 3) return 'medium' as const;
  return 'low' as const;
};

const evidenceFromPaths = (paths: RiskPropagationSignal['paths']): EvidenceItem[] => {
  const lines = paths.map((path) => ({
    text: `${path.from.label} impacts ${path.to.label} via ${path.linkType.replace('_', ' ')}.`,
    entities: [path.from, path.to]
  }));
  return toEvidenceItems(lines, 'deterministic', 8);
};

export const generateRiskPropagationSignals = (
  snapshot: PortfolioSnapshot,
  report: StructuredPortfolioReport,
  forecast: ForecastSignal[] = []
): RiskPropagationSignal[] => {
  const edges = extractDependencyEdges(snapshot);
  const adjacency = buildAdjacency(edges);
  const sourceRows = [
    ...sourceEntitiesFromReport(report),
    ...sourceEntitiesFromForecast(forecast)
  ];

  const sourceMap = new Map<string, { source: EntityReference; severity: number; reasons: string[] }>();
  sourceRows.forEach((row) => {
    const key = makeSourceKey(row.source);
    const existing = sourceMap.get(key);
    if (!existing) {
      sourceMap.set(key, { source: row.source, severity: row.severity, reasons: [row.reason] });
      return;
    }
    existing.severity = Math.max(existing.severity, row.severity);
    existing.reasons.push(row.reason);
  });

  const signals: RiskPropagationSignal[] = [];

  Array.from(sourceMap.values()).forEach((entry, idx) => {
    const paths = bfsPropagation(entry.source, adjacency, 2);
    if (paths.length === 0) return;

    const downstreamEntities = uniqueEntities(paths.map((path) => path.to));
    const relatedEntities = uniqueEntities([entry.source, ...downstreamEntities]).slice(0, 16);
    const severity = scorePropagationSeverity(entry.severity, downstreamEntities.length);

    signals.push({
      id: `prop-${idx + 1}-${entry.source.type}-${entry.source.id}`,
      title: `${entry.source.label} has cross-project propagation risk`,
      severity,
      summary: `${entry.source.label} is linked to ${downstreamEntities.length} downstream entity${downstreamEntities.length === 1 ? '' : 'ies'} through dependency and sequence paths.`,
      paths,
      evidence: [
        ...evidenceFromPaths(paths),
        ...toEvidenceItems([
          `Source risk context: ${Array.from(new Set(entry.reasons)).slice(0, 2).join('; ')}.`
        ], 'deterministic', 2)
      ].slice(0, 10),
      relatedEntities
    });
  });

  return signals
    .slice()
    .sort((a, b) => {
      const sev = (severityScore[b.severity] || 0) - (severityScore[a.severity] || 0);
      if (sev !== 0) return sev;
      return (b.paths?.length || 0) - (a.paths?.length || 0);
    })
    .slice(0, 8);
};
