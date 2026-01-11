
import React, { useState, useEffect } from 'react';
import { WikiTheme } from '../types';

const AdminThemes: React.FC = () => {
  const [themes, setThemes] = useState<WikiTheme[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTheme, setEditingTheme] = useState<Partial<WikiTheme> | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchThemes();
  }, []);

  const fetchThemes = async () => {
    const res = await fetch('/api/wiki/themes');
    setThemes(await res.json());
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const url = editingTheme?._id ? `/api/wiki/themes/${editingTheme._id}` : '/api/wiki/themes';
      const method = editingTheme?._id ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingTheme)
      });
      const data = await res.json();
      if (res.ok) {
        setIsModalOpen(false);
        setEditingTheme(null);
        fetchThemes();
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Save operation failed');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Confirm theme deletion? This cannot be undone.")) return;
    try {
      const res = await fetch(`/api/wiki/themes/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (res.ok) fetchThemes();
      else alert(data.error);
    } catch (err) {
      alert("Delete failed");
    }
  };

  return (
    <div className="space-y-8 p-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">Wiki Visual Themes</h2>
          <p className="text-slate-500 font-medium">Define enterprise styling scoped to documentation artifacts.</p>
        </div>
        <button 
          onClick={() => { setEditingTheme({ key: '', name: '', css: '', isActive: true, isDefault: false }); setIsModalOpen(true); }}
          className="px-6 py-3 bg-slate-900 text-white text-[10px] font-black rounded-2xl hover:bg-slate-800 transition-all uppercase tracking-widest shadow-xl shadow-slate-200"
        >
          + Add Theme
        </button>
      </div>

      <div className="bg-white rounded-[2.5rem] border border-slate-200 overflow-hidden shadow-sm">
        <table className="w-full text-left">
          <thead className="bg-slate-50 border-b border-slate-100">
            <tr>
              <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Theme Name</th>
              <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Unique Key</th>
              <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Active</th>
              <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Default</th>
              <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {themes.map(t => (
              <tr key={t._id} className="hover:bg-slate-50/50 transition-colors group">
                <td className="px-8 py-6">
                  <div className="flex flex-col">
                    <span className="font-bold text-slate-800">{t.name}</span>
                    <span className="text-[10px] text-slate-400 font-medium">{t.description || 'No description'}</span>
                  </div>
                </td>
                <td className="px-8 py-6">
                  <code className="text-xs bg-slate-100 px-2 py-1 rounded-lg text-blue-600 font-bold">{t.key}</code>
                </td>
                <td className="px-8 py-6 text-center">
                  <span className={`w-3 h-3 rounded-full inline-block ${t.isActive ? 'bg-emerald-500 shadow-lg shadow-emerald-500/20' : 'bg-slate-200'}`}></span>
                </td>
                <td className="px-8 py-6 text-center">
                  {t.isDefault && <i className="fas fa-star text-amber-400 drop-shadow-sm"></i>}
                </td>
                <td className="px-8 py-6 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button onClick={() => { setEditingTheme(t); setIsModalOpen(true); }} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-white rounded-xl transition-all"><i className="fas fa-edit"></i></button>
                    {!t.isDefault && <button onClick={() => handleDelete(t._id!)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-white rounded-xl transition-all"><i className="fas fa-trash"></i></button>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[200] flex items-center justify-center p-6">
          <div className="bg-white rounded-[3rem] w-full max-w-2xl p-12 shadow-2xl animate-fadeIn border border-slate-100 overflow-y-auto max-h-[90vh] custom-scrollbar">
            <h3 className="text-3xl font-black text-slate-900 mb-2">{editingTheme?._id ? 'Edit' : 'Configure New'} Theme</h3>
            <p className="text-sm text-slate-500 mb-8 font-medium">Use professional CSS scoped to <code>.wiki-content.theme-{editingTheme?.key || '[key]'}</code>.</p>
            
            {error && <div className="mb-6 p-4 bg-red-50 text-red-600 text-xs font-bold rounded-2xl border border-red-100">{error}</div>}

            <form onSubmit={handleSubmit} className="space-y-8">
              <div className="grid grid-cols-2 gap-8">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Friendly Name</label>
                  <input 
                    type="text" required value={editingTheme?.name || ''} onChange={(e) => setEditingTheme({ ...editingTheme, name: e.target.value })}
                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 text-slate-700 focus:border-blue-500 transition-all font-bold"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Theme Key (Unique ID)</label>
                  <input 
                    type="text" required disabled={!!editingTheme?._id} value={editingTheme?.key || ''} onChange={(e) => setEditingTheme({ ...editingTheme, key: e.target.value.toLowerCase().replace(/\s/g, '-') })}
                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 text-slate-700 focus:border-blue-500 transition-all font-black"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Theme CSS Definitions</label>
                <textarea 
                  required value={editingTheme?.css || ''} onChange={(e) => setEditingTheme({ ...editingTheme, css: e.target.value })}
                  rows={10}
                  className="w-full bg-slate-950 text-emerald-400 border-none rounded-2xl px-6 py-6 font-mono text-xs focus:ring-2 focus:ring-blue-500 transition-all"
                  placeholder={`.wiki-content.theme-${editingTheme?.key || 'my-theme'} h1 { color: #1e293b; }`}
                />
              </div>

              <div className="flex items-center justify-between px-2">
                <label className="flex items-center gap-3 cursor-pointer group">
                  <input type="checkbox" className="sr-only" checked={editingTheme?.isActive} onChange={(e) => setEditingTheme({ ...editingTheme, isActive: e.target.checked })} />
                  <div className={`w-10 h-5 rounded-full relative transition-all ${editingTheme?.isActive ? 'bg-emerald-500' : 'bg-slate-200'}`}>
                    <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${editingTheme?.isActive ? 'left-5.5' : 'left-0.5'}`}></div>
                  </div>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Active Status</span>
                </label>

                <label className="flex items-center gap-3 cursor-pointer group">
                  <input type="checkbox" className="sr-only" checked={editingTheme?.isDefault} onChange={(e) => setEditingTheme({ ...editingTheme, isDefault: e.target.checked })} />
                  <div className={`w-10 h-5 rounded-full relative transition-all ${editingTheme?.isDefault ? 'bg-amber-400' : 'bg-slate-200'}`}>
                    <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${editingTheme?.isDefault ? 'left-5.5' : 'left-0.5'}`}></div>
                  </div>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Set as Default</span>
                </label>
              </div>

              <div className="flex items-center gap-4 pt-6 border-t border-slate-50">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-800 transition-all">Discard</button>
                <button type="submit" disabled={loading} className="flex-1 py-4 bg-slate-900 text-white text-[10px] font-black rounded-2xl shadow-2xl hover:bg-slate-800 transition-all uppercase tracking-widest disabled:opacity-50">
                  {loading ? <i className="fas fa-spinner fa-spin"></i> : 'Commit Theme'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminThemes;
