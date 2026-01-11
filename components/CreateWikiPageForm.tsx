
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

const COLORS = [
  { name: 'Blue', value: '#3b82f6' },
  { name: 'Red', value: '#ef4444' },
  { name: 'Green', value: '#10b981' },
  { name: 'Orange', value: '#f59e0b' },
  { name: 'Purple', value: '#8b5cf6' },
  { name: 'Slate', value: '#475569' },
  { name: 'Gold', value: '#d4af37' }
];

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
  const [viewMode, setViewMode] = useState<'edit' | 'split'>('split');
  const [editorFormat, setEditorFormat] = useState<'markdown' | 'html'>('markdown');
  const [showColorPicker, setShowColorPicker] = useState(false);
  
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
      // Multi-line intelligent selection
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
      // Single line
      if (editorFormat === 'markdown') {
        insertText('- ', '');
      } else {
        insertText('<ul>\n  <li>', '</li>\n</ul>');
      }
    }
  };

  const insertTable = () => {
    const mdTable = `\n| Header 1 | Header 2 |\n|----------|----------|\n| Cell 1   | Cell 2   |\n`;
    const htmlTable = `\n<table border="1">\n  <tr><th>Header 1</th><th>Header 2</th></tr>\n  <tr><td>Cell 1</td><td>Cell 2</td></tr>\n</table>\n`;
    insertText(editorFormat === 'markdown' ? mdTable : htmlTable, '');
  };

  const insertHR = () => {
    insertText(editorFormat === 'markdown' ? '\n---\n' : '\n<hr />\n', '');
  };

  const setFontSize = (size: string) => {
    if (editorFormat === 'markdown') {
      // Markdown doesn't have native font-size, so we use HTML tags
      insertText(`<span style="font-size: ${size}">`, '</span>');
    } else {
      insertText(`<span style="font-size: ${size}">`, '</span>');
    }
  };

  const handleSave = async () => {
    setSaveError(null);
    if (!title.trim()) {
      setSaveError("An artifact title is required to provision this document.");
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
        setSaveError(data.error || "System error: Failed to sync with the Knowledge Registry.");
      }
    } catch (err) {
      setSaveError("Network error: The Nexus Hub could not be reached.");
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
      {/* Header */}
      <header className="px-10 py-5 bg-white border-b border-slate-200 flex items-center justify-between shadow-sm shrink-0">
        <div className="flex items-center gap-6">
          <button onClick={onCancel} className="w-10 h-10 rounded-full bg-slate-50 hover:bg-slate-100 flex items-center justify-center text-slate-400 transition-all border border-slate-100 shadow-sm">
            <i className="fas fa-times"></i>
          </button>
          <div className="flex flex-col">
            <div className="flex items-center gap-2 mb-0.5">
               <span className="text-[9px] font-black text-blue-600 uppercase tracking-widest leading-none bg-blue-50 px-2 py-0.5 rounded">Editor Suite v4.2</span>
            </div>
            <input 
              value={title} onChange={(e) => setTitle(e.target.value)}
              className="text-2xl font-black text-slate-800 placeholder:text-slate-200 border-none p-0 focus:ring-0 outline-none bg-transparent tracking-tight w-[500px]"
              placeholder="Artifact Title Required..."
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
              isSaving ? 'bg-slate-300 text-slate-500' : 'bg-slate-900 text-white hover:bg-slate-800 hover:-translate-y-1'
            }`}
          >
            {isSaving ? <i className="fas fa-circle-notch fa-spin"></i> : <i className="fas fa-cloud-arrow-up"></i>}
            {isSaving ? 'Synchronizing...' : 'Save Artifact'}
          </button>
        </div>
      </header>

      {saveError && (
        <div className="bg-red-600 text-white px-10 py-4 text-xs font-bold flex items-center justify-between animate-fadeIn z-20">
          <div className="flex items-center gap-3">
            <i className="fas fa-exclamation-circle text-lg"></i>
            <span>{saveError}</span>
          </div>
          <button onClick={() => setSaveError(null)} className="w-8 h-8 rounded-full bg-black/10 flex items-center justify-center hover:bg-black/20">
            <i className="fas fa-times"></i>
          </button>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 flex flex-col overflow-hidden bg-white shadow-inner">
          
          {/* Enhanced Toolbar */}
          <div className="px-8 py-3 border-b border-slate-100 bg-slate-50 flex items-center justify-between sticky top-0 z-10">
            <div className="flex items-center gap-1">
              <ToolbarButton icon="fa-bold" label="Bold" onClick={() => insertText(editorFormat === 'markdown' ? '**' : '<b>', editorFormat === 'markdown' ? '**' : '</b>')} />
              <ToolbarButton icon="fa-italic" label="Italic" onClick={() => insertText(editorFormat === 'markdown' ? '*' : '<i>', editorFormat === 'markdown' ? '*' : '</i>')} />
              <div className="w-[1px] h-6 bg-slate-200 mx-2"></div>
              
              <ToolbarButton icon="fa-h1" label="Heading 1" onClick={() => insertText(editorFormat === 'markdown' ? '# ' : '<h1>', editorFormat === 'markdown' ? '' : '</h1>')} />
              <ToolbarButton icon="fa-h2" label="Heading 2" onClick={() => insertText(editorFormat === 'markdown' ? '## ' : '<h2>', editorFormat === 'markdown' ? '' : '</h2>')} />
              
              {/* Font Size Tool */}
              <div className="relative group mx-2">
                <button className="h-10 px-3 flex items-center gap-2 text-slate-500 hover:text-blue-600 hover:bg-white rounded-xl transition-all">
                  <i className="fas fa-text-height text-xs"></i>
                  <span className="text-[10px] font-black uppercase">Size</span>
                </button>
                <div className="absolute top-full left-0 mt-1 w-32 bg-white border border-slate-200 rounded-xl shadow-2xl opacity-0 translate-y-2 pointer-events-none group-hover:opacity-100 group-hover:translate-y-0 transition-all">
                  {['14px', '18px', '24px', '32px', '48px'].map(sz => (
                    <button key={sz} onClick={() => setFontSize(sz)} className="w-full text-left px-4 py-2.5 text-[10px] font-bold text-slate-600 hover:bg-slate-50 border-b border-slate-50 last:border-0">{sz}</button>
                  ))}
                </div>
              </div>

              <div className="w-[1px] h-6 bg-slate-200 mx-2"></div>
              <ToolbarButton icon="fa-list-ul" label="Bullets" onClick={handleList} />
              <ToolbarButton icon="fa-table" label="Insert Table" onClick={insertTable} />
              <ToolbarButton icon="fa-minus" label="Horizontal Rule" onClick={insertHR} />
              <ToolbarButton icon="fa-quote-left" label="Quote" onClick={() => insertText(editorFormat === 'markdown' ? '> ' : '<blockquote>', editorFormat === 'markdown' ? '' : '</blockquote>')} />
              
              <div className="w-[1px] h-6 bg-slate-200 mx-2"></div>
              
              {/* Enhanced Color Palette */}
              <div className="flex items-center gap-1.5 ml-2">
                {COLORS.map(c => (
                  <button 
                    key={c.name}
                    title={c.name}
                    onClick={() => insertText(`<span style="color: ${c.value}">`, '</span>')} 
                    className="w-5 h-5 rounded-full hover:scale-125 transition-transform shadow-sm border border-black/5" 
                    style={{ backgroundColor: c.value }}
                  ></button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 bg-white border border-slate-200 px-3 py-1.5 rounded-2xl shadow-sm">
                <span className={`text-[9px] font-black uppercase tracking-widest ${editorFormat === 'markdown' ? 'text-blue-600' : 'text-slate-400'}`}>Markdown</span>
                <button 
                  onClick={() => setEditorFormat(editorFormat === 'markdown' ? 'html' : 'markdown')}
                  className={`w-10 h-5 rounded-full relative transition-all ${editorFormat === 'markdown' ? 'bg-slate-200' : 'bg-blue-600'}`}
                >
                  <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${editorFormat === 'markdown' ? 'left-0.5' : 'left-5.5'}`}></div>
                </button>
                <span className={`text-[9px] font-black uppercase tracking-widest ${editorFormat === 'html' ? 'text-blue-600' : 'text-slate-400'}`}>HTML</span>
              </div>
              <button 
                onClick={() => setViewMode(viewMode === 'split' ? 'edit' : 'split')}
                className={`px-5 py-2 text-[9px] font-black uppercase tracking-widest rounded-xl flex items-center gap-2 transition-all ${
                  viewMode === 'split' ? 'bg-slate-900 text-white shadow-lg' : 'bg-white border border-slate-200 text-slate-500 hover:border-blue-500'
                }`}
              >
                <i className={`fas ${viewMode === 'split' ? 'fa-eye-slash' : 'fa-columns'}`}></i> 
                {viewMode === 'split' ? 'Hide Preview' : 'Show Preview'}
              </button>
            </div>
          </div>

          <div className={`flex flex-1 overflow-hidden ${viewMode === 'split' ? 'flex-row' : 'flex-col'}`}>
            <div className="flex-1 flex flex-col relative bg-white">
              <textarea 
                ref={textAreaRef}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="flex-1 border-none focus:ring-0 p-12 text-slate-700 leading-relaxed resize-none text-lg font-medium placeholder:text-slate-200 bg-transparent custom-scrollbar selection:bg-blue-100"
                placeholder="Author your enterprise documentation here. Use the toolset above for headings, colors, and formatting..."
              />
              <div className="absolute bottom-6 right-8 text-[9px] font-black text-slate-300 uppercase tracking-widest flex items-center gap-4 pointer-events-none bg-white/80 px-4 py-2 rounded-full">
                <span>{content.length} characters</span>
                <span>{content.split(/\s+/).filter(x => x).length} words</span>
              </div>
            </div>
            
            {viewMode === 'split' && (
              <div className="flex-1 border-l border-slate-100 overflow-y-auto p-12 bg-slate-50/30 custom-scrollbar shadow-inner">
                <div className="max-w-none prose prose-slate prose-xl" dangerouslySetInnerHTML={{ __html: renderedContent }} />
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <aside className="w-80 border-l border-slate-200 bg-slate-50 p-8 space-y-10 shrink-0 overflow-y-auto custom-scrollbar">
          <div className="space-y-6">
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <i className="fas fa-database"></i> Registry Metadata
            </h4>
            <SidebarField label="Document Class" value={category} onChange={setCategory} options={WIKI_CATEGORIES} />
            <SidebarField label="Business Bundle" value={bundleId} onChange={setBundleId} options={BUNDLES.map(b => ({ id: b.id, name: b.name }))} />
            <SidebarField label="Target Application" value={applicationId} onChange={setApplicationId} options={APPLICATIONS.map(a => ({ id: a.id, name: a.name }))} />
            <SidebarField label="Delivery Milestone" value={milestoneId} onChange={setMilestoneId} options={[...Array(10)].map((_, i) => ({ id: `M${i+1}`, name: `M${i+1}` }))} />
          </div>

          <div className="pt-10 border-t border-slate-200">
             <h5 className="font-black text-[10px] text-slate-400 uppercase tracking-widest mb-4">Architecture Templates</h5>
             <div className="grid grid-cols-1 gap-3">
               <TemplateCard title="ADR" desc="Architecture Decision Record" onClick={() => insertTemplate('ADR')} />
               <TemplateCard title="LLD" desc="Low Level Design" onClick={() => insertTemplate('LLD')} />
             </div>
          </div>
          
          <div className="p-6 bg-blue-600 rounded-[2rem] text-white shadow-2xl relative overflow-hidden">
             <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -mr-12 -mt-12"></div>
             <h5 className="font-black text-[10px] uppercase tracking-widest mb-2 flex items-center gap-2">
               <i className="fas fa-info-circle"></i>
               Editor Guide
             </h5>
             <p className="text-[10px] font-medium opacity-80 leading-relaxed">
               For multi-line bullets, select your text block and click the Bullets icon. The system will intelligently wrap each line for you.
             </p>
          </div>
        </aside>
      </div>
      
      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar { width: 5px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
      `}</style>
    </div>
  );
};

const ToolbarButton = ({ icon, label, onClick }: any) => (
  <button 
    onClick={onClick}
    title={label}
    className="w-10 h-10 flex items-center justify-center text-slate-500 hover:text-blue-600 hover:bg-white hover:shadow-lg rounded-xl transition-all"
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
      <option value="">Unassigned</option>
      {options.map((o: any) => typeof o === 'string' ? <option key={o} value={o}>{o}</option> : <option key={o.id} value={o.id}>{o.name}</option>)}
    </select>
  </div>
);

const TemplateCard = ({ title, desc, onClick }: any) => (
  <button 
    onClick={onClick}
    className="w-full text-left p-4 bg-white border border-slate-200 rounded-2xl hover:border-blue-400 hover:shadow-xl transition-all group"
  >
    <div className="flex items-center justify-between mb-1">
      <span className="text-[10px] font-black text-blue-600 uppercase tracking-[0.2em]">{title}</span>
      <i className="fas fa-plus text-[8px] text-slate-300"></i>
    </div>
    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter truncate">{desc}</p>
  </button>
);

export default CreateWikiPageForm;
