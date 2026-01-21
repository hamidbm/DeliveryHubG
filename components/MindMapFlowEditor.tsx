
'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import ReactFlow, { 
  ReactFlowProvider, 
  Background, 
  Controls, 
  MiniMap, 
  useNodesState, 
  useEdgesState,
  useReactFlow,
  Panel
} from 'reactflow';
import { safeMindMapParse, DEFAULT_MINDMAP_JSON } from '../lib/mindmapDsl';
import { computeMindMapLayout } from '../lib/mindmapLayout';
import { exportMindMapAsSvg, exportMindMapAsPng } from '../lib/mindmapExport';
import MindMapNode from './MindMapNode';

const nodeTypes = {
  mindmapNode: MindMapNode,
};

const fitViewOptions = {
  padding: 0.25,
  duration: 800,
};

interface MindMapFlowEditorProps {
  initialContent: string;
  onSave: (content: string) => void;
  readOnly?: boolean;
}

const MindMapFlowEditor: React.FC<MindMapFlowEditorProps> = ({ initialContent, onSave, readOnly = false }) => {
  const [jsonText, setJsonText] = useState(initialContent || DEFAULT_MINDMAP_JSON);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [error, setError] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(!readOnly);
  const { fitView } = useReactFlow();
  
  // Fix: Used ReturnType<typeof setTimeout> instead of NodeJS.Timeout to resolve namespace error in browser environment.
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const performLayoutUpdate = useCallback((text: string) => {
    const { data, error: parseError } = safeMindMapParse(text);
    
    if (parseError) {
      setError(parseError);
      return;
    }
    
    setError(null);
    if (data) {
      const { nodes: newNodes, edges: newEdges } = computeMindMapLayout(data);
      setNodes(newNodes);
      setEdges(newEdges);
      
      // CRITICAL: Fit view using double RAF to ensure DOM has settled with node dimensions
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          fitView(fitViewOptions);
        });
      });
    }
  }, [setNodes, setEdges, fitView]);

  useEffect(() => {
    const content = initialContent || DEFAULT_MINDMAP_JSON;
    setJsonText(content);
    performLayoutUpdate(content);
  }, [initialContent, performLayoutUpdate]);

  const handleJsonChange = (val: string) => {
    setJsonText(val);
    
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    
    debounceTimerRef.current = setTimeout(() => {
      performLayoutUpdate(val);
    }, 400); // 400ms debounce
  };

  const handleFormat = () => {
    try {
      const obj = JSON.parse(jsonText);
      setJsonText(JSON.stringify(obj, null, 2));
    } catch (e) {}
  };

  return (
    <div className="flex-1 flex overflow-hidden h-full bg-slate-50 relative">
      {!readOnly && (
        <div className={`transition-all duration-500 ease-in-out border-r border-slate-200 bg-slate-900 flex flex-col shrink-0 z-50 ${isSidebarOpen ? 'w-[450px]' : 'w-0 opacity-0'}`}>
          <header className="px-8 py-6 border-b border-white/10 flex items-center justify-between bg-black/20">
            <div className="flex flex-col">
              <span className="text-[10px] font-black text-blue-400 uppercase tracking-[0.2em]">Blueprint Logic</span>
              <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest">Radial Engine v2.0</span>
            </div>
            <div className="flex gap-3">
              <button onClick={handleFormat} className="text-[10px] font-black text-slate-400 hover:text-white uppercase transition-colors">Format</button>
            </div>
          </header>
          
          <div className="flex-1 overflow-hidden">
            <textarea
              value={jsonText}
              onChange={(e) => handleJsonChange(e.target.value)}
              className="w-full h-full bg-transparent text-emerald-400 font-mono text-sm p-10 outline-none resize-none custom-scrollbar selection:bg-emerald-500/20"
              spellCheck={false}
              placeholder="Paste JSON DSL here..."
            />
          </div>

          {error && (
            <div className="p-6 bg-red-950/40 border-t border-red-500/20">
               <div className="flex gap-4 text-red-400">
                  <i className="fas fa-triangle-exclamation text-xl"></i>
                  <p className="text-xs font-bold leading-relaxed">{error}</p>
               </div>
            </div>
          )}

          <footer className="p-8 border-t border-white/5 bg-black/30">
             <button 
              onClick={() => onSave(jsonText)}
              className="w-full py-4 bg-blue-600 text-white text-[11px] font-black rounded-2xl uppercase tracking-widest shadow-2xl hover:bg-blue-500 transition-all active:scale-95"
             >
               Commit Visual Logic
             </button>
          </footer>
        </div>
      )}

      <div className="flex-1 relative bg-white">
        {!readOnly && (
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="absolute left-0 top-1/2 -translate-y-1/2 z-[60] w-8 h-24 bg-slate-900 text-white rounded-r-2xl flex items-center justify-center hover:bg-blue-600 transition-all shadow-2xl"
          >
            <i className={`fas fa-chevron-${isSidebarOpen ? 'left' : 'right'} text-xs`}></i>
          </button>
        )}

        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          minZoom={0.05}
          maxZoom={2.0}
          nodesDraggable={!readOnly}
          panOnDrag={true}
          selectionOnDrag={true}
          className="mindmap-flow-engine"
        >
          <Background color="#f8fafc" gap={40} size={1} />
          <Controls className="bg-white shadow-2xl rounded-2xl border-none p-1" />
          <MiniMap 
            nodeStrokeColor={(n) => (n.data?.style?.accent || '#3b82f6')}
            nodeColor={(n) => (n.data?.style?.bg?.includes('linear-gradient') ? (n.data?.style?.accent || '#3b82f6') : (n.data?.style?.bg || '#ffffff'))}
            maskColor="rgba(248, 250, 252, 0.7)"
            className="rounded-[2rem] border border-slate-100 shadow-2xl overflow-hidden"
          />
          
          <Panel position="top-right" className="flex gap-3 m-6">
             <button 
               onClick={() => exportMindMapAsSvg('mindmap-canvas', 'blueprint-export')}
               className="bg-white border border-slate-100 px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 shadow-xl flex items-center gap-3 transition-all"
             >
               <i className="fas fa-file-export text-blue-600"></i> Export SVG
             </button>
             <button 
               onClick={() => exportMindMapAsPng('mindmap-canvas', 'blueprint-export')}
               className="bg-white border border-slate-100 px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 shadow-xl flex items-center gap-3 transition-all"
             >
               <i className="fas fa-image text-emerald-600"></i> PNG
             </button>
          </Panel>
        </ReactFlow>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .react-flow__edge-path { stroke-linecap: round; transition: stroke 0.3s; stroke-dasharray: 0; }
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #334155; border-radius: 10px; }
      `}} />
    </div>
  );
};

const MindMapFlowWithProvider = (props: MindMapFlowEditorProps) => (
  <ReactFlowProvider>
    <MindMapFlowEditor {...props} />
  </ReactFlowProvider>
);

export default MindMapFlowWithProvider;
