
import React, { useState, useRef, useMemo, useEffect } from 'react';
import { WikiPage, WikiTheme, Bundle, Application, TaxonomyCategory, TaxonomyDocumentType } from '../types';
import WikiPageDisplay from './WikiPageDisplay';

interface WikiFormProps {
  initialTitle?: string;
  initialContent?: string;
  initialAuthor?: string;
  initialCreatedAt?: string;
  initialDocumentTypeId?: string;
  initialBundleId?: string;
  initialApplicationId?: string;
  initialMilestoneId?: string;
  spaceId: string;
  allPages?: WikiPage[];
  id?: string;
  onSaveSuccess: (savedId: string) => void;
  onCancel: () => void;
  currentUser?: { name: string };
  bundles: Bundle[];
  applications: Application[];
}

const COLOR_PALETTE = {
  blue: ['#07549C', '#096CC8', '#0B83F4', '#2791F5', '#63B0F8', '#BBDCFC'],
  red: ['#9C0725', '#C8092F', '#F40B3A', '#F86381', '#FA8FA4'],
  green: ['#05703C', '#079C54', '#09C86C', '#BBFCDC']
};

const WikiForm: React.FC<WikiFormProps> = ({ 
  initialTitle = '', 
  initialContent = '', 
  initialAuthor,
  initialCreatedAt,
  initialDocumentTypeId = '',
  initialBundleId = '',
  initialApplicationId = '',
  initialMilestoneId = '',
  spaceId,
  id,
  currentUser,
  onSaveSuccess,
  onCancel,
  bundles,
  applications
}) => {
  const [title, setTitle] = useState(initialTitle);
  const [content, setContent] = useState(initialContent);
  const [documentTypeId, setDocumentTypeId] = useState(initialDocumentTypeId);
  const [bundleId, setBundleId] = useState(initialBundleId);
  const [applicationId, setApplicationId] = useState(initialApplicationId);
  const [milestoneId, setMilestoneId] = useState(initialMilestoneId);
  const [themeKey, setThemeKey] = useState('');
  const [status, setStatus] = useState<'Draft' | 'Published'>('Published');
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'edit' | 'preview'>('edit');
  const [editorFormat, setEditorFormat] = useState<'markdown' | 'html'>('html');
  const [showSizeMenu, setShowSizeMenu] = useState(false);
  const [showColorMenu, setShowColorMenu] = useState(false);
  const [themes, setThemes] = useState<WikiTheme[]>([]);
  
  // Taxonomy Data
  const [categories, setCategories] = useState<TaxonomyCategory[]>([]);
  const [docTypes, setDocTypes] = useState<TaxonomyDocumentType[]>([]);

  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  const sizeMenuRef = useRef<HTMLDivElement>(null);
  const colorMenuRef = useRef<HTMLDivElement>(null);

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

    if (id) {
      fetch('/api/wiki')
        .then(res => res.json())
        .then(pages => {
          const page = pages.find((p: any) => p._id === id || p.id === id);
          if (page?.themeKey) setThemeKey(page.themeKey);
          if (page?.documentTypeId) setDocumentTypeId(page.documentTypeId);
        })
        .catch(() => {});
    }

    const handleClickOutside = (event: MouseEvent) => {
      if (sizeMenuRef.current && !sizeMenuRef.current.contains(event.target as Node)) setShowSizeMenu(false);
      if (colorMenuRef.current && !colorMenuRef.current.contains(event.target as Node)) setShowColorMenu(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [id]);

  const insertText = (before: string, after: string = '') => {
    if (!textAreaRef.current) return;
    const textarea = textAreaRef.current;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const replacement = before + textarea.value.substring(start, end) + after;
    setContent(textarea.value.substring(0, start) + replacement + textarea.value.substring(end));
    setTimeout(() => { textarea.focus(); textarea.setSelectionRange(start + before.length, start + before.length + (end - start)); }, 0);
  };

  const handleSave = async () => {
    if (!title.trim()) { setSaveError("Title required."); return; }
    setIsSaving(true);
    const payload: Partial<WikiPage> = {
      _id: id, title: title.trim(), content, spaceId, bundleId: bundleId || undefined,
      applicationId: applicationId || undefined, milestoneId: milestoneId || undefined,
      documentTypeId: documentTypeId || undefined, themeKey: themeKey || undefined, status,
      author: initialAuthor || currentUser?.name || 'System', lastModifiedBy: currentUser?.name || 'System', createdAt: initialCreatedAt
    };
    try {
      const res = await fetch('/api/wiki', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (res.ok) onSaveSuccess(id!);
      else setSaveError("Update failed.");
    } catch (err) { setSaveError("Network error."); }
    finally { setIsSaving(false); }
  };

  const currentType = docTypes.find(t => t._id === documentTypeId);
  const currentCategory = categories.find(c => c._id === currentType?.categoryId);

  return (
    <div className="fixed inset-0 z-[100] bg-slate-50 flex flex-col animate-fadeIn">
      <header className="px-10 py-5 bg-white border-b border-slate-200 flex items-center justify-between shadow-sm shrink-0">
        <div className="flex items-center gap-6">
          <button onClick={onCancel} className="w-10 h-10 rounded-full bg-slate-50 hover:bg-slate-100 flex items-center justify-center text-slate-400 border border-slate-100"><i className="fas fa-times"></i></button>
          <div className="flex flex-col">
            <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest leading-none mb-1">Revising Artifact</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className="text-2xl font-black text-slate-800 border-none p-0 focus:ring-0 outline-none bg-transparent w-[400px]" />
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 mr-4 shadow-inner">
            <button onClick={() => setStatus('Draft')} className={`px-4 py-2 text-[10px] font-black uppercase rounded-lg ${status === 'Draft' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}>Draft</button>
            <button onClick={() => setStatus('Published')} className={`px-4 py-2 text-[10px] font-black uppercase rounded-lg ${status === 'Published' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}>Publish</button>
          </div>
          <button onClick={handleSave} disabled={isSaving} className="px-10 py-3.5 bg-slate-900 text-white rounded-2xl shadow-xl font-black text-[10px] uppercase tracking-widest flex items-center gap-3">
            {isSaving ? <i className="fas fa-circle-notch fa-spin"></i> : <i className="fas fa-save"></i>} {isSaving ? 'Updating...' : 'Update Artifact'}
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 flex flex-col overflow-hidden bg-white shadow-inner relative">
          <div className="px-8 py-3 border-b border-slate-100 bg-slate-50 flex items-center justify-between z-50">
             <div className="flex items-center gap-1">
                <ToolbarButton icon="fa-bold" onClick={() => insertText('<b>', '</b>')} />
                <ToolbarButton icon="fa-italic" onClick={() => insertText('<i>', '</i>')} />
                <ToolbarButton icon="fa-heading" onClick={() => insertText('<h2>', '</h2>')} />
                <div className="w-[1px] h-6 bg-slate-200 mx-2"></div>
                <ToolbarButton icon="fa-list-ul" onClick={() => insertText('<ul>\n  <li>', '</li>\n</ul>')} />
                <ToolbarButton icon="fa-table" onClick={() => insertText('\n<table>\n  <tr><th>Header</th></tr>\n  <tr><td>Cell</td></tr>\n</table>\n')} />
             </div>
             <button onClick={() => setViewMode(viewMode === 'preview' ? 'edit' : 'preview')} className={`px-4 py-1.5 text-[9px] font-black uppercase rounded-xl ${viewMode === 'preview' ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200'}`}>
                {viewMode === 'preview' ? 'Editor' : 'Preview'}
             </button>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {viewMode === 'edit' ? (
              <textarea value={content} onChange={(e) => setContent(e.target.value)} ref={textAreaRef} className="w-full h-full p-12 text-slate-700 leading-relaxed resize-none text-lg outline-none font-medium" placeholder="Edit content..." />
            ) : (
              <div className="p-12 max-w-5xl mx-auto"><WikiPageDisplay page={{ title, content, spaceId, bundleId, applicationId, milestoneId, documentTypeId, themeKey }} bundles={bundles} applications={applications} /></div>
            )}
          </div>
        </div>

        <aside className="w-80 border-l border-slate-200 bg-slate-50 p-8 space-y-10 shrink-0 overflow-y-auto custom-scrollbar">
          <div className="space-y-6">
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><i className="fas fa-cog"></i> Configuration</h4>
            
            <div className="space-y-2">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Document Type</label>
              <select value={documentTypeId} onChange={(e) => setDocumentTypeId(e.target.value)} className="w-full bg-white border border-slate-200 rounded-2xl px-5 py-4 text-xs font-bold text-slate-700 outline-none shadow-sm">
                <option value="">None Selected</option>
                {categories.map(cat => (
                  <optgroup key={cat._id} label={cat.name}>
                    {docTypes.filter(t => t.categoryId === cat._id).map(type => (
                      <option key={type._id} value={type._id}>{type.name}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>

            <div className="space-y-2 opacity-60">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Category (Derived)</label>
              <div className="w-full bg-slate-100 border border-slate-200 rounded-2xl px-5 py-4 text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-3">
                <i className={`fas ${currentCategory?.icon || 'fa-tag'}`}></i>
                {currentCategory?.name || 'No Category Mapped'}
              </div>
            </div>

            <SidebarField label="Business Bundle" value={bundleId} onChange={setBundleId} options={bundles.map(b => ({ id: b._id, name: b.name }))} />
            <SidebarField label="App Context" value={applicationId} onChange={setApplicationId} options={applications.filter(a => !bundleId || bundleId === 'all' || a.bundleId === bundleId).map(a => ({ id: a._id || a.id, name: a.name }))} />
            <SidebarField label="Milestone" value={milestoneId} onChange={setMilestoneId} options={[...Array(10)].map((_, i) => ({ id: `M${i+1}`, name: `M${i+1}` }))} />
            <SidebarField label="Visual Theme" value={themeKey} onChange={setThemeKey} options={themes.map(t => ({ id: t.key, name: t.name }))} />
          </div>
        </aside>
      </div>
    </div>
  );
};

const ToolbarButton = ({ icon, onClick }: any) => (
  <button onClick={onClick} className="w-9 h-9 flex items-center justify-center text-slate-500 hover:text-blue-600 hover:bg-white rounded-xl transition-all"><i className={`fas ${icon} text-sm`}></i></button>
);

const SidebarField = ({ label, value, onChange, options }: any) => (
  <div className="space-y-2">
    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">{label}</label>
    <select value={value} onChange={(e) => onChange(e.target.value)} className="w-full bg-white border border-slate-200 rounded-2xl px-5 py-4 text-xs font-bold text-slate-700 outline-none shadow-sm">
      <option value="">None Selected</option>
      {options.map((o: any) => <option key={o.id} value={o.id}>{o.name}</option>)}
    </select>
  </div>
);

export default WikiForm;
