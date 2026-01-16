
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ArchitectureDiagram, DiagramFormat, Application, Bundle } from '../types';
import mermaid from 'mermaid';

interface ArchitectureDiagramsProps {
  applications: Application[];
  bundles: Bundle[];
}

const MermaidRenderer: React.FC<{ content: string; id: string }> = ({ content, id }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  const render = useCallback(async () => {
    if (!containerRef.current || !content) return;
    try {
      containerRef.current.innerHTML = ''; // Clear previous
      const { svg } = await mermaid.render(`mermaid-${id}`, content);
      containerRef.current.innerHTML = svg;
    } catch (err) {
      containerRef.current.innerHTML = `<div class="p-10 text-red-500 bg-red-50 rounded-2xl border border-red-100 flex flex-col items-center">
        <i class="fas fa-triangle-exclamation text-2xl mb-2"></i>
        <p class="text-xs font-black uppercase">Syntax Error in Script</p>
      </div>`;
    }
  }, [content, id]);

  useEffect(() => {
    mermaid.initialize({ startOnLoad: false, theme: 'neutral' });
    render();
  }, [render]);

  return <div ref={containerRef} className="flex justify-center items-center w-full min-h-[300px]" />;
};

const ArchitectureDiagrams: React.FC<ArchitectureDiagramsProps> = ({ applications, bundles }) => {
  const [diagrams, setDiagrams] = useState<ArchitectureDiagram[]>([]);
  const [isDesignerOpen, setIsDesignerOpen] = useState(false);
  const [editingDiagram, setEditingDiagram] = useState<Partial<ArchitectureDiagram> | null>(null);
  const [loading, setLoading] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchDiagrams = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/architecture/diagrams');
      const data = await res.json();
      setDiagrams(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDiagrams();
  }, []);

  const openDesigner = (diag?: ArchitectureDiagram) => {
    setEditingDiagram(diag || {
      title: 'New Architecture Diagram',
      format: DiagramFormat.MERMAID,
      content: 'graph TD\n  Start --> Process\n  Process --> End',
      status: 'DRAFT'
    });
    setIsDesignerOpen(true);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const result = event.target?.result;
      if (typeof result !== 'string') return;

      const isDrawio = file.name.endsWith('.drawio') || file.name.endsWith('.xml');
      const format = isDrawio ? DiagramFormat.DRAWIO : DiagramFormat.IMAGE;
      
      const newDiagram: Partial<ArchitectureDiagram> = {
        title: file.name.replace(/\.[^/.]+$/, ""),
        format,
        content: result,
        status: 'DRAFT'
      };

      try {
        const res = await fetch('/api/architecture/diagrams', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newDiagram)
        });
        if (res.ok) fetchDiagrams();
      } catch (err) {
        alert("Upload failed");
      }
    };

    if (file.type.includes('image')) {
      reader.readAsDataURL(file);
    } else {
      reader.readAsText(file);
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Permanently delete this blueprint?")) return;
    await fetch(`/api/architecture/diagrams/${id}`, { method: 'DELETE' });
    fetchDiagrams();
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      {!isDesignerOpen ? (
        <div className="space-y-10">
          <header className="flex justify-between items-end">
            <div>
              <h2 className="text-4xl font-black text-slate-900 tracking-tighter uppercase italic">Architecture Canvas</h2>
              <p className="text-slate-400 font-medium text-lg">Visual blueprints, system sequence flows, and mind maps.</p>
            </div>
            <div className="flex gap-3">
               <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept=".drawio,.xml,image/*" />
               <button 
                 onClick={() => fileInputRef.current?.click()}
                 className="px-6 py-3 bg-white border border-slate-200 text-slate-600 text-[10px] font-black rounded-2xl uppercase tracking-widest hover:bg-slate-50 transition-all flex items-center gap-2"
               >
                 <i className="fas fa-cloud-arrow-up"></i> Upload Blueprint
               </button>
               <button 
                onClick={() => openDesigner()}
                className="px-8 py-3 bg-slate-900 text-white text-[10px] font-black rounded-2xl shadow-xl hover:bg-blue-600 transition-all uppercase tracking-widest flex items-center gap-2"
               >
                 <i className="fas fa-magic"></i> Launch Designer
               </button>
            </div>
          </header>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {loading ? [...Array(3)].map((_, i) => <div key={i} className="h-80 bg-slate-100 rounded-[2.5rem] animate-pulse"></div>) : 
             diagrams.length === 0 ? (
               <div className="col-span-full py-32 text-center bg-slate-50/50 border-2 border-dashed border-slate-100 rounded-[3rem]">
                  <i className="fas fa-pencil-ruler text-5xl mb-6 text-slate-200"></i>
                  <p className="text-sm font-black text-slate-400 uppercase tracking-widest">No visual artifacts established</p>
               </div>
             ) : diagrams.map(diag => (
              <div key={diag._id} className="bg-white border border-slate-200 rounded-[2.5rem] p-8 hover:shadow-2xl transition-all group cursor-pointer relative" onClick={() => openDesigner(diag)}>
                 <button 
                   onClick={(e) => handleDelete(diag._id!, e)}
                   className="absolute top-6 right-6 w-8 h-8 rounded-lg bg-slate-50 text-slate-300 hover:text-red-500 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all z-20"
                 >
                   <i className="fas fa-trash text-[10px]"></i>
                 </button>

                 <div className="flex justify-between items-start mb-6">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-lg ${
                      diag.format === DiagramFormat.MERMAID ? 'bg-indigo-500' : 'bg-emerald-500'
                    }`}>
                       <i className={`fas ${diag.format === DiagramFormat.MERMAID ? 'fa-code' : diag.format === DiagramFormat.DRAWIO ? 'fa-vector-square' : 'fa-image'}`}></i>
                    </div>
                    <span className={`px-3 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest border ${
                      diag.status === 'VERIFIED' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-blue-50 text-blue-600 border-blue-100'
                    }`}>
                      {diag.status}
                    </span>
                 </div>
                 <h4 className="text-lg font-black text-slate-800 mb-2 group-hover:text-blue-600 transition-colors truncate pr-10">{diag.title}</h4>
                 <div className="flex items-center gap-3 mb-6">
                    <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">{diag.format}</span>
                    <div className="w-1 h-1 rounded-full bg-slate-200"></div>
                    <span className="text-[10px] font-bold text-slate-400">Updated {new Date(diag.updatedAt).toLocaleDateString()}</span>
                 </div>
                 <div className="h-32 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-center overflow-hidden">
                    {diag.format === DiagramFormat.MERMAID ? (
                      <div className="scale-[0.4] origin-center opacity-40 pointer-events-none">
                         <MermaidRenderer content={diag.content} id={diag._id!} />
                      </div>
                    ) : diag.format === DiagramFormat.IMAGE ? (
                      <img src={diag.content} className="h-full w-full object-contain opacity-50 grayscale group-hover:grayscale-0 group-hover:opacity-100 transition-all" />
                    ) : (
                      <i className="fas fa-file-code text-slate-200 text-3xl opacity-50"></i>
                    )}
                 </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <ArchitectureDesigner 
          diagram={editingDiagram!} 
          onClose={() => setIsDesignerOpen(false)} 
          onSuccess={() => { setIsDesignerOpen(false); fetchDiagrams(); }}
          bundles={bundles}
          applications={applications}
        />
      )}
    </div>
  );
};

const ArchitectureDesigner: React.FC<{ 
  diagram: Partial<ArchitectureDiagram>; 
  onClose: () => void;
  onSuccess: () => void;
  bundles: Bundle[];
  applications: Application[];
}> = ({ diagram, onClose, onSuccess, bundles, applications }) => {
  const [code, setCode] = useState(diagram.content || '');
  const [title, setTitle] = useState(diagram.title || '');
  const [format, setFormat] = useState<DiagramFormat>(diagram.format || DiagramFormat.MERMAID);
  const [saving, setSaving] = useState(false);
  const [activeBundleId, setActiveBundleId] = useState(diagram.bundleId || '');
  const [activeAppId, setActiveAppId] = useState(diagram.applicationId || '');

  const handleCommit = async () => {
    if (!title.trim()) return alert("Title required");
    setSaving(true);
    try {
      const res = await fetch('/api/architecture/diagrams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...diagram,
          title,
          content: code,
          format,
          bundleId: activeBundleId,
          applicationId: activeAppId,
          status: 'VERIFIED'
        })
      });
      if (res.ok) onSuccess();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] bg-white flex flex-col animate-fadeIn">
      <header className="px-10 py-5 bg-white border-b border-slate-200 flex items-center justify-between shadow-sm shrink-0">
        <div className="flex items-center gap-6">
          <button onClick={onClose} className="w-10 h-10 rounded-full bg-slate-50 hover:bg-slate-100 flex items-center justify-center text-slate-400 border border-slate-100 transition-all"><i className="fas fa-times"></i></button>
          <div className="flex flex-col">
            <span className="text-[9px] font-black text-blue-600 uppercase tracking-widest mb-1">Architecture Designer</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className="text-2xl font-black text-slate-800 border-none p-0 focus:ring-0 outline-none bg-transparent w-[400px]" placeholder="Untitled Flow" />
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 mr-4 shadow-inner">
            {[DiagramFormat.MERMAID, DiagramFormat.DRAWIO, DiagramFormat.MINDMAP].map(fmt => (
              <button 
                key={fmt}
                onClick={() => setFormat(fmt)}
                className={`px-4 py-2 text-[9px] font-black uppercase rounded-lg transition-all ${format === fmt ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}
              >
                {fmt}
              </button>
            ))}
          </div>
          <button 
            onClick={handleCommit}
            disabled={saving}
            className="px-10 py-3.5 bg-slate-900 text-white rounded-2xl shadow-xl font-black text-[10px] uppercase tracking-widest flex items-center gap-3 active:scale-95 transition-all"
          >
            {saving ? <i className="fas fa-circle-notch fa-spin"></i> : <i className="fas fa-save"></i>} 
            {saving ? 'Processing...' : 'Commit to Registry'}
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden bg-slate-50">
        {/* Editor Pane */}
        <div className="w-1/3 flex flex-col bg-slate-900 shadow-2xl relative z-10">
           <div className="px-6 py-3 border-b border-white/5 flex items-center justify-between bg-black/20">
              <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Source Editor</span>
              <div className="flex gap-2">
                 <div className="w-2 h-2 rounded-full bg-red-500/50"></div>
                 <div className="w-2 h-2 rounded-full bg-amber-500/50"></div>
                 <div className="w-2 h-2 rounded-full bg-emerald-500/50"></div>
              </div>
           </div>
           <textarea 
            value={code}
            onChange={(e) => setCode(e.target.value)}
            disabled={format === DiagramFormat.IMAGE}
            className="flex-1 w-full bg-transparent text-emerald-400 font-mono text-sm p-8 outline-none resize-none custom-scrollbar"
            placeholder={format === DiagramFormat.MERMAID ? "Enter Mermaid.js logic here..." : "XML / Content data..."}
           />
           <div className="p-6 bg-black/20 border-t border-white/5">
              <h5 className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-2">Editor Quick-Links</h5>
              <div className="flex flex-wrap gap-2">
                 <button onClick={() => setCode('graph TD\n  A[Client] --> B[API Gateway]\n  B --> C{Auth}\n  C -->|Pass| D[Service]\n  C -->|Fail| E[Reject]')} className="px-3 py-1 bg-white/5 rounded-lg text-[8px] text-slate-400 hover:text-white transition-colors">Flowchart Template</button>
                 <button onClick={() => setCode('sequenceDiagram\n  Alice->>John: Hello John, how are you?\n  John-->>Alice: Great!')} className="px-3 py-1 bg-white/5 rounded-lg text-[8px] text-slate-400 hover:text-white transition-colors">Sequence Template</button>
                 <button onClick={() => setCode('mindmap\n  root((Artifacts))\n    Requirement\n    Design\n    Testing')} className="px-3 py-1 bg-white/5 rounded-lg text-[8px] text-slate-400 hover:text-white transition-colors">Mindmap Template</button>
              </div>
           </div>
        </div>

        {/* Preview Pane */}
        <div className="flex-1 overflow-hidden flex flex-col">
           <div className="px-10 py-6 border-b border-slate-200 bg-white/50 backdrop-blur flex items-center justify-between">
              <div className="flex items-center gap-4">
                 <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Live Canvas</span>
                 <div className="px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-[8px] font-black uppercase">Live Synchronization</div>
              </div>
              <div className="flex gap-2">
                 <button className="w-9 h-9 rounded-xl bg-white border border-slate-200 text-slate-400 hover:text-blue-600 shadow-sm flex items-center justify-center transition-all"><i className="fas fa-magnifying-glass-plus"></i></button>
                 <button className="w-9 h-9 rounded-xl bg-white border border-slate-200 text-slate-400 hover:text-blue-600 shadow-sm flex items-center justify-center transition-all"><i className="fas fa-expand"></i></button>
                 <button className="w-9 h-9 rounded-xl bg-white border border-slate-200 text-slate-400 hover:text-blue-600 shadow-sm flex items-center justify-center transition-all"><i className="fas fa-download"></i></button>
              </div>
           </div>
           
           <div className="flex-1 overflow-auto p-20 flex items-center justify-center custom-scrollbar">
              <div className="bg-white rounded-[3rem] p-16 shadow-[0_50px_100px_rgba(0,0,0,0.05)] border border-slate-100 min-w-[600px] min-h-[400px] flex flex-col items-center justify-center relative overflow-hidden transition-all duration-700">
                 <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 0)', backgroundSize: '30px 30px' }}></div>
                 
                 <div className="relative z-10 w-full">
                   {format === DiagramFormat.MERMAID || format === DiagramFormat.MINDMAP ? (
                     <MermaidRenderer content={code} id="preview" />
                   ) : format === DiagramFormat.IMAGE ? (
                     <img src={code} className="max-w-full h-auto shadow-2xl rounded-2xl" />
                   ) : (
                     <div className="text-center">
                        <pre className="text-slate-400 font-bold mb-10 text-lg opacity-40">XML Core Visualization Active</pre>
                        <i className="fas fa-vector-square text-6xl text-slate-100 mb-4"></i>
                        <p className="mt-10 text-[10px] font-black text-slate-300 uppercase tracking-[0.4em]">Rendering logic for {format}...</p>
                     </div>
                   )}
                 </div>
              </div>
           </div>
        </div>

        {/* Sidebar Metadata */}
        <aside className="w-80 border-l border-slate-200 bg-white p-8 space-y-10 overflow-y-auto custom-scrollbar">
           <div>
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2"><i className="fas fa-link"></i> Mapping Context</h4>
              <div className="space-y-6">
                 <div className="space-y-2">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Business Cluster</label>
                    <select value={activeBundleId} onChange={(e) => setActiveBundleId(e.target.value)} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-3 text-xs font-bold text-slate-700">
                       <option value="">Cross-Bundle</option>
                       {bundles.map(b => <option key={b._id} value={b._id}>{b.name}</option>)}
                    </select>
                 </div>
                 <div className="space-y-2">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Asset Context</label>
                    <select value={activeAppId} onChange={(e) => setActiveAppId(e.target.value)} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-3 text-xs font-bold text-slate-700">
                       <option value="">Full Cluster Scope</option>
                       {applications.filter(a => !activeBundleId || a.bundleId === activeBundleId).map(a => <option key={a._id} value={a._id}>{a.name}</option>)}
                    </select>
                 </div>
              </div>
           </div>

           <div className="pt-10 border-t border-slate-50">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2"><i className="fas fa-robot"></i> AI Reviewer</h4>
              <div className="bg-blue-50 border border-blue-100 rounded-[1.5rem] p-6 space-y-4">
                 <p className="text-[10px] text-blue-700 font-medium leading-relaxed italic">"Diagram synthesis analysis active. Press refresh to evaluate blueprint for interface consistency."</p>
                 <button className="w-full py-2 bg-blue-600 text-white text-[9px] font-black uppercase rounded-lg shadow-lg active:scale-95 transition-all">Evaluate Layout</button>
              </div>
           </div>
        </aside>
      </div>
      
      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
      `}</style>
    </div>
  );
};

export default ArchitectureDiagrams;
