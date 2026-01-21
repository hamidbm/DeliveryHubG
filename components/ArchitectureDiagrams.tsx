
import React, { useState, useEffect, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { ArchitectureDiagram, DiagramFormat, Application, Bundle, Milestone } from '../types';
import mermaid from 'mermaid';

// Dynamically import the heavy MindMap Flow editor
const MindMapFlowEditor = dynamic(() => import('./MindMapFlowEditor'), { 
  ssr: false,
  loading: () => (
    <div className="flex-1 flex flex-col items-center justify-center bg-slate-50 gap-4">
      <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Loading Flow Engine...</p>
    </div>
  )
});

interface ArchitectureDiagramsProps {
  applications: Application[];
  bundles: Bundle[];
  activeBundleId?: string;
  activeAppId?: string;
}

const DEFAULT_MERMAID_CODE = 'graph TD\n  Start --> Process\n  Process --> End';
const DEFAULT_DRAWIO_XML = '<mxfile><diagram id="page-1" name="Page-1"><mxGraphModel dx="1000" dy="1000" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="827" pageHeight="1169" math="0" shadow="0"><root><mxCell id="0"/><mxCell id="1" parent="0"/></root></mxGraphModel></diagram></mxfile>';

const MermaidRenderer: React.FC<{ content: string; id: string }> = ({ content, id }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  const render = useCallback(async () => {
    if (!containerRef.current || !content || content.trim().startsWith('{') || content.trim().startsWith('<')) return;
    try {
      containerRef.current.innerHTML = ''; 
      const safeId = `mermaid-${id.replace(/[^a-zA-Z0-9]/g, '-')}-${Math.floor(Math.random() * 10000)}`;
      const { svg } = await mermaid.render(safeId, content);
      containerRef.current.innerHTML = svg;
      
      const svgEl = containerRef.current.querySelector('svg');
      if (svgEl) {
        svgEl.style.width = '100%';
        svgEl.style.height = 'auto';
        svgEl.style.maxWidth = '100%';
      }
    } catch (err) {
      containerRef.current.innerHTML = `<div class="p-10 text-red-500 bg-red-50 rounded-2xl border border-red-100 flex flex-col items-center">
        <i class="fas fa-triangle-exclamation text-2xl mb-2"></i>
        <p class="text-[10px] font-black uppercase tracking-widest">Mermaid Syntax Error</p>
      </div>`;
    }
  }, [content, id]);

  useEffect(() => {
    mermaid.initialize({ 
      startOnLoad: false, 
      theme: 'neutral',
      securityLevel: 'loose',
      fontFamily: 'Inter'
    });
    render();
  }, [render]);

  return <div ref={containerRef} className="flex justify-center items-center w-full h-full min-h-[400px]" />;
};

const DrawioEditor: React.FC<{ 
  xml: string; 
  onSave: (xml: string) => void;
  requestExportTrigger?: number;
  readOnly?: boolean;
}> = ({ xml, onSave, requestExportTrigger, readOnly = false }) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const xmlRef = useRef(xml);
  const onSaveRef = useRef(onSave);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    xmlRef.current = xml;
    onSaveRef.current = onSave;
  }, [xml, onSave]);

  useEffect(() => {
    if (requestExportTrigger && requestExportTrigger > 0 && isReady) {
      iframeRef.current?.contentWindow?.postMessage(JSON.stringify({
        action: 'export',
        format: 'xml'
      }), '*');
    }
  }, [requestExportTrigger, isReady]);

  useEffect(() => {
    const handleMessage = (evt: MessageEvent) => {
      if (evt.origin !== 'https://embed.diagrams.net') return;
      
      try {
        const data = typeof evt.data === 'string' ? JSON.parse(evt.data) : evt.data;
        const iframe = iframeRef.current;
        if (!iframe || !iframe.contentWindow) return;

        if (data.event === 'configure') {
          iframe.contentWindow.postMessage(JSON.stringify({
            action: 'configure',
            config: { 
              defaultFonts: ["Inter", "Helvetica", "Arial"],
              ui: 'atlas'
            }
          }), '*');
        } else if (data.event === 'init') {
          setIsReady(true);
          iframe.contentWindow.postMessage(JSON.stringify({
            action: 'load',
            xml: xmlRef.current || '',
            autosave: 1
          }), '*');
        } else if (data.event === 'save' || data.event === 'autosave' || data.event === 'export') {
          if (data.xml) {
            onSaveRef.current(data.xml);
          }
          if (data.event === 'save' || data.event === 'export') {
             iframe.contentWindow.postMessage(JSON.stringify({
               action: 'status',
               message: 'Nexus Registry Synchronized',
               modified: false
             }), '*');
          }
        }
      } catch (e) {}
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const baseUrl = "https://embed.diagrams.net/?embed=1&ui=atlas&spin=1&proto=json&configure=1";
  const url = readOnly ? `${baseUrl}&lightbox=1` : baseUrl;

  return (
    <div className="absolute inset-0 w-full h-full bg-white">
      <iframe
        ref={iframeRef}
        className="w-full h-full border-none"
        src={url}
        title="Draw.io Editor"
      />
    </div>
  );
};

const ArchitectureDiagrams: React.FC<ArchitectureDiagramsProps> = ({ applications, bundles, activeBundleId, activeAppId }) => {
  const [diagrams, setDiagrams] = useState<ArchitectureDiagram[]>([]);
  const [isDesignerOpen, setIsDesignerOpen] = useState(false);
  const [editingDiagram, setEditingDiagram] = useState<Partial<ArchitectureDiagram> | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchDiagrams = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (activeBundleId && activeBundleId !== 'all') params.set('bundleId', activeBundleId);
      if (activeAppId && activeAppId !== 'all') params.set('applicationId', activeAppId);
      
      const res = await fetch(`/api/architecture/diagrams?${params.toString()}`);
      const data = await res.json();
      setDiagrams(Array.isArray(data) ? data : []);
    } catch (e) {
      setDiagrams([]);
    } finally {
      setLoading(false);
    }
  }, [activeBundleId, activeAppId]);

  useEffect(() => {
    fetchDiagrams();
  }, [fetchDiagrams]);

  const openDesigner = (diag?: ArchitectureDiagram, edit: boolean = false) => {
    if (!diag) {
      setEditingDiagram({
        title: 'New Architecture Blueprint',
        format: DiagramFormat.MINDMAP_FLOW,
        content: '', 
        status: 'DRAFT',
        bundleId: activeBundleId !== 'all' ? activeBundleId : undefined,
        applicationId: activeAppId !== 'all' ? activeAppId : undefined
      });
    } else {
      setEditingDiagram(diag);
    }
    setIsEditMode(edit);
    setIsDesignerOpen(true);
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Permanently purge this visual artifact?")) return;
    const res = await fetch(`/api/architecture/diagrams/${id}`, { method: 'DELETE' });
    if (res.ok) fetchDiagrams();
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      {!isDesignerOpen ? (
        <div className="space-y-10">
          <header className="flex justify-between items-end">
            <div>
              <h2 className="text-4xl font-black text-slate-900 tracking-tighter uppercase italic">Architecture Canvas</h2>
              <p className="text-slate-400 font-medium text-lg">Visualizing system relationships, sequence flows, and mind maps.</p>
            </div>
            <div className="flex gap-3">
               <button 
                onClick={() => openDesigner(undefined, true)}
                className="px-8 py-3 bg-slate-900 text-white text-[10px] font-black rounded-2xl shadow-xl hover:bg-blue-600 transition-all uppercase tracking-widest flex items-center gap-2"
               >
                 <i className="fas fa-magic"></i> New Canvas
               </button>
            </div>
          </header>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {loading && diagrams.length === 0 ? [...Array(3)].map((_, i) => <div key={i} className="h-80 bg-slate-100 rounded-[2.5rem] animate-pulse"></div>) : 
             diagrams.length === 0 ? (
               <div className="col-span-full py-32 text-center bg-slate-50/50 border-2 border-dashed border-slate-100 rounded-[3rem]">
                  <i className="fas fa-pencil-ruler text-5xl mb-6 text-slate-200"></i>
                  <p className="text-sm font-black text-slate-400 uppercase tracking-widest">No visual artifacts in current scope</p>
               </div>
             ) : diagrams.map(diag => (
              <div key={diag._id} className="bg-white border border-slate-200 rounded-[2.5rem] p-8 hover:shadow-2xl transition-all group cursor-pointer relative flex flex-col h-full" onClick={() => openDesigner(diag, false)}>
                 <div className="absolute top-6 right-6 flex gap-2 opacity-0 group-hover:opacity-100 transition-all z-20">
                    <button 
                      onClick={(e) => { e.stopPropagation(); openDesigner(diag, true); }}
                      className="w-8 h-8 rounded-lg bg-white text-slate-400 hover:text-blue-600 flex items-center justify-center shadow-sm border border-slate-100"
                    >
                      <i className="fas fa-pen text-[10px]"></i>
                    </button>
                    <button 
                      onClick={(e) => handleDelete(diag._id!, e)}
                      className="w-8 h-8 rounded-lg bg-white text-slate-400 hover:text-red-500 flex items-center justify-center shadow-sm border border-slate-100"
                    >
                      <i className="fas fa-trash text-[10px]"></i>
                    </button>
                 </div>

                 <div className="flex justify-between items-start mb-6">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-lg ${
                      diag.format === DiagramFormat.MERMAID ? 'bg-indigo-500 shadow-indigo-200' : 
                      diag.format === DiagramFormat.DRAWIO ? 'bg-orange-500 shadow-orange-200' : 
                      diag.format === DiagramFormat.MINDMAP_FLOW ? 'bg-emerald-500 shadow-emerald-200' :
                      'bg-slate-500 shadow-slate-200'
                    }`}>
                       <i className={`fas ${diag.format === DiagramFormat.MERMAID ? 'fa-code' : diag.format === DiagramFormat.DRAWIO ? 'fa-vector-square' : diag.format === DiagramFormat.MINDMAP_FLOW ? 'fa-diagram-project' : 'fa-image'}`}></i>
                    </div>
                 </div>
                 <h4 className="text-lg font-black text-slate-800 mb-2 group-hover:text-blue-600 transition-colors pr-12 overflow-hidden text-ellipsis whitespace-nowrap">{diag.title}</h4>
                 <div className="flex items-center gap-3 mb-6">
                    <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">{diag.format}</span>
                    <div className="w-1 h-1 rounded-full bg-slate-200"></div>
                    <span className="text-[10px] font-bold text-slate-400">Synced {new Date(diag.updatedAt).toLocaleDateString()}</span>
                 </div>
                 <div className="flex-1 h-40 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-center overflow-hidden p-4">
                    {diag.format === DiagramFormat.MERMAID ? (
                      <div className="scale-[0.4] origin-center opacity-40 group-hover:opacity-100 transition-opacity pointer-events-none w-full flex justify-center">
                         <MermaidRenderer content={diag.content} id={diag._id!} />
                      </div>
                    ) : diag.format === DiagramFormat.MINDMAP_FLOW ? (
                      <div className="flex flex-col items-center gap-2 opacity-30 group-hover:opacity-60 transition-all text-center">
                        <i className="fas fa-brain text-4xl text-slate-300"></i>
                        <span className="text-[8px] font-black uppercase tracking-widest">MindMap Flow Node</span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2 opacity-30 group-hover:opacity-60 transition-all">
                        <i className="fas fa-file-code text-4xl text-slate-300"></i>
                        <span className="text-[8px] font-black uppercase">Visual Artifact</span>
                      </div>
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
          isEditMode={isEditMode}
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
  isEditMode: boolean;
}> = ({ diagram, onClose, onSuccess, bundles, applications, isEditMode }) => {
  const [format, setFormat] = useState<DiagramFormat>(diagram.format || DiagramFormat.MERMAID);
  const [code, setCode] = useState(diagram.content || '');
  const [title, setTitle] = useState(diagram.title || '');
  const [readOnly, setReadOnly] = useState(!isEditMode);
  const [saving, setSaving] = useState(false);
  const [activeBundleId, setActiveBundleId] = useState(diagram.bundleId || '');
  const [activeAppId, setActiveAppId] = useState(diagram.applicationId || '');
  
  const [exportTrigger, setExportTrigger] = useState(0);

  const persistToRegistry = useCallback(async (finalCode: string) => {
    if (!title.trim()) return alert("Artifact title is mandatory.");
    setSaving(true);
    try {
      const res = await fetch('/api/architecture/diagrams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...diagram,
          title,
          content: finalCode,
          format,
          bundleId: activeBundleId || undefined,
          applicationId: activeAppId || undefined,
          status: 'VERIFIED'
        })
      });
      if (res.ok) onSuccess();
    } finally {
      setSaving(false);
    }
  }, [title, diagram, format, activeBundleId, activeAppId, onSuccess]);

  const handleSave = (newCode: string) => {
    setCode(newCode);
    persistToRegistry(newCode);
  };

  return (
    <div className="fixed inset-0 z-[200] bg-white flex flex-col animate-fadeIn overflow-hidden">
      <header className="px-10 py-5 bg-white border-b border-slate-200 flex items-center justify-between shadow-sm shrink-0 z-[210]">
        <div className="flex items-center gap-6">
          <button onClick={onClose} className="w-10 h-10 rounded-full bg-slate-50 hover:bg-slate-100 flex items-center justify-center text-slate-400 border border-slate-100 transition-all"><i className="fas fa-times"></i></button>
          <div className="flex flex-col">
            <span className="text-[9px] font-black text-blue-600 uppercase tracking-widest mb-1 italic">Blueprint Node</span>
            <input 
              value={title} 
              readOnly={readOnly}
              onChange={(e) => setTitle(e.target.value)} 
              className={`text-2xl font-black text-slate-800 border-none p-0 focus:ring-0 outline-none bg-transparent w-[400px] ${readOnly ? 'cursor-default' : ''}`} 
              placeholder="Untitled Blueprint" 
            />
          </div>
        </div>
        <div className="flex items-center gap-4">
          {!readOnly && (
            <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 mr-4 shadow-inner">
              {[DiagramFormat.MERMAID, DiagramFormat.DRAWIO, DiagramFormat.MINDMAP_FLOW].map(fmt => (
                <button 
                  key={fmt}
                  onClick={() => setFormat(fmt)}
                  className={`px-4 py-2 text-[9px] font-black uppercase rounded-lg transition-all ${format === fmt ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  {fmt}
                </button>
              ))}
            </div>
          )}
          
          {readOnly ? (
            <button 
              onClick={() => setReadOnly(false)}
              className="px-10 py-3.5 bg-blue-600 text-white rounded-2xl shadow-xl font-black text-[10px] uppercase tracking-widest flex items-center gap-3 active:scale-95 transition-all"
            >
              <i className="fas fa-pen"></i> Edit
            </button>
          ) : (
            <button 
              onClick={() => { if (format !== DiagramFormat.MINDMAP_FLOW) handleSave(code); else setExportTrigger(p => p+1); }}
              disabled={saving}
              className="px-10 py-3.5 bg-slate-900 text-white rounded-2xl shadow-xl font-black text-[10px] uppercase tracking-widest flex items-center gap-3 active:scale-95 transition-all disabled:opacity-50"
            >
              {saving ? <i className="fas fa-circle-notch fa-spin"></i> : <i className="fas fa-save"></i>} 
              {saving ? 'Syncing...' : 'Sync to Registry'}
            </button>
          )}
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden bg-slate-50 relative">
        {format === DiagramFormat.MINDMAP_FLOW ? (
          <MindMapFlowEditor 
            initialContent={code} 
            onSave={handleSave} 
            readOnly={readOnly}
          />
        ) : format === DiagramFormat.MERMAID ? (
          <div className="flex-1 flex overflow-hidden">
             <div className="w-1/3 bg-slate-900 flex flex-col border-r border-white/5">
                <textarea 
                  value={code} 
                  onChange={(e) => setCode(e.target.value)}
                  readOnly={readOnly}
                  className="flex-1 bg-transparent text-emerald-400 font-mono text-sm p-8 outline-none resize-none custom-scrollbar"
                />
             </div>
             <div className="flex-1 bg-white flex items-center justify-center p-12 overflow-auto">
                <MermaidRenderer content={code || DEFAULT_MERMAID_CODE} id={diagram._id || 'temp'} />
             </div>
          </div>
        ) : (
          <DrawioEditor 
            xml={code || DEFAULT_DRAWIO_XML} 
            onSave={(xml) => setCode(xml)} 
            readOnly={readOnly} 
          />
        )}

        <aside className="w-80 border-l border-slate-200 bg-white p-8 space-y-10 overflow-y-auto custom-scrollbar shrink-0 z-[204]">
           <section>
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-8 flex items-center gap-2"><i className="fas fa-link"></i> Context Mapping</h4>
              <div className="space-y-6">
                 <div className="space-y-2">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Business Bundle</label>
                    <select disabled={readOnly} value={activeBundleId} onChange={(e) => setActiveBundleId(e.target.value)} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 text-xs font-bold text-slate-700 outline-none hover:border-blue-200 transition-all disabled:opacity-50">
                       <option value="">Cross-Bundle</option>
                       {bundles.map(b => <option key={b._id} value={b._id}>{b.name}</option>)}
                    </select>
                 </div>
                 <div className="space-y-2">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Application Mapping</label>
                    <select disabled={readOnly} value={activeAppId} onChange={(e) => setActiveAppId(e.target.value)} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 text-xs font-bold text-slate-700 outline-none hover:border-blue-200 transition-all disabled:opacity-50">
                       <option value="">Global Resource</option>
                       {applications.filter(a => !activeBundleId || a.bundleId === activeBundleId).map(a => <option key={a._id} value={a._id}>{a.name}</option>)}
                    </select>
                 </div>
              </div>
           </section>
        </aside>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
      `}} />
    </div>
  );
};

export default ArchitectureDiagrams;
