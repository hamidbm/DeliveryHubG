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
  const [slug, setSlug] = useState('');
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
  const [editorFormat, setEditorFormat] = useState<'markdown' | 'html'>('html');
  const [themes, setThemes] = useState<WikiTheme[]>([]);
  const [categories, setCategories] = useState<TaxonomyCategory[]>([]);
  const [docTypes, setDocTypes] = useState<TaxonomyDocumentType[]>([]);

  const textAreaRef = useRef<HTMLTextAreaElement>(null);

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

  const generateSlug = (val: string) => {
    return val.toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  };

  const handleTitleChange = (val: string) => {
    setTitle(val);
    if (!slug || slug === generateSlug(title)) {
      setSlug(generateSlug(val));
    }
  };

  const insertText = (before: string, after: string = '') => {
    if (!textAreaRef.current) return;
    const textarea = textAreaRef.current;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const replacement = before + textarea.value.substring(start, end) + after;
    setContent(textarea.value.substring(0, start) + replacement + textarea.value.substring(end));
    setTimeout(() => { textarea.focus(); textarea.setSelectionRange(start + before.length, start + before.length + (end - start)); }, 0);
  };

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
      title: title.trim(), content, slug, spaceId, bundleId: bundleId || undefined,
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
            <span className="text-[9px] font-black text-blue-600 uppercase tracking-widest leading-none mb-1">New Artifact Creator</span>
            <input value={title} onChange={(e) => handleTitleChange(e.target.value)} className="text-2xl font-black text-slate-800 border-none p-0 focus:ring-0 outline-none bg-transparent w-[400px]" placeholder="Untitled Artifact" />
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 mr-2 shadow-inner">
            <button onClick={() => setEditorFormat('markdown')} className={`px-4 py-2 text-[9px] font-black uppercase rounded-lg transition-all ${editorFormat === 'markdown' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}>Markdown</button>
            <button onClick={() => setEditorFormat('html')} className={`px-4 py-2 text-[9px] font-black uppercase rounded-lg transition-all ${editorFormat === 'html' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}>HTML</button>
          </div>

          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 mr-4 shadow-inner">
            <button onClick={() => setStatus('Draft')} className={`px-4 py-2 text-[10px] font-black uppercase rounded-lg ${status === 'Draft' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}>Draft</button>
            <button onClick={() => setStatus('Published')} className={`px-4 py-2 text-[10px] font-black uppercase rounded-lg ${status === 'Published' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}>Publish</button>
          </div>
          <button onClick={handleSave} disabled={isSaving} className="px-10 py-3.5 bg-slate-900 text-white rounded-2xl shadow-xl font-black text-[10px] uppercase tracking-widest flex items-center gap-3 active:scale-95 transition-all">
            {isSaving ? <i className="fas fa-circle-notch fa-spin"></i> : <i className="fas fa-save"></i>} {isSaving ? 'Creating...' : 'Create Artifact'}
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <main className="flex-1 flex flex-col overflow-hidden bg-white shadow-inner relative">
          <div className="px-8 py-3 border-b border-slate-100 bg-slate-50 flex items-center justify-between z-50">
             <div className="flex items-center gap-1">
                <ToolbarButton icon="fa-bold" onClick={() => insertText(editorFormat === 'html' ? '<b>' : '**', editorFormat === 'html' ? '</b>' : '**')} />
                <ToolbarButton icon="fa-italic" onClick={() => insertText(editorFormat === 'html' ? '<i>' : '*', editorFormat === 'html' ? '</i>' : '*')} />
                <ToolbarButton icon="fa-heading" onClick={() => insertText(editorFormat === 'html' ? '<h2>' : '## ', editorFormat === 'html' ? '</h2>' : '')} />
                <ToolbarButton icon="fa-paragraph" onClick={() => insertText(editorFormat === 'html' ? '<p>' : '', editorFormat === 'html' ? '</p>' : '\n\n')} />
                <div className="w-[1px] h-6 bg-slate-200 mx-2"></div>
                <ToolbarButton icon="fa-list-ul" onClick={() => insertText(editorFormat === 'html' ? '<ul>\n  <li>' : '- ', editorFormat === 'html' ? '</li>\n</ul>' : '')} />
                <ToolbarButton icon="fa-table" onClick={() => insertText(editorFormat === 'html' ? '\n<table>\n  <tr><th>Header</th></tr>\n  <tr><td>Cell</td></tr>\n</table>\n' : '\n| Header |\n| --- |\n| Cell |\n')} />
                <div className="w-[1px] h-6 bg-slate-200 mx-2"></div>
                <ToolbarButton icon="fa-link" onClick={() => insertText(editorFormat === 'html' ? '<a href="/wiki/TARGET-SLUG">Link Title' : '[Link Title](/wiki/TARGET-SLUG', editorFormat === 'html' ? '</a>' : ')')} />
                <div className="w-[1px] h-6 bg-slate-200 mx-2"></div>
                <ToolbarButton icon="fa-circle-info" onClick={() => insertText('<div class="callout info">\n  <div class="title"><i class="fas fa-circle-info"></i> INFO</div>\n  <p>', '</p>\n</div>')} />
                <ToolbarButton icon="fa-triangle-exclamation" onClick={() => insertText('<div class="callout warn">\n  <div class="title"><i class="fas fa-triangle-exclamation"></i> WARNING</div>\n  <p>', '</p>\n</div>')} />
                <ToolbarButton icon="fa-grip" onClick={() => insertText('<div class="cards">\n  <div class="card accent span-6">\n    <div class="card-title">Card Title</div>\n    <div class="card-meta">META TAG</div>\n    <p>', '</p>\n  </div>\n</div>')} />
                <ToolbarButton icon="fa-code" onClick={() => insertText(editorFormat === 'html' ? '<pre><code>' : '```\n', editorFormat === 'html' ? '</code></pre>' : '\n```')} />
             </div>
             <button onClick={() => setViewMode(viewMode === 'preview' ? 'edit' : 'preview')} className={`px-4 py-1.5 text-[9px] font-black uppercase rounded-xl transition-all ${viewMode === 'preview' ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-500'}`}>
                {viewMode === 'preview' ? 'Editor View' : 'Preview Artifact'}
             </button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {viewMode === 'edit' ? (
              <textarea 
                value={content} 
                onChange={(e) => setContent(e.target.value)} 
                ref={textAreaRef}
                className="w-full h-full p-12 text-slate-700 leading-relaxed resize-none text-lg outline-none font-medium placeholder:text-slate-300" 
                placeholder="Start authoring content..." 
              />
            ) : (
              <div className="p-12 max-w-5xl mx-auto">
                <WikiPageDisplay page={{ title, content, slug, spaceId, bundleId, applicationId, milestoneId, documentTypeId, themeKey }} bundles={bundles} applications={applications} />
              </div>
            )}
          </div>
        </main>
        
        <aside className="w-80 border-l border-slate-200 bg-slate-50 p-8 space-y-10 shrink-0 overflow-y-auto custom-scrollbar">
          <div className="space-y-6">
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><i className="fas fa-cog"></i> Classification</h4>
            
            <div className="space-y-2">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Document Slug (Stable URL)</label>
              <input value={slug} onChange={(e) => setSlug(generateSlug(e.target.value))} className="w-full bg-white border border-slate-200 rounded-2xl px-5 py-4 text-xs font-bold text-blue-600 outline-none shadow-sm focus:border-blue-500 transition-all" placeholder="my-stable-link" />
            </div>

            <div className="space-y-2">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Document Type</label>
              <select value={documentTypeId} onChange={(e) => handleTypeChange(e.target.value)} className="w-full bg-white border border-slate-200 rounded-2xl px-5 py-4 text-xs font-bold text-slate-700 outline-none shadow-sm focus:border-blue-500 transition-all">
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
            <SidebarField label="Milestone" value={milestoneId} onChange={setMilestoneId} options={[...Array(10)].map((_, i) => ({ id: `M${i+1}`, name: `M${i+1}` }))} />
            <SidebarField label="Visual Theme" value={themeKey} onChange={setThemeKey} options={themes.map(t => ({ id: t.key, name: t.name }))} />
          </div>

          {saveError && (
            <div className="p-4 bg-red-50 border border-red-100 rounded-2xl text-red-500 text-[10px] font-black uppercase tracking-widest flex items-center gap-2 animate-fadeIn">
              <i className="fas fa-exclamation-triangle"></i>
              {saveError}
            </div>
          )}
        </aside>
      </div>
      {/* Fix: Replaced style jsx with standard style tag and dangerouslySetInnerHTML for compatibility */}
      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
      `}} />
    </div>
  );
};

const ToolbarButton = ({ icon, onClick }: any) => (
  <button onClick={onClick} className="w-9 h-9 flex items-center justify-center text-slate-400 hover:text-blue-600 hover:bg-white hover:shadow-sm rounded-xl transition-all"><i className={`fas ${icon} text-sm`}></i></button>
);

const SidebarField = ({ label, value, onChange, options }: any) => (
  <div className="space-y-2">
    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">{label}</label>
    <select value={value} onChange={(e) => onChange(e.target.value)} className="w-full bg-white border border-slate-200 rounded-2xl px-5 py-4 text-xs font-bold text-slate-700 outline-none shadow-sm focus:border-blue-500 transition-all">
      <option value="">None Selected</option>
      {options.map((o: any) => <option key={o.id} value={o.id}>{o.name}</option>)}
    </select>
  </div>
);

export default CreateWikiPageForm;