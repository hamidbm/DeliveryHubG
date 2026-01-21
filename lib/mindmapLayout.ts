
import * as d3 from 'd3-hierarchy';
import { MindMapDsl, MindMapNodeData } from './mindmapDsl';
import { Node, Edge, Position } from 'reactflow';

export function computeMindMapLayout(dsl: MindMapDsl): { nodes: Node[]; edges: Edge[] } {
  const { root, meta } = dsl;
  const nodeWidth = meta.nodeWidth || 220;
  const nodeHeight = meta.nodeHeight || 68;
  const radiusStep = meta.radiusStep || 260;
  
  // 1. Create d3 hierarchy
  const hierarchy = d3.hierarchy<MindMapNodeData>(root);
  const maxDepth = hierarchy.height;
  
  // radius is based on depth
  const totalRadius = radiusStep * (maxDepth + 0.5);

  // 2. Compute tree layout in radial space
  // x is the angle (0 to 2PI), y is the radius
  const treeLayout = d3.tree<MindMapNodeData>()
    .size([2 * Math.PI, totalRadius])
    .separation((a, b) => {
      // Provide more angular separation as we go deeper to prevent outer crowding
      const baseSep = (a.parent === b.parent ? 1.2 : 2.0);
      return baseSep / (a.depth || 1);
    });
    
  const rootNode = treeLayout(hierarchy);
  
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  
  rootNode.descendants().forEach((d) => {
    // d.x is angle, d.y is radius
    // Rotate by -PI/2 so the first branch starts at the top (12 o'clock)
    const angle = d.x - Math.PI / 2;
    const radius = d.y;
    
    // Polar to Cartesian
    const cx = Math.cos(angle) * radius;
    const cy = Math.sin(angle) * radius;
    
    // Convert center coordinate to React Flow top-left coordinate
    const x = cx - nodeWidth / 2;
    const y = cy - nodeHeight / 2;

    // 3. Intelligent Handle Routing based on node position relative to center
    // We determine quadrant to make bezier curves look natural (flowing outward)
    let sourcePos = Position.Bottom;
    let targetPos = Position.Top;

    if (d.depth > 0) {
      const normAngle = (d.x) % (2 * Math.PI);
      
      // Determine if node is primarily on Left, Right, Top, or Bottom of the root
      if (normAngle < Math.PI / 4 || normAngle > 7 * Math.PI / 4) {
        // Top Quadrant
        targetPos = Position.Bottom;
        sourcePos = Position.Top;
      } else if (normAngle >= Math.PI / 4 && normAngle < 3 * Math.PI / 4) {
        // Right Quadrant
        targetPos = Position.Left;
        sourcePos = Position.Right;
      } else if (normAngle >= 3 * Math.PI / 4 && normAngle < 5 * Math.PI / 4) {
        // Bottom Quadrant
        targetPos = Position.Top;
        sourcePos = Position.Bottom;
      } else {
        // Left Quadrant
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
          opacity: 0.7 
        },
        // Mind maps usually look cleaner without large arrowheads
      });
    }
  });
  
  return { nodes, edges };
}
