import React from 'react';
import type { RoadmapDependencyEdge } from './roadmapViewModels';

type MilestonePosition = {
  id: string;
  xStart: number;
  xEnd: number;
  y: number;
};

const DependencyLayer: React.FC<{
  width: number;
  height: number;
  edges: RoadmapDependencyEdge[];
  positions: Record<string, MilestonePosition>;
}> = ({ width, height, edges, positions }) => {
  const paths = edges.map((edge) => {
    const from = positions[edge.fromMilestoneId];
    const to = positions[edge.toMilestoneId];
    if (!from || !to) return null;
    const startX = from.xEnd;
    const startY = from.y;
    const endX = to.xStart;
    const endY = to.y;
    const midX = (startX + endX) / 2;
    const path = `M ${startX} ${startY} C ${midX} ${startY}, ${midX} ${endY}, ${endX} ${endY}`;
    const risk = edge.blockedCount >= 3 ? 'high' : edge.blockedCount > 0 ? 'medium' : 'low';
    const stroke = risk === 'high' ? '#f97316' : risk === 'medium' ? '#f59e0b' : '#94a3b8';
    return { key: `${edge.fromMilestoneId}-${edge.toMilestoneId}`, path, stroke, edge };
  }).filter(Boolean) as Array<{ key: string; path: string; stroke: string; edge: RoadmapDependencyEdge }>;

  if (!paths.length) return null;

  return (
    <svg className="absolute inset-0 pointer-events-auto" width={width} height={height}>
      <defs>
        <marker id="arrow-normal" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
          <path d="M0,0 L8,4 L0,8 Z" fill="#94a3b8" />
        </marker>
        <marker id="arrow-warn" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
          <path d="M0,0 L8,4 L0,8 Z" fill="#f59e0b" />
        </marker>
        <marker id="arrow-risk" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
          <path d="M0,0 L8,4 L0,8 Z" fill="#f97316" />
        </marker>
      </defs>
      {paths.map(({ key, path, stroke, edge }) => (
        <path
          key={key}
          d={path}
          fill="none"
          stroke={stroke}
          strokeWidth={1.5}
          strokeDasharray={edge.blockedCount > 0 ? '4 3' : '0'}
          markerEnd={`url(#${stroke === '#f97316' ? 'arrow-risk' : stroke === '#f59e0b' ? 'arrow-warn' : 'arrow-normal'})`}
        >
          <title>{`Dependency ${edge.fromMilestoneId} → ${edge.toMilestoneId} • Blocked items ${edge.blockedCount}`}</title>
        </path>
      ))}
    </svg>
  );
};

export default DependencyLayer;
