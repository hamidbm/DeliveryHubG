
import * as d3 from 'd3-hierarchy';
import { MindMapDsl, MindMapNodeData } from './mindmapDsl';
import { Node, Edge, MarkerType } from 'reactflow';

export function computeMindMapLayout(dsl: MindMapDsl): { nodes: Node[]; edges: Edge[] } {
  const { root, meta } = dsl;
  
  // 1. Create d3 hierarchy
  const hierarchy = d3.hierarchy<MindMapNodeData>(root);
  
  // 2. Compute tree layout
  // In d3.tree, x is the breadth and y is the depth.
  // For radial, x maps to angle (0 to 2*PI) and y maps to radius.
  const treeLayout = d3.tree<MindMapNodeData>()
    .size([2 * Math.PI, hierarchy.height * meta.radiusStep])
    .separation((a, b) => (a.parent === b.parent ? 1 : 2) / a.depth);
    
  const rootNode = treeLayout(hierarchy);
  
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  
  rootNode.descendants().forEach((d) => {
    const angle = d.x - Math.PI / 2;
    const radius = d.y;
    
    // Polar to Cartesian
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    
    nodes.push({
      id: d.data.id,
      type: 'mindmapNode',
      position: { x, y },
      data: { 
        ...d.data,
        isRoot: d.depth === 0,
        level: d.depth
      },
    });
    
    if (d.parent) {
      const parentAccent = d.parent.data.style?.accent || '#cbd5e1';
      const nodeAccent = d.data.style?.accent || parentAccent;
      
      edges.push({
        id: `e-${d.parent.data.id}-${d.data.id}`,
        source: d.parent.data.id,
        target: d.data.id,
        type: 'smoothstep',
        animated: false,
        style: { 
          stroke: nodeAccent, 
          strokeWidth: 2, 
          opacity: 0.6 
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: nodeAccent,
          width: 15,
          height: 15
        }
      });
    }
  });
  
  return { nodes, edges };
}
