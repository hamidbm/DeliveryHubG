
import React, { useState, useRef, useMemo, useEffect } from 'react';
import { WikiPage } from '../types';
import { BUNDLES, APPLICATIONS } from '../constants';
import { marked } from 'marked';

interface WikiFormProps {
  initialTitle?: string;
  initialContent?: string;
  initialAuthor?: string;
  initialCreatedAt?: string;
  initialCategory?: string;
  initialBundleId?: string;
  initialApplicationId?: string;
  initialMilestoneId?: string;
  parentId?: string;
  spaceId: string;
  id?: string;
  allPages: WikiPage[];
  currentUser?: { name: string };
  onSaveSuccess: (savedId: string) => void;
  onCancel: () => void;
}

const WIKI_CATEGORIES = ["Architecture Decision Record (ADR)", "Low Level Design (LLD)", "Meeting Notes", "Runbook", "General"];

const COLORS = [
  { name: 'Blue', value: '#3b82f6' },
  { name: 'Red', value: '#ef4444' },
  { name: 'Green', value: '#10b981' },
  { name: 'Orange', value: '#f59e0b' },
  { name: 'Purple', value: '#8b5cf6' },
  { name: 'Slate', value: '#475569' },
  { name: 'Gold', value: '#d4af37' }
];

const WikiForm: React.FC<WikiFormProps> = ({ 
  initialTitle = '', 
  initialContent = '', 
  initialAuthor,
  initialCreatedAt,
  initialCategory = 'General',
  initialBundleId = '',
  initialApplicationId = '',
  initialMilestoneId = '',
  spaceId,
  id,
  currentUser,
  onSaveSuccess,
  onCancel
}) => {
  const [title, setTitle] = useState(initialTitle);
  const [content, setContent] = useState(initialContent);
  const [category, setCategory] = useState(initialCategory);
  const [bundleId, setBundleId] = useState(initialBundleId);
  const [applicationId, setApplicationId] = useState(initialApplicationId);
  const [milestoneId, setMilestoneId] = useState(initialMilestoneId);
  const [status, setStatus] = useState<'Draft' | 'Published'>('Published');
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'edit' | 'split'>('split');
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
    
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + before.length, start + before.length + selectedText.length);
    }, 0);
  };

  const handleList = () => {
    if (!textAreaRef.current) return;
    const textarea = textAreaRef.current;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = textarea.value.substring(start, end);
    
    if (selected.trim().includes('\n')) {
      const lines = selected.split('\n');
      const formattedLines = lines.map(line => {
        if (!line.trim()) return line;
        return editorFormat === 'markdown' ? `- ${line}` : `  <li>${line}</li>`;
      }).join('\n');
      
      const result = editorFormat === 'markdown' 
        ? formattedLines 
        : `<ul>\n${formattedLines}\n</ul>`;
        
      setContent(textarea.value.substring(0, start) + result + textarea.value.substring(end));
    } else {
      if (editorFormat === 'markdown') {
        insertText('- ', '');
      } else {
        insertText('<ul>\n  <li>', '</li>\n</ul>');
      }
    }
  };

  const handleSave = async () => {
    setSaveError(null);
    if (!title.trim()) {
      setSaveError("Title cannot be empty.");
      return;
    }
    
    setIsSaving(true);
    const payload: Partial<WikiPage> = {
      _id: id,
      title: title.trim(),
      content,
      spaceId,
      bundleId: bundleId || undefined,
      applicationId: applicationId || undefined,
      milestoneId: milestoneId || undefined,
      category,
      status,
      author: initialAuthor || currentUser?.name || 'System',
      lastModifiedBy: currentUser?.name || 'System',
      createdAt: initialCreatedAt
    };

    try {
      const res = await fetch('/api/wiki', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok) {
        onSaveSuccess(data.result?.insertedId || id);
      } else {
        setSaveError(data.error || "Persistence layer error. Artifact not saved.");
      }
    } catch (err) {
      setSaveError("Registry connection lost.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-slate-50 flex flex-col animate-fadeIn">
      <header className="px-10 py-5 bg-white border-b border-slate-200 flex items-center justify-between shadow-sm shrink-0">
        <div className="flex items-center gap-6">
          <button onClick={onCancel} className="w-10 h-10 rounded-full bg-slate-50 hover:bg-slate-100 flex items-center justify-center text-slate-400 transition-all border border-slate-100 shadow-sm">
            <i className="fas fa-times"></i>
          </button>
          <div className="flex flex-col">
            <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest leading-none mb-1">Editing Artifact</span>
            <input 
              value={title} onChange={(e) => setTitle(e.target.value)}
              className="text-2xl font-black text-slate-800 border-none p-0 focus:ring-0 outline-none bg-transparent tracking-tight w-[400px]"
              placeholder="Artifact Title"
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
            className={`px-10 py-3.5 rounded-2xl shadow-2xl transition-all uppercase tracking-widest font-black text-[10px] flex items-center gap-3 ${
              isSaving ? 'bg-slate-300 text-slate-500' : 'bg-slate-900 text-white hover:bg-slate-800'
            }`}
          >
            {isSaving ? <i className="fas fa-circle-notch fa-spin"></i> : <i className="fas fa-save"></i>}
            {isSaving ? 'Syncing...' : 'Update Artifact'}
          </button>
        </div>
      </header>

      {saveError && (
        <div className="bg-red-500 text-white px-10 py-3 text-xs font-bold animate-fadeIn">
          <i className="fas fa-exclamation-triangle mr-3"></i>
          {saveError}
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 flex flex-col overflow-hidden bg-white">
          <div className="px-8 py-3 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
            <div className="flex items-center gap-1">
              <ToolbarButton icon="fa-bold" label="Bold" onClick={() => insertText(editorFormat === 'markdown' ? '**' : '<b>', editorFormat === 'markdown' ? '**' : '</b>')} />
              <ToolbarButton icon="fa-italic" label="Italic" onClick={() => insertText(editorFormat === 'markdown' ? '*' : '<i>', editorFormat === 'markdown' ? '*' : '</i>')} />
              <div className="w-[1px] h-6 bg-slate-200 mx-2"></div>
              <ToolbarButton icon="fa-h1" label="Heading 1" onClick={() => insertText(editorFormat === 'markdown' ? '# ' : '<h1>', editorFormat === 'markdown' ? '' : '</h1>')} />
              <ToolbarButton icon="fa-h2" label="Heading 2" onClick={() => insertText(editorFormat === 'markdown' ? '## ' : '<h2>', editorFormat === 'markdown' ? '' : '</h2>')} />
              <div className="w-[1px] h-6 bg-slate-200 mx-2"></div>
              <ToolbarButton icon="fa-list-ul" label="Bullets" onClick={handleList} />
              <ToolbarButton icon="fa-table" label="Insert Table" onClick={() => insertText('\n| H1 | H2 |\n|---|---|\n| C1 | C2 |\n', '')} />
              <div className="w-[1px] h-6 bg-slate-200 mx-2"></div>
              <div className="flex items-center gap-1.5 ml-2">
                {COLORS.map(c => (
                  <button 
                    key={c.name}
                    onClick={() => insertText(`<span style="color: ${c.value}">`, '</span>')} 
                    className="w-5 h-5 rounded-full hover:scale-125 transition-transform" 
                    style={{ backgroundColor: c.value }}
                  ></button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 bg-white border border-slate-200 px-3 py-1.5 rounded-2xl shadow-sm">
                <span className={`text-[9px] font-black uppercase tracking-widest ${editorFormat === 'markdown' ? 'text-blue-600' : 'text-slate-400'}`}>MD</span>
                <button onClick={() => setEditorFormat(editorFormat === 'markdown' ? 'html' : 'markdown')} className={`w-10 h-5 rounded-full relative transition-all ${editorFormat === 'markdown' ? 'bg-slate-200' : 'bg-blue-600'}`}>
                  <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${editorFormat === 'markdown' ? 'left-0.5' : 'left-5.5'}`}></div>
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

          <div className={`flex flex-1 overflow-hidden ${viewMode === 'split' ? 'flex-row' : 'flex-col'}`}>
            <textarea 
              ref={textAreaRef}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="flex-1 border-none focus:ring-0 p-12 text-slate-700 leading-relaxed resize-none text-lg font-medium placeholder:text-slate-200 bg-transparent custom-scrollbar"
              placeholder="Artifact content..."
            />
            {viewMode === 'split' && (
              <div className="flex-1 border-l border-slate-100 overflow-y-auto p-12 bg-white custom-scrollbar shadow-inner">
                <div className="prose prose-slate prose-xl max-w-none" dangerouslySetInnerHTML={{ __html: renderedContent }} />
              </div>
            )}
          </div>
        </div>

        <aside className="w-80 border-l border-slate-200 bg-slate-50 p-8 space-y-10 shrink-0 overflow-y-auto custom-scrollbar">
          <div className="space-y-6">
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Metadata context</h4>
            <SidebarField label="Document Type" value={category} onChange={setCategory} options={WIKI_CATEGORIES} />
            <SidebarField label="Business Bundle" value={bundleId} onChange={setBundleId} options={BUNDLES.map(b => ({ id: b.id, name: b.name }))} />
            <SidebarField label="Application" value={applicationId} onChange={setApplicationId} options={APPLICATIONS.map(a => ({ id: a.id, name: a.name }))} />
            <SidebarField label="Milestone" value={milestoneId} onChange={setMilestoneId} options={[...Array(10)].map((_, i) => ({ id: `M${i+1}`, name: `M${i+1}` }))} />
          </div>
        </aside>
      </div>
      
      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
      `}</style>
    </div>
  );
};

const ToolbarButton = ({ icon, label, onClick }: any) => (
  <button 
    onClick={onClick}
    title={label}
    className="w-10 h-10 flex items-center justify-center text-slate-500 hover:text-blue-600 hover:bg-white rounded-xl transition-all"
  >
    <i className={`fas ${icon} text-sm`}></i>
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
      <option value="">Select {label}</option>
      {options.map((o: any) => typeof o === 'string' ? <option key={o} value={o}>{o}</option> : <option key={o.id} value={o.id}>{o.name}</option>)}
    </select>
  </div>
);

export default WikiForm;
