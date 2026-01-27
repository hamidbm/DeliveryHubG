
import React, { useState, useEffect, useRef, useCallback, Suspense, lazy, useMemo } from 'react';
import { ArchitectureDiagram, DiagramFormat, Application, Bundle, Milestone } from '../types';
import mermaid from 'mermaid';
import * as d3 from 'd3';

// Use React.lazy instead of next/dynamic for standard browser module compatibility
const MindMapFlowEditor = lazy(() => import('./MindMapFlowEditor'));
const MindMapMarkdownEditor = lazy(() => import('./MindMapMarkdownEditor'));

interface ArchitectureDiagramsProps {
  applications: Application[];
  bundles: Bundle[];
  activeBundleId?: string;
  activeAppId?: string;
}

const DEFAULT_MERMAID_CODE = `%%{init: {
  "theme": "base",
  "flowchart": {
    "curve": "basis",
    "nodeSpacing": 60,
    "rankSpacing": 70
  }
}}%%
flowchart LR

%% =========================
%% Internet & Edge
%% =========================
subgraph EDGE["Internet & Edge"]
direction TB
U[Users\\nBrowser / Mobile]:::user
DNS[Public DNS]:::edge
WAF[WAF & DDoS Protection]:::edge
CDN[CDN / Static Content]:::edge
end

%% =========================
%% Azure Platform
%% =========================
subgraph AZ["Azure Landing Zone"]
direction LR

subgraph ID["Identity & Secrets"]
ENTRA[Microsoft Entra ID\\nOIDC / OAuth2]:::security
KV[Azure Key Vault\\nSecrets & Certificates]:::security
end

subgraph ROUTING["Ingress & APIs"]
AGW[Application Gateway\\nTLS + WAF]:::platform
APIM[API Management\\nPolicies & Throttling]:::platform
end

subgraph APP["Application Tier"]
FE[Web Application\\nNext.js / SPA]:::app
end

subgraph COMPUTE["Business Logic"]
AKS[AKS Cluster\\nMicroservices]:::compute
ACA[Azure Container Apps\\nServerless APIs]:::compute
end

subgraph INTEGRATION["Integration"]
SB[Service Bus\\nQueues & Topics]:::integration
EH[Event Hubs\\nStreaming Events]:::integration
end

subgraph DATA["Data Layer"]
SQL[(Azure SQL Database)]:::data
COS[(Cosmos DB)]:::data
BLOB[(Blob Storage)]:::data
REDIS[(Redis Cache)]:::data
end

subgraph BATCH["Batch & Automation"]
FUNC[Azure Functions\\nScheduled Jobs]:::batch
BATCHJOB[Batch Processing]:::batch
end

subgraph OPS["Observability & DevOps"]
MON[Azure Monitor\\nLogs & Traces]:::ops
CI[CI/CD Pipelines]:::ops
end

end

%% =========================
%% Traffic Flow
%% =========================
U --> DNS --> WAF --> CDN --> AGW --> APIM --> FE
FE --> APIM
APIM --> AKS
APIM --> ACA

%% =========================
%% Identity & Secrets
%% =========================
FE -. Authenticate .-> ENTRA
AKS -. Validate Token .-> ENTRA
ACA -. Validate Token .-> ENTRA

AKS -. Secrets .-> KV
ACA -. Secrets .-> KV
FUNC -. Secrets .-> KV

%% =========================
%% Data Access
%% =========================
AKS --> REDIS
AKS --> SQL
ACA --> COS
ACA --> BLOB

%% =========================
%% Async & Batch
%% =========================
AKS --> SB
SB --> FUNC
FUNC --> BATCHJOB
BATCHJOB --> SQL
ACA --> EH
EH --> COS

%% =========================
%% Observability & Delivery
%% =========================
FE -. Telemetry .-> MON
AKS -. Telemetry .-> MON
ACA -. Telemetry .-> MON
APIM -. Metrics .-> MON
FUNC -. Logs .-> MON

CI --> FE
CI --> AKS
CI --> ACA
CI --> APIM
CI --> FUNC

%% =========================
%% Styling
%% =========================
classDef user fill:#e0f2fe,stroke:#0284c7,stroke-width:2px;
classDef edge fill:#f8fafc,stroke:#94a3b8,stroke-dasharray: 5 5;
classDef security fill:#fff1f2,stroke:#e11d48,stroke-width:2px;
classDef platform fill:#f0f9ff,stroke:#0ea5e9,stroke-width:2px;
classDef app fill:#f0fdf4,stroke:#22c55e,stroke-width:2px;
classDef compute fill:#faf5ff,stroke:#a855f7,stroke-width:2px;
classDef integration fill:#fffbeb,stroke:#f59e0b,stroke-width:2px;
classDef data fill:#eff6ff,stroke:#3b82f6,stroke-width:2px;
classDef batch fill:#f5f3ff,stroke:#8b5cf6,stroke-width:2px;
classDef ops fill:#f8fafc,stroke:#475569,stroke-width:2px;`;

const DEFAULT_DRAWIO_XML = '<mxfile><diagram id="page-1" name="Page-1"><mxGraphModel dx="1000" dy="1000" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="827" pageHeight="1169" math="0" shadow="0"><root><mxCell id="0"/><mxCell id="1" parent="0"/></root></mxGraphModel></diagram></mxfile>';

const MermaidRenderer: React.FC<{ content: string; id: string }> = ({ content, id }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const zoomRef = useRef<any>(null);

  const handleZoom = useCallback((direction: 'in' | 'out' | 'reset') => {
    if (!zoomRef.current || !containerRef.current) return;
    const svg = d3.select(containerRef.current).select('svg');
    
    if (direction === 'reset') {
      svg.transition().duration(750).call(zoomRef.current.transform, d3.zoomIdentity);
    } else {
      svg.transition().duration(300).call(zoomRef.current.scaleBy, direction === 'in' ? 1.3 : 0.7);
    }
  }, []);

  const render = useCallback(async () => {
    if (!containerRef.current || !content || content.trim().startsWith('{') || content.trim().startsWith('<')) return;
    try {
      containerRef.current.innerHTML = ''; 
      const safeId = `mermaid-${id.replace(/[^a-zA-Z0-9]/g, '-')}-${Math.floor(Math.random() * 10000)}`;
      const { svg } = await mermaid.render(safeId, content);
      
      containerRef.current.innerHTML = svg;
      const svgElement = containerRef.current.querySelector('svg');
      
      if (svgElement) {
        svgElement.setAttribute('width', '100%');
        svgElement.setAttribute('height', '100%');
        svgElement.style.maxWidth = 'none';
        svgElement.style.cursor = 'grab';

        const svgSelection = d3.select(svgElement);
        const zoom = d3.zoom()
          .scaleExtent([0.05, 5])
          .on('zoom', (event) => {
            svgSelection.selectAll('g').filter(function() {
                return this.parentNode === svgElement;
            }).attr('transform', event.transform);
          });

        zoomRef.current = zoom;
        svgSelection.call(zoom as any);
        svgSelection.call(zoom.transform as any, d3.zoomIdentity);
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

  return (
    <div className="relative w-full h-full group/mermaid">
      <div ref={containerRef} className="flex justify-center items-center w-full h-full min-h-[400px] overflow-hidden" />
      <div className="absolute bottom-6 left-6 flex flex-col gap-2 opacity-0 group-hover/mermaid:opacity-100 transition-opacity duration-300 z-50">
        <div className="flex flex-col bg-white/80 backdrop-blur-md border border-slate-200 rounded-2xl shadow-2xl overflow-hidden">
          <button onClick={() => handleZoom('in')} className="p-3 text-slate-600 hover:bg-blue-50 hover:text-blue-600 border-b border-slate-100 transition-colors" title="Zoom In"><i className="fas fa-plus text-xs"></i></button>
          <button onClick={() => handleZoom('out')} className="p-3 text-slate-600 hover:bg-blue-50 hover:text-blue-600 transition-colors border-b border-slate-100" title="Zoom Out"><i className="fas fa-minus text-xs"></i></button>
          <button onClick={() => handleZoom('reset')} className="p-3 text-slate-600 hover:bg-blue-50 hover:text-blue-600 transition-colors" title="Reset View"><i className="fas fa-compress text-xs"></i></button>
        </div>
        <div className="px-3 py-1.5 bg-slate-900 text-white rounded-xl text-[8px] font-black uppercase tracking-widest text-center shadow-lg">D3 Engine</div>
      </div>
    </div>
  );
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
      iframeRef.current?.contentWindow?.postMessage(JSON.stringify({ action: 'export', format: 'xml' }), '*');
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
          iframe.contentWindow.postMessage(JSON.stringify({ action: 'configure', config: { defaultFonts: ["Inter", "Helvetica", "Arial"], ui: 'atlas' } }), '*');
        } else if (data.event === 'init') {
          setIsReady(true);
          iframe.contentWindow.postMessage(JSON.stringify({ action: 'load', xml: xmlRef.current || '', autosave: 1 }), '*');
        } else if (data.event === 'save' || data.event === 'autosave' || data.event === 'export') {
          if (data.xml) onSaveRef.current(data.xml);
          if (data.event === 'save' || data.event === 'export') {
             iframe.contentWindow.postMessage(JSON.stringify({ action: 'status', message: 'Nexus Registry Synchronized', modified: false }), '*');
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
      <iframe ref={iframeRef} className="w-full h-full border-none" src={url} title="Draw.io Editor" />
    </div>
  );
};

const ArchitectureDiagrams: React.FC<ArchitectureDiagramsProps> = ({ applications, bundles, activeBundleId, activeAppId }) => {
  const [diagrams, setDiagrams] = useState<ArchitectureDiagram[]>([]);
  const [isDesignerOpen, setIsDesignerOpen] = useState(false);
  const [editingDiagram, setEditingDiagram] = useState<Partial<ArchitectureDiagram> | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [milestones, setMilestones] = useState<Milestone[]>([]);

  // Metadata Filter State
  const [selBundle, setSelBundle] = useState(activeBundleId || 'all');
  const [selApp, setSelApp] = useState(activeAppId || 'all');
  const [selMilestone, setSelMilestone] = useState('all');
  const [selTag, setSelTag] = useState('all');

  const fetchDiagrams = useCallback(async () => {
    setLoading(true);
    try {
      // In a real app we might fetch with all filters, but here we filter client-side for smoother UI
      const res = await fetch(`/api/architecture/diagrams`);
      const data = await res.json();
      setDiagrams(Array.isArray(data) ? data : []);
    } catch (e) {
      setDiagrams([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDiagrams();
    fetch('/api/milestones').then(r => r.json()).then(data => setMilestones(Array.isArray(data) ? data : []));
  }, [fetchDiagrams]);

  // Sync props to state if they change
  useEffect(() => { if (activeBundleId) setSelBundle(activeBundleId); }, [activeBundleId]);
  useEffect(() => { if (activeAppId) setSelApp(activeAppId); }, [activeAppId]);

  const allTags = useMemo(() => {
    const tags = new Set<string>();
    diagrams.forEach(d => d.tags?.forEach(t => tags.add(t)));
    return Array.from(tags).sort();
  }, [diagrams]);

  const filteredDiagrams = useMemo(() => {
    return diagrams.filter(d => {
      const matchBundle = selBundle === 'all' || d.bundleId === selBundle;
      const matchApp = selApp === 'all' || d.applicationId === selApp;
      const matchMilestone = selMilestone === 'all' || d.milestoneId === selMilestone;
      const matchTag = selTag === 'all' || d.tags?.includes(selTag);
      return matchBundle && matchApp && matchMilestone && matchTag;
    });
  }, [diagrams, selBundle, selApp, selMilestone, selTag]);

  const openDesigner = (diag?: ArchitectureDiagram, edit: boolean = false) => {
    if (!diag) {
      setEditingDiagram({
        title: 'New Architecture Blueprint',
        format: DiagramFormat.MINDMAP_MD,
        content: '', 
        status: 'DRAFT',
        bundleId: selBundle !== 'all' ? selBundle : undefined,
        applicationId: selApp !== 'all' ? selApp : undefined,
        milestoneId: selMilestone !== 'all' ? selMilestone : undefined,
        tags: []
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
        <div className="space-y-8">
          <header className="flex justify-between items-end">
            <div>
              <h2 className="text-4xl font-black text-slate-900 tracking-tighter uppercase italic">Architecture Canvas</h2>
              <p className="text-slate-400 font-medium text-lg">Visualizing system relationships, sequence flows, and mind maps.</p>
            </div>
            <button 
              onClick={() => openDesigner(undefined, true)}
              className="px-8 py-3 bg-slate-900 text-white text-[10px] font-black rounded-2xl shadow-xl hover:bg-blue-600 transition-all uppercase tracking-widest flex items-center gap-2"
            >
              <i className="fas fa-magic"></i> New Canvas
            </button>
          </header>

          {/* Filter Bar */}
          <div className="bg-white border border-slate-200 p-6 rounded-[2rem] shadow-sm flex flex-wrap items-center gap-6">
             <div className="flex items-center gap-3">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Bundle</label>
                <select value={selBundle} onChange={(e) => { setSelBundle(e.target.value); setSelApp('all'); }} className="bg-slate-50 border-none rounded-xl px-4 py-2 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/10 transition-all">
                  <option value="all">All Bundles</option>
                  {bundles.map(b => <option key={b._id} value={b._id}>{b.name}</option>)}
                </select>
             </div>
             <div className="flex items-center gap-3">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Application</label>
                <select value={selApp} onChange={(e) => setSelApp(e.target.value)} className="bg-slate-50 border-none rounded-xl px-4 py-2 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/10 transition-all">
                  <option value="all">All Apps</option>
                  {applications.filter(a => selBundle === 'all' || a.bundleId === selBundle).map(a => <option key={a._id} value={a._id}>{a.name}</option>)}
                </select>
             </div>
             <div className="flex items-center gap-3">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Milestone</label>
                <select value={selMilestone} onChange={(e) => setSelMilestone(e.target.value)} className="bg-slate-50 border-none rounded-xl px-4 py-2 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/10 transition-all">
                  <option value="all">All Milestones</option>
                  {milestones.map(m => <option key={m._id} value={m._id}>{m.name}</option>)}
                </select>
             </div>
             <div className="flex items-center gap-3">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Tag</label>
                <select value={selTag} onChange={(e) => setSelTag(e.target.value)} className="bg-slate-50 border-none rounded-xl px-4 py-2 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/10 transition-all">
                  <option value="all">All Tags</option>
                  {allTags.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
             </div>
             <button onClick={() => { setSelBundle('all'); setSelApp('all'); setSelMilestone('all'); setSelTag('all'); }} className="ml-auto text-[9px] font-black text-slate-400 uppercase tracking-widest hover:text-blue-600 transition-colors">Clear Filters</button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 pb-20">
            {loading && diagrams.length === 0 ? [...Array(3)].map((_, i) => <div key={i} className="h-80 bg-slate-100 rounded-[2.5rem] animate-pulse"></div>) : 
             filteredDiagrams.length === 0 ? (
               <div className="col-span-full py-32 text-center bg-slate-50/50 border-2 border-dashed border-slate-100 rounded-[3rem]">
                  <i className="fas fa-pencil-ruler text-5xl mb-6 text-slate-200"></i>
                  <p className="text-sm font-black text-slate-400 uppercase tracking-widest">No diagrams found matching filters</p>
               </div>
             ) : filteredDiagrams.map(diag => (
              <div key={diag._id} className="bg-white border border-slate-200 rounded-[2.5rem] p-8 hover:shadow-2xl transition-all group cursor-pointer relative flex flex-col h-full" onClick={() => openDesigner(diag, false)}>
                 <div className="absolute top-6 right-6 flex gap-2 opacity-0 group-hover:opacity-100 transition-all z-20">
                    <button onClick={(e) => { e.stopPropagation(); openDesigner(diag, true); }} className="w-8 h-8 rounded-lg bg-white text-slate-400 hover:text-blue-600 flex items-center justify-center shadow-sm border border-slate-100"><i className="fas fa-pen text-[10px]"></i></button>
                    <button onClick={(e) => handleDelete(diag._id!, e)} className="w-8 h-8 rounded-lg bg-white text-slate-400 hover:text-red-500 flex items-center justify-center shadow-sm border border-slate-100"><i className="fas fa-trash text-[10px]"></i></button>
                 </div>
                 <div className="flex justify-between items-start mb-6">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-lg ${
                      diag.format === DiagramFormat.MERMAID ? 'bg-indigo-500 shadow-indigo-200' : 
                      diag.format === DiagramFormat.DRAWIO ? 'bg-orange-500 shadow-orange-200' : 
                      diag.format === DiagramFormat.MINDMAP_FLOW ? 'bg-emerald-500 shadow-emerald-200' :
                      diag.format === DiagramFormat.MINDMAP_MD ? 'bg-blue-500 shadow-blue-200' : 'bg-slate-500 shadow-slate-200'
                    }`}><i className={`fas ${diag.format === DiagramFormat.MERMAID ? 'fa-code' : diag.format === DiagramFormat.DRAWIO ? 'fa-vector-square' : 'fa-diagram-project'}`}></i></div>
                 </div>
                 <h4 className="text-lg font-black text-slate-800 mb-2 group-hover:text-blue-600 transition-colors pr-12 truncate">{diag.title}</h4>
                 <div className="flex flex-wrap gap-2 mb-6">
                    <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">{diag.format}</span>
                    {diag.tags?.map(t => <span key={t} className="px-2 py-0.5 bg-blue-50 text-blue-500 text-[8px] font-black uppercase rounded-md border border-blue-100">{t}</span>)}
                 </div>
                 <div className="flex-1 h-40 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-center overflow-hidden p-4">
                    <div className="flex flex-col items-center gap-2 opacity-30 group-hover:opacity-60 transition-all text-center">
                        <i className={`fas ${diag.format === DiagramFormat.MERMAID ? 'fa-code' : 'fa-file-code'} text-4xl text-slate-300`}></i>
                        <span className="text-[8px] font-black uppercase tracking-widest">Visual Logic Attached</span>
                    </div>
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
          milestones={milestones}
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
  milestones: Milestone[];
}> = ({ diagram, onClose, onSuccess, bundles, applications, isEditMode, milestones }) => {
  const [format, setFormat] = useState<DiagramFormat>(diagram.format || DiagramFormat.MERMAID);
  const [code, setCode] = useState(diagram.content || (diagram.format === DiagramFormat.MERMAID ? DEFAULT_MERMAID_CODE : ''));
  const [title, setTitle] = useState(diagram.title || '');
  const [readOnly, setReadOnly] = useState(!isEditMode);
  const [saving, setSaving] = useState(false);
  const [activeBundleId, setActiveBundleId] = useState(diagram.bundleId || '');
  const [activeAppId, setActiveAppId] = useState(diagram.applicationId || '');
  const [activeMilestoneId, setActiveMilestoneId] = useState(diagram.milestoneId || '');
  const [tagsInput, setTagsInput] = useState(diagram.tags?.join(', ') || '');
  const [isContextOpen, setIsContextOpen] = useState(true);
  
  const [exportTrigger, setExportTrigger] = useState(0);

  useEffect(() => {
    if (!code || code === '') {
      if (format === DiagramFormat.MERMAID) setCode(DEFAULT_MERMAID_CODE);
      else if (format === DiagramFormat.DRAWIO) setCode(DEFAULT_DRAWIO_XML);
    }
  }, [format, code]);

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
          milestoneId: activeMilestoneId || undefined,
          tags: tagsInput.split(',').map(t => t.trim()).filter(t => t),
          status: 'VERIFIED'
        })
      });
      if (res.ok) onSuccess();
    } finally {
      setSaving(false);
    }
  }, [title, diagram, format, activeBundleId, activeAppId, activeMilestoneId, tagsInput, onSuccess]);

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
            <input value={title} readOnly={readOnly} onChange={(e) => setTitle(e.target.value)} className={`text-2xl font-black text-slate-800 border-none p-0 focus:ring-0 outline-none bg-transparent w-[400px] ${readOnly ? 'cursor-default' : ''}`} placeholder="Untitled Blueprint" />
          </div>
        </div>
        <div className="flex items-center gap-4">
          {!readOnly && (
            <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 mr-4 shadow-inner">
              {[DiagramFormat.MERMAID, DiagramFormat.DRAWIO, DiagramFormat.MINDMAP_FLOW, DiagramFormat.MINDMAP_MD].map(fmt => (
                <button key={fmt} onClick={() => setFormat(fmt)} className={`px-4 py-2 text-[9px] font-black uppercase rounded-lg transition-all ${format === fmt ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>{fmt === DiagramFormat.MINDMAP_MD ? 'Mind Map (MD)' : fmt === DiagramFormat.MINDMAP_FLOW ? 'Mind Map (Legacy)' : fmt}</button>
              ))}
            </div>
          )}
          {readOnly ? (
            <button onClick={() => setReadOnly(false)} className="px-10 py-3.5 bg-blue-600 text-white rounded-2xl shadow-xl font-black text-[10px] uppercase tracking-widest flex items-center gap-3 active:scale-95 transition-all"><i className="fas fa-pen"></i> Edit</button>
          ) : (
            <button onClick={() => { if (format !== DiagramFormat.MINDMAP_FLOW) handleSave(code); else setExportTrigger(p => p+1); }} disabled={saving} className="px-10 py-3.5 bg-slate-900 text-white rounded-2xl shadow-xl font-black text-[10px] uppercase tracking-widest flex items-center gap-3 active:scale-95 transition-all disabled:opacity-50">
              {saving ? <i className="fas fa-circle-notch fa-spin"></i> : <i className="fas fa-save"></i>} {saving ? 'Syncing...' : 'Sync to Registry'}
            </button>
          )}
        </div>
      </header>

      <div className="flex-1 flex flex-row overflow-hidden bg-slate-50 relative">
        <div className="flex-1 relative overflow-hidden flex flex-col min-w-0">
          {format === DiagramFormat.MINDMAP_MD ? (
            <Suspense fallback={<div className="flex-1 flex items-center justify-center bg-white"><i className="fas fa-circle-notch fa-spin text-blue-500 text-2xl"></i></div>}><MindMapMarkdownEditor initialContent={code} onSave={handleSave} readOnly={readOnly} /></Suspense>
          ) : format === DiagramFormat.MINDMAP_FLOW ? (
            <Suspense fallback={<div className="flex-1 flex flex-col items-center justify-center bg-white gap-4"><div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div><p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Activating Canvas...</p></div>}><MindMapFlowEditor initialContent={code} onSave={handleSave} readOnly={readOnly} /></Suspense>
          ) : format === DiagramFormat.MERMAID ? (
            <div className="flex-1 flex overflow-hidden">
               {!readOnly && <div className="w-1/3 bg-slate-900 flex flex-col border-r border-white/5"><textarea value={code} onChange={(e) => setCode(e.target.value)} readOnly={readOnly} className="flex-1 bg-transparent text-emerald-400 font-mono text-sm p-8 outline-none resize-none custom-scrollbar" /></div>}
               <div className="flex-1 bg-white p-0 overflow-hidden relative"><MermaidRenderer content={code || DEFAULT_MERMAID_CODE} id={diagram._id || 'temp'} /></div>
            </div>
          ) : (
            <div className="flex-1 relative bg-white h-full w-full"><DrawioEditor xml={code || DEFAULT_DRAWIO_XML} onSave={(xml) => setCode(xml)} readOnly={readOnly} /></div>
          )}
        </div>

        <aside className={`border-l border-slate-200 bg-white transition-all duration-500 ease-in-out shrink-0 z-[204] relative flex flex-col ${isContextOpen ? 'w-80' : 'w-0 overflow-hidden opacity-0'}`}>
           <div className="p-8 space-y-10 min-w-[320px]">
             <section>
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-8 flex items-center gap-2"><i className="fas fa-link"></i> Context Mapping</h4>
                <div className="space-y-6">
                   <div className="space-y-2">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Business Bundle</label>
                      <select disabled={readOnly} value={activeBundleId} onChange={(e) => { setActiveBundleId(e.target.value); setActiveAppId(''); }} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 text-xs font-bold text-slate-700 outline-none hover:border-blue-200 transition-all disabled:opacity-50">
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
                   <div className="space-y-2">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Target Milestone</label>
                      <select disabled={readOnly} value={activeMilestoneId} onChange={(e) => setActiveMilestoneId(e.target.value)} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 text-xs font-bold text-slate-700 outline-none hover:border-blue-200 transition-all disabled:opacity-50">
                         <option value="">Unscheduled</option>
                         {milestones.map(m => <option key={m._id} value={m._id}>{m.name}</option>)}
                      </select>
                   </div>
                   <div className="space-y-2">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Tags (Comma Separated)</label>
                      <input readOnly={readOnly} value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 text-xs font-bold text-slate-700 outline-none hover:border-blue-200 transition-all disabled:opacity-50" placeholder="cloud, infra, v2" />
                   </div>
                </div>
             </section>
           </div>
        </aside>

        <button onClick={() => setIsContextOpen(!isContextOpen)} className={`absolute bottom-8 right-8 z-[215] w-12 h-12 rounded-full shadow-2xl flex items-center justify-center transition-all ${isContextOpen ? 'bg-slate-900 text-white' : 'bg-blue-600 text-white animate-bounce'}`} title={isContextOpen ? "Collapse Mapping Panel" : "Expand Mapping Panel"}><i className={`fas ${isContextOpen ? 'fa-chevron-right' : 'fa-link'}`}></i></button>
      </div>
    </div>
  );
};

export default ArchitectureDiagrams;
