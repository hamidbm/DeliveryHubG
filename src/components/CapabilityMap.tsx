
import React, { useState, useEffect, useMemo } from 'react';
import { BusinessCapability, Application, ArchitectureDiagram } from '../types';

interface CapabilityMapProps {
  applications: Application[];
}

const CapabilityMap: React.FC<CapabilityMapProps> = ({ applications: allApps }) => {
  const [capabilities, setCapabilities] = useState<BusinessCapability[]>([]);
  const [diagrams, setDiagrams] = useState<ArchitectureDiagram[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isMappingOpen, setIsMappingOpen] = useState(false);
  const [editingCap, setEditingCap] = useState<Partial<BusinessCapability> | null>(null);
  const [activeMappingCap, setActiveMappingCap] = useState<BusinessCapability | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchData = async () => {
    setLoading(true);
    try {
      const [capRes, diagRes] = await Promise.all([
        fetch('/api/capabilities'),
        fetch('/api/architecture/diagrams')
      ]);
      setCapabilities(await capRes.json());
      setDiagrams(await diagRes.json());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCap?.name) return;
    const res = await fetch('/api/capabilities', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editingCap)
    });
    if (res.ok) {
      setIsModalOpen(false);
      fetchData();
    }
  };

  const handleToggleMapping = async (type: 'app' | 'diag', id: string) => {
    if (!activeMappingCap?._id) return;
    
    if (type === 'app') {
      const app = allApps.find(a => a._id === id);
      if (!app) return;
      const capIds = app.capabilityIds || [];
      const nextIds = capIds.includes(activeMappingCap._id) 
        ? capIds.filter(cid => cid !== activeMappingCap._id)
        : [...capIds, activeMappingCap._id];
      
      await fetch(`/api/applications/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ capabilityIds: nextIds })
      });
    } else {
      const diag = diagrams.find(d => d._id === id);
      if (!diag) return;
      const capIds = diag.capabilityIds || [];
      const nextIds = capIds.includes(activeMappingCap._id)
        ? capIds.filter(cid => cid !== activeMappingCap._id)
        : [...capIds, activeMappingCap._id];

      await fetch(`/api/architecture/diagrams/${id}`, {
        method: 'POST', // Backend save function handles both insert and update
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...diag, capabilityIds: nextIds })
      });
    }
    fetchData(); // Refresh both apps and diagrams
  };

  const tree = useMemo(() => {
    const build = (parentId?: string, level: number = 1): any[] => {
      return capabilities
        .filter(c => c.parentId === parentId && c.level === level)
        .map(c => ({
          ...c,
          children: build(c._id, level + 1),
          apps: allApps.filter(app => app.capabilityIds?.includes(c._id!)),
          blueprints: diagrams.filter(d => d.capabilityIds?.includes(c._id!))
        }));
    };
    return build(undefined, 1);
  }, [capabilities, allApps, diagrams]);

  return (
    <div className="space-y-10 animate-fadeIn">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h2 className="text-4xl font-black text-slate-900 tracking-tighter uppercase italic">Business Capability Map</h2>
          <p className="text-slate-400 font-medium text-lg">The foundational taxonomy mapping business functions to delivery assets.</p>
        </div>
        <button 
          onClick={() => { setEditingCap({ name: '', description: '', level: 1 }); setIsModalOpen(true); }}
          className="px-8 py-3 bg-slate-900 text-white text-[10px] font-black rounded-2xl shadow-xl hover:bg-blue-600 transition-all uppercase tracking-widest flex items-center gap-2"
        >
          + Add Domain
        </button>
      </header>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {[1, 2].map(i => <div key={i} className="h-96 bg-slate-100 rounded-[3rem] animate-pulse"></div>)}
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-10">
           {tree.map(domain => (
             <div key={domain._id} className="bg-white border border-slate-200 rounded-[3rem] p-10 shadow-sm hover:shadow-2xl transition-all group flex flex-col h-full">
                <div className="flex items-center justify-between mb-10">
                   <div className="flex items-center gap-5">
                      <div className="w-14 h-14 bg-slate-900 text-white rounded-[1.5rem] flex items-center justify-center text-2xl shadow-xl">
                        <i className="fas fa-layer-group"></i>
                      </div>
                      <div>
                        <h3 className="text-2xl font-black text-slate-800 tracking-tight">{domain.name}</h3>
                        <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Level 1 Domain</p>
                      </div>
                   </div>
                </div>

                <div className="space-y-8 flex-1">
                   {domain.children.map((sub: any) => (
                     <div key={sub._id} className="bg-slate-50/50 p-8 rounded-[2rem] border border-slate-100 space-y-6 group/sub">
                        <div className="flex items-center justify-between">
                           <h4 className="text-sm font-black text-slate-700 uppercase tracking-tight">{sub.name}</h4>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                           {sub.children.map((fn: any) => (
                             <div key={fn._id} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4 group/fn relative overflow-hidden">
                                <div className="flex justify-between items-start">
                                   <span className="text-[11px] font-black text-slate-800 leading-tight pr-6">{fn.name}</span>
                                   <button 
                                      onClick={() => { setActiveMappingCap(fn); setIsMappingOpen(true); }}
                                      className="w-7 h-7 rounded-lg bg-slate-50 text-slate-400 flex items-center justify-center text-[10px] hover:bg-blue-600 hover:text-white transition-all shadow-sm opacity-0 group-hover/fn:opacity-100"
                                   >
                                      <i className="fas fa-link"></i>
                                   </button>
                                </div>
                                
                                <div className="space-y-2">
                                   <div className="flex flex-wrap gap-1.5">
                                      {fn.apps.map((app: any) => (
                                        <span key={app._id} className="px-2 py-0.5 bg-blue-50 text-blue-600 text-[8px] font-black uppercase rounded border border-blue-100">
                                          {app.name}
                                        </span>
                                      ))}
                                   </div>
                                   {fn.blueprints.length > 0 && (
                                      <div className="flex flex-wrap gap-1.5 border-t border-slate-50 pt-2">
                                         {fn.blueprints.map((diag: any) => (
                                           <span key={diag._id} className="px-2 py-0.5 bg-emerald-50 text-emerald-600 text-[8px] font-black uppercase rounded border border-emerald-100 flex items-center gap-1">
                                              <i className="fas fa-project-diagram"></i>
                                              {diag.title}
                                           </span>
                                         ))}
                                      </div>
                                   )}
                                </div>
                             </div>
                           ))}
                        </div>
                     </div>
                   ))}
                </div>
             </div>
           ))}
        </div>
      )}

      {/* Asset Manager Modal */}
      {isMappingOpen && activeMappingCap && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-md z-[400] flex items-center justify-center p-6">
           <div className="bg-white rounded-[3rem] w-full max-w-4xl p-12 shadow-2xl animate-fadeIn border border-slate-100 flex flex-col h-[80vh]">
              <header className="flex justify-between items-start mb-10 shrink-0">
                 <div>
                    <h3 className="text-3xl font-black text-slate-900 tracking-tight">Traceability Manager</h3>
                    <p className="text-slate-500 font-medium mt-1">Map applications and blueprints to <span className="text-blue-600">"{activeMappingCap.name}"</span>.</p>
                 </div>
                 <button onClick={() => setIsMappingOpen(false)} className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 hover:text-red-500 transition-colors">
                   <i className="fas fa-times"></i>
                 </button>
              </header>

              <div className="flex-1 grid grid-cols-2 gap-10 overflow-hidden">
                 <section className="flex flex-col overflow-hidden">
                    <div className="flex items-center gap-3 mb-6">
                       <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center text-xs shadow-lg"><i className="fas fa-cube"></i></div>
                       <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Applications Registry</h4>
                    </div>
                    <div className="flex-1 overflow-y-auto space-y-2 pr-4 custom-scrollbar">
                       {allApps.map(app => {
                         const isLinked = app.capabilityIds?.includes(activeMappingCap._id!);
                         return (
                           <button 
                              key={app._id} 
                              onClick={() => handleToggleMapping('app', app._id!)}
                              className={`w-full text-left p-4 rounded-2xl border transition-all flex items-center justify-between group ${
                                isLinked ? 'bg-blue-600 border-blue-600 text-white shadow-xl shadow-blue-200' : 'bg-slate-50 border-slate-100 hover:bg-white text-slate-600'
                              }`}
                           >
                              <div className="min-w-0">
                                 <p className="text-sm font-black truncate">{app.name}</p>
                                 <p className={`text-[9px] font-bold uppercase tracking-widest ${isLinked ? 'text-blue-100' : 'text-slate-400'}`}>{app.aid}</p>
                              </div>
                              <i className={`fas ${isLinked ? 'fa-check-circle' : 'fa-plus opacity-0 group-hover:opacity-100'} transition-all`}></i>
                           </button>
                         );
                       })}
                    </div>
                 </section>

                 <section className="flex flex-col overflow-hidden">
                    <div className="flex items-center gap-3 mb-6">
                       <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center text-xs shadow-lg"><i className="fas fa-project-diagram"></i></div>
                       <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Visual Blueprints</h4>
                    </div>
                    <div className="flex-1 overflow-y-auto space-y-2 pr-4 custom-scrollbar">
                       {diagrams.map(diag => {
                         const isLinked = diag.capabilityIds?.includes(activeMappingCap._id!);
                         return (
                           <button 
                              key={diag._id} 
                              onClick={() => handleToggleMapping('diag', diag._id!)}
                              className={`w-full text-left p-4 rounded-2xl border transition-all flex items-center justify-between group ${
                                isLinked ? 'bg-emerald-600 border-emerald-600 text-white shadow-xl shadow-emerald-200' : 'bg-slate-50 border-slate-100 hover:bg-white text-slate-600'
                              }`}
                           >
                              <div className="min-w-0">
                                 <p className="text-sm font-black truncate">{diag.title}</p>
                                 <p className={`text-[9px] font-bold uppercase tracking-widest ${isLinked ? 'text-emerald-100' : 'text-slate-400'}`}>{diag.format}</p>
                              </div>
                              <i className={`fas ${isLinked ? 'fa-check-circle' : 'fa-plus opacity-0 group-hover:opacity-100'} transition-all`}></i>
                           </button>
                         );
                       })}
                       {diagrams.length === 0 && (
                          <div className="py-20 text-center text-slate-300 italic text-xs">No diagrams found in registry.</div>
                       )}
                    </div>
                 </section>
              </div>

              <footer className="pt-10 shrink-0 flex justify-end">
                 <button onClick={() => setIsMappingOpen(false)} className="px-10 py-4 bg-slate-900 text-white text-[11px] font-black uppercase rounded-2xl shadow-xl hover:bg-blue-600 transition-all">Synchronize Mapping</button>
              </footer>
           </div>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-md z-[300] flex items-center justify-center p-6">
          <div className="bg-white rounded-[3rem] w-full max-w-xl p-12 shadow-2xl animate-fadeIn border border-slate-100 relative">
            <button onClick={() => setIsModalOpen(false)} className="absolute top-8 right-8 w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 hover:text-red-500 transition-colors">
              <i className="fas fa-times"></i>
            </button>
            <form onSubmit={handleSave} className="space-y-8">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Capability Label</label>
                <input required value={editingCap?.name || ''} onChange={(e) => setEditingCap({...editingCap, name: e.target.value})} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 text-slate-700 font-bold outline-none" />
              </div>
              <button type="submit" className="w-full py-4 bg-slate-900 text-white text-[10px] font-black rounded-2xl uppercase tracking-widest">Commit to Registry</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CapabilityMap;
