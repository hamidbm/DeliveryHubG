
import React, { useState, useEffect, useMemo } from 'react';
import { Application, Bundle } from '../types';
import { marked } from 'marked';
import DOMPurify from 'isomorphic-dompurify';

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

const InfrastructureExplorer: React.FC<{ applications: Application[] }> = ({ applications }) => {
  const [selectedApp, setSelectedApp] = useState<Application | null>(null);
  const [tfCode, setTfCode] = useState('');
  const [aiInsight, setAiInsight] = useState<string | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'iac' | 'topography' | 'audit'>('iac');
  const [searchTerm, setSearchTerm] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (selectedApp) {
      setTfCode(selectedApp.cloudMetadata?.terraformCode || MOCK_TF);
      setAiInsight(null);
    }
  }, [selectedApp]);

  const filteredApps = useMemo(() => {
    return applications.filter(a => 
      a.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      a.aid.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [applications, searchTerm]);

  const runAiAudit = async () => {
    if (!tfCode) return;
    setIsAiLoading(true);
    setActiveTab('audit');
    try {
      const res = await fetch('/api/ai/analyze-terraform', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          code: tfCode, 
          provider: selectedApp?.cloudMetadata?.provider || 'Azure' 
        })
      });
      const data = await res.json();
      setAiInsight(data.analysis);
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleSaveTf = async () => {
    if (!selectedApp?._id) return;
    setSaving(true);
    const metadata = {
        ...selectedApp.cloudMetadata,
        terraformCode: tfCode,
        lastAppliedAt: new Date().toISOString()
    };
    try {
      await fetch(`/api/applications/${selectedApp._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cloudMetadata: metadata })
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex h-[850px] bg-white rounded-[3rem] border border-slate-200 shadow-2xl overflow-hidden animate-fadeIn">
      {/* App Sidebar */}
      <aside className="w-80 border-r border-slate-100 flex flex-col shrink-0 bg-slate-50/30">
        <div className="p-8 border-b border-slate-100 bg-white/50 backdrop-blur shrink-0">
           <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Cloud Fleet</h3>
           <div className="relative">
              <i className="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 text-[10px]"></i>
              <input 
                type="text" 
                placeholder="Search resources..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-100 border-none rounded-xl pl-10 pr-4 py-2.5 text-[11px] font-bold outline-none focus:ring-2 focus:ring-blue-500/10 transition-all"
              />
           </div>
        </div>
        <nav className="flex-1 overflow-y-auto p-4 custom-scrollbar">
           {filteredApps.map(app => (
             <button
               key={app._id}
               onClick={() => setSelectedApp(app)}
               className={`w-full text-left p-4 rounded-2xl transition-all flex items-center gap-4 group mb-1 ${
                 selectedApp?._id === app._id ? 'bg-white shadow-xl border border-slate-100 ring-2 ring-blue-500/10' : 'hover:bg-white/50 text-slate-500'
               }`}
             >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                  selectedApp?._id === app._id ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-400'
                }`}>
                   <i className={`fas ${app.cloudMetadata?.provider === 'GCP' ? 'fa-google' : 'fa-cloud'}`}></i>
                </div>
                <div className="min-w-0 flex-1">
                   <p className={`text-sm font-black truncate ${selectedApp?._id === app._id ? 'text-slate-900' : 'text-slate-600'}`}>{app.name}</p>
                   <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{app.cloudMetadata?.environment || 'PROD'}</p>
                </div>
             </button>
           ))}
        </nav>
      </aside>

      {/* Main Workspace */}
      <main className="flex-1 flex flex-col overflow-hidden bg-white">
        {selectedApp ? (
          <>
            {/* Context Header */}
            <header className="p-10 border-b border-slate-50 flex items-center justify-between shrink-0">
               <div className="flex items-center gap-6">
                  <div className={`w-16 h-16 rounded-[1.5rem] flex items-center justify-center text-2xl shadow-2xl text-white ${
                    selectedApp.cloudMetadata?.provider === 'GCP' ? 'bg-emerald-500' : 'bg-blue-600'
                  }`}>
                    <i className={`fas ${selectedApp.cloudMetadata?.provider === 'GCP' ? 'fa-shapes' : 'fa-cubes'}`}></i>
                  </div>
                  <div>
                    <h2 className="text-3xl font-black text-slate-900 tracking-tighter uppercase italic">{selectedApp.name} Workspace</h2>
                    <div className="flex items-center gap-4 mt-1">
                       <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest px-3 py-1 bg-blue-50 rounded-lg border border-blue-100">
                         Sub: {selectedApp.cloudMetadata?.subscriptionId || 'nexus-sub-001'}
                       </span>
                       <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                         <i className="fas fa-location-dot"></i> East US 2
                       </span>
                    </div>
                  </div>
               </div>
               <div className="flex gap-3">
                  <button 
                    onClick={runAiAudit}
                    disabled={isAiLoading}
                    className="px-6 py-3 bg-slate-900 text-white text-[10px] font-black rounded-2xl shadow-xl hover:bg-blue-600 transition-all uppercase tracking-widest flex items-center gap-3 active:scale-95"
                  >
                    {isAiLoading ? <i className="fas fa-circle-notch fa-spin"></i> : <i className="fas fa-brain"></i>}
                    AI Audit
                  </button>
                  <button 
                    onClick={handleSaveTf}
                    disabled={saving}
                    className="px-6 py-3 bg-blue-50 text-blue-600 border border-blue-100 text-[10px] font-black rounded-2xl hover:bg-blue-100 transition-all uppercase tracking-widest flex items-center gap-2"
                  >
                    {saving ? <i className="fas fa-circle-notch fa-spin"></i> : <i className="fas fa-save"></i>}
                    Sync Script
                  </button>
               </div>
            </header>

            {/* Workspace Navigation */}
            <div className="flex px-10 border-b border-slate-50 bg-slate-50/30">
               {[
                 { id: 'iac', label: 'IaC Definition (TF)', icon: 'fa-code' },
                 { id: 'topography', label: 'Infrastructure Map', icon: 'fa-project-diagram' },
                 { id: 'audit', label: 'Security & Cost Audit', icon: 'fa-shield-halved' }
               ].map(tab => (
                 <button
                   key={tab.id}
                   onClick={() => setActiveTab(tab.id as any)}
                   className={`px-8 py-4 text-[10px] font-black uppercase tracking-widest border-b-2 transition-all flex items-center gap-2 ${
                     activeTab === tab.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400 hover:text-slate-600'
                   }`}
                 >
                   <i className={`fas ${tab.icon} text-[10px]`}></i>
                   {tab.label}
                 </button>
               ))}
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto custom-scrollbar bg-white">
               {activeTab === 'iac' && (
                 <div className="h-full flex flex-col">
                   <div className="flex-1 p-0 relative">
                      <textarea 
                        value={tfCode}
                        onChange={(e) => setTfCode(e.target.value)}
                        spellCheck={false}
                        className="w-full h-full p-10 bg-slate-950 text-emerald-400 font-mono text-sm outline-none resize-none selection:bg-emerald-500/20"
                        placeholder="# Paste Terraform HCL here..."
                      />
                      <div className="absolute top-8 right-8 flex flex-col gap-2">
                         <div className="px-4 py-2 bg-slate-800 text-white rounded-xl text-[8px] font-black uppercase tracking-widest shadow-2xl border border-white/5">HCL v1.2</div>
                      </div>
                   </div>
                 </div>
               )}

               {activeTab === 'topography' && (
                 <div className="p-12 h-full flex flex-col items-center justify-center text-center">
                    <div className="w-24 h-24 bg-slate-50 rounded-[2.5rem] flex items-center justify-center mb-8 border border-slate-100 shadow-inner">
                       <i className="fas fa-diagram-project text-slate-200 text-4xl"></i>
                    </div>
                    <h3 className="text-xl font-black text-slate-800 tracking-tight uppercase">Live Topography</h3>
                    <p className="text-slate-400 font-medium max-w-sm mt-3 leading-relaxed">
                      Reverse-engineering resource relationships from the Terraform state to generate an interactive spatial map.
                    </p>
                    <button className="mt-8 px-10 py-4 bg-slate-900 text-white text-[10px] font-black uppercase rounded-2xl shadow-xl hover:bg-blue-600 transition-all">Generate Graph</button>
                 </div>
               )}

               {activeTab === 'audit' && (
                 <div className="p-12 max-w-5xl mx-auto animate-fadeIn">
                    {isAiLoading ? (
                      <div className="space-y-8 py-20">
                         <div className="flex flex-col items-center gap-6">
                            <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] animate-pulse">Gemini Reasoning Engine Active...</p>
                         </div>
                         <div className="space-y-4 max-w-2xl mx-auto">
                            <div className="h-4 bg-slate-50 rounded-full w-full animate-pulse"></div>
                            <div className="h-4 bg-slate-50 rounded-full w-3/4 animate-pulse"></div>
                            <div className="h-4 bg-slate-50 rounded-full w-5/6 animate-pulse"></div>
                         </div>
                      </div>
                    ) : aiInsight ? (
                      <div className="prose prose-slate max-w-none prose-headings:text-slate-900 prose-headings:font-black prose-p:font-medium prose-p:text-slate-600">
                         <div className="bg-blue-900 rounded-[2.5rem] p-10 text-white mb-12 shadow-2xl relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-32 -mt-32 blur-3xl"></div>
                            <header className="flex items-center gap-4 mb-6 relative z-10">
                               <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></div>
                               <span className="text-[10px] font-black uppercase tracking-[0.2em]">Architecture Review Committed</span>
                            </header>
                            <p className="text-xl font-bold italic text-blue-50 relative z-10 leading-relaxed">
                              "The following audit identifies potential cost leaks and security posture improvements for the {selectedApp.name} infrastructure definition."
                            </p>
                         </div>
                         <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(marked.parse(aiInsight) as string) }} />
                      </div>
                    ) : (
                      <div className="py-20 flex flex-col items-center text-center opacity-40">
                         <i className="fas fa-brain text-6xl text-blue-500/50 mb-8"></i>
                         <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Request an AI Audit to analyze your IaC posture.</p>
                      </div>
                    )}
                 </div>
               )}
            </div>
          </>
        ) : (
          <div className="h-full flex flex-col items-center justify-center p-20 text-center bg-slate-50/10">
            <div className="w-24 h-24 bg-white rounded-[2.5rem] flex items-center justify-center mb-8 border border-slate-100 shadow-xl shadow-slate-200/50">
               <i className="fas fa-cloud text-slate-100 text-4xl"></i>
            </div>
            <h3 className="text-xl font-black text-slate-800 tracking-tight uppercase">Cloud Command Center</h3>
            <p className="text-slate-400 font-medium max-w-xs mt-3 leading-relaxed">
              Select an application from the registry to manage its specific subscription, terraform scripts, and cloud resources.
            </p>
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
