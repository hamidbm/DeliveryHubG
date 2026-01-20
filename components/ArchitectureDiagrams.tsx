
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ArchitectureDiagram, DiagramFormat, Application, Bundle, Milestone } from '../types';
import mermaid from 'mermaid';
import MindElixir from 'mind-elixir';

interface ArchitectureDiagramsProps {
  applications: Application[];
  bundles: Bundle[];
  activeBundleId?: string;
  activeAppId?: string;
}

// Global defaults for stability
const DEFAULT_MINDMAP_TOPIC = "Nexus Central Concept";
const DEFAULT_MINDMAP_DATA = {
  nodeData: {
    id: "root",
    topic: DEFAULT_MINDMAP_TOPIC,
    root: true,
    children: []
  }
};

/**
 * Guarded JSON parser to prevent application crashes on malformed/missing artifact content.
 */
function safeJsonParse<T>(value: unknown, fallback: T): T {
  if (value === null || value === undefined) return fallback;
  if (typeof value !== 'string') return fallback;

  const trimmed = value.trim();
  if (!trimmed || trimmed === 'undefined' || trimmed === 'null') return fallback;

  try {
    return JSON.parse(trimmed) as T;
  } catch (err) {
    console.error("Nexus Registry: Failed to parse visual source payload. Falling back to default node.", err);
    return fallback;
  }
}

const MermaidRenderer: React.FC<{ content: string; id: string }> = ({ content, id }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  const render = useCallback(async () => {
    if (!containerRef.current || !content) return;
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

const MindMapEditor: React.FC<{
  data: string;
  onUpdate: (data: string) => void;
  readOnly?: boolean;
}> = ({ data, onUpdate, readOnly = false }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const meRef = useRef<any>(null);
  const initialized = useRef(false);

  useEffect(() => {
    if (!containerRef.current || initialized.current) return;

    // Use guarded parser for robustness
    const mindData = safeJsonParse(data, DEFAULT_MINDMAP_DATA);

    const me = new MindElixir({
      el: containerRef.current,
      direction: MindElixir.SIDE,
      data: mindData,
      draggable: !readOnly,
      contextMenu: !readOnly,
      toolBar: true,
      nodeMenu: !readOnly,
      keypress: !readOnly,
      mainButton: !readOnly,
    });

    me.init();
    meRef.current = me;
    initialized.current = true;

    if (!readOnly) {
      me.bus.addListener('operation', () => {
        const fullData = me.getData();
        onUpdate(JSON.stringify(fullData));
      });
    }

    return () => {
      // Cleanup happens via DOM removal in MindElixir
    };
  }, []);

  // Sync state if it changes externally
  useEffect(() => {
    if (meRef.current && data) {
      try {
        const currentDataStr = JSON.stringify(meRef.current.getData());
        if (currentDataStr !== data) {
          const parsed = safeJsonParse(data, DEFAULT_MINDMAP_DATA);
          meRef.current.refresh(parsed);
        }
      } catch (e) {}
    }
  }, [data]);

  return (
    <div className="w-full h-full relative mind-map-container overflow-hidden">
      <div ref={containerRef} className="w-full h-full bg-slate-50" />
      {readOnly && (
        <div className="absolute inset-0 z-10 bg-transparent pointer-events-none" />
      )}
      {!readOnly && (
        <div className="absolute bottom-6 right-6 flex flex-col gap-2 z-20">
          <button 
            onClick={() => meRef.current?.toCenter()}
            className="w-10 h-10 rounded-full bg-white shadow-xl flex items-center justify-center text-slate-400 hover:text-blue-600 transition-all border border-slate-100"
            title="Recenter"
          >
            <i className="fas fa-crosshairs"></i>
          </button>
        </div>
      )}
    </div>
  );
};

const ArchitectureDiagrams: React.FC<ArchitectureDiagramsProps> = ({ applications, bundles, activeBundleId, activeAppId }) => {
  const [diagrams, setDiagrams] = useState<ArchitectureDiagram[]>([]);
  const [isDesignerOpen, setIsDesignerOpen] = useState(false);
  const [isIngestModalOpen, setIsIngestModalOpen] = useState(false);
  const [editingDiagram, setEditingDiagram] = useState<Partial<ArchitectureDiagram> | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
        format: DiagramFormat.MERMAID,
        content: 'graph TD\n  Start --> Process\n  Process --> End',
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

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result;
      if (typeof result !== 'string') return;

      let format = DiagramFormat.IMAGE;
      if (file.name.endsWith('.drawio') || file.name.endsWith('.xml')) format = DiagramFormat.DRAWIO;
      if (file.name.endsWith('.json')) format = DiagramFormat.MINDMAP;
      
      setEditingDiagram({
        title: file.name.replace(/\.[^/.]+$/, ""),
        format,
        content: result,
        bundleId: activeBundleId !== 'all' ? activeBundleId : undefined,
        applicationId: activeAppId !== 'all' ? activeAppId : undefined,
        status: 'DRAFT',
        tags: []
      });
      setIsIngestModalOpen(true);
    };

    if (file.type.includes('image')) {
      reader.readAsDataURL(file);
    } else {
      reader.readAsText(file);
    }
  };

  const commitIngest = async () => {
    if (!editingDiagram?.title?.trim()) return alert("Title is mandatory.");
    setIsUploading(true);
    try {
      const res = await fetch('/api/architecture/diagrams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingDiagram)
      });
      
      if (res.ok) {
        setIsIngestModalOpen(false);
        setEditingDiagram(null);
        await fetchDiagrams();
        if (fileInputRef.current) fileInputRef.current.value = '';
      } else {
        const err = await res.json();
        alert(`Ingest Failed: ${err.error || 'Unknown Error'}`);
      }
    } catch (err) {
      alert("Ingest Error: Connection lost.");
    } finally {
      setIsUploading(false);
    }
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
              <p className="text-slate-400 font-medium text-lg">Visualizing system relationships, sequence flows, and infrastructure topologies.</p>
            </div>
            <div className="flex gap-3">
               <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept=".drawio,.xml,.json,image/*" />
               <button 
                 onClick={() => fileInputRef.current?.click()}
                 className="px-6 py-3 bg-white border border-slate-200 text-slate-600 text-[10px] font-black rounded-2xl uppercase tracking-widest hover:bg-slate-50 transition-all flex items-center gap-2 shadow-sm"
               >
                 <i className="fas fa-cloud-arrow-up"></i> Ingest Blueprint
               </button>
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
                      title="Edit Blueprint"
                    >
                      <i className="fas fa-pen text-[10px]"></i>
                    </button>
                    <button 
                      onClick={(e) => handleDelete(diag._id!, e)}
                      className="w-8 h-8 rounded-lg bg-white text-slate-400 hover:text-red-500 flex items-center justify-center shadow-sm border border-slate-100"
                      title="Delete Blueprint"
                    >
                      <i className="fas fa-trash text-[10px]"></i>
                    </button>
                 </div>

                 <div className="flex justify-between items-start mb-6">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-lg ${
                      diag.format === DiagramFormat.MERMAID ? 'bg-indigo-500 shadow-indigo-200' : 
                      diag.format === DiagramFormat.DRAWIO ? 'bg-orange-500 shadow-orange-200' : 
                      diag.format === DiagramFormat.MINDMAP ? 'bg-emerald-500 shadow-emerald-200' :
                      'bg-slate-500 shadow-slate-200'
                    }`}>
                       <i className={`fas ${diag.format === DiagramFormat.MERMAID ? 'fa-code' : diag.format === DiagramFormat.DRAWIO ? 'fa-vector-square' : diag.format === DiagramFormat.MINDMAP ? 'fa-diagram-project' : 'fa-image'}`}></i>
                    </div>
                    <span className={`px-3 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest border ${
                      diag.status === 'VERIFIED' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-blue-50 text-blue-600 border-blue-100'
                    }`}>
                      {diag.status}
                    </span>
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
                    ) : diag.format === DiagramFormat.IMAGE ? (
                      <img src={diag.content} className="h-full w-full object-contain opacity-50 grayscale group-hover:grayscale-0 group-hover:opacity-100 transition-all" alt={diag.title} />
                    ) : diag.format === DiagramFormat.MINDMAP ? (
                      <div className="flex flex-col items-center gap-2 opacity-30 group-hover:opacity-60 transition-all text-center">
                        <i className="fas fa-brain text-4xl text-slate-300"></i>
                        <span className="text-[8px] font-black uppercase tracking-widest">Interactive Logic Node</span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2 opacity-30 group-hover:opacity-60 transition-all">
                        <i className="fas fa-file-code text-4xl text-slate-300"></i>
                        <span className="text-[8px] font-black uppercase">XML Vector Node</span>
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

      {/* Ingest Staging Modal */}
      {isIngestModalOpen && editingDiagram && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-md z-[300] flex items-center justify-center p-6">
           <div className="bg-white rounded-[3rem] w-full max-w-xl p-12 shadow-2xl animate-fadeIn border border-slate-100 overflow-y-auto max-h-[90vh] custom-scrollbar">
              <header className="mb-10">
                 <h3 className="text-3xl font-black text-slate-900 tracking-tight">Stage Visual Artifact</h3>
                 <p className="text-slate-400 text-sm font-medium mt-1">Map registry metadata to the imported blueprint.</p>
              </header>

              <div className="space-y-6">
                 <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Blueprint Title</label>
                    <input 
                      value={editingDiagram.title} 
                      onChange={(e) => setEditingDiagram({...editingDiagram, title: e.target.value})}
                      className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 text-slate-700 font-bold outline-none focus:border-blue-500 transition-all"
                    />
                 </div>

                 <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Bundle Association</label>
                       <select 
                         value={editingDiagram.bundleId || ''} 
                         onChange={(e) => setEditingDiagram({...editingDiagram, bundleId: e.target.value || undefined, applicationId: undefined})}
                         className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 text-slate-700 font-bold outline-none"
                       >
                          <option value="">Full Cluster Scope</option>
                          {bundles.map(b => <option key={b._id} value={b._id}>{b.name}</option>)}
                       </select>
                    </div>
                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Asset Mapping</label>
                       <select 
                         value={editingDiagram.applicationId || ''} 
                         onChange={(e) => setEditingDiagram({...editingDiagram, applicationId: e.target.value || undefined})}
                         className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 text-slate-700 font-bold outline-none"
                       >
                          <option value="">General Purpose</option>
                          {applications.filter(a => !editingDiagram.bundleId || a.bundleId === editingDiagram.bundleId).map(a => <option key={a._id} value={a._id}>{a.name}</option>)}
                       </select>
                    </div>
                 </div>

                 <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Milestone Anchor</label>
                       <select 
                         value={editingDiagram.milestoneId || ''} 
                         onChange={(e) => setEditingDiagram({...editingDiagram, milestoneId: e.target.value || undefined})}
                         className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 text-slate-700 font-bold outline-none"
                       >
                          <option value="">Continuous Lifecycle</option>
                          {[...Array(10)].map((_, i) => <option key={i} value={`M${i+1}`}>M{i+1} Release</option>)}
                       </select>
                    </div>
                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tags (Comma Separated)</label>
                       <input 
                        placeholder="L3, Security, API" 
                        onChange={(e) => setEditingDiagram({...editingDiagram, tags: e.target.value.split(',').map(t => t.trim())})}
                        className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 text-slate-700 font-bold outline-none" 
                       />
                    </div>
                 </div>

                 <div className="flex gap-4 pt-10 border-t border-slate-50">
                    <button onClick={() => { setIsIngestModalOpen(false); setEditingDiagram(null); }} className="flex-1 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-900 transition-colors">Discard</button>
                    <button 
                      onClick={commitIngest} 
                      disabled={isUploading}
                      className="flex-[2] py-4 bg-slate-900 text-white text-[10px] font-black rounded-2xl shadow-2xl hover:bg-blue-600 transition-all uppercase tracking-widest"
                    >
                      {isUploading ? <i className="fas fa-circle-notch fa-spin mr-2"></i> : null}
                      Commit to Registry
                    </button>
                 </div>
              </div>
           </div>
        </div>
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
  const [code, setCode] = useState(() => {
    if (diagram.format === DiagramFormat.MINDMAP) {
      // Ensure Mind Map diagrams always have valid JSON content
      return diagram.content || JSON.stringify(DEFAULT_MINDMAP_DATA);
    }
    return diagram.content || '';
  });
  const [title, setTitle] = useState(diagram.title || '');
  const [format, setFormat] = useState<DiagramFormat>(diagram.format || DiagramFormat.MERMAID);
  const [readOnly, setReadOnly] = useState(!isEditMode);
  const [saving, setSaving] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(!isEditMode);
  const [activeBundleId, setActiveBundleId] = useState(diagram.bundleId || '');
  const [activeAppId, setActiveAppId] = useState(diagram.applicationId || '');
  const [activeMilestone, setActiveMilestone] = useState(diagram.milestoneId || '');
  
  const [exportTrigger, setExportTrigger] = useState(0);
  const [isCommitPending, setIsCommitPending] = useState(false);

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
          milestoneId: activeMilestone || undefined,
          status: 'VERIFIED'
        })
      });
      if (res.ok) {
        onSuccess();
      } else {
        const err = await res.json();
        alert(`Registry Sync Failed: ${err.error}`);
      }
    } finally {
      setSaving(false);
      setIsCommitPending(false);
    }
  }, [title, diagram, format, activeBundleId, activeAppId, activeMilestone, onSuccess]);

  const handleCommitRequest = () => {
    if (!title.trim()) return alert("Title required.");
    
    if (format === DiagramFormat.DRAWIO) {
      setIsCommitPending(true);
      setExportTrigger(prev => prev + 1);
    } else {
      persistToRegistry(code);
    }
  };

  const handleDrawioUpdate = useCallback((newXml: string) => {
    setCode(newXml);
    if (isCommitPending) {
      persistToRegistry(newXml);
    }
  }, [isCommitPending, persistToRegistry]);

  const handleExportJson = () => {
    const blob = new Blob([code], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${title.replace(/\s+/g, '-').toLowerCase()}-mindmap.json`;
    link.click();
  };

  return (
    <div className="fixed inset-0 z-[200] bg-white flex flex-col animate-fadeIn overflow-hidden">
      <header className="px-10 py-5 bg-white border-b border-slate-200 flex items-center justify-between shadow-sm shrink-0 z-[210]">
        <div className="flex items-center gap-6">
          <button onClick={onClose} className="w-10 h-10 rounded-full bg-slate-50 hover:bg-slate-100 flex items-center justify-center text-slate-400 border border-slate-100 transition-all"><i className="fas fa-times"></i></button>
          <div className="flex flex-col">
            <span className="text-[9px] font-black text-blue-600 uppercase tracking-widest mb-1 italic">Blueprint Registry Node</span>
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
              {[DiagramFormat.MERMAID, DiagramFormat.DRAWIO, DiagramFormat.MINDMAP].map(fmt => (
                <button 
                  key={fmt}
                  onClick={() => {
                    setFormat(fmt);
                    // Initialize with default data if switching to MINDMAP and current content is incompatible
                    if (fmt === DiagramFormat.MINDMAP && !code.trim().startsWith('{')) {
                       setCode(JSON.stringify(DEFAULT_MINDMAP_DATA));
                    }
                  }}
                  className={`px-4 py-2 text-[9px] font-black uppercase rounded-lg transition-all ${format === fmt ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  {fmt}
                </button>
              ))}
            </div>
          )}
          
          {readOnly ? (
            <button 
              onClick={() => { setReadOnly(false); setIsSidebarCollapsed(false); }}
              className="px-10 py-3.5 bg-blue-600 text-white rounded-2xl shadow-xl font-black text-[10px] uppercase tracking-widest flex items-center gap-3 active:scale-95 transition-all"
            >
              <i className="fas fa-pen"></i> Enter Edit Mode
            </button>
          ) : (
            <div className="flex gap-2">
              {format === DiagramFormat.MINDMAP && (
                <button 
                  onClick={handleExportJson}
                  className="px-6 py-3.5 bg-white border border-slate-200 text-slate-600 rounded-2xl shadow-sm font-black text-[10px] uppercase tracking-widest flex items-center gap-3 hover:bg-slate-50 transition-all"
                >
                  <i className="fas fa-file-export"></i> JSON
                </button>
              )}
              <button 
                onClick={handleCommitRequest}
                disabled={saving || isCommitPending}
                className="px-10 py-3.5 bg-slate-900 text-white rounded-2xl shadow-xl font-black text-[10px] uppercase tracking-widest flex items-center gap-3 active:scale-95 transition-all disabled:opacity-50"
              >
                {saving || isCommitPending ? <i className="fas fa-circle-notch fa-spin"></i> : <i className="fas fa-save"></i>} 
                {saving || isCommitPending ? 'Syncing...' : 'Commit to Registry'}
              </button>
            </div>
          )}
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden bg-slate-50 relative">
        <div 
          className={`flex flex-col bg-slate-900 shadow-2xl relative z-[205] transition-all duration-500 ease-in-out origin-left ${isSidebarCollapsed ? 'w-0 opacity-0 pointer-events-none' : 'w-1/3'}`}
        >
           <div className="px-6 py-3 border-b border-white/5 flex items-center justify-between bg-black/20 shrink-0">
              <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Source Registry</span>
              <div className="flex gap-2">
                 <div className="w-2 h-2 rounded-full bg-red-500/30"></div>
                 <div className="w-2 h-2 rounded-full bg-amber-500/30"></div>
                 <div className="w-2 h-2 rounded-full bg-emerald-500/30"></div>
              </div>
           </div>
           <div className="flex-1 overflow-hidden relative">
             <textarea 
              value={code}
              readOnly={readOnly}
              onChange={(e) => setCode(e.target.value)}
              className={`w-full h-full bg-transparent text-emerald-400 font-mono text-sm p-8 outline-none resize-none custom-scrollbar selection:bg-emerald-500/20 ${readOnly ? 'opacity-80' : ''}`}
              placeholder={format === DiagramFormat.MERMAID ? "Enter Mermaid syntax..." : "Visual source payload..."}
             />
           </div>
        </div>

        <button 
          onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          className={`absolute top-1/2 -translate-y-1/2 w-6 h-24 bg-slate-800 text-white rounded-r-xl flex flex-col items-center justify-center hover:bg-blue-600 transition-all z-[206] shadow-2xl border-y border-r border-white/10 ${isSidebarCollapsed ? 'left-0' : 'left-[33.333%]'}`}
          title={isSidebarCollapsed ? "Show Source" : "Maximize Workspace"}
        >
          <div className="flex flex-col gap-1 mb-2 opacity-30">
            <div className="w-1 h-1 rounded-full bg-white"></div>
            <div className="w-1 h-1 rounded-full bg-white"></div>
            <div className="w-1 h-1 rounded-full bg-white"></div>
          </div>
          <i className={`fas fa-chevron-${isSidebarCollapsed ? 'right' : 'left'} text-[10px]`}></i>
        </button>

        <div className={`flex-1 overflow-hidden flex flex-col transition-all duration-500 ${isSidebarCollapsed ? 'pl-6' : ''}`}>
           <div className="px-10 py-4 border-b border-slate-200 bg-white/50 backdrop-blur flex items-center justify-between shrink-0">
              <div className="flex items-center gap-4">
                 <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nexus Workspace</span>
                 {!readOnly && (
                   <div className="px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-[8px] font-black uppercase animate-pulse border border-blue-100">Live Synthesis</div>
                 )}
              </div>
           </div>
           
           <div className={`flex-1 overflow-hidden relative flex flex-col ${format === DiagramFormat.DRAWIO || format === DiagramFormat.MINDMAP ? 'p-0' : 'p-6 lg:p-10'}`}>
              <div className={`bg-white w-full h-full relative overflow-hidden flex flex-col ${format === DiagramFormat.DRAWIO || format === DiagramFormat.MINDMAP ? '' : 'rounded-[3rem] shadow-[0_50px_100px_rgba(0,0,0,0.05)] border border-slate-100 items-center justify-center'}`}>
                 {format !== DiagramFormat.DRAWIO && format !== DiagramFormat.MINDMAP && (
                   <div className="absolute inset-0 opacity-[0.02] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 0)', backgroundSize: '32px 32px' }}></div>
                 )}
                 
                 <div className={`relative z-10 w-full h-full overflow-hidden ${format === DiagramFormat.DRAWIO || format === DiagramFormat.MINDMAP ? '' : 'overflow-auto custom-scrollbar p-6 flex flex-col items-center justify-center'}`}>
                   {format === DiagramFormat.MERMAID ? (
                     <div className="w-full h-full min-h-[500px]">
                        <MermaidRenderer content={code} id={diagram._id || 'temp'} />
                     </div>
                   ) : format === DiagramFormat.DRAWIO ? (
                     <DrawioEditor xml={code} onSave={handleDrawioUpdate} requestExportTrigger={exportTrigger} readOnly={readOnly} />
                   ) : format === DiagramFormat.MINDMAP ? (
                     <MindMapEditor data={code} onUpdate={setCode} readOnly={readOnly} />
                   ) : format === DiagramFormat.IMAGE ? (
                     <div className="max-w-full max-h-full flex items-center justify-center overflow-auto shadow-2xl rounded-[2rem] border border-slate-100 p-4">
                        <img src={code} className="max-w-none h-auto transition-transform duration-500" alt="Blueprint Preview" />
                     </div>
                   ) : (
                     <div className="text-center opacity-40 flex flex-col items-center gap-6">
                        <i className="fas fa-vector-square text-6xl text-slate-200"></i>
                        <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.5em]">Artifact processing...</p>
                     </div>
                   )}
                 </div>
              </div>
           </div>
        </div>

        <aside className="w-80 border-l border-slate-200 bg-white p-8 space-y-10 overflow-y-auto custom-scrollbar shrink-0 z-[204]">
           <section>
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-8 flex items-center gap-2"><i className="fas fa-link"></i> Hierarchy Context</h4>
              <div className="space-y-6">
                 <div className="space-y-2">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Business Cluster</label>
                    <select disabled={readOnly} value={activeBundleId} onChange={(e) => setActiveBundleId(e.target.value)} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 text-xs font-bold text-slate-700 outline-none hover:border-blue-200 transition-all disabled:opacity-50">
                       <option value="">Cross-Bundle Plane</option>
                       {bundles.map(b => <option key={b._id} value={b._id}>{b.name}</option>)}
                    </select>
                 </div>
                 <div className="space-y-2">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Asset Mapping</label>
                    <select disabled={readOnly} value={activeAppId} onChange={(e) => setActiveAppId(e.target.value)} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 text-xs font-bold text-slate-700 outline-none hover:border-blue-200 transition-all disabled:opacity-50">
                       <option value="">Full Cluster Scope</option>
                       {applications.filter(a => !activeBundleId || a.bundleId === activeBundleId).map(a => <option key={a._id} value={a._id}>{a.name}</option>)}
                    </select>
                 </div>
                 <div className="space-y-2">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Milestone Anchor</label>
                    <select disabled={readOnly} value={activeMilestone} onChange={(e) => setActiveMilestone(e.target.value)} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 text-xs font-bold text-slate-700 outline-none hover:border-blue-200 transition-all disabled:opacity-50">
                       <option value="">Continuous Lifecycle</option>
                       {[...Array(10)].map((_, i) => <option key={i} value={`M${i+1}`}>M{i+1} Release</option>)}
                    </select>
                 </div>
              </div>
           </section>
           <section className="pt-10 border-t border-slate-50">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 mb-6"><i className="fas fa-robot"></i> Review Protocol</h4>
              <div className="bg-blue-50 border border-blue-100 rounded-[2rem] p-6 space-y-4">
                 <p className="text-[11px] text-blue-700 font-medium leading-relaxed italic">
                   {readOnly ? '"Reviewing visual blueprint registry entry."' : '"Registry sync active. Ensure node hierarchy consistency."'}
                 </p>
              </div>
           </section>
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
