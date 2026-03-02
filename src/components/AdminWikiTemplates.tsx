import React, { useEffect, useState } from 'react';
import { WikiTemplate, TaxonomyDocumentType } from '../types';
import DocumentTypePicker from './DocumentTypePicker';

const AdminWikiTemplates: React.FC = () => {
  const [templates, setTemplates] = useState<WikiTemplate[]>([]);
  const [docTypes, setDocTypes] = useState<TaxonomyDocumentType[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Partial<WikiTemplate> | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchTemplates();
    fetchDocTypes();
  }, []);

  const fetchTemplates = async () => {
    const res = await fetch('/api/wiki/templates');
    setTemplates(await res.json());
  };

  const fetchDocTypes = async () => {
    const res = await fetch('/api/taxonomy/document-types?active=true');
    setDocTypes(await res.json());
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTemplate?.name || !editingTemplate?.documentTypeId || !editingTemplate?.content) {
      setError('Name, document type, and content are required.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const url = editingTemplate?._id ? `/api/wiki/templates/${String(editingTemplate._id)}` : '/api/wiki/templates';
      const method = editingTemplate?._id ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingTemplate)
      });
      const data = await res.json();
      if (res.ok) {
        setIsModalOpen(false);
        setEditingTemplate(null);
        fetchTemplates();
      } else {
        setError(data.error || 'Save failed');
      }
    } catch {
      setError('Save operation failed');
    } finally {
      setLoading(false);
    }
  };

  const handleDeactivate = async (id: string) => {
    if (!confirm('Deactivate this template? It will no longer appear in the Wiki flow.')) return;
    try {
      const res = await fetch(`/api/wiki/templates/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (res.ok) fetchTemplates();
      else alert(data.error || 'Deactivate failed');
    } catch {
      alert('Deactivate failed');
    }
  };

  const resolveDocTypeName = (id?: string) =>
    docTypes.find((d) => String(d._id || d.id) === String(id))?.name || 'Unknown';

  return (
    <div className="space-y-8 p-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">Wiki Templates</h2>
          <p className="text-slate-500 font-medium">Manage reusable templates tied to document types.</p>
        </div>
        <button
          onClick={() => {
            setEditingTemplate({ name: '', documentTypeId: '', content: '', isActive: true, isDefault: false });
            setIsModalOpen(true);
          }}
          className="px-6 py-3 bg-slate-900 text-white text-[10px] font-black rounded-2xl hover:bg-slate-800 transition-all uppercase tracking-widest shadow-xl shadow-slate-200"
        >
          + Add Template
        </button>
      </div>

      <div className="bg-white rounded-[2.5rem] border border-slate-200 overflow-hidden shadow-sm">
        <table className="w-full text-left">
          <thead className="bg-slate-50 border-b border-slate-100">
            <tr>
              <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Template Name</th>
              <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Document Type</th>
              <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Active</th>
              <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Default</th>
              <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {templates.map((t) => (
              <tr key={t._id} className="hover:bg-slate-50/50 transition-colors group">
                <td className="px-8 py-6">
                  <div className="flex flex-col">
                    <span className="font-bold text-slate-800">{t.name}</span>
                    <span className="text-[10px] text-slate-400 font-medium">{t._id}</span>
                  </div>
                </td>
                <td className="px-8 py-6">
                  <span className="text-xs font-bold text-slate-600">{resolveDocTypeName(t.documentTypeId)}</span>
                </td>
                <td className="px-8 py-6 text-center">
                  <span className={`w-3 h-3 rounded-full inline-block ${t.isActive ? 'bg-emerald-500 shadow-lg shadow-emerald-500/20' : 'bg-slate-200'}`}></span>
                </td>
                <td className="px-8 py-6 text-center">
                  {t.isDefault && <i className="fas fa-star text-amber-400 drop-shadow-sm"></i>}
                </td>
                <td className="px-8 py-6 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button onClick={() => { setEditingTemplate(t); setIsModalOpen(true); }} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-white rounded-xl transition-all"><i className="fas fa-edit"></i></button>
                    {t.isActive && (
                      <button onClick={() => handleDeactivate(t._id!)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-white rounded-xl transition-all"><i className="fas fa-trash"></i></button>
                    )}
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
            <h3 className="text-3xl font-black text-slate-900 mb-2">{editingTemplate?._id ? 'Edit' : 'Create'} Template</h3>
            <p className="text-sm text-slate-500 mb-8 font-medium">Templates are Markdown-only and tied to a document type.</p>

            {error && <div className="mb-6 p-4 bg-red-50 text-red-600 text-xs font-bold rounded-2xl border border-red-100">{error}</div>}

            <form onSubmit={handleSubmit} className="space-y-8">
              <div className="grid grid-cols-2 gap-8">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Template Name</label>
                  <input
                    type="text"
                    required
                    value={editingTemplate?.name || ''}
                    onChange={(e) => setEditingTemplate({ ...editingTemplate, name: e.target.value })}
                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 text-slate-700 focus:border-blue-500 transition-all font-bold"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Document Type</label>
                  <DocumentTypePicker
                    docTypes={docTypes}
                    value={editingTemplate?.documentTypeId || ''}
                    onChange={(value) => setEditingTemplate({ ...editingTemplate, documentTypeId: value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Template Content (Markdown)</label>
                <textarea
                  required
                  value={editingTemplate?.content || ''}
                  onChange={(e) => setEditingTemplate({ ...editingTemplate, content: e.target.value })}
                  rows={10}
                  className="w-full bg-slate-950 text-emerald-400 border-none rounded-2xl px-6 py-6 font-mono text-xs focus:ring-2 focus:ring-blue-500 transition-all"
                  placeholder="# Template Title\n\n## Section"
                />
              </div>

              <div className="flex items-center justify-between px-2">
                <label className="flex items-center gap-3 cursor-pointer group">
                  <input type="checkbox" className="sr-only" checked={!!editingTemplate?.isActive} onChange={(e) => setEditingTemplate({ ...editingTemplate, isActive: e.target.checked })} />
                  <div className={`w-10 h-5 rounded-full relative transition-all ${editingTemplate?.isActive ? 'bg-emerald-500' : 'bg-slate-200'}`}>
                    <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${editingTemplate?.isActive ? 'left-5.5' : 'left-0.5'}`}></div>
                  </div>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Active Status</span>
                </label>

                <label className="flex items-center gap-3 cursor-pointer group">
                  <input type="checkbox" className="sr-only" checked={!!editingTemplate?.isDefault} onChange={(e) => setEditingTemplate({ ...editingTemplate, isDefault: e.target.checked })} />
                  <div className={`w-10 h-5 rounded-full relative transition-all ${editingTemplate?.isDefault ? 'bg-amber-400' : 'bg-slate-200'}`}>
                    <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${editingTemplate?.isDefault ? 'left-5.5' : 'left-0.5'}`}></div>
                  </div>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Set as Default</span>
                </label>
              </div>

              <div className="flex items-center gap-4 pt-6 border-t border-slate-50">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-800 transition-all">Discard</button>
                <button type="submit" disabled={loading} className="flex-1 py-4 bg-slate-900 text-white text-[10px] font-black rounded-2xl shadow-2xl hover:bg-slate-800 transition-all uppercase tracking-widest disabled:opacity-50">
                  {loading ? <i className="fas fa-spinner fa-spin"></i> : 'Commit Template'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminWikiTemplates;
