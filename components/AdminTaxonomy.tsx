
import React, { useState, useEffect } from 'react';
import { TaxonomyCategory, TaxonomyDocumentType } from '../types';

const AdminTaxonomy: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'categories' | 'types'>('categories');
  const [categories, setCategories] = useState<TaxonomyCategory[]>([]);
  const [types, setTypes] = useState<TaxonomyDocumentType[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const [cRes, tRes] = await Promise.all([
      fetch('/api/taxonomy/categories'),
      fetch('/api/taxonomy/document-types')
    ]);
    setCategories(await cRes.json());
    setTypes(await tRes.json());
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const url = activeTab === 'categories' ? '/api/taxonomy/categories' : '/api/taxonomy/document-types';
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
    } catch (err) {
      console.error("Save failed", err);
    } finally {
      setLoading(false);
    }
  };

  const openNewCategory = () => {
    setEditingItem({ key: '', name: '', icon: 'fa-file', isActive: true, sortOrder: 10 });
    setIsModalOpen(true);
  };

  const openNewType = () => {
    setEditingItem({ key: '', name: '', categoryId: categories[0]?._id, isActive: true, sortOrder: 10 });
    setIsModalOpen(true);
  };

  return (
    <div className="space-y-8 p-6">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">Enterprise Taxonomy</h2>
          <p className="text-slate-500 font-medium">Standardize documentation structures across the portfolio.</p>
        </div>
        <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200 shadow-inner">
          <button onClick={() => setActiveTab('categories')} className={`px-6 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${activeTab === 'categories' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}>Categories</button>
          <button onClick={() => setActiveTab('types')} className={`px-6 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${activeTab === 'types' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}>Document Types</button>
        </div>
      </div>

      <div className="bg-white rounded-[2.5rem] border border-slate-200 overflow-hidden shadow-sm">
        {activeTab === 'categories' ? (
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Icon / Key</th>
                <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Category Name</th>
                <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Types</th>
                <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Status</th>
                <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">
                  <button onClick={openNewCategory} className="text-blue-600 hover:text-blue-700 font-black">+ Add</button>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {categories.map(c => (
                <tr key={c._id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-8 py-6 flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400">
                      <i className={`fas ${c.icon}`}></i>
                    </div>
                    <code className="text-xs font-black text-blue-600 uppercase">{c.key}</code>
                  </td>
                  <td className="px-8 py-6 font-bold text-slate-800">{c.name}</td>
                  <td className="px-8 py-6 text-center text-sm font-medium text-slate-400">
                    {types.filter(t => t.categoryId === c._id).length}
                  </td>
                  <td className="px-8 py-6 text-center">
                    <span className={`w-2.5 h-2.5 rounded-full inline-block ${c.isActive ? 'bg-emerald-500' : 'bg-slate-200'}`}></span>
                  </td>
                  <td className="px-8 py-6 text-right">
                    <button onClick={() => { setEditingItem(c); setIsModalOpen(true); }} className="text-slate-400 hover:text-blue-600"><i className="fas fa-edit"></i></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Type Key</th>
                <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Artifact Name</th>
                <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Category</th>
                <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Status</th>
                <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">
                  <button onClick={openNewType} className="text-blue-600 hover:text-blue-700 font-black">+ Add</button>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {types.map(t => (
                <tr key={t._id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-8 py-6">
                    <code className="text-xs font-black text-slate-400 uppercase">{t.key}</code>
                  </td>
                  <td className="px-8 py-6 font-bold text-slate-800">{t.name}</td>
                  <td className="px-8 py-6">
                    <span className="text-xs font-bold text-slate-500">{categories.find(c => c._id === t.categoryId)?.name || 'Unknown'}</span>
                  </td>
                  <td className="px-8 py-6 text-center">
                    <span className={`w-2.5 h-2.5 rounded-full inline-block ${t.isActive ? 'bg-emerald-500' : 'bg-slate-200'}`}></span>
                  </td>
                  <td className="px-8 py-6 text-right">
                    <button onClick={() => { setEditingItem(t); setIsModalOpen(true); }} className="text-slate-400 hover:text-blue-600"><i className="fas fa-edit"></i></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[200] flex items-center justify-center p-6">
          <div className="bg-white rounded-[3rem] w-full max-w-xl p-12 shadow-2xl animate-fadeIn border border-slate-100 overflow-y-auto max-h-[90vh]">
            <h3 className="text-3xl font-black text-slate-900 mb-8">{editingItem?._id ? 'Edit' : 'New'} {activeTab === 'categories' ? 'Category' : 'Document Type'}</h3>
            <form onSubmit={handleSave} className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Unique Key</label>
                  <input required value={editingItem?.key || ''} onChange={(e) => setEditingItem({...editingItem, key: e.target.value.toUpperCase()})}
                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 text-slate-700 focus:border-blue-500 font-black" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Display Name</label>
                  <input required value={editingItem?.name || ''} onChange={(e) => setEditingItem({...editingItem, name: e.target.value})}
                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 text-slate-700 focus:border-blue-500 font-bold" />
                </div>
              </div>

              {activeTab === 'categories' ? (
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">FontAwesome Icon</label>
                  <input value={editingItem?.icon || ''} onChange={(e) => setEditingItem({...editingItem, icon: e.target.value})}
                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 text-slate-700 font-mono" placeholder="fa-book" />
                </div>
              ) : (
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Parent Category</label>
                  <select required value={editingItem?.categoryId || ''} onChange={(e) => setEditingItem({...editingItem, categoryId: e.target.value})}
                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 text-slate-700 font-bold appearance-none">
                    {categories.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
                  </select>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Default Template (Optional)</label>
                <textarea value={editingItem?.defaultTemplate || ''} onChange={(e) => setEditingItem({...editingItem, defaultTemplate: e.target.value})}
                  rows={4} className="w-full bg-slate-950 text-emerald-400 border-none rounded-2xl px-6 py-6 font-mono text-xs" placeholder="# Title\n\nContent goes here..." />
              </div>

              <div className="flex items-center gap-4 pt-6">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-4 text-[10px] font-black text-slate-400 uppercase">Cancel</button>
                <button type="submit" disabled={loading} className="flex-1 py-4 bg-slate-900 text-white text-[10px] font-black rounded-2xl shadow-xl">
                  {loading ? 'Processing...' : 'Commit Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminTaxonomy;
