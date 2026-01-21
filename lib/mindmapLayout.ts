
import * as d3 from 'd3-hierarchy';
import { MindMapDsl, MindMapNodeData } from './mindmapDsl';
import { Node, Edge, Position } from 'reactflow';

export function computeMindMapLayout(dsl: MindMapDsl): { nodes: Node[]; edges: Edge[] } {
  const { root, meta } = dsl;
  const nodeWidth = meta.nodeWidth || 220;
  const nodeHeight = meta.nodeHeight || 68;
  
  // Dynamic radius based on node dimensions to ensure no collision
  const minRadiusStep = Math.max(meta.radiusStep || 260, nodeWidth * 1.1);
  
  // 1. Build D3 Hierarchy
  const hierarchy = d3.hierarchy<MindMapNodeData>(root);
  const maxDepth = hierarchy.height;
  
  // 2. Configure Tree Layout
  // x is angle [0, 2PI], y is radial distance
  const treeLayout = d3.tree<MindMapNodeData>()
    .size([2 * Math.PI, minRadiusStep * (maxDepth + 0.5)])
    .separation((a, b) => {
      // Increase separation at deeper levels to avoid outer clumping
      const baseSep = a.parent === b.parent ? 1.5 : 2.2;
      return baseSep / (a.depth || 1);
    });
    
  const rootNode = treeLayout(hierarchy);
  
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  
  rootNode.descendants().forEach((d) => {
    // d.x is angle, d.y is radius
    // We rotate by -PI/2 so the 0 angle starts at the top (12 o'clock)
    const angle = d.x - Math.PI / 2;
    const radius = d.y;
    
    // Polar to Cartesian
    const cx = Math.cos(angle) * radius;
    const cy = Math.sin(angle) * radius;
    
    // CRITICAL FIX: React Flow positions are TOP-LEFT.
    // We must offset the center coordinates by half the node dimensions.
    const x = cx - nodeWidth / 2;
    const y = cy - nodeHeight / 2;

    // 3. Intelligent Handle Orientation
    // Determine which side of the node faces "outward" from the root
    let sourcePos = Position.Bottom;
    let targetPos = Position.Top;

    if (d.depth > 0) {
      // Normalize angle to [-PI, PI] for easy quadrant check
      const normAngle = Math.atan2(Math.sin(angle), Math.cos(angle));
      
      if (normAngle >= -Math.PI / 4 && normAngle <= Math.PI / 4) {
        // Right side
        sourcePos = Position.Right;
        targetPos = Position.Left;
      } else if (normAngle > Math.PI / 4 && normAngle < 3 * Math.PI / 4) {
        // Bottom side
        sourcePos = Position.Bottom;
        targetPos = Position.Top;
      } else if (normAngle < -Math.PI / 4 && normAngle > -3 * Math.PI / 4) {
        // Top side
        sourcePos = Position.Top;
        targetPos = Position.Bottom;
      } else {
        // Left side
        sourcePos = Position.Left;
        targetPos = Position.Right;
      }
    }
    
    nodes.push({
      id: d.data.id,
      type: 'mindmapNode',
      position: { x, y },
      sourcePosition: sourcePos,
      targetPosition: targetPos,
      data: { 
        ...d.data,
        isRoot: d.depth === 0,
        level: d.depth,
        width: nodeWidth,
        height: nodeHeight
      },
      style: { width: nodeWidth, height: nodeHeight }
    });
    
    if (d.parent) {
      const parentAccent = d.parent.data.style?.accent || '#cbd5e1';
      const nodeAccent = d.data.style?.accent || parentAccent;
      
      edges.push({
        id: `e-${d.parent.data.id}-${d.data.id}`,
        source: d.parent.data.id,
        target: d.data.id,
        type: 'default', // Smooth Bezier
        style: { 
          stroke: nodeAccent, 
          strokeWidth: 2.5, 
          opacity: 0.75
        }
      });
    }
  });
  
  return { nodes, edges };
}
