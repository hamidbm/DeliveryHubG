
import React, { useState, useEffect, useMemo } from 'react';
import { BusinessCapability, Application } from '../types';

interface CapabilityMapProps {
  applications: Application[];
}

const CapabilityMap: React.FC<CapabilityMapProps> = ({ applications }) => {
  const [capabilities, setCapabilities] = useState<BusinessCapability[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCap, setEditingCap] = useState<Partial<BusinessCapability> | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchCaps = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/capabilities');
      const data = await res.json();
      setCapabilities(Array.isArray(data) ? data : []);
    } catch (e) {
      setCapabilities([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCaps();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCap?.name) return;
    try {
      const res = await fetch('/api/capabilities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingCap)
      });
      if (res.ok) {
        setIsModalOpen(false);
        fetchCaps();
      }
    } catch (err) {}
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Permanently delete this business capability? Applications linked to it will remain, but the mapping will be severed.")) return;
    await fetch(`/api/capabilities/${id}`, { method: 'DELETE' });
    fetchCaps();
  };

  const tree = useMemo(() => {
    const filtered = capabilities.filter(c => 
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      c.description.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const build = (parentId?: string, level: number = 1): any[] => {
      return capabilities
        .filter(c => c.parentId === parentId && c.level === level)
        .map(c => ({
          ...c,
          children: build(c._id, level + 1),
          apps: applications.filter(app => app.capabilityIds?.includes(c._id!))
        }));
    };
    return build(undefined, 1);
  }, [capabilities, applications, searchQuery]);

  return (
    <div className="space-y-10 animate-fadeIn">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h2 className="text-4xl font-black text-slate-900 tracking-tighter uppercase italic">Business Capability Map</h2>
          <p className="text-slate-400 font-medium text-lg">The foundational taxonomy mapping business functions to delivery assets.</p>
        </div>
        <div className="flex gap-3">
          <div className="relative">
            <i className="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 text-sm"></i>
            <input 
              type="text" 
              placeholder="Filter taxonomy..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-white border border-slate-200 rounded-2xl pl-12 pr-6 py-3 text-sm font-bold focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none w-64 transition-all"
            />
          </div>
          <button 
            onClick={() => { setEditingCap({ name: '', description: '', level: 1 }); setIsModalOpen(true); }}
            className="px-8 py-3 bg-slate-900 text-white text-[10px] font-black rounded-2xl shadow-xl hover:bg-blue-600 transition-all uppercase tracking-widest flex items-center gap-2"
          >
            + Add Domain
          </button>
        </div>
      </header>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {[1, 2].map(i => <div key={i} className="h-96 bg-slate-100 rounded-[3rem] animate-pulse"></div>)}
        </div>
      ) : tree.length === 0 ? (
        <div className="py-40 text-center bg-white border border-slate-200 rounded-[3rem] shadow-sm">
           <i className="fas fa-sitemap text-6xl text-slate-100 mb-6"></i>
           <p className="text-slate-400 font-black uppercase tracking-[0.2em]">No Capabilities defined in registry</p>
           <button onClick={() => { setEditingCap({ name: '', description: '', level: 1 }); setIsModalOpen(true); }} className="mt-8 text-blue-600 font-black text-sm uppercase hover:underline">Begin Taxonomy Design</button>
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
                   <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => { setEditingCap({ name: '', description: '', level: 2, parentId: domain._id }); setIsModalOpen(true); }} className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center text-xs hover:bg-blue-600 hover:text-white transition-all shadow-sm" title="Add Sub-Domain"><i className="fas fa-plus"></i></button>
                      <button onClick={() => { setEditingCap(domain); setIsModalOpen(true); }} className="w-9 h-9 rounded-xl bg-slate-50 text-slate-400 flex items-center justify-center text-xs hover:bg-blue-600 hover:text-white transition-all shadow-sm"><i className="fas fa-pen"></i></button>
                      <button onClick={(e) => handleDelete(domain._id, e)} className="w-9 h-9 rounded-xl bg-red-50 text-red-400 flex items-center justify-center text-xs hover:bg-red-500 hover:text-white transition-all shadow-sm"><i className="fas fa-trash"></i></button>
                   </div>
                </div>

                <div className="space-y-8 flex-1">
                   {domain.children.map((sub: any) => (
                     <div key={sub._id} className="bg-slate-50/50 p-8 rounded-[2rem] border border-slate-100 space-y-6 group/sub">
                        <div className="flex items-center justify-between">
                           <div className="flex items-center gap-3">
                              <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                              <h4 className="text-sm font-black text-slate-700 uppercase tracking-tight">{sub.name}</h4>
                           </div>
                           <div className="flex gap-2 opacity-0 group-hover/sub:opacity-100 transition-opacity">
                              <button onClick={() => { setEditingCap({ name: '', description: '', level: 3, parentId: sub._id }); setIsModalOpen(true); }} className="text-[10px] font-black text-blue-600 uppercase hover:underline">+ Function</button>
                              <button onClick={() => { setEditingCap(sub); setIsModalOpen(true); }} className="text-slate-300 hover:text-blue-600 transition-colors"><i className="fas fa-pen text-[10px]"></i></button>
                           </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                           {sub.children.map((fn: any) => (
                             <div key={fn._id} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-3 group/fn relative overflow-hidden">
                                <div className="flex justify-between items-start">
                                   <span className="text-[10px] font-bold text-slate-800 leading-tight pr-6">{fn.name}</span>
                                   <div className="flex gap-1 opacity-0 group-hover/fn:opacity-100 transition-opacity">
                                      <button onClick={() => { setEditingCap(fn); setIsModalOpen(true); }} className="text-slate-300 hover:text-blue-600"><i className="fas fa-cog text-[8px]"></i></button>
                                   </div>
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                   {fn.apps.length > 0 ? fn.apps.map((app: any) => (
                                     <div key={app._id} className="px-2 py-0.5 bg-blue-50 text-blue-600 text-[8px] font-black uppercase rounded-md border border-blue-100 truncate max-w-full" title={app.name}>
                                       {app.name}
                                     </div>
                                   )) : <span className="text-[8px] text-slate-300 italic font-bold">Unmapped Function</span>}
                                </div>
                             </div>
                           ))}
                           {sub.children.length === 0 && (
                             <div className="col-span-full py-4 text-center">
                                <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest italic">No functions configured</span>
                             </div>
                           )}
                        </div>
                     </div>
                   ))}
                   {domain.children.length === 0 && (
                     <div className="py-20 flex flex-col items-center opacity-30 text-slate-300">
                        <i className="fas fa-cubes text-4xl mb-3"></i>
                        <p className="text-[10px] font-black uppercase tracking-widest">Empty Domain Structure</p>
                     </div>
                   )}
                </div>
                
                <div className="mt-10 pt-8 border-t border-slate-50 flex items-center justify-between">
                   <div className="flex -space-x-2">
                      {domain.children.flatMap((s:any) => s.children.flatMap((f:any) => f.apps)).slice(0, 5).map((app: any, idx: number) => (
                        <div key={idx} className="w-8 h-8 rounded-full border-2 border-white bg-slate-100 flex items-center justify-center text-[8px] font-black text-slate-500 shadow-sm overflow-hidden" title={app.name}>
                           <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(app.name)}&background=random&size=32`} className="w-full h-full object-cover" />
                        </div>
                      ))}
                   </div>
                   <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                     {domain.children.reduce((acc: any, curr: any) => acc + curr.children.length, 0)} Core Functions
                   </span>
                </div>
             </div>
           ))}
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-md z-[300] flex items-center justify-center p-6">
          <div className="bg-white rounded-[3rem] w-full max-w-xl p-12 shadow-2xl animate-fadeIn border border-slate-100 relative">
            <button onClick={() => setIsModalOpen(false)} className="absolute top-8 right-8 w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 hover:text-red-500 transition-colors">
              <i className="fas fa-times"></i>
            </button>
            
            <header className="mb-10">
              <h3 className="text-3xl font-black text-slate-900 tracking-tight">{editingCap?._id ? 'Refine' : 'Add'} {editingCap?.level === 1 ? 'Domain' : editingCap?.level === 2 ? 'Sub-Domain' : 'Functional'} Node</h3>
              <p className="text-slate-400 text-sm font-medium mt-1">Registry mapping configuration for L{editingCap?.level} capability.</p>
            </header>

            <form onSubmit={handleSave} className="space-y-8">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Capability Label</label>
                <input 
                  required 
                  value={editingCap?.name || ''} 
                  onChange={(e) => setEditingCap({...editingCap, name: e.target.value})} 
                  className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 text-slate-700 font-bold outline-none focus:border-blue-500 transition-all shadow-sm" 
                  placeholder="e.g. Core Ledger Management" 
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Contextual Description</label>
                <textarea 
                  value={editingCap?.description || ''} 
                  onChange={(e) => setEditingCap({...editingCap, description: e.target.value})} 
                  className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 text-slate-700 font-medium h-24 outline-none focus:border-blue-500" 
                  placeholder="Define the scope and business value of this function..."
                />
              </div>

              {editingCap?.level && editingCap.level > 1 && (
                <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100 flex items-center gap-4">
                  <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center text-xs shadow-lg"><i className="fas fa-link"></i></div>
                  <div>
                    <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Inheritance Active</p>
                    <p className="text-[11px] text-blue-800 font-bold">Mapping to: {capabilities.find(c => c._id === editingCap.parentId)?.name}</p>
                  </div>
                </div>
              )}

              <footer className="pt-10 flex gap-4">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-900 transition-colors">Discard</button>
                <button type="submit" className="flex-[2] py-4 bg-slate-900 text-white text-[10px] font-black rounded-2xl shadow-2xl hover:bg-blue-600 transition-all uppercase tracking-widest">Commit to Registry</button>
              </footer>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CapabilityMap;
