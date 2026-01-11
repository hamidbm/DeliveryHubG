
import React, { useState, useRef, useMemo, useEffect } from 'react';
import { WikiPage } from '../types';
import { BUNDLES, APPLICATIONS } from '../constants';
import { marked } from 'marked';

interface CreateWikiPageFormProps {
  parentId?: string;
  spaceId: string;
  allPages: WikiPage[];
  currentUser?: { name: string };
  onSaveSuccess: (savedId: string) => void;
  onCancel: () => void;
}

const WIKI_CATEGORIES = ["Architecture Decision Record (ADR)", "Low Level Design (LLD)", "Meeting Notes", "Runbook", "General"];

const CreateWikiPageForm: React.FC<CreateWikiPageFormProps> = ({ 
  spaceId,
  currentUser,
  onSaveSuccess,
  onCancel
}) => {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('General');
  const [bundleId, setBundleId] = useState('');
  const [applicationId, setApplicationId] = useState('');
  const [milestoneId, setMilestoneId] = useState('');
  const [status, setStatus] = useState<'Draft' | 'Published'>('Draft');
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'edit' | 'split'>('edit');
  const [editorFormat, setEditorFormat] = useState<'markdown' | 'html'>('markdown');
  
  const textAreaRef = useRef<HTMLTextAreaElement>(null);

  const renderedContent = useMemo(() => {
    try {
      return marked.parse(content || '_No content to preview_');
    } catch (e) {
      return 'Error rendering preview';
    }
  }, [content]);

  const insertText = (before: string, after: string = '') => {
    if (!textAreaRef.current) return;
    const textarea = textAreaRef.current;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = textarea.value.substring(start, end);
    const replacement = before + selectedText + after;
    
    const newContent = 
      textarea.value.substring(0, start) + 
      replacement + 
      textarea.value.substring(end);
    
    setContent(newContent);
    
    // Reset focus and selection
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + before.length, start + before.length + selectedText.length);
    }, 0);
  };

  const handleSave = async () => {
    setSaveError(null);
    if (!title.trim()) {
      setSaveError("An artifact title is required.");
      return;
    }
    
    setIsSaving(true);
    const payload: Partial<WikiPage> = {
      title: title.trim(),
      content,
      spaceId,
      bundleId: bundleId || undefined,
      applicationId: applicationId || undefined,
      milestoneId: milestoneId || undefined,
      category,
      status,
      author: currentUser?.name || 'System',
      lastModifiedBy: currentUser?.name || 'System'
    };

    try {
      const res = await fetch('/api/wiki', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok) {
        onSaveSuccess(data.result?.insertedId || '');
      } else {
        setSaveError(data.error || "Failed to persist the artifact to the registry.");
      }
    } catch (err) {
      setSaveError("Network connectivity issue. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const insertTemplate = (tpl: string) => {
    let tplContent = '';
    if (tpl === 'ADR') tplContent = '# ADR: [Title]\n\n## Status\nProposed\n\n## Context\n...\n\n## Decision\n...\n\n## Consequences\n...';
    if (tpl === 'LLD') tplContent = '# LLD: [Title]\n\n## Introduction\n...\n\n## Architecture\n...\n\n## Data Model\n...';
    setContent(content + (content ? '\n\n' : '') + tplContent);
  };

  return (
    <div className="fixed inset-0 z-[100] bg-slate-50 flex flex-col animate-fadeIn">
      {/* Top Header */}
      <header className="px-10 py-5 bg-white border-b border-slate-200 flex items-center justify-between shadow-sm shrink-0">
        <div className="flex items-center gap-6">
          <button onClick={onCancel} className="w-10 h-10 rounded-full bg-slate-50 hover:bg-slate-100 flex items-center justify-center text-slate-400 transition-all border border-slate-100 shadow-sm">
            <i className="fas fa-times"></i>
          </button>
          <div className="flex flex-col">
            <div className="flex items-center gap-2 mb-0.5">
               <span className="text-[9px] font-black text-blue-600 uppercase tracking-widest leading-none bg-blue-50 px-2 py-0.5 rounded">Drafting Mode</span>
               <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">Knowledge Engine v3.1</span>
            </div>
            <input 
              value={title} onChange={(e) => setTitle(e.target.value)}
              className="text-2xl font-black text-slate-800 placeholder:text-slate-200 border-none p-0 focus:ring-0 outline-none bg-transparent tracking-tight w-[400px]"
              placeholder="Artifact Title..."
            />
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 mr-4">
            <button onClick={() => setStatus('Draft')} className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${status === 'Draft' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}>Draft</button>
            <button onClick={() => setStatus('Published')} className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${status === 'Published' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}>Publish</button>
          </div>
          
          <button 
            onClick={handleSave}
            disabled={isSaving}
            className={`px-8 py-3 rounded-xl shadow-xl transition-all uppercase tracking-widest font-black text-[10px] flex items-center gap-2 ${
              isSaving ? 'bg-slate-300 text-slate-500' : 'bg-slate-900 text-white hover:bg-slate-800 hover:-translate-y-0.5'
            }`}
          >
            {isSaving ? <i className="fas fa-circle-notch fa-spin"></i> : <i className="fas fa-cloud-arrow-up"></i>}
            {isSaving ? 'Syncing...' : 'Save Artifact'}
          </button>
        </div>
      </header>

      {saveError && (
        <div className="bg-red-500 text-white px-10 py-3 text-xs font-bold flex items-center justify-between animate-fadeIn">
          <div className="flex items-center gap-3">
            <i className="fas fa-exclamation-triangle"></i>
            <span>{saveError}</span>
          </div>
          <button onClick={() => setSaveError(null)} className="opacity-60 hover:opacity-100">
            <i className="fas fa-times"></i>
          </button>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* Main Editor Section */}
        <div className="flex-1 flex flex-col overflow-hidden bg-white shadow-inner">
          {/* Editor Toolbar */}
          <div className="px-10 py-3 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
            <div className="flex items-center gap-1">
              <ToolbarButton icon="fa-bold" label="Bold" onClick={() => editorFormat === 'markdown' ? insertText('**', '**') : insertText('<b>', '</b>')} />
              <ToolbarButton icon="fa-italic" label="Italic" onClick={() => editorFormat === 'markdown' ? insertText('*', '*') : insertText('<i>', '</i>')} />
              <ToolbarButton icon="fa-strikethrough" label="Strike" onClick={() => editorFormat === 'markdown' ? insertText('~~', '~~') : insertText('<del>', '</del>')} />
              <div className="w-[1px] h-6 bg-slate-200 mx-1"></div>
              <ToolbarButton icon="fa-heading" label="H1" onClick={() => editorFormat === 'markdown' ? insertText('# ', '') : insertText('<h1>', '</h1>')} />
              <ToolbarButton icon="fa-heading" label="H2" size="xs" onClick={() => editorFormat === 'markdown' ? insertText('## ', '') : insertText('<h2>', '</h2>')} />
              <div className="w-[1px] h-6 bg-slate-200 mx-1"></div>
              <ToolbarButton icon="fa-list-ul" label="List" onClick={() => editorFormat === 'markdown' ? insertText('- ', '') : insertText('<ul><li>', '</li></ul>')} />
              <ToolbarButton icon="fa-quote-left" label="Quote" onClick={() => editorFormat === 'markdown' ? insertText('> ', '') : insertText('<blockquote>', '</blockquote>')} />
              <ToolbarButton icon="fa-code" label="Code" onClick={() => editorFormat === 'markdown' ? insertText('```\n', '\n```') : insertText('<pre><code>', '</code></pre>')} />
              <div className="w-[1px] h-6 bg-slate-200 mx-1"></div>
              <ToolbarButton icon="fa-link" label="Link" onClick={() => editorFormat === 'markdown' ? insertText('[', '](url)') : insertText('<a href="url">', '</a>')} />
              <div className="w-[1px] h-6 bg-slate-200 mx-1"></div>
              {/* Color Picker Simulation */}
              <div className="flex items-center gap-1 ml-2">
                <button onClick={() => insertText('<span style="color: #3b82f6">', '</span>')} className="w-4 h-4 rounded-full bg-blue-500 hover:scale-125 transition-transform" title="Blue Text"></button>
                <button onClick={() => insertText('<span style="color: #ef4444">', '</span>')} className="w-4 h-4 rounded-full bg-red-500 hover:scale-125 transition-transform" title="Red Text"></button>
                <button onClick={() => insertText('<span style="color: #10b981">', '</span>')} className="w-4 h-4 rounded-full bg-emerald-500 hover:scale-125 transition-transform" title="Green Text"></button>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 bg-white border border-slate-200 px-3 py-1.5 rounded-xl shadow-sm">
                <span className={`text-[9px] font-black uppercase tracking-widest ${editorFormat === 'markdown' ? 'text-blue-600' : 'text-slate-400'}`}>MD</span>
                <button 
                  onClick={() => setEditorFormat(editorFormat === 'markdown' ? 'html' : 'markdown')}
                  className={`w-8 h-4 rounded-full relative transition-all ${editorFormat === 'markdown' ? 'bg-slate-200' : 'bg-blue-600'}`}
                >
                  <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${editorFormat === 'markdown' ? 'left-0.5' : 'left-4.5'}`}></div>
                </button>
                <span className={`text-[9px] font-black uppercase tracking-widest ${editorFormat === 'html' ? 'text-blue-600' : 'text-slate-400'}`}>HTML</span>
              </div>
              <button 
                onClick={() => setViewMode(viewMode === 'split' ? 'edit' : 'split')}
                className={`px-4 py-1.5 text-[9px] font-black uppercase tracking-widest rounded-xl flex items-center gap-2 transition-all ${
                  viewMode === 'split' ? 'bg-blue-600 text-white shadow-lg' : 'bg-white border border-slate-200 text-slate-500 hover:border-blue-500'
                }`}
              >
                <i className="fas fa-columns"></i> Split Preview
              </button>
            </div>
          </div>

          {/* Editor Body */}
          <div className={`flex flex-1 overflow-hidden ${viewMode === 'split' ? 'flex-row' : 'flex-col'}`}>
            <div className="flex-1 flex flex-col relative bg-slate-50/10">
              <textarea 
                ref={textAreaRef}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="flex-1 border-none focus:ring-0 p-12 text-slate-700 leading-relaxed resize-none text-lg font-medium placeholder:text-slate-200 bg-transparent custom-scrollbar"
                placeholder="Start authoring your enterprise document. Use the toolbar above for assistance..."
              />
              <div className="absolute bottom-6 right-8 text-[9px] font-black text-slate-300 uppercase tracking-widest flex items-center gap-4 pointer-events-none">
                <span>{content.length} characters</span>
                <span>{content.split(/\s+/).filter(x => x).length} words</span>
              </div>
            </div>
            
            {viewMode === 'split' && (
              <div className="flex-1 border-l border-slate-100 overflow-y-auto p-12 bg-white custom-scrollbar shadow-inner">
                <div className="max-w-none prose prose-slate prose-lg prose-headings:font-black prose-headings:tracking-tighter prose-a:text-blue-600" dangerouslySetInnerHTML={{ __html: renderedContent }} />
              </div>
            )}
          </div>
        </div>

        {/* Metadata Sidebar */}
        <aside className="w-80 border-l border-slate-200 bg-slate-50 p-8 space-y-10 shrink-0 overflow-y-auto custom-scrollbar">
          <div className="space-y-6">
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <i className="fas fa-sliders-h"></i> Configuration
            </h4>
            <SidebarField label="Artifact Class" value={category} onChange={setCategory} options={WIKI_CATEGORIES} />
            <SidebarField label="Business Bundle" value={bundleId} onChange={setBundleId} options={BUNDLES.map(b => ({ id: b.id, name: b.name }))} />
            <SidebarField label="Target App" value={applicationId} onChange={setApplicationId} options={APPLICATIONS.map(a => ({ id: a.id, name: a.name }))} />
            <SidebarField label="Milestone Link" value={milestoneId} onChange={setMilestoneId} options={[...Array(10)].map((_, i) => ({ id: `M${i+1}`, name: `M${i+1}` }))} />
          </div>

          <div className="pt-10 border-t border-slate-200">
             <h5 className="font-black text-[10px] text-slate-400 uppercase tracking-widest mb-4">Quick Insert Templates</h5>
             <div className="grid grid-cols-1 gap-3">
               <TemplateCard title="ADR" desc="Architecture Decision Record" onClick={() => insertTemplate('ADR')} />
               <TemplateCard title="LLD" desc="Low Level Design Doc" onClick={() => insertTemplate('LLD')} />
               <TemplateCard title="NOTES" desc="Standard Meeting Minutes" onClick={() => insertTemplate('General')} />
             </div>
          </div>
          
          <div className="p-6 bg-slate-900 rounded-3xl text-white shadow-xl relative overflow-hidden group">
             <div className="absolute -top-4 -right-4 w-16 h-16 bg-white/5 rounded-full group-hover:scale-150 transition-transform duration-700"></div>
             <h5 className="font-black text-[10px] uppercase tracking-widest mb-2 flex items-center gap-2">
               <i className="fas fa-lightbulb text-amber-400"></i>
               Author Tip
             </h5>
             <p className="text-[10px] font-medium opacity-70 leading-relaxed">
               Mixing Markdown and HTML is supported. Use HTML for advanced styling like text coloring or complex tables.
             </p>
          </div>
        </aside>
      </div>
      
      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #cbd5e1; }
      `}</style>
    </div>
  );
};

const ToolbarButton = ({ icon, label, onClick, size = 'sm' }: any) => (
  <button 
    onClick={onClick}
    title={label}
    className="w-10 h-10 flex items-center justify-center text-slate-500 hover:text-blue-600 hover:bg-white hover:shadow-sm rounded-xl transition-all"
  >
    <i className={`fas ${icon} ${size === 'xs' ? 'text-[10px]' : 'text-sm'}`}></i>
  </button>
);

const SidebarField = ({ label, value, onChange, options }: any) => (
  <div className="space-y-2">
    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">{label}</label>
    <select 
      value={value} 
      onChange={(e) => onChange(e.target.value)}
      className="w-full bg-white border border-slate-200 rounded-2xl px-5 py-4 text-xs font-bold text-slate-700 outline-none focus:border-blue-500 transition-all shadow-sm"
    >
      <option value="">Unassigned</option>
      {options.map((o: any) => typeof o === 'string' ? <option key={o} value={o}>{o}</option> : <option key={o.id} value={o.id}>{o.name}</option>)}
    </select>
  </div>
);

const TemplateCard = ({ title, desc, onClick }: any) => (
  <button 
    onClick={onClick}
    className="w-full text-left p-4 bg-white border border-slate-200 rounded-2xl hover:border-blue-400 hover:shadow-lg transition-all group"
  >
    <div className="flex items-center justify-between mb-1">
      <span className="text-[10px] font-black text-blue-600 uppercase tracking-[0.2em]">{title}</span>
      <i className="fas fa-plus text-[8px] text-slate-300 group-hover:text-blue-400 group-hover:rotate-90 transition-all"></i>
    </div>
    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter truncate">{desc}</p>
  </button>
);

export default CreateWikiPageForm;
