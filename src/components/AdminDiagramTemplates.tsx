import React, { useEffect, useMemo, useState } from 'react';
import { DiagramFormat } from '../types';
import MarkmapRenderer from './MarkmapRenderer';

const DIAGRAM_TYPES = [
  { id: 'enterprise_arch', label: 'Cloud Enterprise Architecture' },
  { id: 'application_integration', label: 'Application Integration' },
  { id: 'c4_context', label: 'C4 Context' },
  { id: 'c4_container', label: 'C4 Container' },
  { id: 'c4_component', label: 'C4 Component' },
  { id: 'sequence', label: 'Sequence Diagram' },
  { id: 'class', label: 'Class Diagram' },
  { id: 'service_design', label: 'Service Design' },
  { id: 'api_flow', label: 'API Flow' },
  { id: 'database_schema', label: 'Database Schema' },
  { id: 'data_flow', label: 'Data Flow Diagram' },
  { id: 'mind_map', label: 'Mind Map' },
  { id: 'capability_map', label: 'Capability Map' }
];

const formatOptions = [DiagramFormat.MERMAID, DiagramFormat.DRAWIO, DiagramFormat.MINDMAP_MD];

const AdminDiagramTemplates: React.FC = () => {
  const [templates, setTemplates] = useState<any[]>([]);
  const [filters, setFilters] = useState({ diagramType: 'all', format: 'all', active: 'all' });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const fetchTemplates = async () => {
    const params = new URLSearchParams();
    if (filters.diagramType !== 'all') params.set('diagramType', filters.diagramType);
    if (filters.format !== 'all') params.set('format', filters.format);
    params.set('includeInactive', 'true');
    const res = await fetch(`/api/diagram-templates?${params.toString()}`);
    const data = await res.json();
    setTemplates(Array.isArray(data) ? data : []);
  };

  useEffect(() => { fetchTemplates(); }, [filters.diagramType, filters.format]);

  const filtered = useMemo(() => {
    if (filters.active === 'all') return templates;
    const isActive = filters.active === 'active';
    return templates.filter((t) => Boolean(t.isActive) === isActive);
  }, [templates, filters.active]);

  const openCreate = () => {
    setEditing({
      key: '',
      name: '',
      description: '',
      diagramType: DIAGRAM_TYPES[0].id,
      format: DiagramFormat.MERMAID,
      content: '',
      preview: { kind: 'none' },
      tags: [],
      isActive: true,
      isDefault: false
    });
    setError('');
    setIsModalOpen(true);
  };

  const openEdit = async (tpl: any) => {
    const res = await fetch(`/api/diagram-templates/${encodeURIComponent(String(tpl._id || tpl.id))}`);
    const data = await res.json();
    setEditing({ ...data });
    setError('');
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing?.key || !editing?.name || !editing?.diagramType || !editing?.format || !editing?.content) {
      setError('Key, name, type, format, and content are required.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const url = editing?._id ? `/api/diagram-templates/${String(editing._id)}` : '/api/diagram-templates';
      const method = editing?._id ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editing)
      });
      const data = await res.json();
      if (res.ok) {
        setIsModalOpen(false);
        setEditing(null);
        fetchTemplates();
      } else {
        setError(data.error || 'Save failed');
      }
    } catch {
      setError('Save failed');
    } finally {
      setLoading(false);
    }
  };

  const handleDeactivate = async (id: string) => {
    if (!confirm('Deactivate this template?')) return;
    const res = await fetch(`/api/diagram-templates/${id}`, { method: 'DELETE' });
    if (res.ok) fetchTemplates();
  };

  const handleSetDefault = async (tpl: any) => {
    if (!confirm('Set this template as default for its type and format?')) return;
    const res = await fetch(`/api/diagram-templates/${String(tpl._id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...tpl, isDefault: true })
    });
    if (res.ok) fetchTemplates();
  };

  const renderPreview = () => {
    if (!editing) return null;
    if (editing.format === DiagramFormat.MERMAID) {
      return (
        <div className="bg-white border border-slate-100 rounded-2xl p-4 min-h-[240px]">
          <MermaidPreview content={editing.content} />
        </div>
      );
    }
    if (editing.format === DiagramFormat.MINDMAP_MD) {
      return (
        <pre className="bg-slate-950 text-emerald-300 rounded-2xl p-4 text-xs overflow-auto max-h-[240px]">
          {editing.content}
        </pre>
      );
    }
    return (
      <pre className="bg-slate-950 text-emerald-300 rounded-2xl p-4 text-xs overflow-auto max-h-[240px]">
        {editing.content}
      </pre>
    );
  };

  return (
    <div className="space-y-8 p-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">Diagram Templates</h2>
          <p className="text-slate-500 font-medium">Manage reusable architecture diagram templates.</p>
        </div>
        <button
          onClick={openCreate}
          className="px-6 py-3 bg-slate-900 text-white text-[10px] font-black rounded-2xl hover:bg-slate-800 transition-all uppercase tracking-widest shadow-xl shadow-slate-200"
        >
          + Add Template
        </button>
      </div>

      <div className="flex flex-wrap gap-4 bg-white border border-slate-100 rounded-2xl p-4">
        <select value={filters.diagramType} onChange={(e) => setFilters({ ...filters, diagramType: e.target.value })} className="bg-slate-50 border border-slate-100 rounded-xl px-4 py-2 text-xs font-bold text-slate-700">
          <option value="all">All Types</option>
          {DIAGRAM_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
        </select>
        <select value={filters.format} onChange={(e) => setFilters({ ...filters, format: e.target.value })} className="bg-slate-50 border border-slate-100 rounded-xl px-4 py-2 text-xs font-bold text-slate-700">
          <option value="all">All Formats</option>
          {formatOptions.map(f => <option key={f} value={f}>{f === DiagramFormat.MINDMAP_MD ? 'Mind Map (MD)' : f}</option>)}
        </select>
        <select value={filters.active} onChange={(e) => setFilters({ ...filters, active: e.target.value })} className="bg-slate-50 border border-slate-100 rounded-xl px-4 py-2 text-xs font-bold text-slate-700">
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      <div className="bg-white rounded-[2.5rem] border border-slate-200 overflow-hidden shadow-sm">
        <table className="w-full text-left">
          <thead className="bg-slate-50 border-b border-slate-100">
            <tr>
              <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Template</th>
              <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Type</th>
              <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Format</th>
              <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Active</th>
              <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Default</th>
              <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {filtered.map((t) => (
              <tr key={t._id} className="hover:bg-slate-50/50 transition-colors group">
                <td className="px-8 py-6">
                  <div className="flex flex-col">
                    <span className="font-bold text-slate-800">{t.name}</span>
                    <span className="text-[10px] text-slate-400 font-medium">{t.key}</span>
                  </div>
                </td>
                <td className="px-8 py-6 text-xs font-bold text-slate-600">{t.diagramType}</td>
                <td className="px-8 py-6 text-xs font-bold text-slate-600">{t.format}</td>
                <td className="px-8 py-6 text-center">
                  <span className={`w-3 h-3 rounded-full inline-block ${t.isActive ? 'bg-emerald-500 shadow-lg shadow-emerald-500/20' : 'bg-slate-200'}`}></span>
                </td>
                <td className="px-8 py-6 text-center">
                  {t.isDefault ? <i className="fas fa-star text-amber-400 drop-shadow-sm"></i> : <span className="text-[9px] text-slate-300 font-black uppercase">—</span>}
                </td>
                <td className="px-8 py-6 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button onClick={() => openEdit(t)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-white rounded-xl transition-all"><i className="fas fa-edit"></i></button>
                    {!t.isDefault && (
                      <button onClick={() => handleSetDefault(t)} className="p-2 text-slate-400 hover:text-amber-500 hover:bg-white rounded-xl transition-all" title="Set Default"><i className="fas fa-star"></i></button>
                    )}
                    {t.isActive && (
                      <button onClick={() => handleDeactivate(String(t._id))} className="p-2 text-slate-400 hover:text-red-600 hover:bg-white rounded-xl transition-all"><i className="fas fa-trash"></i></button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-8 py-10 text-center text-slate-400 text-sm">No templates found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {isModalOpen && editing && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[200] flex items-center justify-center p-6">
          <div className="bg-white rounded-[3rem] w-full max-w-4xl p-10 shadow-2xl animate-fadeIn border border-slate-100 overflow-y-auto max-h-[90vh] custom-scrollbar">
            <h3 className="text-3xl font-black text-slate-900 mb-2">{editing?._id ? 'Edit' : 'Create'} Diagram Template</h3>
            <p className="text-sm text-slate-500 mb-8 font-medium">Templates are governance assets and should be curated carefully.</p>

            {error && <div className="mb-6 p-4 bg-red-50 text-red-600 text-xs font-bold rounded-2xl border border-red-100">{error}</div>}

            <form onSubmit={handleSave} className="space-y-8">
              <div className="grid grid-cols-2 gap-8">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Key</label>
                  <input
                    type="text"
                    required
                    value={editing.key || ''}
                    onChange={(e) => setEditing({ ...editing, key: e.target.value })}
                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-3 text-slate-700 focus:border-blue-500 transition-all font-bold"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Name</label>
                  <input
                    type="text"
                    required
                    value={editing.name || ''}
                    onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-3 text-slate-700 focus:border-blue-500 transition-all font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Diagram Type</label>
                  <select
                    required
                    value={editing.diagramType || ''}
                    onChange={(e) => setEditing({ ...editing, diagramType: e.target.value })}
                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-3 text-slate-700 focus:border-blue-500 transition-all font-bold"
                  >
                    {DIAGRAM_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Format</label>
                  <select
                    required
                    value={editing.format || ''}
                    onChange={(e) => setEditing({ ...editing, format: e.target.value })}
                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-3 text-slate-700 focus:border-blue-500 transition-all font-bold"
                  >
                    {formatOptions.map(f => <option key={f} value={f}>{f === DiagramFormat.MINDMAP_MD ? 'Mind Map (MD)' : f}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Active</label>
                  <select
                    value={editing.isActive ? 'true' : 'false'}
                    onChange={(e) => setEditing({ ...editing, isActive: e.target.value === 'true' })}
                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-3 text-slate-700 focus:border-blue-500 transition-all font-bold"
                  >
                    <option value="true">Active</option>
                    <option value="false">Inactive</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Description</label>
                <input
                  type="text"
                  value={editing.description || ''}
                  onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                  className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-3 text-slate-700 focus:border-blue-500 transition-all font-bold"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Content</label>
                <textarea
                  required
                  value={editing.content || ''}
                  onChange={(e) => setEditing({ ...editing, content: e.target.value })}
                  rows={12}
                  className="w-full bg-slate-950 text-emerald-400 border-none rounded-2xl px-6 py-6 font-mono text-xs focus:ring-2 focus:ring-blue-500 transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-8">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Preview Kind</label>
                  <select
                    value={editing.preview?.kind || 'none'}
                    onChange={(e) => setEditing({ ...editing, preview: { ...(editing.preview || {}), kind: e.target.value } })}
                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-3 text-slate-700 focus:border-blue-500 transition-all font-bold"
                  >
                    <option value="none">None</option>
                    <option value="base64">Base64</option>
                    <option value="url">URL</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Preview Data</label>
                  <input
                    type="text"
                    value={editing.preview?.data || ''}
                    onChange={(e) => setEditing({ ...editing, preview: { ...(editing.preview || {}), data: e.target.value } })}
                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-3 text-slate-700 focus:border-blue-500 transition-all font-bold"
                  />
                </div>
              </div>

              <div className="flex items-center gap-4">
                <label className="flex items-center gap-3 cursor-pointer group">
                  <input type="checkbox" className="sr-only" checked={!!editing.isDefault} onChange={(e) => setEditing({ ...editing, isDefault: e.target.checked })} />
                  <div className={`w-10 h-5 rounded-full relative transition-all ${editing.isDefault ? 'bg-amber-400' : 'bg-slate-200'}`}>
                    <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${editing.isDefault ? 'left-5.5' : 'left-0.5'}`}></div>
                  </div>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Set as Default</span>
                </label>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Live Preview</label>
                {renderPreview()}
              </div>

              <div className="flex items-center gap-4 pt-6 border-t border-slate-50">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest border border-slate-200 text-slate-500 hover:text-slate-700">Cancel</button>
                <button type="submit" disabled={loading} className="px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest bg-slate-900 text-white disabled:opacity-50">
                  {loading ? 'Saving...' : 'Save Template'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

const MermaidPreview: React.FC<{ content: string }> = ({ content }) => {
  const containerRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    const render = async () => {
      if (!containerRef.current || !content) return;
      try {
        const mermaid = (await import('mermaid')).default;
        mermaid.initialize({ startOnLoad: false, theme: 'neutral', securityLevel: 'loose' });
        containerRef.current.innerHTML = '';
        const safeId = `mermaid-preview-${Math.random().toString(36).slice(2)}`;
        const { svg } = await mermaid.render(safeId, content);
        containerRef.current.innerHTML = svg;
        const svgEl = containerRef.current.querySelector('svg');
        if (svgEl && containerRef.current) {
          const width = Math.max(1, containerRef.current.clientWidth);
          const height = Math.max(1, containerRef.current.clientHeight);
          svgEl.setAttribute('width', String(width));
          svgEl.setAttribute('height', String(height));
        }
      } catch {
        if (containerRef.current) {
          containerRef.current.innerHTML = '<div class="text-xs text-red-500">Preview failed</div>';
        }
      }
    };
    render();
  }, [content]);

  return <div ref={containerRef} className="w-full h-[200px]" />;
};

export default AdminDiagramTemplates;
