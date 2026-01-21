
import * as d3 from 'd3-hierarchy';
import { MindMapDsl, MindMapNodeData } from './mindmapDsl';
import { Node, Edge, MarkerType, Position } from 'reactflow';

export function computeMindMapLayout(dsl: MindMapDsl): { nodes: Node[]; edges: Edge[] } {
  const { root, meta } = dsl;
  const nodeWidth = meta.nodeWidth || 220;
  const nodeHeight = meta.nodeHeight || 68;
  const radiusStep = meta.radiusStep || 280;
  
  // 1. Create d3 hierarchy
  const hierarchy = d3.hierarchy<MindMapNodeData>(root);
  
  // 2. Compute tree layout
  // x in d3.tree size is the angular range (0 to 2*PI)
  // y in d3.tree size is the radial distance
  const treeLayout = d3.tree<MindMapNodeData>()
    .size([2 * Math.PI, hierarchy.height * radiusStep])
    .separation((a, b) => {
      // Increase separation for nodes at deeper levels to avoid overlap
      const sep = (a.parent === b.parent ? 1.2 : 2.0);
      return sep / (a.depth || 1);
    });
    
  const rootNode = treeLayout(hierarchy);
  
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  
  rootNode.descendants().forEach((d) => {
    // d.x is the angle, d.y is the radius
    // Subtract PI/2 to make the first branch start at the top (12 o'clock)
    const angle = d.x - Math.PI / 2;
    const radius = d.y;
    
    // Polar to Cartesian conversion
    const centerX = Math.cos(angle) * radius;
    const centerY = Math.sin(angle) * radius;
    
    // CRITICAL: Convert center-point to top-left position for React Flow
    // If we don't subtract half the width/height, nodes won't be centered on the lines
    const x = centerX - nodeWidth / 2;
    const y = centerY - nodeHeight / 2;

    // Determine optimal handle positions based on the node's quadrant
    // This makes the Bezier curves look natural instead of like "elbows"
    const normAngle = (d.x) % (2 * Math.PI);
    let targetPos = Position.Top;
    let sourcePos = Position.Bottom;

    if (d.depth > 0) {
      if (normAngle < Math.PI / 4 || normAngle > 7 * Math.PI / 4) {
        // Top quadrant
        targetPos = Position.Top;
        sourcePos = Position.Bottom;
      } else if (normAngle >= Math.PI / 4 && normAngle < 3 * Math.PI / 4) {
        // Right quadrant
        targetPos = Position.Left;
        sourcePos = Position.Right;
      } else if (normAngle >= 3 * Math.PI / 4 && normAngle < 5 * Math.PI / 4) {
        // Bottom quadrant
        targetPos = Position.Bottom;
        sourcePos = Position.Top;
      } else {
        // Left quadrant
        targetPos = Position.Right;
        sourcePos = Position.Left;
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
      // Ensure the style block passed to React Flow matches our intended size
      style: { width: nodeWidth, height: nodeHeight }
    });
    
    if (d.parent) {
      const edgeColor = d.data.style?.accent || d.parent.data.style?.accent || '#cbd5e1';
      
      edges.push({
        id: `e-${d.parent.data.id}-${d.data.id}`,
        source: d.parent.data.id,
        target: d.data.id,
        type: 'default', // Standard Bezier curve
        style: { 
          stroke: edgeColor, 
          strokeWidth: 2, 
          opacity: 0.8
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: edgeColor,
          width: 15,
          height: 15
        }
      });
    }
  });
  
  return { nodes, edges };
}
