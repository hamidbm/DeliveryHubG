
'use client';

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import ReactFlow, { 
  ReactFlowProvider, 
  Background, 
  Controls, 
  MiniMap, 
  useNodesState, 
  useEdgesState,
  ConnectionLineType,
  FitViewOptions,
  Panel
} from 'reactflow';
import 'reactflow/dist/style.css';
import { safeMindMapParse, DEFAULT_MINDMAP_JSON, MindMapDsl } from '../lib/mindmapDsl';
import { computeMindMapLayout } from '../lib/mindmapLayout';
import { exportMindMapAsSvg, exportMindMapAsPng } from '../lib/mindmapExport';
import MindMapNode from './MindMapNode';

const nodeTypes = {
  mindmapNode: MindMapNode,
};

const fitViewOptions: FitViewOptions = {
  padding: 0.2,
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

  const updateLayout = useCallback((text: string) => {
    const { data, error } = safeMindMapParse(text);
    if (error) {
      setError(error);
      return;
    }
    setError(null);
    if (data) {
      const { nodes: newNodes, edges: newEdges } = computeMindMapLayout(data);
      setNodes(newNodes);
      setEdges(newEdges);
    }
  }, [setNodes, setEdges]);

  // Handle initial load and external updates
  useEffect(() => {
    updateLayout(initialContent || DEFAULT_MINDMAP_JSON);
    setJsonText(initialContent || DEFAULT_MINDMAP_JSON);
  }, [initialContent, updateLayout]);

  const handleJsonChange = (val: string) => {
    setJsonText(val);
    updateLayout(val);
  };

  const handleFormat = () => {
    try {
      const obj = JSON.parse(jsonText);
      const formatted = JSON.stringify(obj, null, 2);
      setJsonText(formatted);
    } catch (e) {}
  };

  const handleReset = () => {
    if (confirm("Reset to sample blueprint? All local changes will be lost.")) {
      setJsonText(DEFAULT_MINDMAP_JSON);
      updateLayout(DEFAULT_MINDMAP_JSON);
    }
  };

  const handleExportSvg = () => exportMindMapAsSvg('mindmap-canvas', 'nexus-mindmap');

  return (
    <div className="flex-1 flex overflow-hidden h-full bg-white relative">
      {!readOnly && (
        <div className={`transition-all duration-300 ease-in-out border-r border-slate-200 bg-slate-900 flex flex-col shrink-0 ${isSidebarOpen ? 'w-1/3' : 'w-0 opacity-0'}`}>
          <header className="px-6 py-4 border-b border-white/10 flex items-center justify-between bg-black/20">
            <span className="text-[10px] font-black text-blue-400 uppercase tracking-[0.2em]">Source Registry (JSON)</span>
            <div className="flex gap-2">
              <button onClick={handleFormat} className="text-[9px] font-black text-slate-400 hover:text-white uppercase">Format</button>
              <button onClick={handleReset} className="text-[9px] font-black text-red-400 hover:text-red-300 uppercase">Reset</button>
            </div>
          </header>
          
          <div className="flex-1 overflow-hidden">
            <textarea
              value={jsonText}
              onChange={(e) => handleJsonChange(e.target.value)}
              className="w-full h-full bg-transparent text-emerald-400 font-mono text-sm p-8 outline-none resize-none custom-scrollbar selection:bg-emerald-500/20"
              spellCheck={false}
              placeholder="Enter Mind Map JSON..."
            />
          </div>

          {error && (
            <div className="p-6 bg-red-950/50 border-t border-red-500/30">
               <div className="flex gap-3 text-red-400">
                  <i className="fas fa-triangle-exclamation text-sm mt-0.5"></i>
                  <p className="text-xs font-bold leading-relaxed">{error}</p>
               </div>
            </div>
          )}

          <footer className="p-6 border-t border-white/5 flex gap-3 bg-black/10">
             <button 
              onClick={() => onSave(jsonText)}
              className="flex-1 py-3 bg-blue-600 text-white text-[10px] font-black rounded-xl uppercase tracking-widest shadow-xl hover:bg-blue-500 transition-all active:scale-95"
             >
               Commit Changes
             </button>
          </footer>
        </div>
      )}

      <div className="flex-1 relative bg-[#FDFDFD]">
        <button 
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className={`absolute left-0 top-1/2 -translate-y-1/2 z-[60] w-6 h-20 bg-slate-800 text-white rounded-r-xl flex items-center justify-center hover:bg-blue-600 transition-all ${readOnly ? 'hidden' : ''}`}
        >
          <i className={`fas fa-chevron-${isSidebarOpen ? 'left' : 'right'} text-[10px]`}></i>
        </button>

        <ReactFlow
          id="mindmap-canvas"
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          connectionLineType={ConnectionLineType.SmoothStep}
          fitView
          fitViewOptions={fitViewOptions}
          panOnDrag={true}
          selectionOnDrag={true}
          zoomOnScroll={true}
          nodesDraggable={!readOnly}
          className="mindmap-flow"
        >
          <Background color="#cbd5e1" gap={32} />
          <Controls className="bg-white shadow-xl rounded-xl border-slate-100" />
          <MiniMap 
            nodeColor={(n) => (n.data?.style?.accent || '#3b82f6')} 
            maskColor="rgb(241, 245, 249, 0.6)"
            className="rounded-2xl border border-slate-100 shadow-2xl"
          />
          
          <Panel position="top-right" className="flex gap-2">
             <button 
               onClick={handleExportSvg}
               className="bg-white border border-slate-200 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 shadow-lg flex items-center gap-2"
             >
               <i className="fas fa-file-export text-blue-600"></i> Export SVG
             </button>
             <button 
               onClick={() => exportMindMapAsPng('mindmap-canvas', 'nexus-mindmap')}
               className="bg-white border border-slate-200 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 shadow-lg flex items-center gap-2"
             >
               <i className="fas fa-image text-emerald-600"></i> PNG
             </button>
          </Panel>
        </ReactFlow>
      </div>

      {/* Fix: Replaced style jsx with standard style tag and dangerouslySetInnerHTML for compatibility */}
      <style dangerouslySetInnerHTML={{ __html: `
        .react-flow__edge-path {
          stroke-dasharray: 0;
          stroke-linecap: round;
        }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
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
