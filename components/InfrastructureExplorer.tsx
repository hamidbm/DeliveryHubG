import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Application, Bundle } from '../types';
import { marked } from 'marked';
import DOMPurify from 'isomorphic-dompurify';
import mermaid from 'mermaid';
import * as d3 from 'd3';

const MOCK_TF = `resource "azurerm_resource_group" "nexus" {
  name     = "rg-delivery-hub-prod"
  location = "East US"
}

resource "azurerm_kubernetes_cluster" "aks" {
  name                = "aks-nexus-east-001"
  location            = azurerm_resource_group.nexus.location
  resource_group_name = azurerm_resource_group.nexus.name
  dns_prefix          = "nexusaks"

  default_node_pool {
    name       = "default"
    node_count = 3
    vm_size    = "Standard_D2_v2"
  }

  identity {
    type = "SystemAssigned"
  }
}`;

const InfraMermaidRenderer: React.FC<{ content: string; appId: string }> = ({ content, appId }) => {
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
    let isMounted = true;
    const renderMap = async () => {
      if (!containerRef.current || !content) return;
      try {
        containerRef.current.innerHTML = '';
        const uniqueId = `infra-render-${appId.replace(/[^a-zA-Z0-9]/g, '-')}-${Date.now()}`;
        mermaid.initialize({ 
          startOnLoad: false, 
          theme: 'neutral', 
          securityLevel: 'loose', 
          fontFamily: 'Inter' 
        });
        
        const { svg } = await mermaid.render(uniqueId, content);
        
        if (isMounted && containerRef.current) {
          containerRef.current.innerHTML = svg;
          const svgEl = containerRef.current.querySelector('svg');
          
          if (svgEl) {
            svgEl.setAttribute('width', '100%');
            svgEl.setAttribute('height', '100%');
            svgEl.style.maxWidth = 'none';
            svgEl.style.maxHeight = 'none';
            svgEl.style.cursor = 'grab';
            svgEl.style.display = 'block';

            const svgSelection = d3.select(svgEl);
            const zoom = d3.zoom()
              .scaleExtent([0.1, 8])
              .on('zoom', (event) => {
                svgSelection.selectAll('g').filter(function() {
                  // Only apply transform to the top-level groups to maintain zoom correctly
                  return this.parentNode === svgEl;
                }).attr('transform', event.transform);
              });

            zoomRef.current = zoom;
            svgSelection.call(zoom as any);
            svgSelection.call(zoom.transform as any, d3.zoomIdentity);
          }
        }
      } catch (err) {
        if (isMounted && containerRef.current) {
          containerRef.current.innerHTML = `
            <div class="p-12 text-red-500 bg-red-50 rounded-[2rem] border border-red-100 flex flex-col items-center text-center max-w-md mx-auto shadow-sm">
              <i class="fas fa-triangle-exclamation text-3xl mb-4"></i>
              <h4 class="text-sm font-black uppercase tracking-widest mb-2">Visualization Failed</h4>
              <p class="text-xs font-medium text-red-400">The generated Mermaid code contains syntax errors. Please refine the IaC script and retry.</p>
            </div>
          `;
        }
      }
    };
    renderMap();
    return () => { isMounted = false; };
  }, [content, appId]);

  return (
    <div className="relative w-full h-full group/infra-vis">
      <div ref={containerRef} className="w-full h-full flex items-center justify-center overflow-hidden animate-fadeIn" />
      
      {/* Zoom Controls Overlay */}
      <div className="absolute bottom-6 left-6 flex flex-col gap-2 opacity-0 group-hover/infra-vis:opacity-100 transition-opacity duration-300 z-50">
        <div className="flex flex-col bg-white/80 backdrop-blur-md border border-slate-200 rounded-2xl shadow-2xl overflow-hidden">
          <button onClick={() => handleZoom('in')} className="p-3 text-slate-600 hover:bg-blue-50 hover:text-blue-600 border-b border-slate-100 transition-colors" title="Zoom In"><i className="fas fa-plus text-xs"></i></button>
          <button onClick={() => handleZoom('out')} className="p-3 text-slate-600 hover:bg-blue-50 hover:text-blue-600 transition-colors border-b border-slate-100" title="Zoom Out"><i className="fas fa-minus text-xs"></i></button>
          <button onClick={() => handleZoom('reset')} className="p-3 text-slate-600 hover:bg-blue-50 hover:text-blue-600 transition-colors" title="Reset View"><i className="fas fa-compress text-xs"></i></button>
        </div>
        <div className="px-3 py-1.5 bg-slate-900 text-white rounded-xl text-[8px] font-black uppercase tracking-widest text-center shadow-lg">D3 Zoom Engine</div>
      </div>
    </div>
  );
};

const InfrastructureExplorer: React.FC<{ applications: Application[], onUpdate?: () => void }> = ({ applications, onUpdate }) => {
  const [selectedApp, setSelectedApp] = useState<Application | null>(null);
  const [tfCode, setTfCode] = useState('');
  const [aiInsight, setAiInsight] = useState<string | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  
  const [topographyContent, setTopographyContent] = useState<string | null>(null);
  const [isTopographyLoading, setIsTopographyLoading] = useState(false);
  const [topographyError, setTopographyError] = useState<string | null>(null);
  const [activeEngine, setActiveEngine] = useState<string | null>(null);
  const [auditEngine, setAuditEngine] = useState<string | null>(null);
  const [isAuthError, setIsAuthError] = useState(false);

  const [activeTab, setActiveTab] = useState<'iac' | 'topography' | 'audit'>('iac');
  const [searchTerm, setSearchTerm] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (selectedApp) {
      setTfCode(selectedApp.cloudMetadata?.terraformCode || MOCK_TF);
      setAiInsight(null);
      setTopographyContent(null);
      setTopographyError(null);
      setIsAuthError(false);
    }
  }, [selectedApp]);

  const filteredApps = useMemo(() => {
    return applications.filter(a => 
      a.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      a.aid.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [applications, searchTerm]);

  const handleReAuthorize = async () => {
    if (window.aistudio) {
      await window.aistudio.openSelectKey();
      setIsAuthError(false);
      if (activeTab === 'topography') handleGenerateTopography();
      else if (activeTab === 'audit') runAiAudit();
    }
  };

  const runAiAudit = async () => {
    if (!tfCode) return;
    setIsAiLoading(true);
    setActiveTab('audit');
    try {
      const res = await fetch('/api/ai/analyze-terraform', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: tfCode, provider: selectedApp?.cloudMetadata?.provider || 'Azure' })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setAiInsight(data.analysis);
      setAuditEngine(data.engine);
    } catch (err: any) {
      setAiInsight(`### Audit Failed\n\n${err.message}`);
    } finally {
      setIsAiLoading(false);
    }
  };

  // Auto-trigger audit if tab switched and no data exists
  useEffect(() => {
    if (activeTab === 'audit' && !aiInsight && !isAiLoading && tfCode) {
      runAiAudit();
    }
  }, [activeTab]);

  const handleGenerateTopography = async () => {
    if (!tfCode || tfCode.trim().length < 10) {
      alert("IaC Definition is too brief to map.");
      return;
    }

    setIsTopographyLoading(true);
    setTopographyError(null);
    setIsAuthError(false);
    
    try {
      const res = await fetch('/api/ai/generate-diagram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: tfCode })
      });
      
      const data = await res.json();
      if (data.mermaid === "ERROR_AUTH: API Key Unauthorized or Missing") {
        setIsAuthError(true);
        throw new Error("Missing AI Credentials");
      }

      if (data.error) throw new Error(data.error);

      if (data.mermaid) {
        setTopographyContent(data.mermaid);
        setActiveEngine(data.engine);
      } else {
        throw new Error("Intelligence engine returned empty payload.");
      }
    } catch (err: any) {
      setTopographyError(err.message || "Failed to synthesize logical state.");
    } finally {
      setIsTopographyLoading(false);
    }
  };

  const handleSaveTf = async () => {
    if (!selectedApp?._id) return;
    setSaving(true);
    const metadata = { ...selectedApp.cloudMetadata, terraformCode: tfCode, lastAppliedAt: new Date().toISOString() };
    try {
      const res = await fetch(`/api/applications/${selectedApp._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cloudMetadata: metadata })
      });
      if (res.ok) {
        setSelectedApp({ ...selectedApp, cloudMetadata: metadata as any });
        if (onUpdate) onUpdate();
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex h-[850px] bg-white rounded-[3rem] border border-slate-200 shadow-2xl overflow-hidden animate-fadeIn">
      <aside className="w-80 border-r border-slate-100 flex flex-col shrink-0 bg-slate-50/30">
        <div className="p-8 border-b border-slate-100 bg-white/50 backdrop-blur shrink-0">
           <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Cloud Fleet</h3>
           <div className="relative">
              <i className="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 text-[10px]"></i>
              <input type="text" placeholder="Search..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full bg-slate-100 border-none rounded-xl pl-10 pr-4 py-2.5 text-[11px] font-bold outline-none focus:ring-2 focus:ring-blue-500/10" />
           </div>
        </div>
        <nav className="flex-1 overflow-y-auto p-4 custom-scrollbar">
           {filteredApps.map(app => (
             <button key={app._id} onClick={() => setSelectedApp(app)} className={`w-full text-left p-4 rounded-2xl transition-all flex items-center gap-4 mb-1 ${selectedApp?._id === app._id ? 'bg-white shadow-xl border border-slate-100 ring-2 ring-blue-500/10' : 'hover:bg-white/50 text-slate-500'}`}>
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${selectedApp?._id === app._id ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-400'}`}><i className={`fas ${app.cloudMetadata?.provider === 'GCP' ? 'fa-google' : 'fa-cloud'}`}></i></div>
                <div className="min-w-0 flex-1"><p className={`text-sm font-black truncate ${selectedApp?._id === app._id ? 'text-slate-900' : 'text-slate-600'}`}>{app.name}</p></div>
             </button>
           ))}
        </nav>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden bg-white">
        {selectedApp ? (
          <>
            <header className="p-10 border-b border-slate-50 flex items-center justify-between shrink-0">
               <div className="flex items-center gap-6">
                  <div className={`w-16 h-16 rounded-[1.5rem] flex items-center justify-center text-2xl shadow-2xl text-white ${selectedApp.cloudMetadata?.provider === 'GCP' ? 'bg-emerald-500' : 'bg-blue-600'}`}><i className={`fas ${selectedApp.cloudMetadata?.provider === 'GCP' ? 'fa-shapes' : 'fa-cubes'}`}></i></div>
                  <div><h2 className="text-3xl font-black text-slate-900 tracking-tighter uppercase italic">{selectedApp.name} Workspace</h2></div>
               </div>
               <div className="flex gap-3">
                  <button onClick={runAiAudit} disabled={isAiLoading} className="px-6 py-3 bg-slate-900 text-white text-[10px] font-black rounded-2xl shadow-xl hover:bg-blue-600 transition-all uppercase tracking-widest">{isAiLoading ? <i className="fas fa-circle-notch fa-spin"></i> : <i className="fas fa-shield-halved"></i>} Trigger Audit</button>
                  <button onClick={handleSaveTf} disabled={saving} className="px-6 py-3 bg-blue-50 text-blue-600 border border-blue-100 text-[10px] font-black rounded-2xl">Sync Script</button>
               </div>
            </header>

            <div className="flex px-10 border-b border-slate-50 bg-slate-50/30">
               {[{ id: 'iac', label: 'IaC Definition', icon: 'fa-code' }, { id: 'topography', label: 'Infrastructure Map', icon: 'fa-project-diagram' }, { id: 'audit', label: 'Security Audit', icon: 'fa-shield-halved' }].map(tab => (
                 <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`px-8 py-4 text-[10px] font-black uppercase tracking-widest border-b-2 flex items-center gap-2 transition-all ${activeTab === tab.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400'}`}><i className={`fas ${tab.icon}`}></i> {tab.label}</button>
               ))}
            </div>

            <div className="flex-1 overflow-y-auto bg-white custom-scrollbar">
               {activeTab === 'iac' && <textarea value={tfCode} onChange={(e) => setTfCode(e.target.value)} spellCheck={false} className="w-full h-full p-10 bg-slate-950 text-emerald-400 font-mono text-sm outline-none resize-none custom-scrollbar" />}
               
               {activeTab === 'topography' && (
                 <div className="p-0 h-full flex flex-col overflow-hidden">
                    {isTopographyLoading ? (
                        <div className="flex-1 flex flex-col items-center justify-center gap-6">
                            <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] animate-pulse">Consulting AI Engine...</p>
                        </div>
                    ) : isAuthError ? (
                        <div className="flex-1 flex flex-col items-center justify-center text-center p-12">
                            <div className="w-20 h-20 bg-amber-50 text-amber-500 rounded-full flex items-center justify-center mb-6 border border-amber-100 shadow-inner">
                                <i className="fas fa-lock text-2xl"></i>
                            </div>
                            <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">AI Access Required</h3>
                            <p className="text-slate-400 font-medium max-w-sm mt-3 leading-relaxed">Infrastructure mapping requires an authorized API Key from a paid project. Authorization for this session is missing or expired.</p>
                            <button onClick={handleReAuthorize} className="mt-8 px-10 py-4 bg-blue-600 text-white text-[10px] font-black uppercase rounded-2xl shadow-xl hover:bg-blue-700 transition-all active:scale-95">Authorize Logic Engine</button>
                        </div>
                    ) : topographyError ? (
                        <div className="flex-1 flex flex-col items-center justify-center text-center p-12">
                            <div className="w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center mb-6 border border-red-100">
                                <i className="fas fa-circle-exclamation text-2xl"></i>
                            </div>
                            <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">Generation Failed</h3>
                            <p className="text-slate-400 font-medium max-w-sm mt-3 leading-relaxed">{topographyError}</p>
                            <button onClick={handleGenerateTopography} className="mt-8 px-10 py-4 bg-slate-900 text-white text-[10px] font-black uppercase rounded-2xl shadow-xl">Try Again</button>
                        </div>
                    ) : topographyContent ? (
                        <div className="h-full flex flex-col">
                            <header className="px-10 py-6 flex justify-between items-center border-b border-slate-50">
                                <div className="flex items-center gap-3">
                                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><i className="fas fa-circle text-emerald-500 text-[6px]"></i> Active Topology Snapshotted</span>
                                  <div className="px-3 py-1 bg-blue-50 text-blue-600 rounded-lg text-[8px] font-black uppercase tracking-widest border border-blue-100 flex items-center gap-2">
                                     <i className="fas fa-microchip"></i>
                                     {activeEngine}
                                  </div>
                                </div>
                                <div className="flex gap-2">
                                  <button onClick={handleGenerateTopography} className="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl text-[9px] font-black uppercase">Re-Sync</button>
                                  <button onClick={() => setTopographyContent(null)} className="px-4 py-2 bg-white border border-slate-200 text-slate-400 rounded-xl text-[9px] font-black uppercase">Clear</button>
                                </div>
                            </header>
                            <div className="flex-1 bg-slate-50/50 flex items-center justify-center overflow-hidden shadow-inner relative">
                                <InfraMermaidRenderer content={topographyContent} appId={selectedApp._id!} />
                            </div>
                        </div>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-center p-12">
                            <div className="w-24 h-24 bg-slate-50 rounded-[2.5rem] flex items-center justify-center mb-8 border border-slate-100 shadow-inner"><i className="fas fa-diagram-project text-slate-200 text-4xl"></i></div>
                            <h3 className="text-xl font-black text-slate-800 tracking-tight uppercase">Live Topography</h3>
                            <p className="text-slate-400 font-medium max-w-sm mt-3 leading-relaxed">Reverse-engineer logical resource relationships from the Terraform state definition using the default System LLM.</p>
                            <button onClick={handleGenerateTopography} className="mt-8 px-10 py-4 bg-slate-900 text-white text-[10px] font-black uppercase rounded-2xl shadow-xl hover:bg-blue-600 transition-all active:scale-95">Generate Graph</button>
                        </div>
                    )}
                 </div>
               )}

               {activeTab === 'audit' && (
                 <div className="p-10 min-h-full bg-white">
                    {isAiLoading ? (
                      <div className="flex flex-col items-center justify-center py-32 gap-6">
                        <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] animate-pulse">Running Multi-Vector Security Scan...</p>
                      </div>
                    ) : aiInsight ? (
                      <div className="animate-fadeIn space-y-10">
                         <header className="flex justify-between items-center bg-slate-50 px-8 py-5 rounded-2xl border border-slate-100">
                            <div className="flex items-center gap-4">
                               <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                               <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Registry Audit Report Complete</span>
                            </div>
                            <div className="flex items-center gap-3">
                               <span className="px-3 py-1 bg-blue-50 text-blue-600 rounded-lg text-[8px] font-black uppercase tracking-widest border border-blue-100 flex items-center gap-2">
                                  <i className="fas fa-microchip"></i> {auditEngine}
                               </span>
                               <button onClick={runAiAudit} className="px-4 py-1.5 bg-slate-900 text-white text-[9px] font-black rounded-lg uppercase tracking-widest shadow-lg">Re-Scan</button>
                            </div>
                         </header>
                         <div className="prose prose-slate max-w-none prose-h1:text-4xl prose-h2:text-2xl prose-p:text-slate-600" 
                              dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(marked.parse(aiInsight) as string) }} />
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-32 text-center">
                        <div className="w-24 h-24 bg-slate-50 rounded-[2.5rem] flex items-center justify-center mb-8 border border-slate-100 shadow-inner">
                           <i className="fas fa-shield-halved text-slate-200 text-4xl"></i>
                        </div>
                        <h3 className="text-xl font-black text-slate-800 tracking-tight uppercase">Infrastructure Auditor</h3>
                        <p className="text-slate-400 font-medium max-w-md mt-3 leading-relaxed">Execute an AI-powered security and cost audit on your IaC definition. Detect misconfigurations before deployment.</p>
                        <button onClick={runAiAudit} className="mt-8 px-10 py-4 bg-blue-600 text-white text-[10px] font-black uppercase rounded-2xl shadow-xl hover:bg-blue-700 transition-all active:scale-95">Initiate Audit</button>
                      </div>
                    )}
                 </div>
               )}
            </div>
          </>
        ) : (
          <div className="h-full flex flex-col items-center justify-center p-20 text-center bg-slate-50/10">
            <div className="w-24 h-24 bg-white rounded-[2.5rem] flex items-center justify-center mb-8 border border-slate-100 shadow-xl shadow-slate-200/50"><i className="fas fa-cloud text-slate-100 text-4xl"></i></div>
            <h3 className="text-xl font-black text-slate-800 tracking-tight uppercase">Cloud Command Center</h3>
          </div>
        )}
      </main>

      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
      `}} />
    </div>
  );
};

export default InfrastructureExplorer;