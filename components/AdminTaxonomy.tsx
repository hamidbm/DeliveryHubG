
import React, { useState, useEffect, useMemo } from 'react';
import { TaxonomyCategory, TaxonomyDocumentType } from '../types';

const AUDIENCES = [
  { id: 'engineering', label: 'Engineering' },
  { id: 'security', label: 'Security' },
  { id: 'operations', label: 'Operations' },
  { id: 'leadership', label: 'Leadership' },
  { id: 'program_management', label: 'Program Management' },
  { id: 'product', label: 'Product' },
  { id: 'finance', label: 'Finance' },
  { id: 'audit', label: 'Audit' }
];

const PHASES = [
  { id: 'strategy', label: 'Strategy' },
  { id: 'plan', label: 'Plan' },
  { id: 'design', label: 'Design' },
  { id: 'build', label: 'Build' },
  { id: 'test', label: 'Test' },
  { id: 'release', label: 'Release' },
  { id: 'operate', label: 'Operate' },
  { id: 'improve', label: 'Improve' },
  { id: 'retire', label: 'Retire' }
];

const AdminTaxonomy: React.FC = () => {
  const [categories, setCategories] = useState<TaxonomyCategory[]>([]);
  const [types, setTypes] = useState<TaxonomyDocumentType[]>([]);
  const [selectedCatId, setSelectedCatId] = useState<string | 'all'>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState<'category' | 'type'>('category');
  const [editingItem, setEditingItem] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [isBootstrapping, setIsBootstrapping] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [cRes, tRes] = await Promise.all([
        fetch('/api/taxonomy/categories'),
        fetch('/api/taxonomy/document-types')
      ]);
      const cats = await cRes.json();
      const docs = await tRes.json();
      setCategories(cats);
      setTypes(docs);
      if (cats.length > 0 && selectedCatId === 'all') {
        setSelectedCatId(cats[0]._id);
      }
    } catch (e) {
      console.error("Registry Sync Error", e);
    }
  };

  const handleBootstrap = async () => {
    if (!confirm("This will initialize the registry with standard enterprise categories and artifact types. Existing taxonomy data will be preserved. Proceed?")) return;
    setIsBootstrapping(true);
    try {
      await fetch('/api/seed');
      await fetchData();
    } finally {
      setIsBootstrapping(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const url = modalType === 'category' ? '/api/taxonomy/categories' : '/api/taxonomy/document-types';
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingItem)
      });
      if (res.ok) {
        setIsModalOpen(false);
        fetchData();
      }
    } finally {
      setLoading(false);
    }
  };

  const openNewCategory = () => {
    setModalType('category');
    setEditingItem({ key: '', name: '', icon: 'fa-folder', isActive: true, sortOrder: 10 });
    setIsModalOpen(true);
  };

  const openNewType = (catId?: string) => {
    setModalType('type');
    setEditingItem({ 
      key: '', 
      name: '', 
      categoryId: catId || (selectedCatId !== 'all' ? selectedCatId : categories[0]?._id), 
      isActive: true, 
      sortOrder: 10,
      audience: [],
      lifecyclePhases: [],
      requiredMetadata: { requiresBundle: true, requiresApplication: true, requiresMilestone: false }
    });
    setIsModalOpen(true);
  };

  const filteredTypes = useMemo(() => {
    if (selectedCatId === 'all') return types;
    return types.filter(t => t.categoryId === selectedCatId);
  }, [types, selectedCatId]);

  const activeCategory = categories.find(c => c._id === selectedCatId);

  return (
    <div className="h-full flex flex-col animate-fadeIn">
      {/* Module Header */}
      <header className="px-10 py-8 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white">
        <div>
          <h2 className="text-4xl font-black text-slate-900 tracking-tighter">Taxonomy Designer</h2>
          <p className="text-slate-500 font-medium mt-1">Govern documentation categories and standard artifact blueprints.</p>
        </div>
        <div className="flex items-center gap-3">
          {categories.length === 0 && (
            <button 
              onClick={handleBootstrap}
              disabled={isBootstrapping}
              className="px-6 py-3 bg-blue-50 text-blue-600 text-[10px] font-black rounded-2xl uppercase tracking-widest hover:bg-blue-100 transition-all border border-blue-100 flex items-center gap-2"
            >
              {isBootstrapping ? <i className="fas fa-circle-notch fa-spin"></i> : <i className="fas fa-magic"></i>}
              Bootstrap Registry
            </button>
          )}
          <button 
            onClick={openNewCategory}
            className="px-8 py-3.5 bg-slate-900 text-white text-[10px] font-black rounded-2xl shadow-xl hover:bg-slate-800 transition-all uppercase tracking-widest flex items-center gap-2"
          >
            <i className="fas fa-plus"></i>
            New Category
          </button>
        </div>
      </header>

      {categories.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-20 text-center">
          <div className="w-32 h-32 rounded-[3rem] bg-slate-50 flex items-center justify-center mb-8 border border-slate-100 shadow-inner">
             <i className="fas fa-tags text-slate-200 text-5xl"></i>
          </div>
          <h3 className="text-2xl font-black text-slate-800 tracking-tight">Enterprise Taxonomy is Empty</h3>
          <p className="text-slate-400 font-medium max-w-md mt-2 mb-10">Start by defining artifact groups like Architecture or Security to organize your delivery documentation.</p>
          <div className="flex items-center gap-4">
             <button onClick={handleBootstrap} className="px-8 py-4 bg-white border-2 border-slate-200 text-slate-600 font-black text-[11px] uppercase tracking-widest rounded-2xl hover:border-blue-500 hover:text-blue-600 transition-all">Initialize Standards</button>
             <button onClick={openNewCategory} className="px-8 py-4 bg-blue-600 text-white font-black text-[11px] uppercase tracking-widest rounded-2xl shadow-2xl shadow-blue-600/20 hover:bg-blue-700 transition-all">Create Custom Group</button>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex overflow-hidden">
          {/* Categories Sidebar */}
          <aside className="w-96 border-r border-slate-100 flex flex-col bg-slate-50/20 shrink-0">
            <div className="p-6 border-b border-slate-100 bg-white">
               <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Categories ({categories.length})</h4>
               <div className="space-y-2 overflow-y-auto max-h-[600px] custom-scrollbar pr-2">
                 {categories.map(cat => (
                   <button
                    key={cat._id}
                    onClick={() => setSelectedCatId(cat._id!)}
                    className={`w-full text-left p-4 rounded-2xl transition-all group relative ${
                      selectedCatId === cat._id ? 'bg-white shadow-xl shadow-slate-200 border border-slate-100 ring-2 ring-blue-500/10' : 'hover:bg-slate-100/50 text-slate-500'
                    }`}
                   >
                     <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                          selectedCatId === cat._id ? 'bg-blue-600 text-white shadow-lg' : 'bg-slate-100 text-slate-400 group-hover:bg-white'
                        }`}>
                          <i className={`fas ${cat.icon || 'fa-folder'}`}></i>
                        </div>
                        <div className="flex-1 min-w-0">
                           <p className={`text-sm font-black truncate ${selectedCatId === cat._id ? 'text-slate-900' : 'text-slate-600'}`}>{cat.name}</p>
                           <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{cat.key}</p>
                        </div>
                        <i className={`fas fa-chevron-right text-[10px] transition-all ${selectedCatId === cat._id ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-2'}`}></i>
                     </div>
                   </button>
                 ))}
               </div>
            </div>
            <div className="p-8 bg-white/50 flex-1">
               <div className="rounded-[2rem] border-2 border-dashed border-slate-200 p-8 flex flex-col items-center text-center opacity-60">
                  <i className="fas fa-layer-group text-slate-300 text-3xl mb-4"></i>
                  <p className="text-xs font-bold text-slate-400">Add categories to refine your documentation hierarchy.</p>
               </div>
            </div>
          </aside>

          {/* Types Detail Area */}
          <main className="flex-1 bg-white overflow-y-auto custom-scrollbar p-12">
            {activeCategory ? (
              <div className="max-w-5xl mx-auto space-y-12">
                <header className="flex items-end justify-between border-b border-slate-100 pb-10">
                   <div className="flex items-center gap-6">
                      <div className="w-20 h-20 bg-slate-950 text-white rounded-[2rem] flex items-center justify-center text-3xl shadow-2xl">
                         <i className={`fas ${activeCategory.icon}`}></i>
                      </div>
                      <div>
                         <div className="flex items-center gap-3">
                           <h3 className="text-3xl font-black text-slate-900 tracking-tight">{activeCategory.name}</h3>
                           <button onClick={() => { setEditingItem(activeCategory); setModalType('category'); setIsModalOpen(true); }} className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 hover:text-blue-600 transition-all"><i className="fas fa-pen text-[10px]"></i></button>
                         </div>
                         <p className="text-slate-500 font-medium text-lg mt-1">{activeCategory.description || `Manage standard artifacts for ${activeCategory.name}.`}</p>
                      </div>
                   </div>
                   <button 
                    onClick={() => openNewType()}
                    className="px-6 py-3 bg-blue-600 text-white text-[10px] font-black rounded-xl uppercase tracking-widest hover:bg-blue-700 transition-all shadow-lg"
                   >
                     + Add Document Type
                   </button>
                </header>

                <div className="grid grid-cols-1 gap-6">
                   {filteredTypes.length === 0 ? (
                     <div className="py-20 bg-slate-50 rounded-[3rem] border-2 border-dashed border-slate-100 flex flex-col items-center justify-center">
                        <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center shadow-sm mb-4">
                           <i className="fas fa-file-signature text-slate-200"></i>
                        </div>
                        <p className="font-black text-slate-400 uppercase tracking-widest text-[10px]">No artifact types defined for this category</p>
                        <button onClick={() => openNewType()} className="mt-4 text-blue-600 font-black text-xs">Create First Artifact Blueprint</button>
                     </div>
                   ) : filteredTypes.map(type => (
                     <div key={type._id} className="bg-white border border-slate-100 rounded-[2rem] p-8 hover:shadow-xl hover:shadow-slate-100 transition-all group flex items-start justify-between">
                        <div className="flex items-start gap-6">
                           <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-600 transition-all">
                              <i className={`fas ${type.icon || 'fa-file-invoice'}`}></i>
                           </div>
                           <div className="space-y-2">
                              <div className="flex items-center gap-3">
                                 <h4 className="text-xl font-black text-slate-800 group-hover:text-blue-600 transition-colors">{type.name}</h4>
                                 <code className="text-[10px] font-black text-slate-400 bg-slate-50 px-2 py-0.5 rounded-md border border-slate-100">{type.key}</code>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                 {type.audience?.map(aud => <span key={aud} className="px-2 py-0.5 bg-indigo-50 text-indigo-600 text-[9px] font-black uppercase rounded-md border border-indigo-100">{aud}</span>)}
                                 {type.lifecyclePhases?.map(ph => <span key={ph} className="px-2 py-0.5 bg-emerald-50 text-emerald-600 text-[9px] font-black uppercase rounded-md border border-emerald-100">{ph}</span>)}
                              </div>
                              {type.description && <p className="text-sm text-slate-400 font-medium leading-relaxed">{type.description}</p>}
                           </div>
                        </div>
                        <div className="flex items-center gap-4">
                           <div className="flex flex-col items-end mr-4">
                              <span className="text-[8px] font-black text-slate-300 uppercase tracking-widest mb-1">Status</span>
                              <div className={`w-3 h-3 rounded-full ${type.isActive ? 'bg-emerald-500' : 'bg-slate-200'}`}></div>
                           </div>
                           <button onClick={() => { setEditingItem(type); setModalType('type'); setIsModalOpen(true); }} className="w-10 h-10 rounded-2xl border border-slate-200 text-slate-400 hover:text-blue-600 hover:border-blue-500 transition-all shadow-sm flex items-center justify-center"><i className="fas fa-cog"></i></button>
                        </div>
                     </div>
                   ))}
                </div>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-200">
                 <p className="font-black uppercase tracking-[0.2em]">Select a category to manage artifact blueprints</p>
              </div>
            )}
          </main>
        </div>
      )}

      {/* Modal Designer */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-md z-[200] flex items-center justify-center p-6">
          <div className="bg-white rounded-[3rem] w-full max-w-2xl p-12 shadow-2xl animate-fadeIn border border-slate-100 overflow-y-auto max-h-[90vh] custom-scrollbar">
            <header className="mb-10 flex justify-between items-start">
               <div>
                 <h3 className="text-3xl font-black text-slate-900 tracking-tight">{editingItem?._id ? 'Refine' : 'Initialize'} {modalType === 'category' ? 'Category' : 'Document Type'}</h3>
                 <p className="text-slate-500 font-medium mt-1">Registry mapping configuration.</p>
               </div>
               <button onClick={() => setIsModalOpen(false)} className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 hover:text-red-500 transition-colors">
                 <i className="fas fa-times"></i>
               </button>
            </header>

            <form onSubmit={handleSave} className="space-y-10">
              <section className="space-y-6">
                <div className="flex items-center gap-2 mb-4">
                  <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Basic Identification</h4>
                </div>
                <div className="grid grid-cols-2 gap-8">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">System Key (Unique)</label>
                    <input required value={editingItem?.key || ''} onChange={(e) => setEditingItem({...editingItem, key: e.target.value.toUpperCase().replace(/\s/g, '_')})}
                      className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 text-slate-700 focus:border-blue-500 font-black outline-none transition-all" placeholder="ADR" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Display Label</label>
                    <input required value={editingItem?.name || ''} onChange={(e) => setEditingItem({...editingItem, name: e.target.value})}
                      className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 text-slate-700 focus:border-blue-500 font-bold outline-none transition-all" placeholder="Architecture Decision Record" />
                  </div>
                </div>
                <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Description (Internal Help Text)</label>
                    <textarea value={editingItem?.description || ''} onChange={(e) => setEditingItem({...editingItem, description: e.target.value})}
                      className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 text-slate-700 focus:border-blue-500 font-medium h-24" />
                </div>
              </section>

              {modalType === 'category' ? (
                <section className="space-y-6">
                   <div className="flex items-center gap-2 mb-4">
                    <span className="w-2 h-2 rounded-full bg-indigo-600"></span>
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Visual Configuration</h4>
                  </div>
                  <div className="grid grid-cols-2 gap-8">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">FontAwesome Icon</label>
                      <input value={editingItem?.icon || ''} onChange={(e) => setEditingItem({...editingItem, icon: e.target.value})}
                        className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 text-slate-700 font-mono text-sm outline-none" placeholder="fa-sitemap" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Execution Order</label>
                      <input type="number" value={editingItem?.sortOrder || 10} onChange={(e) => setEditingItem({...editingItem, sortOrder: parseInt(e.target.value)})}
                        className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 text-slate-700 font-bold outline-none" />
                    </div>
                  </div>
                </section>
              ) : (
                <>
                  <section className="space-y-6">
                    <div className="flex items-center gap-2 mb-4">
                      <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
                      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Enterprise Classification</h4>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Parent Category Mapping</label>
                      <select required value={editingItem?.categoryId || ''} onChange={(e) => setEditingItem({...editingItem, categoryId: e.target.value})}
                        className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 text-slate-700 font-bold appearance-none outline-none focus:border-blue-500">
                        {categories.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-8">
                       <div className="space-y-2">
                         <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Primary Audience</label>
                         <div className="bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 grid grid-cols-1 gap-2 max-h-40 overflow-y-auto custom-scrollbar">
                            {AUDIENCES.map(aud => (
                              <label key={aud.id} className="flex items-center gap-3 cursor-pointer group">
                                <input type="checkbox" className="sr-only" checked={editingItem?.audience?.includes(aud.id)}
                                  onChange={(e) => {
                                    const curr = editingItem.audience || [];
                                    const next = e.target.checked ? [...curr, aud.id] : curr.filter((id: string) => id !== aud.id);
                                    setEditingItem({...editingItem, audience: next});
                                  }} />
                                <div className={`w-4 h-4 rounded border-2 transition-all flex items-center justify-center ${editingItem?.audience?.includes(aud.id) ? 'bg-blue-600 border-blue-600' : 'bg-white border-slate-200 group-hover:border-slate-300'}`}>
                                   {editingItem?.audience?.includes(aud.id) && <i className="fas fa-check text-[8px] text-white"></i>}
                                </div>
                                <span className={`text-[11px] font-bold ${editingItem?.audience?.includes(aud.id) ? 'text-blue-600' : 'text-slate-500'}`}>{aud.label}</span>
                              </label>
                            ))}
                         </div>
                       </div>
                       <div className="space-y-2">
                         <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Lifecycle Phases</label>
                         <div className="bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 grid grid-cols-1 gap-2 max-h-40 overflow-y-auto custom-scrollbar">
                            {PHASES.map(ph => (
                              <label key={ph.id} className="flex items-center gap-3 cursor-pointer group">
                                <input type="checkbox" className="sr-only" checked={editingItem?.lifecyclePhases?.includes(ph.id)}
                                  onChange={(e) => {
                                    const curr = editingItem.lifecyclePhases || [];
                                    const next = e.target.checked ? [...curr, ph.id] : curr.filter((id: string) => id !== ph.id);
                                    setEditingItem({...editingItem, lifecyclePhases: next});
                                  }} />
                                <div className={`w-4 h-4 rounded border-2 transition-all flex items-center justify-center ${editingItem?.lifecyclePhases?.includes(ph.id) ? 'bg-emerald-600 border-emerald-600' : 'bg-white border-slate-200 group-hover:border-slate-300'}`}>
                                   {editingItem?.lifecyclePhases?.includes(ph.id) && <i className="fas fa-check text-[8px] text-white"></i>}
                                </div>
                                <span className={`text-[11px] font-bold ${editingItem?.lifecyclePhases?.includes(ph.id) ? 'text-emerald-600' : 'text-slate-500'}`}>{ph.label}</span>
                              </label>
                            ))}
                         </div>
                       </div>
                    </div>
                  </section>

                  <section className="space-y-6">
                    <div className="flex items-center gap-2 mb-4">
                      <span className="w-2 h-2 rounded-full bg-slate-900"></span>
                      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Starter Content & Governance</h4>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Default Document Template (Markdown/HTML)</label>
                      <textarea value={editingItem?.defaultTemplate || ''} onChange={(e) => setEditingItem({...editingItem, defaultTemplate: e.target.value})}
                        rows={6} className="w-full bg-slate-950 text-emerald-400 border-none rounded-2xl px-6 py-6 font-mono text-xs focus:ring-2 focus:ring-blue-500 outline-none" placeholder="# Executive Summary\n\nRecord the decision here..." />
                    </div>
                    <div className="flex items-center gap-8 bg-slate-50 p-6 rounded-2xl border border-slate-100">
                       {[
                         { id: 'requiresBundle', label: 'Require Bundle' },
                         { id: 'requiresApplication', label: 'Require App' },
                         { id: 'requiresMilestone', label: 'Require Milestone' }
                       ].map(knob => (
                         <label key={knob.id} className="flex items-center gap-3 cursor-pointer">
                            <input type="checkbox" className="sr-only" checked={editingItem?.requiredMetadata?.[knob.id as keyof typeof editingItem.requiredMetadata]}
                              onChange={(e) => setEditingItem({
                                ...editingItem, 
                                requiredMetadata: { ...editingItem.requiredMetadata, [knob.id]: e.target.checked }
                              })} />
                            <div className={`w-8 h-4 rounded-full relative transition-all ${editingItem?.requiredMetadata?.[knob.id as keyof typeof editingItem.requiredMetadata] ? 'bg-blue-600' : 'bg-slate-200'}`}>
                               <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${editingItem?.requiredMetadata?.[knob.id as keyof typeof editingItem.requiredMetadata] ? 'left-4.5' : 'left-0.5'}`}></div>
                            </div>
                            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{knob.label}</span>
                         </label>
                       ))}
                    </div>
                  </section>
                </>
              )}

              <footer className="flex items-center gap-4 pt-10 border-t border-slate-50">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] hover:text-slate-800 transition-colors">Discard</button>
                <button type="submit" disabled={loading} className="flex-1 py-4 bg-slate-900 text-white text-[10px] font-black rounded-2xl shadow-2xl hover:shadow-slate-300 transition-all active:scale-[0.98] disabled:opacity-50">
                  {loading ? <i className="fas fa-circle-notch fa-spin mr-2"></i> : null}
                  Commit Taxonomy Node
                </button>
              </footer>
            </form>
          </div>
        </div>
      )}

      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
      `}</style>
    </div>
  );
};

export default AdminTaxonomy;
