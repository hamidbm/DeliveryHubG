import React, { useMemo } from 'react';

type GraphNode = {
  id: string;
  key?: string;
  title?: string;
  status?: string;
  remainingPoints: number;
  scope: 'IN_MILESTONE' | 'EXTERNAL';
  isCritical: boolean;
  isNearCritical: boolean;
};

type GraphEdge = { fromId: string; toId: string };

type GraphMode = 'critical' | 'critical+near' | 'full';

interface DependencyGraphProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  mode: GraphMode;
  maxNodes?: number;
  onNodeClick?: (id: string) => void;
  cycleDetected?: boolean;
}

const DependencyGraph: React.FC<DependencyGraphProps> = ({ nodes, edges, mode, maxNodes = 150, onNodeClick, cycleDetected }) => {
  const filtered = useMemo(() => {
    let filteredNodes = nodes;
    if (mode === 'critical') {
      filteredNodes = nodes.filter((n) => n.isCritical);
    } else if (mode === 'critical+near') {
      filteredNodes = nodes.filter((n) => n.isCritical || n.isNearCritical);
    }
    if (filteredNodes.length > maxNodes) {
      filteredNodes = filteredNodes.slice(0, maxNodes);
    }
    const idSet = new Set(filteredNodes.map((n) => n.id));
    const filteredEdges = edges.filter((e) => idSet.has(e.fromId) && idSet.has(e.toId));
    return { nodes: filteredNodes, edges: filteredEdges };
  }, [nodes, edges, mode, maxNodes]);

  const layout = useMemo(() => {
    const nodeMap = new Map(filtered.nodes.map((n) => [n.id, n]));
    const indegree = new Map<string, number>();
    const outgoing = new Map<string, string[]>();
    filtered.nodes.forEach((n) => {
      indegree.set(n.id, 0);
      outgoing.set(n.id, []);
    });
    filtered.edges.forEach((e) => {
      if (!outgoing.has(e.fromId) || !outgoing.has(e.toId)) return;
      outgoing.get(e.fromId)!.push(e.toId);
      indegree.set(e.toId, (indegree.get(e.toId) || 0) + 1);
    });
    const queue: string[] = [];
    indegree.forEach((deg, id) => { if (deg === 0) queue.push(id); });
    const level = new Map<string, number>();
    queue.forEach((id) => level.set(id, 0));
    while (queue.length) {
      const id = queue.shift()!;
      const nextLevel = (level.get(id) || 0) + 1;
      (outgoing.get(id) || []).forEach((n) => {
        const current = level.get(n);
        if (current === undefined || nextLevel > current) level.set(n, nextLevel);
        indegree.set(n, (indegree.get(n) || 0) - 1);
        if ((indegree.get(n) || 0) === 0) queue.push(n);
      });
    }

    const grouped = new Map<number, string[]>();
    filtered.nodes.forEach((n) => {
      const l = level.get(n.id) ?? 0;
      if (!grouped.has(l)) grouped.set(l, []);
      grouped.get(l)!.push(n.id);
    });

    const positions = new Map<string, { x: number; y: number }>();
    const colWidth = 220;
    const rowHeight = 90;
    Array.from(grouped.entries()).forEach(([l, ids]) => {
      ids.forEach((id, idx) => {
        positions.set(id, { x: l * colWidth + 40, y: idx * rowHeight + 40 });
      });
    });

    return { positions, nodeMap };
  }, [filtered]);

  const edgesToRender = filtered.edges.map((e) => {
    const from = layout.positions.get(e.fromId);
    const to = layout.positions.get(e.toId);
    if (!from || !to) return null;
    const fromNode = layout.nodeMap.get(e.fromId);
    const toNode = layout.nodeMap.get(e.toId);
    const isCritical = !!fromNode?.isCritical && !!toNode?.isCritical;
    return { from, to, isCritical, id: `${e.fromId}-${e.toId}` };
  }).filter(Boolean) as Array<{ from: { x: number; y: number }; to: { x: number; y: number }; isCritical: boolean; id: string }>;

  const width = Math.max(600, Math.max(...Array.from(layout.positions.values()).map((p) => p.x + 180), 600));
  const height = Math.max(400, Math.max(...Array.from(layout.positions.values()).map((p) => p.y + 80), 400));

  if (cycleDetected) {
    return (
      <div className="p-4 border border-rose-200 bg-rose-50 text-rose-600 rounded-2xl text-sm">
        Dependency cycle detected. Graph view is disabled. Resolve cycles to view the DAG.
      </div>
    );
  }

  return (
    <div className="border border-slate-100 rounded-2xl p-4 bg-slate-50 overflow-auto">
      <svg width={width} height={height}>
        {edgesToRender.map((e) => (
          <line
            key={e.id}
            x1={e.from.x + 140}
            y1={e.from.y + 18}
            x2={e.to.x}
            y2={e.to.y + 18}
            stroke={e.isCritical ? '#ef4444' : '#cbd5f5'}
            strokeWidth={e.isCritical ? 2.5 : 1.2}
          />
        ))}
        {filtered.nodes.map((n) => {
          const pos = layout.positions.get(n.id);
          if (!pos) return null;
          const isCritical = n.isCritical;
          const isNear = n.isNearCritical;
          return (
            <g key={n.id} transform={`translate(${pos.x}, ${pos.y})`} onClick={() => onNodeClick?.(n.id)} style={{ cursor: 'pointer' }}>
              <rect
                width={160}
                height={36}
                rx={12}
                fill={isCritical ? '#fee2e2' : isNear ? '#fef9c3' : '#ffffff'}
                stroke={isCritical ? '#ef4444' : isNear ? '#f59e0b' : '#e2e8f0'}
              />
              <text x={8} y={14} fontSize={10} fontWeight={700} fill="#475569">{n.key || n.id}</text>
              <text x={8} y={28} fontSize={9} fill="#64748b">{n.title?.slice(0, 22)}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};

export default DependencyGraph;
