import React, { useState, useRef, useMemo, useEffect } from 'react';
import { WikiPage, WikiTheme, Bundle, Application, TaxonomyCategory, TaxonomyDocumentType } from '../types';
import WikiPageDisplay from './WikiPageDisplay';

interface CreateWikiPageFormProps {
  parentId?: string;
  spaceId: string;
  initialBundleId?: string;
  initialApplicationId?: string;
  initialMilestoneId?: string;
  initialMode?: 'author' | 'upload' | 'ai';
  allPages: WikiPage[];
  currentUser?: { name: string };
  onSaveSuccess: (savedId: string) => void;
  onCancel: () => void;
  bundles: Bundle[];
  applications: Application[];
}

const CreateWikiPageForm: React.FC<CreateWikiPageFormProps> = ({ 
  spaceId,
  initialBundleId = '',
  initialApplicationId = '',
  initialMilestoneId = '',
  initialMode = 'author',
  currentUser,
  onSaveSuccess,
  onCancel,
  bundles,
  applications
}) => {
  const [mode, setMode] = useState<'author' | 'upload' | 'ai'>(initialMode);
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [content, setContent] = useState('');
  const [documentTypeId, setDocumentTypeId] = useState('');
  const [bundleId, setBundleId] = useState(initialBundleId);
  const [applicationId, setApplicationId] = useState(initialApplicationId);
  const [milestoneId, setMilestoneId] = useState(initialMilestoneId);
  const [themeKey, setThemeKey] = useState('');
  const [status, setStatus] = useState<'Draft' | 'Published'>('Published');
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'edit' | 'preview'>('edit');
  const [editorFormat, setEditorFormat] = useState<'markdown' | 'html'>('html');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [aiPrompt, setAiPrompt] = useState('');
  
  const [themes, setThemes] = useState<WikiTheme[]>([]);
  const [categories, setCategories] = useState<TaxonomyCategory[]>([]);
  const [docTypes, setDocTypes] = useState<TaxonomyDocumentType[]>([]);

  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const promptSuggestions = useMemo(() => {
    const selectedType = docTypes.find((type) => type._id === documentTypeId);
    if (!selectedType) return [];
    const name = selectedType.name;
    const base = `Create a Markdown template for a "${name}" document.`;
    const suggestions = [
      `${base} Include sections for Overview, Scope, Assumptions, and Key Decisions.`,
      `${base} Provide a structured outline with headings, bullet points, and placeholders for data.`,
      `${base} Emphasize diagrams or tables where helpful and include a revision history section.`,
    ];

    const specialized: Record<string, string[]> = {
      'Low Level Design': [
        `${base} Include Architecture, Interfaces, Data Model, Error Handling, and NFRs.`,
        `${base} Add API contracts, sequence flows, and deployment considerations sections.`,
      ],
      'High Level Design': [
        `${base} Include Business Context, System Overview, Architecture, and Risks.`,
        `${base} Add components, integrations, and security considerations sections.`,
      ],
      Runbook: [
        `${base} Include Prerequisites, Step-by-step Procedures, Validation, and Rollback.`,
        `${base} Add monitoring, alerts, and escalation paths sections.`,
      ],
      'Test Plan': [
        `${base} Include Scope, Test Strategy, Test Cases, and Exit Criteria.`,
        `${base} Add environments, test data, and traceability sections.`,
      ],
      'Migration Plan': [
        `${base} Include Phases, Cutover Steps, Data Migration, and Rollback.`,
        `${base} Add risk mitigation and timeline sections.`,
      ],
    };

    return specialized[name] ? [...specialized[name], ...suggestions] : suggestions;
  }, [docTypes, documentTypeId]);

  const buildTemplate = (docTypeName: string, prompt: string) => {
    const header = `# ${title || docTypeName || 'New Document'}\n\n`;
    const promptNote = prompt.trim()
      ? `> **AI Prompt Used:** ${prompt.trim()}\n\n`
      : '';

    const templates: Record<string, string> = {
      'Low Level Design': [
        '## Overview',
        '## Scope',
        '## Architecture',
        '## Interfaces & APIs',
        '## Data Model',
        '## Error Handling',
        '## Security',
        '## NFRs',
        '## Deployment',
        '## Open Questions'
      ].join('\n\n'),
      'High Level Design': [
        '## Business Context',
        '## System Overview',
        '## Architecture',
        '## Key Components',
        '## Integrations',
        '## Risks & Mitigations',
        '## Assumptions',
        '## Open Questions'
      ].join('\n\n'),
      Runbook: [
        '## Purpose',
        '## Prerequisites',
        '## Step-by-step Procedure',
        '## Validation',
        '## Rollback Plan',
        '## Monitoring & Alerts',
        '## Escalation'
      ].join('\n\n'),
      'Test Plan': [
        '## Scope',
        '## Test Strategy',
        '## Environments',
        '## Test Data',
        '## Test Cases',
        '## Exit Criteria',
        '## Risks'
      ].join('\n\n'),
      'Migration Plan': [
        '## Goals',
        '## Phases',
        '## Data Migration',
        '## Cutover Steps',
        '## Rollback Plan',
        '## Risks & Mitigations',
        '## Timeline'
      ].join('\n\n'),
    };

    const fallback = [
      '## Overview',
      '## Scope',
      '## Requirements',
      '## Design',
      '## Risks',
      '## Open Questions'
    ].join('\n\n');

    return `${header}${promptNote}${templates[docTypeName] || fallback}\n`;
  };

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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      if (!title) handleTitleChange(file.name.split('.').shift() || '');
    }
  };

  const handleSave = async () => {
    if (!title.trim()) { setSaveError("Title required."); return; }
    setIsSaving(true);
    setSaveError(null);

    try {
      if (mode === 'author') {
        const payload: Partial<WikiPage> = {
          title: title.trim(), content, slug, spaceId, bundleId: bundleId || undefined,
          applicationId: applicationId || undefined, milestoneId: milestoneId || undefined,
          documentTypeId: documentTypeId || undefined, themeKey: themeKey || undefined, status,
          author: currentUser?.name || 'System', lastModifiedBy: currentUser?.name || 'System'
        };
        const res = await fetch('/api/wiki', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        const data = await res.json();
        if (res.ok) onSaveSuccess(data.result?.insertedId || '');
        else setSaveError(data.error || "Save failed.");
      } else {
        if (!selectedFile) { setSaveError("Please select a file."); setIsSaving(false); return; }
        const formData = new FormData();
        formData.append('file', selectedFile);
        formData.append('title', title.trim());
        formData.append('spaceId', spaceId);
        if (bundleId) formData.append('bundleId', bundleId);
        if (applicationId) formData.append('applicationId', applicationId);
        if (milestoneId) formData.append('milestoneId', milestoneId);
        if (documentTypeId) formData.append('documentTypeId', documentTypeId);
        if (themeKey) formData.append('themeKey', themeKey);

        const res = await fetch('/api/wiki/assets', { method: 'POST', body: formData });
        const data = await res.json();
        if (res.ok) onSaveSuccess(data.result?.insertedId || '');
        else setSaveError(data.error || "Upload failed.");
      }
    } catch (err) { setSaveError("Network failure."); }
    finally { setIsSaving(false); }
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

  return (
    <div className="fixed inset-0 z-[100] bg-slate-50 flex flex-col animate-fadeIn">
      <header className="px-10 py-5 bg-white border-b border-slate-200 flex items-center justify-between shadow-sm shrink-0">
        <div className="flex items-center gap-6">
          <button onClick={onCancel} className="w-10 h-10 rounded-full bg-slate-50 hover:bg-slate-100 flex items-center justify-center text-slate-400 border border-slate-100"><i className="fas fa-times"></i></button>
          <div className="flex flex-col">
            <span className="text-[9px] font-black text-blue-600 uppercase tracking-widest leading-none mb-1">Provisioning Registry Artifact</span>
            <input value={title} onChange={(e) => handleTitleChange(e.target.value)} className="text-2xl font-black text-slate-800 border-none p-0 focus:ring-0 outline-none bg-transparent w-[400px]" placeholder="Artifact Title" />
          </div>
        </div>
        
        <div className="flex items-center gap-6">
          <div className="flex bg-slate-100 p-1.5 rounded-2xl border border-slate-200 shadow-inner">
             <button onClick={() => setMode('author')} className={`px-6 py-2.5 text-[10px] font-black uppercase rounded-xl transition-all flex items-center gap-2 ${mode === 'author' ? 'bg-white text-blue-600 shadow-xl' : 'text-slate-400 hover:text-slate-600'}`}>
                <i className="fas fa-pen-nib"></i> Editor Mode
             </button>
             <button onClick={() => setMode('upload')} className={`px-6 py-2.5 text-[10px] font-black uppercase rounded-xl transition-all flex items-center gap-2 ${mode === 'upload' ? 'bg-white text-blue-600 shadow-xl' : 'text-slate-400 hover:text-slate-600'}`}>
                <i className="fas fa-file-upload"></i> Asset Upload
             </button>
             <button onClick={() => setMode('ai')} className={`px-6 py-2.5 text-[10px] font-black uppercase rounded-xl transition-all flex items-center gap-2 ${mode === 'ai' ? 'bg-white text-blue-600 shadow-xl' : 'text-slate-400 hover:text-slate-600'}`}>
                <i className="fas fa-wand-magic-sparkles"></i> AI Prompt
             </button>
          </div>

          <button
            onClick={handleSave}
            disabled={isSaving || mode === 'ai'}
            className={`px-10 py-3.5 rounded-2xl shadow-xl font-black text-[10px] uppercase tracking-widest flex items-center gap-3 active:scale-95 transition-all ${
              mode === 'ai'
                ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
                : 'bg-slate-900 text-white'
            }`}
          >
            {isSaving ? <i className="fas fa-circle-notch fa-spin"></i> : <i className="fas fa-save"></i>} 
            {isSaving
              ? (mode === 'upload' ? 'Uploading...' : 'Saving...')
              : (mode === 'upload' ? 'Upload Asset' : mode === 'ai' ? 'Switch to Editor' : 'Commit Artifact')}
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <main className="flex-1 flex flex-col overflow-hidden bg-white shadow-inner relative">
          {mode === 'author' ? (
            <>
              <div className="px-8 py-3 border-b border-slate-100 bg-slate-50 flex items-center justify-between z-50">
                 <div className="flex items-center gap-1">
                    <ToolbarButton icon="fa-bold" onClick={() => insertText(editorFormat === 'html' ? '<b>' : '**', editorFormat === 'html' ? '</b>' : '**')} />
                    <ToolbarButton icon="fa-italic" onClick={() => insertText(editorFormat === 'html' ? '<i>' : '*', editorFormat === 'html' ? '</i>' : '*')} />
                    <ToolbarButton icon="fa-heading" onClick={() => insertText(editorFormat === 'html' ? '<h2>' : '## ', editorFormat === 'html' ? '</h2>' : '')} />
                    <div className="w-[1px] h-6 bg-slate-200 mx-2"></div>
                    <ToolbarButton icon="fa-link" onClick={() => insertText(editorFormat === 'html' ? '<a href="/wiki/TARGET-SLUG">' : '[Link Title](/wiki/TARGET-SLUG', editorFormat === 'html' ? '</a>' : ')')} />
                    <ToolbarButton icon="fa-circle-info" onClick={() => insertText('<div class="callout info">\n  <div class="title"><i class="fas fa-circle-info"></i> INFO</div>\n  <p>', '</p>\n</div>')} />
                 </div>
                 <div className="flex gap-2">
                    <div className="flex bg-white rounded-lg p-0.5 border border-slate-200 text-[8px] font-black uppercase">
                       <button onClick={() => setEditorFormat('markdown')} className={`px-3 py-1 rounded ${editorFormat === 'markdown' ? 'bg-blue-600 text-white' : 'text-slate-400'}`}>MD</button>
                       <button onClick={() => setEditorFormat('html')} className={`px-3 py-1 rounded ${editorFormat === 'html' ? 'bg-blue-600 text-white' : 'text-slate-400'}`}>HTML</button>
                    </div>
                    <button onClick={() => setViewMode(viewMode === 'preview' ? 'edit' : 'preview')} className={`px-4 py-1.5 text-[9px] font-black uppercase rounded-xl transition-all ${viewMode === 'preview' ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-500'}`}>
                       {viewMode === 'preview' ? 'Editor' : 'Preview'}
                    </button>
                 </div>
              </div>
              <div className="flex-1 overflow-y-auto">
                {viewMode === 'edit' ? (
                  <textarea value={content} onChange={(e) => setContent(e.target.value)} ref={textAreaRef} className="w-full h-full p-12 text-slate-700 leading-relaxed resize-none text-lg outline-none font-medium placeholder:text-slate-300" placeholder="Start authoring artifact content..." />
                ) : (
                  <div className="p-12 max-w-5xl mx-auto"><WikiPageDisplay page={{ title, content, slug, spaceId, bundleId, applicationId, milestoneId, documentTypeId, themeKey }} bundles={bundles} applications={applications} /></div>
                )}
              </div>
            </>
          ) : mode === 'ai' ? (
            <div className="flex-1 flex flex-col items-center justify-center p-20 text-center">
              <div className="max-w-3xl space-y-6">
                <div className="w-24 h-24 bg-white rounded-3xl flex items-center justify-center text-4xl text-blue-500 shadow-xl mx-auto">
                  <i className="fas fa-wand-magic-sparkles"></i>
                </div>
                <h3 className="text-2xl font-black text-slate-800 tracking-tight">Generate with AI</h3>
                <p className="text-slate-400 font-medium leading-relaxed">
                  Select a document type on the right to get AI prompt suggestions. Customize a prompt,
                  then switch to Editor Mode to start drafting with that template.
                </p>
                <div className="flex items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      const selectedType = docTypes.find((type) => type._id === documentTypeId);
                      const template = buildTemplate(selectedType?.name || 'Document', aiPrompt);
                      setContent(template);
                      setEditorFormat('markdown');
                      setMode('author');
                    }}
                    className="px-8 py-3 bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest rounded-2xl shadow-xl hover:bg-slate-800 transition-all"
                  >
                    Start with Template
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode('author')}
                    className="px-8 py-3 bg-white text-slate-600 text-[10px] font-black uppercase tracking-widest rounded-2xl border border-slate-200 hover:bg-slate-50 transition-all"
                  >
                    Skip AI
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-20 text-center">
               <div 
                 onClick={() => fileInputRef.current?.click()}
                 onDragOver={(e) => e.preventDefault()}
                 onDrop={(e) => { e.preventDefault(); if (e.dataTransfer.files[0]) handleFileChange({ target: { files: e.dataTransfer.files } } as any); }}
                 className="w-full max-w-2xl border-4 border-dashed border-slate-100 rounded-[3.5rem] p-24 hover:border-blue-500 hover:bg-blue-50/30 transition-all cursor-pointer group flex flex-col items-center"
               >
                  <div className="w-24 h-24 bg-white rounded-3xl flex items-center justify-center text-4xl text-slate-200 group-hover:text-blue-500 shadow-xl group-hover:scale-110 transition-all mb-8">
                     <i className="fas fa-cloud-arrow-up"></i>
                  </div>
                  {selectedFile ? (
                    <div className="space-y-2">
                       <h3 className="text-xl font-black text-slate-800">{selectedFile.name}</h3>
                       <p className="text-sm font-bold text-blue-600 uppercase tracking-widest">{(selectedFile.size / 1024).toFixed(1)} KB READY</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                       <h3 className="text-2xl font-black text-slate-800 tracking-tight">Stage Local Document</h3>
                       <p className="text-slate-400 font-medium max-w-sm mt-3 leading-relaxed">Drop PDF, DOCX, XLSX, or images here to synchronize with the Enterprise Wiki registry.</p>
                       <span className="inline-block px-6 py-2 bg-slate-900 text-white rounded-xl text-[9px] font-black uppercase tracking-widest mt-4">Select Source File</span>
                    </div>
                  )}
                  <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileChange} />
               </div>
               
               <div className="mt-12 flex gap-12 text-slate-300">
                  <div className="flex flex-col items-center gap-2"><i className="fas fa-file-pdf text-2xl"></i><span className="text-[8px] font-black uppercase">PDF</span></div>
                  <div className="flex flex-col items-center gap-2"><i className="fas fa-file-word text-2xl"></i><span className="text-[8px] font-black uppercase">Word</span></div>
                  <div className="flex flex-col items-center gap-2"><i className="fas fa-file-excel text-2xl"></i><span className="text-[8px] font-black uppercase">Excel</span></div>
                  <div className="flex flex-col items-center gap-2"><i className="fas fa-file-powerpoint text-2xl"></i><span className="text-[8px] font-black uppercase">PPTX</span></div>
               </div>
            </div>
          )}
        </main>
        
        <aside className="w-80 border-l border-slate-200 bg-slate-50 p-8 space-y-10 shrink-0 overflow-y-auto custom-scrollbar">
          <div className="space-y-6">
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><i className="fas fa-cog"></i> Classification</h4>
            
            {mode === 'author' && (
              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Stable Link (Slug)</label>
                <input value={slug} onChange={(e) => setSlug(generateSlug(e.target.value))} className="w-full bg-white border border-slate-200 rounded-2xl px-5 py-4 text-xs font-bold text-blue-600 outline-none shadow-sm focus:border-blue-500 transition-all" />
              </div>
            )}

            <div className="space-y-2">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Semantic Doc Type</label>
              <select value={documentTypeId} onChange={(e) => setDocumentTypeId(e.target.value)} className="w-full bg-white border border-slate-200 rounded-2xl px-5 py-4 text-xs font-bold text-slate-700 outline-none shadow-sm focus:border-blue-500 transition-all">
                <option value="">Select Bluepint...</option>
                {categories.map(cat => (
                  <optgroup key={cat._id} label={cat.name}>
                    {docTypes.filter(t => t.categoryId === cat._id).map(type => (
                      <option key={type._id} value={type._id}>{type.name}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>

            {mode !== 'upload' && (
              <div className="space-y-3">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">AI Prompt Suggestions</label>
                {promptSuggestions.length ? (
                  <div className="space-y-3">
                    <div className="flex flex-col gap-2">
                      {promptSuggestions.map((suggestion, index) => (
                        <button
                          key={`${documentTypeId}-${index}`}
                          type="button"
                          onClick={() => setAiPrompt(suggestion)}
                          className={`text-left px-4 py-3 rounded-2xl border text-[10px] font-black uppercase tracking-widest transition-all ${
                            aiPrompt === suggestion
                              ? 'bg-blue-600 text-white border-blue-600'
                              : 'bg-white text-slate-500 border-slate-200 hover:border-blue-400'
                          }`}
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                    <textarea
                      value={aiPrompt}
                      onChange={(e) => setAiPrompt(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-2xl px-4 py-3 text-xs font-semibold text-slate-700 outline-none shadow-sm focus:border-blue-500 transition-all min-h-[120px]"
                      placeholder="Select a suggestion or customize your own prompt..."
                    />
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={() => {
                          const selectedType = docTypes.find((type) => type._id === documentTypeId);
                          const template = buildTemplate(selectedType?.name || 'Document', aiPrompt);
                          setContent(template);
                          setEditorFormat('markdown');
                          setMode('author');
                        }}
                        className="px-4 py-2 text-[9px] font-black uppercase tracking-widest rounded-xl bg-slate-900 text-white hover:bg-slate-800 transition-all"
                        disabled={!aiPrompt.trim()}
                      >
                        Generate Template
                      </button>
                      <button
                        type="button"
                        onClick={() => navigator.clipboard?.writeText(aiPrompt)}
                        className="px-4 py-2 text-[9px] font-black uppercase tracking-widest rounded-xl bg-white text-slate-500 border border-slate-200 hover:border-slate-400 transition-all"
                        disabled={!aiPrompt.trim()}
                      >
                        Copy Prompt
                      </button>
                      <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">
                        Updates editor with the latest prompt.
                      </span>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 font-medium">Select a document type to see AI prompt suggestions.</p>
                )}
              </div>
            )}

            <SidebarField label="Business Bundle" value={bundleId} onChange={setBundleId} options={bundles.map(b => ({ id: b._id, name: b.name }))} />
            <SidebarField label="Target Application" value={applicationId} onChange={setApplicationId} options={applications.filter(a => !bundleId || a.bundleId === bundleId).map(a => ({ id: a._id || a.id, name: a.name }))} />
            <SidebarField label="Release Milestone" value={milestoneId} onChange={setMilestoneId} options={[...Array(10)].map((_, i) => ({ id: `M${i+1}`, name: `M${i+1}` }))} />
            <SidebarField label="Visual Identity" value={themeKey} onChange={setThemeKey} options={themes.map(t => ({ id: t.key, name: t.name }))} />
          </div>

          {saveError && (
            <div className="p-4 bg-red-50 border border-red-100 rounded-2xl text-red-500 text-[10px] font-black uppercase tracking-widest flex items-center gap-2 animate-fadeIn">
              <i className="fas fa-exclamation-triangle"></i> {saveError}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
};

const ToolbarButton = ({ icon, onClick }: any) => (
  <button onClick={onClick} className="w-9 h-9 flex items-center justify-center text-slate-400 hover:text-blue-600 hover:bg-white hover:shadow-sm rounded-xl transition-all"><i className={`fas ${icon} text-sm`}></i></button>
);

const SidebarField = ({ label, value, onChange, options }: any) => (
  <div className="space-y-2">
    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">{label}</label>
    <select value={value ?? ''} onChange={(e) => onChange(e.target.value)} className="w-full bg-white border border-slate-200 rounded-2xl px-5 py-4 text-xs font-bold text-slate-700 outline-none shadow-sm focus:border-blue-500 transition-all">
      <option value="">Global / None</option>
      {options.map((o: any) => <option key={o.id} value={o.id}>{o.name}</option>)}
    </select>
  </div>
);

export default CreateWikiPageForm;
