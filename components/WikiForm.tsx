
import React, { useState, useRef, useMemo } from 'react';
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
  spaceId: string;
  // Fix: Added missing allPages prop to the interface
  allPages?: WikiPage[];
  id?: string;
  onSaveSuccess: (savedId: string) => void;
  onCancel: () => void;
  currentUser?: { name: string };
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
  // Fix: Destructure allPages even if currently unused in the template
  allPages = [],
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
    const text = textarea.value;
    const selectedText = text.substring(start, end);
    const replacement = before + selectedText + after;
    const newContent = text.substring(0, start) + replacement + text.substring(end);
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
      const result = editorFormat === 'markdown' ? formattedLines : `<ul>\n${formattedLines}\n</ul>`;
      setContent(textarea.value.substring(0, start) + result + textarea.value.substring(end));
    } else {
      if (editorFormat === 'markdown') insertText('- ', '');
      else insertText('<ul>\n  <li>', '</li>\n</ul>');
    }
  };

  const setFontSize = (size: string) => {
    insertText(`<span style="font-size: ${size}">`, '</span>');
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
      if (res.ok) onSaveSuccess(data.result?.insertedId || id);
      else setSaveError(data.error || "Save operation failed.");
    } catch (err) {
      setSaveError("Connection error.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-slate-50 flex flex-col animate-fadeIn">
      <header className="px-10 py-5 bg-white border-b border-slate-200 flex items-center justify-between shadow-sm shrink-0">
        <div className="flex items-center gap-6">
          <button onClick={onCancel} className="w-10 h-10 rounded-full bg-slate-50 hover:bg-slate-100 flex items-center justify-center text-slate-400 border border-slate-100 shadow-sm">
            <i className="fas fa-times"></i>
          </button>
          <div className="flex flex-col">
            <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest leading-none mb-1">Editing Artifact</span>
            <input 
              value={title} onChange={(e) => setTitle(e.target.value)}
              className="text-2xl font-black text-slate-800 border-none p-0 focus:ring-0 outline-none bg-transparent tracking-tight w-[400px]"
            />
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 mr-4">
            <button onClick={() => setStatus('Draft')} className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${status === 'Draft' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}>Draft</button>
            <button onClick={() => setStatus('Published')} className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${status === 'Published' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}>Publish</button>
          </div>
          <button 
            onClick={handleSave} disabled={isSaving}
            className={`px-10 py-3.5 rounded-2xl shadow-2xl transition-all uppercase tracking-widest font-black text-[10px] flex items-center gap-3 ${isSaving ? 'bg-slate-300 text-slate-500' : 'bg-slate-900 text-white hover:bg-slate-800'}`}
          >
            {isSaving ? <i className="fas fa-circle-notch fa-spin"></i> : <i className="fas fa-save"></i>}
            {isSaving ? 'Updating...' : 'Update Artifact'}
          </button>
        </div>
      </header>

      {saveError && (
        <div className="bg-red-500 text-white px-10 py-3 text-xs font-bold animate-fadeIn">
          <i className="fas fa-exclamation-triangle mr-3"></i> {saveError}
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 flex flex-col overflow-hidden bg-white">
          <div className="px-8 py-3 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
            <div className="flex items-center gap-1">
              <ToolbarButton icon="fa-bold" onClick={() => insertText(editorFormat === 'markdown' ? '**' : '<b>', editorFormat === 'markdown' ? '**' : '</b>')} />
              <ToolbarButton icon="fa-italic" onClick={() => insertText(editorFormat === 'markdown' ? '*' : '<i>', editorFormat === 'markdown' ? '*' : '</i>')} />
              <div className="w-[1px] h-6 bg-slate-200 mx-2"></div>
              
              <button onClick={() => insertText(editorFormat === 'markdown' ? '# ' : '<h1>', editorFormat === 'markdown' ? '' : '</h1>')} className="h-10 px-3 flex items-center gap-2 text-slate-500 hover:text-blue-600 hover:bg-white rounded-xl">
                <i className="fas fa-heading"></i><span className="text-[10px] font-black">H1</span>
              </button>
              <button onClick={() => insertText(editorFormat === 'markdown' ? '## ' : '<h2>', editorFormat === 'markdown' ? '' : '</h2>')} className="h-10 px-3 flex items-center gap-2 text-slate-500 hover:text-blue-600 hover:bg-white rounded-xl">
                <i className="fas fa-heading"></i><span className="text-[10px] font-black">H2</span>
              </button>

              <div className="relative group mx-2">
                <button className="h-10 px-3 flex items-center gap-2 text-slate-500 hover:text-blue-600 hover:bg-white rounded-xl">
                  <i className="fas fa-text-height text-xs"></i><span className="text-[10px] font-black">Size</span>
                </button>
                <div className="absolute top-full left-0 mt-1 w-32 bg-white border border-slate-200 rounded-xl shadow-2xl opacity-0 translate-y-2 pointer-events-none group-hover:opacity-100 group-hover:translate-y-0 transition-all z-20">
                  {['14px', '18px', '24px', '32px', '48px'].map(sz => (
                    <button key={sz} onClick={() => setFontSize(sz)} className="w-full text-left px-4 py-2.5 text-[10px] font-bold text-slate-600 hover:bg-slate-50 border-b border-slate-50 last:border-0">{sz}</button>
                  ))}
                </div>
              </div>

              <div className="w-[1px] h-6 bg-slate-200 mx-2"></div>
              <ToolbarButton icon="fa-list-ul" onClick={handleList} />
              <ToolbarButton icon="fa-table" onClick={() => insertText(editorFormat === 'markdown' ? '\n| H1 | H2 |\n|---|---|\n| C1 | C2 |\n' : '\n<table><tr><th>H1</th></tr><tr><td>C1</td></tr></table>\n')} />
              
              <div className="flex items-center gap-1.5 ml-2">
                {COLORS.map(c => (
                  <button key={c.name} onClick={() => insertText(`<span style="color: ${c.value}">`, '</span>')} className="w-5 h-5 rounded-full hover:scale-125 transition-transform" style={{ backgroundColor: c.value }}></button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 bg-white border border-slate-200 px-3 py-1.5 rounded-2xl shadow-sm">
                <span className={`text-[9px] font-black ${editorFormat === 'markdown' ? 'text-blue-600' : 'text-slate-400'}`}>MD</span>
                <button onClick={() => setEditorFormat(editorFormat === 'markdown' ? 'html' : 'markdown')} className={`w-10 h-5 rounded-full relative ${editorFormat === 'markdown' ? 'bg-slate-200' : 'bg-blue-600'}`}>
                  <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${editorFormat === 'markdown' ? 'left-0.5' : 'left-5.5'}`}></div>
                </button>
                <span className={`text-[9px] font-black ${editorFormat === 'html' ? 'text-blue-600' : 'text-slate-400'}`}>HTML</span>
              </div>
              <button onClick={() => setViewMode(viewMode === 'split' ? 'edit' : 'split')} className={`px-4 py-1.5 text-[9px] font-black uppercase rounded-xl ${viewMode === 'split' ? 'bg-blue-600 text-white' : 'bg-white border text-slate-500'}`}>Preview</button>
            </div>
          </div>

          <div className={`flex flex-1 overflow-hidden ${viewMode === 'split' ? 'flex-row' : 'flex-col'}`}>
            <textarea ref={textAreaRef} value={content} onChange={(e) => setContent(e.target.value)} className="flex-1 border-none focus:ring-0 p-12 text-slate-700 leading-relaxed resize-none text-lg font-medium placeholder:text-slate-200 bg-transparent custom-scrollbar" />
            {viewMode === 'split' && (
              <div className="flex-1 border-l border-slate-100 overflow-y-auto p-12 bg-white custom-scrollbar shadow-inner">
                <div className="prose prose-slate prose-xl max-w-none" dangerouslySetInnerHTML={{ __html: renderedContent }} />
              </div>
            )}
          </div>
        </div>

        <aside className="w-80 border-l border-slate-200 bg-slate-50 p-8 space-y-10 shrink-0 overflow-y-auto custom-scrollbar">
          <SidebarField label="Type" value={category} onChange={setCategory} options={WIKI_CATEGORIES} />
        </aside>
      </div>
      <style jsx>{` .custom-scrollbar::-webkit-scrollbar { width: 4px; } .custom-scrollbar::-webkit-scrollbar-track { background: transparent; } .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; } `}</style>
    </div>
  );
};

const ToolbarButton = ({ icon, label, onClick }: any) => (
  <button onClick={onClick} title={label} className="w-10 h-10 flex items-center justify-center text-slate-500 hover:text-blue-600 hover:bg-white rounded-xl transition-all">
    <i className={`fas ${icon} text-sm`}></i>
  </button>
);

const SidebarField = ({ label, value, onChange, options }: any) => (
  <div className="space-y-2">
    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">{label}</label>
    <select value={value} onChange={(e) => onChange(e.target.value)} className="w-full bg-white border border-slate-200 rounded-2xl px-5 py-4 text-xs font-bold text-slate-700 outline-none focus:border-blue-500 transition-all shadow-sm">
      <option value="">Unassigned</option>
      {options.map((o: any) => typeof o === 'string' ? <option key={o} value={o}>{o}</option> : <option key={o.id} value={o.id}>{o.name}</option>)}
    </select>
  </div>
);

export default WikiForm;
