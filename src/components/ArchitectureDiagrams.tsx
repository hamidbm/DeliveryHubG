"use client";

import React, { useState, useEffect, useRef, useCallback, Suspense, lazy, useMemo } from 'react';
import { ArchitectureDiagram, DiagramFormat, Application, Bundle, Milestone, ReviewRecord, TaxonomyCategory, TaxonomyDocumentType } from '../types';
import { useRouter, useSearchParams } from '../App';
import CommentsDrawer from './CommentsDrawer';
import DocumentTypePicker from './DocumentTypePicker';
import { canSubmitForReviewClient, canResubmitClient, canMarkFeedbackSentClient, isEngineeringRoleClient, isVendorRoleClient } from '../lib/authzClient';
import { ensureSafeStylesheetAccess } from '../lib/safeStylesheets';
import * as d3 from 'd3';
import { DEFAULT_MARKMAP_MD } from '../lib/markmapDsl';

const MindMapMarkdownEditor = lazy(() => import('./MindMapMarkdownEditor'));
const MindMapFlowEditor = lazy(() => import('./MindMapFlowEditor'));

interface ArchitectureDiagramsProps {
  applications: Application[];
  bundles: Bundle[];
  activeBundleId?: string;
  activeAppId?: string;
}

const DIAGRAM_TYPES = [
  { group: 'Enterprise Architecture', items: [
    { id: 'enterprise_arch', label: 'Cloud Enterprise Architecture' },
    { id: 'application_integration', label: 'Application Integration' },
    { id: 'c4_context', label: 'C4 Context' },
    { id: 'c4_container', label: 'C4 Container' },
    { id: 'c4_component', label: 'C4 Component' }
  ]},
  { group: 'Software Design', items: [
    { id: 'sequence', label: 'Sequence Diagram' },
    { id: 'class', label: 'Class Diagram' },
    { id: 'service_design', label: 'Service Design' },
    { id: 'api_flow', label: 'API Flow' }
  ]},
  { group: 'Data', items: [
    { id: 'database_schema', label: 'Database Schema' },
    { id: 'data_flow', label: 'Data Flow Diagram' }
  ]},
  { group: 'Strategy / Planning', items: [
    { id: 'mind_map', label: 'Mind Map' },
    { id: 'capability_map', label: 'Capability Map' }
  ]}
];

const TYPE_TO_FORMATS: Record<string, DiagramFormat[]> = {
  enterprise_arch: [DiagramFormat.DRAWIO, DiagramFormat.MERMAID],
  application_integration: [DiagramFormat.DRAWIO, DiagramFormat.MERMAID],
  c4_context: [DiagramFormat.MERMAID, DiagramFormat.DRAWIO],
  c4_container: [DiagramFormat.MERMAID, DiagramFormat.DRAWIO],
  c4_component: [DiagramFormat.MERMAID, DiagramFormat.DRAWIO],
  sequence: [DiagramFormat.MERMAID],
  class: [DiagramFormat.MERMAID],
  service_design: [DiagramFormat.MERMAID, DiagramFormat.DRAWIO],
  api_flow: [DiagramFormat.MERMAID, DiagramFormat.DRAWIO],
  database_schema: [DiagramFormat.MERMAID],
  data_flow: [DiagramFormat.MERMAID, DiagramFormat.DRAWIO],
  mind_map: [DiagramFormat.MINDMAP_MD],
  capability_map: [DiagramFormat.MINDMAP_MD, DiagramFormat.MERMAID]
};

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
ENTRA[Microsoft Enra ID\\nOIDC / OAuth2]:::security
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

  useEffect(() => {
    const render = async () => {
      if (!containerRef.current || !content || content.trim().startsWith('{') || content.trim().startsWith('<')) return;
      try {
        ensureSafeStylesheetAccess();
        const mermaid = (await import('mermaid')).default;
        mermaid.initialize({ 
          startOnLoad: false, 
          theme: 'neutral',
          securityLevel: 'loose',
          fontFamily: 'Inter'
        });
        
        containerRef.current.innerHTML = ''; 
        const safeId = `mermaid-${id.replace(/[^a-zA-Z0-9]/g, '-')}-${Math.floor(Math.random() * 10000)}`;
        const { svg } = await mermaid.render(safeId, content);
        
        if (containerRef.current) {
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
                svgSelection.selectAll('g').filter(function (this: Element) {
                  return this.parentNode === svgElement;
                }).attr('transform', event.transform);
              });

            zoomRef.current = zoom;
            svgSelection.call(zoom as any);
            svgSelection.call(zoom.transform as any, d3.zoomIdentity);
          }
        }
      } catch (err) {
        if (containerRef.current) {
          containerRef.current.innerHTML = `<div class="p-10 text-red-500 bg-red-50 rounded-2xl border border-red-100 flex flex-col items-center">
            <i class="fas fa-triangle-exclamation text-2xl mb-2"></i>
            <p class="text-[10px] font-black uppercase tracking-widest">Mermaid Syntax Error</p>
          </div>`;
        }
      }
    };
    render();
  }, [content, id]);

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
          iframe.contentWindow.postMessage(JSON.stringify({ action: 'load', xml: xmlRef.current || DEFAULT_DRAWIO_XML, autosave: 1 }), '*');
        } else if (data.event === 'save' || data.event === 'autosave' || data.event === 'export') {
          if (data.xml) onSaveRef.current(data.xml);
          if (data.event === 'save' || data.event === 'export') {
             iframe.contentWindow.postMessage(JSON.stringify({ action: 'status', message: 'Registry Synchronized', modified: false }), '*');
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
  const router = useRouter();
  const searchParams = useSearchParams();
  const [diagrams, setDiagrams] = useState<ArchitectureDiagram[]>([]);
  const [isDesignerOpen, setIsDesignerOpen] = useState(false);
  const [editingDiagram, setEditingDiagram] = useState<Partial<ArchitectureDiagram> | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [docTypes, setDocTypes] = useState<TaxonomyDocumentType[]>([]);
  const [docCategories, setDocCategories] = useState<TaxonomyCategory[]>([]);
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);
  const [wizardMode, setWizardMode] = useState<'blank' | 'template' | 'upload' | null>(null);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [selectedFormat, setSelectedFormat] = useState<DiagramFormat | null>(null);
  const [templateOptions, setTemplateOptions] = useState<any[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [selectedDocumentTypeId, setSelectedDocumentTypeId] = useState<string | null>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadingDiagram, setUploadingDiagram] = useState(false);
  const [creatingDiagram, setCreatingDiagram] = useState(false);
  const [wizardError, setWizardError] = useState<string | null>(null);

  const [selBundle, setSelBundle] = useState(activeBundleId || 'all');
  const [selApp, setSelApp] = useState(activeAppId || 'all');
  const [selMilestone, setSelMilestone] = useState('all');
  const [selTag, setSelTag] = useState('all');

  const fetchDiagrams = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/architecture/diagrams?includeReviewSummary=true`);
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
    fetch('/api/taxonomy/document-types?active=true').then(r => r.json()).then(data => setDocTypes(Array.isArray(data) ? data : []));
    fetch('/api/taxonomy/categories?active=true').then(r => r.json()).then(data => setDocCategories(Array.isArray(data) ? data : []));
  }, [fetchDiagrams]);

  useEffect(() => {
    const diagramId = searchParams.get('diagramId');
    if (!diagramId) return;
    const match = diagrams.find((d) => String(d._id) === String(diagramId));
    if (match) {
      setEditingDiagram(match);
      setIsEditMode(false);
      setIsDesignerOpen(true);
    }
  }, [diagrams, searchParams]);

  useEffect(() => { if (activeBundleId) setSelBundle(activeBundleId); }, [activeBundleId]);
  useEffect(() => { if (activeAppId) setSelApp(activeAppId); }, [activeAppId]);

  useEffect(() => {
    const loadTemplates = async () => {
      if (!selectedType || !selectedFormat) {
        setTemplateOptions([]);
        return;
      }
      setTemplatesLoading(true);
      try {
        const params = new URLSearchParams();
        params.set('diagramType', selectedType);
        params.set('format', selectedFormat);
        const res = await fetch(`/api/diagram-templates?${params.toString()}`);
        const data = await res.json();
        setTemplateOptions(Array.isArray(data) ? data : []);
      } catch {
        setTemplateOptions([]);
      } finally {
        setTemplatesLoading(false);
      }
    };
    loadTemplates();
  }, [selectedType, selectedFormat]);

  useEffect(() => {
    if (!templateOptions.length) return;
    if (selectedTemplateId) return;
    const defaultTpl = templateOptions.find((t) => t.isDefault);
    if (defaultTpl) {
      setSelectedTemplateId(String(defaultTpl._id || defaultTpl.id));
    }
  }, [templateOptions, selectedTemplateId]);

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
        format: DiagramFormat.MERMAID,
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
    if (diag?._id) {
      const params = new URLSearchParams(searchParams.toString());
      params.set('tab', 'architecture');
      params.set('diagramId', String(diag._id));
      router.push(`/?${params.toString()}`);
    }
  };

  const openWizard = () => {
    setWizardStep(1);
    setWizardMode(null);
    setSelectedType(null);
    setSelectedFormat(null);
    setSelectedTemplateId(null);
    setTemplateOptions([]);
    setSelectedDocumentTypeId(null);
    setUploadFile(null);
    setWizardError(null);
    setIsWizardOpen(true);
  };

  const getDefaultContent = (format: DiagramFormat) => {
    if (format === DiagramFormat.DRAWIO) return DEFAULT_DRAWIO_XML;
    if (format === DiagramFormat.MINDMAP_MD) return DEFAULT_MARKMAP_MD;
    return DEFAULT_MERMAID_CODE;
  };

  const createFromWizard = async () => {
    const requiresType = wizardMode === 'template';
    if ((requiresType && !selectedType) || !selectedFormat || !selectedDocumentTypeId) return;
    setWizardError(null);
    setCreatingDiagram(true);
    try {
      let content = getDefaultContent(selectedFormat);
      let sourceTemplateId: string | undefined = undefined;
      let createdFromTemplate = false;
      let title = DIAGRAM_TYPES.flatMap(g => g.items).find(i => i.id === selectedType)?.label || 'New Diagram';

      if (selectedTemplateId) {
        try {
          const res = await fetch(`/api/diagram-templates/${encodeURIComponent(selectedTemplateId)}`);
          if (res.ok) {
            const template = await res.json();
            if (template?.content) content = String(template.content);
            if (template?.name) title = String(template.name);
            sourceTemplateId = String(template._id || template.id || selectedTemplateId);
            createdFromTemplate = true;
          }
        } catch {}
      }

      const payload: Partial<ArchitectureDiagram> = {
        title,
        diagramType: selectedType || undefined,
        format: selectedFormat,
        content,
        documentTypeId: selectedDocumentTypeId,
        bundleId: selBundle !== 'all' ? selBundle : undefined,
        applicationId: selApp !== 'all' ? selApp : undefined,
        milestoneId: selMilestone !== 'all' ? selMilestone : undefined,
        tags: [],
        status: 'DRAFT',
        sourceTemplateId,
        createdFromTemplate
      };

      const res = await fetch('/api/architecture/diagrams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        const insertedId = data?.result?.insertedId;
        const created = { ...payload, _id: insertedId || payload._id } as ArchitectureDiagram;
        setIsWizardOpen(false);
        setEditingDiagram(created);
        setIsEditMode(true);
        setIsDesignerOpen(true);
        fetchDiagrams();
      } else {
        let message = 'Failed to create diagram.';
        try {
          const data = await res.json();
          message = data?.error || message;
        } catch {}
        setWizardError(message);
      }
    } catch (error: any) {
      setWizardError(error?.message || 'Failed to create diagram.');
    } finally {
      setCreatingDiagram(false);
    }
  };

  const resolveUploadFormat = (file: File): DiagramFormat => {
    const name = file.name.toLowerCase();
    if (name.endsWith('.drawio') || name.endsWith('.xml')) return DiagramFormat.DRAWIO;
    if (name.endsWith('.mmd')) return DiagramFormat.MERMAID;
    if (name.endsWith('.md')) return DiagramFormat.MINDMAP_MD;
    if (name.endsWith('.json')) return DiagramFormat.MINDMAP;
    if (name.endsWith('.svg') || name.endsWith('.png') || name.endsWith('.jpeg') || name.endsWith('.jpg')) return DiagramFormat.IMAGE;
    if (name.endsWith('.pdf')) return DiagramFormat.PDF;
    return DiagramFormat.MERMAID;
  };

  const handleUploadDiagram = async () => {
    if (!uploadFile || !selectedDocumentTypeId) return;
    setUploadingDiagram(true);
    setWizardError(null);
    try {
      const format = resolveUploadFormat(uploadFile);
      const content = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.onload = () => resolve(String(reader.result || ''));
        if ([DiagramFormat.IMAGE, DiagramFormat.PDF].includes(format)) {
          reader.readAsDataURL(uploadFile);
        } else {
          reader.readAsText(uploadFile);
        }
      });
      const payload: Partial<ArchitectureDiagram> = {
        title: uploadFile.name.replace(/\.[^/.]+$/, ''),
        diagramType: selectedType || undefined,
        format,
        content,
        createdFromUpload: true,
        documentTypeId: selectedDocumentTypeId,
        bundleId: selBundle !== 'all' ? selBundle : undefined,
        applicationId: selApp !== 'all' ? selApp : undefined,
        milestoneId: selMilestone !== 'all' ? selMilestone : undefined,
        tags: [],
        status: 'DRAFT'
      };
      const res = await fetch('/api/architecture/diagrams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        const insertedId = data?.result?.insertedId;
        const created = { ...payload, _id: insertedId || payload._id } as ArchitectureDiagram;
        setIsWizardOpen(false);
        setEditingDiagram(created);
        setIsEditMode(true);
        setIsDesignerOpen(true);
        fetchDiagrams();
      } else {
        let message = 'Failed to upload diagram.';
        try {
          const data = await res.json();
          message = data?.error || message;
        } catch {}
        setWizardError(message);
      }
    } catch (error: any) {
      setWizardError(error?.message || 'Failed to upload diagram.');
    } finally {
      setUploadingDiagram(false);
    }
  };

  const closeDesigner = () => {
    setIsDesignerOpen(false);
    const params = new URLSearchParams(searchParams.toString());
    params.delete('diagramId');
    params.delete('focus');
    params.delete('reviewId');
    params.delete('cycleId');
    params.set('tab', 'architecture');
    router.push(`/?${params.toString()}`);
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
              onClick={openWizard}
              className="px-8 py-3 bg-slate-900 text-white text-[10px] font-black rounded-2xl shadow-xl hover:bg-blue-600 transition-all uppercase tracking-widest flex items-center gap-2"
            >
              <i className="fas fa-magic"></i> New Canvas
            </button>
          </header>

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

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-20">
            {loading && diagrams.length === 0 ? [...Array(3)].map((_, i) => <div key={i} className="h-56 bg-slate-100 rounded-[2rem] animate-pulse"></div>) : 
             filteredDiagrams.length === 0 ? (
               <div className="col-span-full py-32 text-center bg-slate-50/50 border-2 border-dashed border-slate-100 rounded-[3rem]">
                  <i className="fas fa-pencil-ruler text-5xl mb-6 text-slate-200"></i>
                  <p className="text-sm font-black text-slate-400 uppercase tracking-widest">No diagrams found matching filters</p>
               </div>
             ) : filteredDiagrams.map(diag => {
              const summary = diag.reviewSummary;
              const reviewers = summary?.reviewers || [];
              const cycleStatus = summary?.currentCycleStatus || '';
              const cycleNumber = summary?.currentCycleNumber;
              const cycleDue = summary?.currentDueAt;
              const isClosed = cycleStatus === 'closed';
              const isOverdue = !!cycleDue && !isClosed && new Date(cycleDue).getTime() < Date.now();
              const statusLabel = cycleStatus ? cycleStatus.replace(/_/g, ' ') : '';
              const statusClass = cycleStatus === 'requested'
                ? 'bg-slate-100 text-slate-500 border-slate-200'
                : cycleStatus === 'in_review'
                  ? 'bg-blue-50 text-blue-600 border-blue-200'
                  : cycleStatus === 'feedback_sent'
                    ? 'bg-purple-50 text-purple-600 border-purple-200'
                    : cycleStatus === 'vendor_addressing'
                      ? 'bg-amber-50 text-amber-700 border-amber-200'
                      : cycleStatus === 'closed'
                        ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
                        : 'bg-slate-100 text-slate-500 border-slate-200';

              return (
                <div key={diag._id} className="bg-white border border-slate-200 rounded-[2rem] p-5 hover:shadow-xl transition-all group cursor-pointer relative flex flex-col justify-between h-[230px]" onClick={() => openDesigner(diag, false)}>
                  <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-all z-20">
                    <button onClick={(e) => { e.stopPropagation(); openDesigner(diag, true); }} className="w-8 h-8 rounded-lg bg-white text-slate-400 hover:text-blue-600 flex items-center justify-center shadow-sm border border-slate-100"><i className="fas fa-pen text-[10px]"></i></button>
                    <button onClick={(e) => handleDelete(diag._id!, e)} className="w-8 h-8 rounded-lg bg-white text-slate-400 hover:text-red-500 flex items-center justify-center shadow-sm border border-slate-100"><i className="fas fa-trash text-[10px]"></i></button>
                  </div>
                  
                  <div>
                    <div className="flex items-start gap-3 mb-3">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-white shadow-md ${
                        diag.format === DiagramFormat.MERMAID ? 'bg-indigo-500' : 
                        diag.format === DiagramFormat.DRAWIO ? 'bg-orange-500' : 
                        diag.format === DiagramFormat.MINDMAP_MD ? 'bg-blue-500' : 'bg-slate-500'
                      }`}><i className={`fas ${diag.format === DiagramFormat.MERMAID ? 'fa-code' : diag.format === DiagramFormat.DRAWIO ? 'fa-vector-square' : 'fa-diagram-project'} text-sm`}></i></div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="text-sm font-black text-slate-800 group-hover:text-blue-600 transition-colors line-clamp-2">{diag.title}</h4>
                          {summary && (
                            <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-full border ${statusClass}`}>
                              {cycleNumber ? `#${cycleNumber}` : ''} {statusLabel || 'review'}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <i className="fas fa-boxes-stacked text-[9px] text-slate-300"></i>
                        <span className="text-[10px] font-bold text-slate-500 truncate">
                          {bundles.find(b => b._id === diag.bundleId)?.name || 'Unassigned Cluster'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <i className="fas fa-cube text-[9px] text-slate-300"></i>
                        <span className="text-[10px] font-bold text-slate-500 truncate">
                          {applications.find(a => a._id === diag.applicationId || a.id === diag.applicationId)?.name || 'No App Context'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <i className="fas fa-layer-group text-[9px] text-slate-300"></i>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{diag.format}</span>
                      </div>
                      {summary && reviewers.length > 0 && (
                        <div className="flex items-center gap-2 pt-1">
                          <div className="flex -space-x-2">
                            {reviewers.slice(0, 2).map((r: any) => (
                              <img key={r.userId} src={`https://ui-avatars.com/api/?name=${encodeURIComponent(r.displayName || 'R')}&background=0D8ABC&color=fff&size=32`} className="w-6 h-6 rounded-full border-2 border-white shadow-sm" />
                            ))}
                          </div>
                          {reviewers.length > 2 && (
                            <span className="text-[9px] font-black uppercase text-slate-400">+{reviewers.length - 2}</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t border-slate-50 pt-3 mt-2">
                    {summary ? (
                      <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-slate-400">
                        {cycleDue ? (
                          <>
                            <i className="fas fa-calendar text-[9px]"></i>
                            <span>{new Date(cycleDue).toLocaleDateString()}</span>
                            {isOverdue && <span className="text-red-500">Overdue</span>}
                          </>
                        ) : (
                          <span>No due date</span>
                        )}
                      </div>
                    ) : (
                      <span className="text-[8px] font-black text-slate-200 uppercase italic">No review</span>
                    )}
                    {summary && (
                      <div className="flex items-center gap-3">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openDesigner(diag, false);
                            const params = new URLSearchParams(searchParams.toString());
                            params.set('tab', 'architecture');
                            params.set('diagramId', String(diag._id));
                            params.set('focus', 'review');
                            if (summary.currentCycleId) params.set('cycleId', summary.currentCycleId);
                            if (summary.reviewId) params.set('reviewId', summary.reviewId);
                            router.push(`/?${params.toString()}`);
                          }}
                          className="text-[9px] font-black uppercase tracking-widest text-blue-600 hover:text-blue-800"
                        >
                          View Review
                        </button>
                        {summary.story?.id && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              const params = new URLSearchParams();
                              params.set('tab', 'work-items');
                              params.set('view', 'tree');
                              params.set('workItemId', summary.story!.id);
                              router.push(`/?${params.toString()}`);
                            }}
                            className="text-[9px] font-black uppercase tracking-widest text-slate-500 hover:text-slate-800"
                          >
                            Open Review Story
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <ArchitectureDesigner 
          diagram={editingDiagram!} 
          onClose={closeDesigner} 
          onSuccess={() => { closeDesigner(); fetchDiagrams(); }}
          bundles={bundles}
          applications={applications}
          isEditMode={isEditMode}
          milestones={milestones}
          focusReview={searchParams.get('focus') === 'review'}
          deepLinkReviewId={searchParams.get('reviewId')}
          deepLinkCycleId={searchParams.get('cycle') || searchParams.get('cycleId')}
          deepLinkThreadId={searchParams.get('threadId')}
        />
      )}

      {isWizardOpen && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm">
          <div className="w-[900px] max-w-[95vw] max-h-[85vh] bg-white rounded-[2rem] shadow-2xl border border-slate-100 overflow-hidden flex flex-col">
            <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between">
              <div>
                <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Create Diagram</div>
                <div className="text-xl font-black text-slate-800">New Canvas Wizard</div>
              </div>
              <button onClick={() => setIsWizardOpen(false)} className="w-9 h-9 rounded-full bg-slate-50 hover:bg-slate-100 text-slate-400 flex items-center justify-center"><i className="fas fa-times"></i></button>
            </div>

            <div className="px-8 py-6 overflow-y-auto flex-1">
              <div className="flex items-center gap-3 mb-6">
                {wizardMode === 'upload' ? (
                  <div className="px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border bg-blue-50 text-blue-600 border-blue-200">
                    Upload
                  </div>
                ) : (
                  (wizardMode === 'blank' ? [1, 2] : [1, 2, 3]).map(step => (
                    <div key={step} className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${wizardStep === step ? 'bg-blue-50 text-blue-600 border-blue-200' : 'bg-slate-50 text-slate-400 border-slate-100'}`}>
                      Step {step}
                    </div>
                  ))
                )}
              </div>

              {!wizardMode && (
                <div className="grid grid-cols-3 gap-4">
                  {[
                    { id: 'template', title: 'Template', desc: 'Start from curated templates.' },
                    { id: 'blank', title: 'Blank', desc: 'Start from a clean canvas.' },
                    { id: 'upload', title: 'Upload', desc: 'Upload an existing diagram.' }
                  ].map(mode => (
                    <button
                      key={mode.id}
                      onClick={() => {
                        setWizardMode(mode.id as any);
                        setWizardStep(1);
                        setSelectedType(null);
                        setSelectedFormat(null);
                        setSelectedTemplateId(null);
                      }}
                      className="p-6 rounded-[1.5rem] border border-slate-100 hover:border-slate-200 hover:bg-slate-50 text-left transition-all"
                    >
                      <div className="text-sm font-black text-slate-800">{mode.title}</div>
                      <div className="text-[10px] text-slate-400 mt-2">{mode.desc}</div>
                    </button>
                  ))}
                </div>
              )}

              {wizardMode === 'template' && wizardStep === 1 && (
                <div className="space-y-6">
                  {DIAGRAM_TYPES.map(group => (
                    <div key={group.group}>
                      <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3">{group.group}</div>
                      <div className="grid grid-cols-2 gap-3">
                        {group.items.map(item => (
                          <button
                            key={item.id}
                            onClick={() => setSelectedType(item.id)}
                            className={`p-3 rounded-2xl border text-left transition-all ${selectedType === item.id ? 'border-blue-300 bg-blue-50' : 'border-slate-100 hover:border-slate-200 hover:bg-slate-50'}`}
                          >
                            <div className="text-[13px] font-black text-slate-800">{item.label}</div>
                            <div className="text-[9px] text-slate-400 uppercase tracking-widest mt-1">{item.id.replace(/_/g, ' ')}</div>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {wizardMode === 'template' && wizardStep === 2 && (
                <div className="space-y-6">
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Choose Format</div>
                  <div className="flex flex-wrap gap-3">
                    {(selectedType ? TYPE_TO_FORMATS[selectedType] || [] : []).map(fmt => (
                      <button
                        key={fmt}
                        onClick={() => setSelectedFormat(fmt)}
                        className={`px-4 py-2.5 rounded-2xl text-[9px] font-black uppercase tracking-widest border transition-all ${selectedFormat === fmt ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'}`}
                      >
                        {fmt === DiagramFormat.MINDMAP_MD ? 'Mind Map (MD)' : fmt}
                      </button>
                    ))}
                    {!selectedType && (
                      <div className="text-sm text-slate-400">Select a diagram type first.</div>
                    )}
                  </div>
                </div>
              )}

              {wizardMode === 'blank' && wizardStep === 1 && (
                <div className="space-y-6">
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Choose Format</div>
                  <div className="flex flex-wrap gap-3">
                    {[DiagramFormat.MERMAID, DiagramFormat.DRAWIO, DiagramFormat.MINDMAP_MD, DiagramFormat.MINDMAP].map(fmt => (
                      <button
                        key={fmt}
                        onClick={() => setSelectedFormat(fmt)}
                        className={`px-4 py-2.5 rounded-2xl text-[9px] font-black uppercase tracking-widest border transition-all ${selectedFormat === fmt ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'}`}
                      >
                        {fmt === DiagramFormat.MINDMAP_MD ? 'Mind Map (MD)' : fmt === DiagramFormat.MINDMAP ? 'Mind Map (JSON)' : fmt}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {wizardMode === 'template' && wizardStep === 3 && (
                <div className="space-y-6">
                  <DocumentTypePicker
                    label="Document Type"
                    required
                    value={selectedDocumentTypeId}
                    onChange={setSelectedDocumentTypeId}
                    docTypes={docTypes}
                    categories={docCategories}
                  />
                  <div className="flex items-center justify-between">
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Start From Template</div>
                    <button
                      onClick={() => setSelectedTemplateId(null)}
                      className={`text-[9px] font-black uppercase tracking-widest ${selectedTemplateId === null ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                      Blank Diagram
                    </button>
                  </div>
                  {templatesLoading ? (
                    <div className="grid grid-cols-3 gap-4">
                      {[...Array(3)].map((_, i) => <div key={i} className="h-28 bg-slate-100 rounded-2xl animate-pulse" />)}
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-4">
                      {templateOptions.map(t => (
                        <button
                          key={t._id || t.id}
                          onClick={() => setSelectedTemplateId(String(t._id || t.id))}
                          className={`p-3 rounded-2xl border text-left transition-all ${selectedTemplateId === String(t._id || t.id) ? 'border-blue-300 bg-blue-50' : 'border-slate-100 hover:border-slate-200'}`}
                        >
                          <div className="h-16 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center overflow-hidden">
                            {t.preview?.kind === 'base64' && t.preview?.data ? (
                              <img src={`data:image/png;base64,${t.preview.data}`} className="object-cover w-full h-full" />
                            ) : t.preview?.kind === 'url' && t.preview?.data ? (
                              <img src={t.preview.data} className="object-cover w-full h-full" />
                            ) : (
                              <span className="text-[9px] font-black uppercase tracking-widest text-slate-300">No Preview</span>
                            )}
                          </div>
                          <div className="mt-2 text-[12px] font-black text-slate-800">{t.name}</div>
                          <div className="text-[9px] text-slate-400 mt-1 line-clamp-2">{t.description || 'Template'}</div>
                        </button>
                      ))}
                      {templateOptions.length === 0 && (
                        <div className="col-span-full text-sm text-slate-400">No templates available for this type/format.</div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {wizardMode === 'blank' && wizardStep === 2 && (
                <div className="space-y-6">
                  <DocumentTypePicker
                    label="Document Type"
                    required
                    value={selectedDocumentTypeId}
                    onChange={setSelectedDocumentTypeId}
                    docTypes={docTypes}
                    categories={docCategories}
                  />

                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Bundle (optional)</label>
                      <select value={selBundle} onChange={(e) => setSelBundle(e.target.value)} className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-2 text-xs font-bold text-slate-700">
                        <option value="all">All Bundles</option>
                        {bundles.map(b => <option key={b._id} value={b._id}>{b.name}</option>)}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Application (optional)</label>
                      <select value={selApp} onChange={(e) => setSelApp(e.target.value)} className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-2 text-xs font-bold text-slate-700">
                        <option value="all">All Apps</option>
                        {applications.filter(a => selBundle === 'all' || a.bundleId === selBundle).map(a => <option key={a._id} value={a._id}>{a.name}</option>)}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Milestone (optional)</label>
                      <select value={selMilestone} onChange={(e) => setSelMilestone(e.target.value)} className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-2 text-xs font-bold text-slate-700">
                        <option value="all">All Milestones</option>
                        {milestones.map(m => <option key={m._id} value={m._id}>{m.name}</option>)}
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {wizardMode === 'upload' && (
                <div className="space-y-6">
                  <DocumentTypePicker
                    label="Document Type"
                    required
                    value={selectedDocumentTypeId}
                    onChange={setSelectedDocumentTypeId}
                    docTypes={docTypes}
                    categories={docCategories}
                  />

                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Bundle (optional)</label>
                      <select value={selBundle} onChange={(e) => setSelBundle(e.target.value)} className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-2 text-xs font-bold text-slate-700">
                        <option value="all">All Bundles</option>
                        {bundles.map(b => <option key={b._id} value={b._id}>{b.name}</option>)}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Application (optional)</label>
                      <select value={selApp} onChange={(e) => setSelApp(e.target.value)} className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-2 text-xs font-bold text-slate-700">
                        <option value="all">All Apps</option>
                        {applications.filter(a => selBundle === 'all' || a.bundleId === selBundle).map(a => <option key={a._id} value={a._id}>{a.name}</option>)}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Milestone (optional)</label>
                      <select value={selMilestone} onChange={(e) => setSelMilestone(e.target.value)} className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-2 text-xs font-bold text-slate-700">
                        <option value="all">All Milestones</option>
                        {milestones.map(m => <option key={m._id} value={m._id}>{m.name}</option>)}
                      </select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Diagram Type (optional)</label>
                    <select value={selectedType || ''} onChange={(e) => setSelectedType(e.target.value || null)} className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-2 text-xs font-bold text-slate-700">
                      <option value="">None</option>
                      {DIAGRAM_TYPES.flatMap(g => g.items).map(t => (
                        <option key={t.id} value={t.id}>{t.label}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Upload File</label>
                    <input
                      type="file"
                      accept=".drawio,.xml,.svg,.png,.jpeg,.jpg,.pdf,.mmd,.md,.json"
                      onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                      className="w-full text-xs"
                    />
                    {uploadFile && (
                      <div className="text-[10px] text-slate-500">Selected: {uploadFile.name}</div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {wizardError && (
              <div className="px-8 pb-4">
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-[11px] font-bold text-rose-700">
                  {wizardError}
                </div>
              </div>
            )}

            <div className="px-8 py-6 border-t border-slate-100 flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  if (!wizardMode) {
                    setIsWizardOpen(false);
                    return;
                  }
                  if (wizardMode === 'upload') {
                    setWizardMode(null);
                    return;
                  }
                  setWizardStep(Math.max(1, wizardStep - 1));
                }}
                className="px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border border-slate-200 text-slate-500 hover:text-slate-700"
                disabled={wizardMode && wizardMode !== 'upload' ? wizardStep === 1 : false}
              >
                {wizardMode ? 'Back' : 'Cancel'}
              </button>
              <div className="flex items-center gap-3">
                {!wizardMode ? (
                  <button
                    type="button"
                    className="px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest bg-slate-100 text-slate-300"
                    disabled
                  >
                    Next
                  </button>
                ) : wizardMode === 'upload' ? (
                  <button
                    type="button"
                    onClick={handleUploadDiagram}
                    className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest ${(!selectedDocumentTypeId || !uploadFile || uploadingDiagram) ? 'bg-slate-100 text-slate-300' : 'bg-blue-600 text-white'}`}
                    disabled={!selectedDocumentTypeId || !uploadFile || uploadingDiagram}
                  >
                    {uploadingDiagram ? 'Uploading...' : 'Upload'}
                  </button>
                ) : wizardMode === 'blank' && wizardStep < 2 ? (
                  <button
                    type="button"
                    onClick={() => setWizardStep(Math.min(2, wizardStep + 1))}
                    className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest ${wizardStep === 1 && !selectedFormat ? 'bg-slate-100 text-slate-300' : 'bg-blue-600 text-white'}`}
                    disabled={wizardStep === 1 && !selectedFormat}
                  >
                    Next
                  </button>
                ) : wizardMode === 'template' && wizardStep < 3 ? (
                  <button
                    type="button"
                    onClick={() => setWizardStep(Math.min(3, wizardStep + 1))}
                    className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest ${wizardStep === 1 && !selectedType ? 'bg-slate-100 text-slate-300' : wizardStep === 2 && !selectedFormat ? 'bg-slate-100 text-slate-300' : 'bg-blue-600 text-white'}`}
                    disabled={(wizardStep === 1 && !selectedType) || (wizardStep === 2 && !selectedFormat)}
                  >
                    Next
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={createFromWizard}
                    className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest ${(!selectedFormat || (wizardMode === 'template' && !selectedType) || !selectedDocumentTypeId || creatingDiagram) ? 'bg-slate-100 text-slate-300' : 'bg-slate-900 text-white'}`}
                    disabled={!selectedFormat || (wizardMode === 'template' && !selectedType) || !selectedDocumentTypeId || creatingDiagram}
                  >
                    {creatingDiagram ? 'Creating...' : 'Create'}
                  </button>
                )}
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
  milestones: Milestone[];
  focusReview?: boolean;
  deepLinkReviewId?: string | null;
  deepLinkCycleId?: string | null;
  deepLinkThreadId?: string | null;
}> = ({ diagram, onClose, onSuccess, bundles, applications, isEditMode, milestones, focusReview, deepLinkReviewId, deepLinkCycleId, deepLinkThreadId }) => {
  const router = useRouter();
  const [savedDiagramId, setSavedDiagramId] = useState<string | null>(
    diagram?._id ? String(diagram._id) : null
  );
  const [format, setFormat] = useState<DiagramFormat>(diagram.format || DiagramFormat.MERMAID);
  const [code, setCode] = useState(diagram.content || (diagram.format === DiagramFormat.MERMAID ? DEFAULT_MERMAID_CODE : ''));
  const [title, setTitle] = useState(diagram.title || '');
  const [readOnly, setReadOnly] = useState(!isEditMode);
  const [saving, setSaving] = useState(false);
  const [isAiGenerating, setIsAiGenerating] = useState(false);
  const [activeBundleId, setActiveBundleId] = useState(diagram.bundleId || '');
  const [activeAppId, setActiveAppId] = useState(diagram.applicationId || '');
  const [activeMilestoneId, setActiveMilestoneId] = useState(diagram.milestoneId || '');
  const [tagsInput, setTagsInput] = useState(diagram.tags?.join(', ') || '');
  const [isContextOpen, setIsContextOpen] = useState(true);
  const [sideTab, setSideTab] = useState<'metadata' | 'review' | 'comments'>(focusReview ? 'review' : 'metadata');
  const [review, setReview] = useState<ReviewRecord | null>(null);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewNotes, setReviewNotes] = useState('');
  const [reviewDueAt, setReviewDueAt] = useState('');
  const [reviewActionLoading, setReviewActionLoading] = useState(false);
  const [reviewerAssignments, setReviewerAssignments] = useState<any[]>([]);
  const [manualReviewerSearch, setManualReviewerSearch] = useState('');
  const [manualReviewerOptions, setManualReviewerOptions] = useState<any[]>([]);
  const [extraReviewerIds, setExtraReviewerIds] = useState<string[]>([]);
  const [reviewToast, setReviewToast] = useState<string | null>(null);
  const [reviewToastType, setReviewToastType] = useState<'success' | 'error'>('success');
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [vendorResponseBody, setVendorResponseBody] = useState('');
  const [vendorResponseDirty, setVendorResponseDirty] = useState(false);
  const [linkedWorkItem, setLinkedWorkItem] = useState<any | null>(null);
  const [commentInitialFilter, setCommentInitialFilter] = useState<'all' | 'discussion' | 'current' | 'past'>('all');
  const [commentInitialCycleId, setCommentInitialCycleId] = useState<string | null>(null);
  const [commentSuppressNewThread, setCommentSuppressNewThread] = useState(false);
  const [commentInitialThreadId, setCommentInitialThreadId] = useState<string | null>(null);
  const diagramId = savedDiagramId || (diagram?._id ? String(diagram._id) : null);

  useEffect(() => {
    setSavedDiagramId(diagram?._id ? String(diagram._id) : null);
  }, [diagram?._id]);

  useEffect(() => {
    if (!code || code === '') {
      if (format === DiagramFormat.MERMAID) setCode(DEFAULT_MERMAID_CODE);
      else if (format === DiagramFormat.DRAWIO) setCode(DEFAULT_DRAWIO_XML);
    }
    if (format === DiagramFormat.DRAWIO && code && !code.trim().startsWith('<mxfile')) {
      setCode(DEFAULT_DRAWIO_XML);
    }
  }, [format, code]);

  useEffect(() => {
    if (deepLinkThreadId) {
      setSideTab('comments');
      setCommentInitialThreadId(String(deepLinkThreadId));
    }
  }, [deepLinkThreadId]);

  const setReviewError = (status?: number, message?: string) => {
    let nextMessage = message || 'Action failed.';
    if (status === 403) {
      nextMessage = 'You are not authorized for this action.';
    }
    if (status === 409 && (!message || message === 'Action failed.')) {
      nextMessage = 'A review cycle is already active for this diagram.';
    }
    setReviewToastType('error');
    setReviewToast(nextMessage);
  };

  const handleReviewError = async (res: Response) => {
    let message = 'Action failed.';
    try {
      const data = await res.json();
      message = data?.error || message;
    } catch {}
    setReviewError(res.status, message);
  };

  const handleSubmitForReview = async () => {
    if (!diagramId || ['undefined', 'null'].includes(diagramId)) {
      setReviewToastType('error');
      setReviewToast('Save the diagram before submitting for review.');
      return;
    }
    const bundleId = activeBundleId || diagram.bundleId;
    if (!bundleId && reviewerAssignments.length === 0 && extraReviewerIds.length === 0) {
      setReviewToastType('error');
      setReviewToast('No assigned CMO reviewers for this bundle.');
      return;
    }
    setReviewActionLoading(true);
    try {
      const defaultReviewerIds = reviewerAssignments.map((a: any) => String(a.userId || a.user?._id || a.user?.id)).filter(Boolean);
      const reviewerUserIds = Array.from(new Set([...defaultReviewerIds, ...extraReviewerIds]));
      const res = await fetch('/api/reviews/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resourceType: 'architecture_diagram',
          resourceId: diagramId,
          resourceTitle: title,
          bundleId: bundleId || undefined,
          applicationId: activeAppId || diagram.applicationId || undefined,
          dueAt: reviewDueAt || undefined,
          notes: reviewNotes || undefined,
          reviewerUserIds: reviewerUserIds.length > 0 ? reviewerUserIds : undefined
        })
      });
      if (res.ok) {
        const data = await res.json();
        setReview(data.review || null);
        setReviewNotes('');
        setReviewDueAt('');
        setExtraReviewerIds([]);
        setReviewToastType('success');
        setReviewToast('Review submitted');
      } else {
        await handleReviewError(res);
      }
    } finally {
      setReviewActionLoading(false);
    }
  };

  const handleReviewAction = async (action: 'feedback_sent' | 'resubmitted' | 'closed' | 'vendor_addressing') => {
    if (!review?.currentCycleId || !review?._id) return;
    setReviewActionLoading(true);
    try {
      const actionMap: Record<string, string> = {
        feedback_sent: 'feedback-sent',
        vendor_addressing: 'vendor-addressing',
        resubmitted: 'resubmit',
        closed: 'close'
      };
      const route = actionMap[action] || action.replace('_', '-');
      const res = await fetch(`/api/reviews/${encodeURIComponent(String(review._id))}/cycles/${encodeURIComponent(review.currentCycleId)}/${route}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ifMatchUpdatedAt: review.updatedAt, resourceType: 'architecture_diagram', resourceId: diagramId })
      });
      if (res.ok) {
        await refreshReview();
        setReviewToastType('success');
        setReviewToast('Review updated');
      } else {
        await handleReviewError(res);
      }
    } finally {
      setReviewActionLoading(false);
    }
  };

  const handleSaveVendorResponse = async (body: string) => {
    if (!review?.currentCycleId || !review?._id) return;
    setReviewActionLoading(true);
    try {
      const res = await fetch(`/api/reviews/${encodeURIComponent(String(review._id))}/cycles/${encodeURIComponent(review.currentCycleId)}/vendor-response`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body, ifMatchUpdatedAt: review.updatedAt })
      });
      if (res.ok) {
        await refreshReview();
        setReviewToastType('success');
        setReviewToast('Vendor response saved');
      } else {
        await handleReviewError(res);
      }
    } finally {
      setReviewActionLoading(false);
    }
  };

  useEffect(() => {
    if (focusReview) setSideTab('review');
  }, [focusReview]);

  useEffect(() => {
    if (focusReview && deepLinkCycleId) {
      setCommentInitialFilter('current');
      setCommentInitialCycleId(deepLinkCycleId);
      setSideTab('review');
    }
  }, [focusReview, deepLinkCycleId]);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => r.ok ? r.json() : null)
      .then((data) => setCurrentUser(data?.user || data))
      .catch(() => setCurrentUser(null));
  }, []);

  const refreshReview = useCallback(async () => {
    if (!diagramId) return;
    setReviewLoading(true);
    try {
      const res = await fetch(`/api/reviews/by-resource?resourceType=${encodeURIComponent('architecture_diagram')}&resourceId=${encodeURIComponent(String(diagramId))}`);
      const data = await res.json();
      setReview(data || null);
    } catch {
      setReview(null);
    } finally {
      setReviewLoading(false);
    }
  }, [diagramId]);

  const refreshReviewers = useCallback(async () => {
    const bundleId = activeBundleId || diagram.bundleId;
    if (!bundleId) {
      setReviewerAssignments([]);
      return;
    }
    try {
      const res = await fetch(`/api/bundle-assignments?bundleId=${encodeURIComponent(String(bundleId))}&type=assigned_cmo&active=true`);
      const data = await res.json();
      setReviewerAssignments(Array.isArray(data) ? data : []);
    } catch {
      setReviewerAssignments([]);
    }
  }, [activeBundleId, diagram.bundleId]);

  useEffect(() => {
    refreshReview();
    refreshReviewers();
  }, [refreshReview, refreshReviewers]);

  useEffect(() => {
    const loadWorkItem = async () => {
      if (!review?._id || !review.currentCycleId) {
        setLinkedWorkItem(null);
        return;
      }
      try {
        const params = new URLSearchParams({
          reviewId: String(review._id),
          cycleId: String(review.currentCycleId)
        });
        const res = await fetch(`/api/work-items/by-review?${params.toString()}`);
        const data = await res.json();
        setLinkedWorkItem(data || null);
      } catch {
        setLinkedWorkItem(null);
      }
    };
    loadWorkItem();
  }, [review?._id, review?.currentCycleId]);

  useEffect(() => {
    const currentCycle = review?.cycles?.find((c) => c.cycleId === review.currentCycleId);
    const body = currentCycle?.vendorResponse?.body || '';
    setVendorResponseBody(body);
    setVendorResponseDirty(false);
  }, [review?.currentCycleId, review?.updatedAt]);

  useEffect(() => {
    if (!manualReviewerSearch.trim()) {
      setManualReviewerOptions([]);
      return;
    }
    const controller = new AbortController();
    const q = manualReviewerSearch.trim();
    fetch(`/api/users/search?scope=cmo&includeAdmin=true&q=${encodeURIComponent(q)}`, { signal: controller.signal })
      .then((r) => r.ok ? r.json() : [])
      .then((data) => setManualReviewerOptions(Array.isArray(data) ? data : []))
      .catch(() => {});
    return () => controller.abort();
  }, [manualReviewerSearch]);

  const handleAiGeneration = async () => {
    if (!activeAppId || activeAppId === 'all') {
      alert("Please select a valid Application Context in the Mapping sidebar before generating from IaC.");
      return;
    }

    const app = applications.find(a => (a._id || a.id) === activeAppId);
    if (!app?.cloudMetadata?.terraformCode) {
      alert(`The selected application (${app?.name || 'Unknown'}) does not have a Terraform script saved in the Registry. Go to Infrastructure -> IaC Definition to add it.`);
      return;
    }

    setIsAiGenerating(true);
    setFormat(DiagramFormat.MERMAID); // AI generation optimized for Mermaid
    try {
      const res = await fetch('/api/ai/generate-diagram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: app.cloudMetadata.terraformCode })
      });
      const data = await res.json();
      if (data.mermaid) {
        setCode(data.mermaid);
      }
    } finally {
      setIsAiGenerating(false);
    }
  };

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
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        const insertedId = data?.result?.insertedId;
        if (insertedId) setSavedDiagramId(String(insertedId));
        onSuccess();
      }
    } finally {
      setSaving(false);
    }
  }, [title, diagram, format, activeBundleId, activeAppId, activeMilestoneId, tagsInput, onSuccess]);

  // Determine if we should show the "Generate from IaC" button
  const showAiGenButton = useMemo(() => {
    return activeAppId && activeAppId !== 'all' && !readOnly;
  }, [activeAppId, readOnly]);

  const currentRole = currentUser?.role;
  const currentUserId = String(currentUser?.userId || currentUser?.id || '');
  const guestAccountType = (currentUser as any)?.accountType;
  const canSubmitReview = canSubmitForReviewClient(currentRole, guestAccountType);
  const canResubmitReview = canResubmitClient(currentRole, guestAccountType);
  const canMarkFeedbackSent = canMarkFeedbackSentClient(currentRole);

  const currentCycle = review?.cycles?.find((c) => c.cycleId === review.currentCycleId);
  const isReviewer = Boolean(currentCycle && currentUserId && currentCycle.reviewerUserIds?.includes(currentUserId));
  const isClosed = review?.status === 'closed' || currentCycle?.status === 'closed';
  const canVendorActions = (isEngineeringRoleClient(currentRole) || isVendorRoleClient(currentRole)) && !isReviewer;
  const showReviewerActions = Boolean(
    currentCycle &&
      isReviewer &&
      !isClosed &&
      (currentCycle.status === 'requested' || currentCycle.status === 'in_review')
  );
  const showVendorActions = Boolean(currentCycle && !isReviewer && !isClosed && canVendorActions);
  const showVendorResponseEditor = Boolean(showVendorActions && currentCycle?.status === 'vendor_addressing');
  const showVendorResponseReadOnly = Boolean(currentCycle?.vendorResponse?.body && ['feedback_sent', 'vendor_addressing', 'closed'].includes(currentCycle.status));

  const isBinaryFormat = format === DiagramFormat.IMAGE || format === DiagramFormat.PDF;

  return (
    <div className="fixed inset-0 z-[200] bg-white flex flex-col animate-fadeIn overflow-hidden">
      <header className="px-10 py-5 bg-white border-b border-slate-200 flex items-center justify-between shrink-0 z-[210]">
        <div className="flex items-center gap-6">
          <button onClick={onClose} className="w-10 h-10 rounded-full bg-slate-50 hover:bg-slate-100 flex items-center justify-center text-slate-400 border border-slate-100 transition-all"><i className="fas fa-times"></i></button>
          <div className="flex flex-col">
            <span className="text-[9px] font-black text-blue-600 uppercase tracking-widest mb-1 italic">Blueprint Node</span>
            <input value={title} readOnly={readOnly} onChange={(e) => setTitle(e.target.value)} className={`text-2xl font-black text-slate-800 border-none p-0 focus:ring-0 outline-none bg-transparent w-[400px] ${readOnly ? 'cursor-default' : ''}`} placeholder="Untitled Blueprint" />
          </div>
        </div>
        <div className="flex items-center gap-4">
          {!readOnly && !isBinaryFormat && (
            <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 mr-4 shadow-inner">
              {[DiagramFormat.MERMAID, DiagramFormat.DRAWIO, DiagramFormat.MINDMAP_MD, DiagramFormat.MINDMAP].map(fmt => (
                <button key={fmt} onClick={() => setFormat(fmt)} className={`px-4 py-2 text-[9px] font-black uppercase rounded-lg transition-all ${format === fmt ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>{fmt === DiagramFormat.MINDMAP_MD ? 'Mind Map (MD)' : fmt === DiagramFormat.MINDMAP ? 'Mind Map (JSON)' : fmt}</button>
              ))}
            </div>
          )}
          {showAiGenButton && (
             <button 
                onClick={handleAiGeneration}
                disabled={isAiGenerating}
                className="px-6 py-3.5 bg-blue-50 text-blue-600 border border-blue-200 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center gap-3 active:scale-95 transition-all shadow-sm"
             >
                {isAiGenerating ? <i className="fas fa-circle-notch fa-spin"></i> : <i className="fas fa-wand-sparkles"></i>}
                Generate from IaC
             </button>
          )}
          {readOnly ? (
            <button onClick={() => setReadOnly(false)} className="px-10 py-3.5 bg-blue-600 text-white rounded-2xl shadow-xl font-black text-[10px] uppercase tracking-widest flex items-center gap-3 active:scale-95 transition-all"><i className="fas fa-pen"></i> Edit</button>
          ) : (
            <button onClick={() => { persistToRegistry(code); }} disabled={saving} className="px-10 py-3.5 bg-slate-900 text-white rounded-2xl shadow-xl font-black text-[10px] uppercase tracking-widest flex items-center gap-3 active:scale-95 transition-all disabled:opacity-50">
              {saving ? <i className="fas fa-circle-notch fa-spin"></i> : <i className="fas fa-save"></i>} {saving ? 'Syncing...' : 'Sync to Registry'}
            </button>
          )}
        </div>
      </header>

      <div className="flex-1 flex flex-row overflow-hidden bg-slate-50 relative">
        <div className="flex-1 relative overflow-hidden flex flex-col min-w-0">
          {format === DiagramFormat.MINDMAP ? (
            <Suspense fallback={<div className="flex-1 flex items-center justify-center bg-white"><i className="fas fa-circle-notch fa-spin text-blue-500 text-2xl"></i></div>}><MindMapFlowEditor initialContent={code} onSave={setCode} readOnly={readOnly} /></Suspense>
          ) : format === DiagramFormat.MINDMAP_MD ? (
            <Suspense fallback={<div className="flex-1 flex items-center justify-center bg-white"><i className="fas fa-circle-notch fa-spin text-blue-500 text-2xl"></i></div>}><MindMapMarkdownEditor initialContent={code} onSave={setCode} readOnly={readOnly} /></Suspense>
          ) : format === DiagramFormat.MERMAID ? (
            <div className="flex-1 flex overflow-hidden">
               {!readOnly && <div className="w-1/3 bg-slate-900 flex flex-col border-r border-white/5"><textarea value={code} onChange={(e) => setCode(e.target.value)} readOnly={readOnly} className="flex-1 bg-transparent text-emerald-400 font-mono text-sm p-8 outline-none resize-none custom-scrollbar" /></div>}
               <div className="flex-1 bg-white p-0 overflow-hidden relative">
                 {isAiGenerating ? (
                    <div className="h-full flex flex-col items-center justify-center bg-white gap-6">
                       <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] animate-pulse">Gemini Reverse-Engineering Infrastructure...</p>
                    </div>
                 ) : (
                    <MermaidRenderer content={code || DEFAULT_MERMAID_CODE} id={diagram._id || 'temp'} />
                 )}
               </div>
            </div>
          ) : format === DiagramFormat.DRAWIO ? (
            <div className="flex-1 relative bg-white h-full w-full"><DrawioEditor xml={code || DEFAULT_DRAWIO_XML} onSave={(xml) => setCode(xml)} readOnly={readOnly} /></div>
          ) : format === DiagramFormat.IMAGE ? (
            <div className="flex-1 relative bg-white h-full w-full flex items-center justify-center">
              {code ? <img src={code} alt={title} className="max-h-full max-w-full object-contain" /> : <div className="text-slate-400 text-sm">No image content</div>}
            </div>
          ) : format === DiagramFormat.PDF ? (
            <div className="flex-1 relative bg-white h-full w-full">
              {code ? <iframe src={code} className="w-full h-full" /> : <div className="text-slate-400 text-sm p-6">No PDF content</div>}
            </div>
          ) : (
            <div className="flex-1 relative bg-white h-full w-full flex items-center justify-center text-slate-400">Unsupported format</div>
          )}
        </div>

        <aside className={`border-l border-slate-200 bg-white transition-all duration-500 ease-in-out shrink-0 z-[204] relative flex flex-col ${isContextOpen ? 'w-[35rem]' : 'w-0 overflow-hidden opacity-0'}`}>
           <div className="p-8 space-y-8 min-w-[560px]">
             <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl border border-slate-200">
               <button
                 onClick={() => setSideTab('metadata')}
                 className={`px-4 py-2 text-[9px] font-black uppercase rounded-lg transition-all ${
                   sideTab === 'metadata' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-400 hover:text-slate-600'
                 }`}
               >
                 Metadata
               </button>
               <button
                 onClick={() => setSideTab('review')}
                 className={`px-4 py-2 text-[9px] font-black uppercase rounded-lg transition-all ${
                   sideTab === 'review' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-400 hover:text-slate-600'
                 }`}
               >
                 Review
               </button>
               <button
                 onClick={() => {
                   setSideTab('comments');
                   setCommentInitialFilter('all');
                   setCommentInitialCycleId(null);
                   setCommentSuppressNewThread(false);
                 }}
                 className={`px-4 py-2 text-[9px] font-black uppercase rounded-lg transition-all ${
                   sideTab === 'comments' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-400 hover:text-slate-600'
                 }`}
               >
                 Comments
               </button>
               <button
                 onClick={() => setIsContextOpen(false)}
                 title="Collapse panel"
                 aria-label="Collapse panel"
                 className="ml-auto w-8 h-8 rounded-lg border border-slate-200 bg-white flex items-center justify-center hover:bg-slate-50"
               >
                 <img src="/icons/close-pane.png" alt="Collapse panel" className="w-4 h-4" />
               </button>
             </div>

             {sideTab === 'metadata' && (
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
                           <option value="all">Global Resource</option>
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
             )}

             {sideTab === 'review' && (
               <section>
                 <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                   <i className="fas fa-clipboard-check"></i> Review
                 </h4>

                 {reviewToast && (
                   <div className={`mb-4 text-[10px] font-black uppercase tracking-widest px-3 py-2 rounded-xl border ${
                     reviewToastType === 'error' ? 'bg-rose-50 border-rose-200 text-rose-700' : 'bg-emerald-50 border-emerald-200 text-emerald-700'
                   }`}>
                     {reviewToast}
                   </div>
                 )}

                 <>
                   {reviewLoading && <div className="text-xs text-slate-400">Loading review...</div>}
                   {!reviewLoading && currentCycle && (
                     <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 space-y-3">
                       <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">Cycle #{currentCycle.number}</div>
                       <div className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                         Status: {currentCycle.status.replace(/_/g, ' ')}
                       </div>
                       {linkedWorkItem && (
                         <button
                           onClick={() => {
                             const params = new URLSearchParams();
                             params.set('tab', 'work-items');
                             params.set('view', 'tree');
                             params.set('workItemId', String(linkedWorkItem._id || linkedWorkItem.id || ''));
                             router.push(`/?${params.toString()}`);
                           }}
                           className="text-[9px] font-black uppercase tracking-widest text-blue-600 hover:text-blue-800"
                           title="Open related work item"
                         >
                           Open Work Item → {linkedWorkItem.key}
                         </button>
                       )}
                       <div className="text-[9px] font-bold text-slate-500">
                         Due: {currentCycle.dueAt ? new Date(currentCycle.dueAt).toLocaleDateString() : '—'}
                       </div>
                       <div className="flex flex-wrap gap-2">
                         {(currentCycle.reviewers || []).map((r: any) => (
                           <span key={r.userId} className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest bg-white border border-slate-200 text-slate-500">
                             {r.displayName || r.email || r.userId}
                           </span>
                         ))}
                       </div>
                     </div>
                   )}

                   {!reviewLoading && !currentCycle && (
                     <div className="space-y-4">
                       <div>
                         <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Due Date</label>
                         <input
                           type="date"
                           value={reviewDueAt}
                           onChange={(e) => setReviewDueAt(e.target.value)}
                           className="mt-2 w-full border border-slate-200 rounded-xl px-3 py-2 text-xs"
                         />
                       </div>
                       <div>
                         <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Notes</label>
                         <textarea
                           value={reviewNotes}
                           onChange={(e) => setReviewNotes(e.target.value)}
                           className="mt-2 w-full border border-slate-200 rounded-xl px-3 py-2 text-xs min-h-[80px]"
                           placeholder="Optional notes for reviewers"
                         />
                       </div>
                       <div>
                         <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Default Reviewers (CMO)</label>
                         {reviewerAssignments.length === 0 ? (
                           <div className="mt-2 text-[9px] font-black uppercase tracking-widest text-amber-600">No assigned reviewers.</div>
                         ) : (
                           <div className="mt-2 flex flex-wrap gap-2">
                             {reviewerAssignments.map((assignment: any) => (
                               <span key={assignment.userId || assignment.user?._id} className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest bg-white border border-slate-200 text-slate-500">
                                 {assignment.user?.name || assignment.user?.email || assignment.userId}
                               </span>
                             ))}
                           </div>
                         )}
                       </div>
                       <div>
                         <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Add Reviewers (CMO/Admin)</label>
                         <input
                           value={manualReviewerSearch}
                           onChange={(e) => setManualReviewerSearch(e.target.value)}
                           placeholder="Search CMO/Admin users"
                           className="mt-2 w-full border border-slate-200 rounded-xl px-3 py-2 text-xs"
                         />
                         <div className="mt-2 flex flex-wrap gap-2">
                           {manualReviewerOptions.map((user: any) => {
                             const checked = extraReviewerIds.includes(user.id);
                             return (
                               <label key={user.id} className="flex items-center gap-2 px-2 py-1 rounded-full border border-slate-200 bg-white text-[9px] font-black uppercase tracking-widest text-slate-500">
                                 <input
                                   type="checkbox"
                                   checked={checked}
                                   onChange={(e) => {
                                     if (e.target.checked) {
                                       setExtraReviewerIds((prev) => [...prev, user.id]);
                                     } else {
                                       setExtraReviewerIds((prev) => prev.filter((id) => id !== user.id));
                                     }
                                   }}
                                 />
                                 {user.name || user.email}
                               </label>
                             );
                           })}
                         </div>
                       </div>
                     </div>
                   )}

                   <div className="mt-4 flex flex-wrap gap-3 items-center">
                     {!currentCycle && (
                       <button
                         onClick={handleSubmitForReview}
                         disabled={!canSubmitReview || reviewActionLoading}
                         className="px-4 py-2 bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest rounded-xl disabled:opacity-50"
                       >
                         {reviewActionLoading ? 'Submitting...' : 'Submit for Review'}
                       </button>
                     )}
                     {showReviewerActions && (
                       <>
                         <button
                           onClick={() => {
                             setSideTab('comments');
                             setCommentInitialFilter('current');
                             setCommentInitialCycleId(review?.currentCycleId || null);
                             setCommentSuppressNewThread(true);
                           }}
                           disabled={reviewActionLoading}
                           className="px-4 py-2 bg-white border border-slate-200 text-slate-600 text-[10px] font-black uppercase tracking-widest rounded-xl"
                         >
                           Add Review Comment
                         </button>
                         <button
                           onClick={() => handleReviewAction('feedback_sent')}
                           disabled={reviewActionLoading || !canMarkFeedbackSent}
                           className="px-4 py-2 bg-emerald-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl disabled:opacity-50"
                         >
                           {reviewActionLoading ? 'Updating...' : 'Mark Feedback Sent'}
                         </button>
                       </>
                     )}
                     {showVendorActions && currentCycle?.status === 'feedback_sent' && (
                       <button
                         onClick={() => handleReviewAction('vendor_addressing')}
                         disabled={reviewActionLoading}
                         className="px-4 py-2 bg-slate-100 text-slate-600 text-[10px] font-black uppercase tracking-widest rounded-xl"
                       >
                         {reviewActionLoading ? 'Updating...' : 'Start Addressing'}
                       </button>
                     )}
                     {showVendorActions && (currentCycle?.status === 'feedback_sent' || currentCycle?.status === 'vendor_addressing') && (
                       <button
                         onClick={() => handleReviewAction('resubmitted')}
                         disabled={reviewActionLoading}
                         className="px-4 py-2 bg-blue-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl disabled:opacity-50"
                       >
                         {reviewActionLoading ? 'Updating...' : 'Resubmit (New Cycle)'}
                       </button>
                     )}
                     {showVendorActions && currentCycle?.status === 'vendor_addressing' && (
                       <button
                         onClick={() => handleReviewAction('closed')}
                         disabled={reviewActionLoading}
                         className="px-4 py-2 bg-slate-100 text-slate-600 text-[10px] font-black uppercase tracking-widest rounded-xl disabled:opacity-50"
                       >
                         {reviewActionLoading ? 'Updating...' : 'Close Cycle'}
                       </button>
                     )}
                     {isClosed && !isReviewer && canResubmitReview && (
                       <button
                         onClick={handleSubmitForReview}
                         disabled={!canSubmitReview || reviewActionLoading}
                         className="px-4 py-2 bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest rounded-xl disabled:opacity-50"
                       >
                         Start New Review Cycle
                       </button>
                     )}
                   </div>

                   {showVendorResponseEditor && (
                     <div className="mt-4">
                       <div className="text-[9px] font-black uppercase tracking-widest text-slate-400">Vendor Response</div>
                       <textarea
                         value={vendorResponseBody}
                         onChange={(e) => { setVendorResponseBody(e.target.value); setVendorResponseDirty(true); }}
                         className="mt-2 w-full border border-slate-200 rounded-xl px-3 py-2 text-xs min-h-[120px]"
                         placeholder="Summarize changes or next steps"
                       />
                       <div className="mt-2 flex items-center justify-between">
                         <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400">
                           {vendorResponseDirty ? 'Unsaved changes' : ''}
                         </span>
                         <button
                           onClick={() => handleSaveVendorResponse(vendorResponseBody)}
                           disabled={!vendorResponseDirty || reviewActionLoading}
                           className="px-4 py-2 bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest rounded-xl disabled:opacity-50"
                         >
                           {reviewActionLoading ? 'Saving...' : 'Save'}
                         </button>
                       </div>
                     </div>
                   )}
                   {showVendorResponseReadOnly && currentCycle?.vendorResponse?.body && (
                     <div className="mt-4">
                       <div className="text-[9px] font-black uppercase tracking-widest text-slate-400">Vendor Response</div>
                       <div className="mt-2 bg-white border border-slate-100 rounded-xl p-4 text-xs text-slate-700 whitespace-pre-wrap">
                         {currentCycle.vendorResponse.body}
                       </div>
                     </div>
                   )}
                 </>
               </section>
             )}
             {sideTab === 'comments' && (
               <section className="border border-slate-100 rounded-2xl overflow-hidden">
                <CommentsDrawer
                  embedded
                  isOpen
                  onClose={() => {}}
                  resource={diagramId ? { type: 'architecture_diagram', id: String(diagramId), title } : null}
                  currentUser={currentUser}
                  initialFilter={commentInitialFilter}
                  initialCycleId={commentInitialCycleId}
                  currentReviewCycleId={review?.currentCycleId || null}
                  reviewId={review?._id ? String(review._id) : (deepLinkReviewId || null)}
                  suppressNewThread={commentSuppressNewThread}
                  initialThreadId={commentInitialThreadId}
                />
              </section>
            )}
           </div>
        </aside>

        <button onClick={() => setIsContextOpen(!isContextOpen)} className={`absolute bottom-8 right-8 z-[215] w-12 h-12 rounded-full shadow-2xl flex items-center justify-center transition-all ${isContextOpen ? 'bg-slate-900 text-white' : 'bg-blue-600 text-white animate-bounce'}`} title={isContextOpen ? "Collapse Mapping Panel" : "Expand Mapping Panel"}><i className={`fas ${isContextOpen ? 'fa-chevron-right' : 'fa-link'}`}></i></button>
      </div>

    </div>
  );
};

export default ArchitectureDiagrams;
