
import React, { useState, useRef, useMemo, useEffect } from 'react';
import { WikiPage, WikiTheme, Bundle, Application, TaxonomyCategory, TaxonomyDocumentType } from '../types';
import WikiPageDisplay from './WikiPageDisplay';

interface CreateWikiPageFormProps {
  parentId?: string;
  spaceId: string;
  allPages: WikiPage[];
  currentUser?: { name: string };
  onSaveSuccess: (savedId: string) => void;
  onCancel: () => void;
  bundles: Bundle[];
  applications: Application[];
}

const CreateWikiPageForm: React.FC<CreateWikiPageFormProps> = ({ 
  spaceId, currentUser, onSaveSuccess, onCancel, bundles, applications
}) => {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [documentTypeId, setDocumentTypeId] = useState('');
  const [bundleId, setBundleId] = useState('');
  const [applicationId, setApplicationId] = useState('');
  const [milestoneId, setMilestoneId] = useState('');
  const [themeKey, setThemeKey] = useState('');
  const [status, setStatus] = useState<'Draft' | 'Published'>('Draft');
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'edit' | 'preview'>('edit');
  const [themes, setThemes] = useState<WikiTheme[]>([]);
  const [categories, setCategories] = useState<TaxonomyCategory[]>([]);
  const [docTypes, setDocTypes] = useState<TaxonomyDocumentType[]>([]);

  useEffect(() => {
    const loadData = async () => {
      const [thRes, catRes, typRes] = await Promise.all([
        fetch('/api/wiki/themes?active=true'),
        fetch('/api/taxonomy/categories?active=true'),
        fetch('/api/taxonomy/document-types?active=true')
      ]);
      setThemes(await thRes.json());
      setCategories(await catRes.json());
      setDocTypes(await typRes.json());
    };
    loadData();
  }, []);

  const handleTypeChange = (val: string) => {
    setDocumentTypeId(val);
    const selected = docTypes.find(t => t._id === val);
    if (selected?.defaultTemplate && (!content || content.trim() === "")) {
      setContent(selected.defaultTemplate);
    }
  };

  const handleSave = async () => {
    if (!title.trim()) { setSaveError("Title required."); return; }
    setIsSaving(true);
    const payload: Partial<WikiPage> = {
      title: title.trim(), content, spaceId, bundleId: bundleId || undefined,
      applicationId: applicationId || undefined, milestoneId: milestoneId || undefined,
      documentTypeId: documentTypeId || undefined, themeKey: themeKey || undefined, status,
      author: currentUser?.name || 'System', lastModifiedBy: currentUser?.name || 'System'
    };
    try {
      const res = await fetch('/api/wiki', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (res.ok) onSaveSuccess(data.result?.insertedId || '');
      else setSaveError("Save failed.");
    } catch (err) { setSaveError("Network failure."); }
    finally { setIsSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-slate-50 flex flex-col animate-fadeIn">
      <header className="px-10 py-5 bg-white border-b border-slate-200 flex items-center justify-between shadow-sm shrink-0">
        <div className="flex items-center gap-6">
          <button onClick={onCancel} className="w-10 h-10 rounded-full bg-slate-50 hover:bg-slate-100 flex items-center justify-center text-slate-400 border border-slate-100"><i className="fas fa-times"></i></button>
          <div className="flex flex-col">
            <span className="text-[9px] font-black text-blue-600 uppercase tracking-widest mb-1">New Artifact Creator</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className="text-2xl font-black text-slate-800 border-none p-0 focus:ring-0 outline-none bg-transparent w-[400px]" placeholder="Untitled Artifact" />
          </div>
        </div>
        <div className="flex items-center gap-4">
           <button onClick={handleSave} disabled={isSaving} className="px-10 py-3.5 bg-slate-900 text-white rounded-2xl shadow-xl font-black text-[10px] uppercase tracking-widest">
            {isSaving ? 'Saving...' : 'Create Artifact'}
           </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <main className="flex-1 flex flex-col overflow-hidden bg-white">
          <div className="px-8 py-3 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
             <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Document Editor</div>
             <button onClick={() => setViewMode(viewMode === 'preview' ? 'edit' : 'preview')} className="text-[9px] font-black uppercase text-blue-600">{viewMode === 'preview' ? 'Edit Mode' : 'Full Preview'}</button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {viewMode === 'edit' ? (
              <textarea value={content} onChange={(e) => setContent(e.target.value)} className="w-full h-full p-12 text-slate-700 leading-relaxed resize-none text-lg outline-none font-medium" placeholder="Start authoring..." />
            ) : (
              <div className="p-12 max-w-5xl mx-auto"><WikiPageDisplay page={{ title, content, spaceId, bundleId, applicationId, milestoneId, documentTypeId, themeKey }} bundles={bundles} applications={applications} /></div>
            )}
          </div>
        </main>
        
        <aside className="w-80 border-l border-slate-200 bg-slate-50 p-8 space-y-10 overflow-y-auto custom-scrollbar">
          <div className="space-y-6">
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Classification</h4>
            
            <div className="space-y-2">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Document Type</label>
              <select value={documentTypeId} onChange={(e) => handleTypeChange(e.target.value)} className="w-full bg-white border border-slate-200 rounded-2xl px-5 py-4 text-xs font-bold text-slate-700 outline-none shadow-sm">
                <option value="">Generic Document</option>
                {categories.map(cat => (
                  <optgroup key={cat._id} label={cat.name}>
                    {docTypes.filter(t => t.categoryId === cat._id).map(type => (
                      <option key={type._id} value={type._id}>{type.name}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>

            <SidebarField label="Target Bundle" value={bundleId} onChange={setBundleId} options={bundles.map(b => ({ id: b._id, name: b.name }))} />
            <SidebarField label="Target Application" value={applicationId} onChange={setApplicationId} options={applications.filter(a => !bundleId || a.bundleId === bundleId).map(a => ({ id: a._id || a.id, name: a.name }))} />
          </div>
        </aside>
      </div>
    </div>
  );
};

const SidebarField = ({ label, value, onChange, options }: any) => (
  <div className="space-y-2">
    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">{label}</label>
    <select value={value} onChange={(e) => onChange(e.target.value)} className="w-full bg-white border border-slate-200 rounded-2xl px-5 py-4 text-xs font-bold text-slate-700 outline-none shadow-sm">
      <option value="">None Selected</option>
      {options.map((o: any) => <option key={o.id} value={o.id}>{o.name}</option>)}
    </select>
  </div>
);

export default CreateWikiPageForm;
