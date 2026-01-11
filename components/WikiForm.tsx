
import React, { useState, useRef, useMemo, useEffect } from 'react';
import { WikiPage, WikiTheme } from '../types';
import { BUNDLES, APPLICATIONS } from '../constants';
import WikiPageDisplay from './WikiPageDisplay';

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
  allPages?: WikiPage[];
  id?: string;
  onSaveSuccess: (savedId: string) => void;
  onCancel: () => void;
  currentUser?: { name: string };
}

const WIKI_CATEGORIES = ["Architecture Decision Record (ADR)", "Low Level Design (LLD)", "Meeting Notes", "Runbook", "General"];

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
  const [themeKey, setThemeKey] = useState('');
  const [status, setStatus] = useState<'Draft' | 'Published'>('Published');
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'edit' | 'preview'>('edit');
  const [editorFormat, setEditorFormat] = useState<'markdown' | 'html'>('html');
  const [showSizeMenu, setShowSizeMenu] = useState(false);
  const [showColorMenu, setShowColorMenu] = useState(false);
  const [themes, setThemes] = useState<WikiTheme[]>([]);
  
  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  const sizeMenuRef = useRef<HTMLDivElement>(null);
  const colorMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch('/api/wiki/themes?active=true')
      .then(res => res.json())
      .then(setThemes)
      .catch(() => []);
    
    if (id) {
      fetch('/api/wiki')
        .then(res => res.json())
        .then(pages => {
          const page = pages.find((p: any) => p._id === id || p.id === id);
          if (page?.themeKey) setThemeKey(page.themeKey);
        })
        .catch(() => {});
    }

    const handleClickOutside = (event: MouseEvent) => {
      if (sizeMenuRef.current && !sizeMenuRef.current.contains(event.target as Node)) {
        setShowSizeMenu(false);
      }
      if (colorMenuRef.current && !colorMenuRef.current.contains(event.target as Node)) {
        setShowColorMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [id]);

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
        const clean = line.trim();
        return editorFormat === 'markdown' ? `- ${clean}` : `  <li>${clean}</li>`;
      }).join('\n');
      const result = editorFormat === 'markdown' ? formattedLines : `<ul>\n${formattedLines}\n</ul>`;
      setContent(textarea.value.substring(0, start) + result + textarea.value.substring(end));
    } else {
      if (editorFormat === 'markdown') insertText('- ', '');
      else insertText('<ul>\n  <li>', '</li>\n</ul>');
    }
  };

  const insertTable = () => {
    const mdTable = `\n| Header 1 | Header 2 |\n|----------|----------|\n| Cell 1   | Cell 2   |\n`;
    const htmlTable = `\n<table border="1">\n  <tr><th>Header 1</th><th>Header 2</th></tr>\n  <tr><td>Cell 1</td><td>Cell 2</td></tr>\n</table>\n`;
    insertText(editorFormat === 'markdown' ? mdTable : htmlTable, '');
  };

  const insertCardsGrid = () => {
    const snippet = `\n<div class="cards">\n  <div class="card accent span-6">\n    <h3 class="card-title">[Some Title]</h3>\n    <p class="card-meta">[Sub title]</p>\n    <p>[Contents]</p>\n  </div>\n\n  <div class="card span-6">\n    <h3 class="card-title">[Some Title]</h3>\n    <p class="card-meta">[Sub title]</p>\n    <p>[Contents]</p>\n  </div>\n</div>\n`;
    insertText(snippet, '');
  };

  const insertCallout = (type: 'info' | 'warn' | 'success') => {
    const snippet = `\n<div class="callout ${type}">\n  <div class="title">[Some Title]</div>\n  <p>\n    \n  </p>\n</div>\n`;
    insertText(snippet, '');
  };

  const insertCodeSnippet = () => {
    const snippet = `\n<pre><code>\n// Some comment\n\n</code></pre>\n`;
    insertText(snippet, '');
  };

  const setFontSize = (size: string) => {
    insertText(`<span style="font-size: ${size}">`, '</span>');
    setShowSizeMenu(false);
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
      themeKey: themeKey || undefined,
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
      if (res.ok) onSaveSuccess(data.result?.insertedId || id!);
      else setSaveError(data.error || "Save operation failed.");
    } catch (err) {
      setSaveError("Registry connection error.");
    } finally {
      setIsSaving(false);
    }
  };

  const previewPage: WikiPage = {
    _id: id,
    id,
    title,
    content,
    spaceId,
    bundleId: bundleId || undefined,
    applicationId: applicationId || undefined,
    milestoneId: milestoneId || undefined,
    category,
    themeKey: themeKey || undefined,
    status,
    author: initialAuthor || currentUser?.name || 'System',
    lastModifiedBy: currentUser?.name || 'System',
    createdAt: initialCreatedAt || new Date().toISOString()
  };

  return (
    <div className="fixed inset-0 z-[100] bg-slate-50 flex flex-col animate-fadeIn">
      <header className="px-10 py-5 bg-white border-b border-slate-200 flex items-center justify-between shadow-sm shrink-0">
        <div className="flex items-center gap-6">
          <button onClick={onCancel} className="w-10 h-10 rounded-full bg-slate-50 hover:bg-slate-100 flex items-center justify-center text-slate-400 border border-slate-100 shadow-sm transition-all">
            <i className="fas fa-times"></i>
          </button>
          <div className="flex flex-col">
            <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest leading-none mb-1">Revising Artifact</span>
            <input 
              value={title} onChange={(e) => setTitle(e.target.value)}
              className="text-2xl font-black text-slate-800 border-none p-0 focus:ring-0 outline-none bg-transparent tracking-tight w-[400px]"
            />
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 mr-4 shadow-inner">
            <button onClick={() => setStatus('Draft')} className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${status === 'Draft' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}>Draft</button>
            <button onClick={() => setStatus('Published')} className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${status === 'Published' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}>Publish</button>
          </div>
          <button 
            onClick={handleSave} disabled={isSaving}
            className={`px-10 py-3.5 rounded-2xl shadow-xl transition-all uppercase tracking-widest font-black text-[10px] flex items-center gap-3 ${isSaving ? 'bg-slate-300 text-slate-500 cursor-not-allowed' : 'bg-slate-900 text-white hover:bg-slate-800'}`}
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
        <div className="flex-1 flex flex-col overflow-hidden bg-white shadow-inner">
          <div className="px-8 py-3 border-b border-slate-100 bg-slate-50 flex items-center justify-between sticky top-0 z-[60] overflow-visible">
            <div className="flex items-center gap-1 shrink-0">
              <ToolbarButton icon="fa-bold" label="Bold" onClick={() => insertText(editorFormat === 'markdown' ? '**' : '<b>', editorFormat === 'markdown' ? '**' : '</b>')} />
              <ToolbarButton icon="fa-italic" label="Italic" onClick={() => insertText(editorFormat === 'markdown' ? '*' : '<i>', editorFormat === 'markdown' ? '*' : '</i>')} />
              <ToolbarButton icon="fa-paragraph" label="Paragraph" onClick={() => insertText('<p>', '</p>')} />
              <div className="w-[1px] h-6 bg-slate-200 mx-2"></div>
              
              <button 
                onClick={() => insertText(editorFormat === 'markdown' ? '# ' : '<h1>', editorFormat === 'markdown' ? '' : '</h1>')} 
                className="h-10 px-4 flex items-center gap-2 text-slate-700 font-black hover:text-blue-600 hover:bg-white border border-transparent hover:border-slate-100 rounded-xl transition-all"
                title="Heading 1"
              >
                <i className="fas fa-heading text-xs"></i><span className="text-xs">H1</span>
              </button>
              <button 
                onClick={() => insertText(editorFormat === 'markdown' ? '## ' : '<h2>', editorFormat === 'markdown' ? '' : '</h2>')} 
                className="h-10 px-4 flex items-center gap-2 text-slate-700 font-black hover:text-blue-600 hover:bg-white border border-transparent hover:border-slate-100 rounded-xl transition-all"
                title="Heading 2"
              >
                <i className="fas fa-heading text-xs opacity-60"></i><span className="text-xs">H2</span>
              </button>

              <div className="w-[1px] h-6 bg-slate-200 mx-2"></div>

              <div className="relative" ref={sizeMenuRef}>
                <button 
                  onClick={() => setShowSizeMenu(!showSizeMenu)}
                  className={`h-10 px-3 flex items-center gap-2 rounded-xl border transition-all ${
                    showSizeMenu ? 'bg-blue-600 text-white border-blue-600 shadow-lg' : 'text-slate-500 hover:text-blue-600 hover:bg-white border-transparent'
                  }`}
                  title="Text Size"
                >
                  <i className="fas fa-text-height text-sm"></i>
                  <i className={`fas fa-chevron-down text-[8px] transition-transform ${showSizeMenu ? 'rotate-180' : ''}`}></i>
                </button>
                {showSizeMenu && (
                  <div className="absolute top-full left-0 mt-2 w-36 bg-white border border-slate-200 rounded-2xl shadow-2xl py-2 z-[70] animate-fadeIn overflow-hidden">
                    <div className="px-4 py-2 text-[9px] font-black text-slate-300 uppercase tracking-widest bg-slate-50 border-b border-slate-50 mb-1">Pick Size</div>
                    {['12px', '14px', '18px', '24px', '32px', '48px'].map(sz => (
                      <button 
                        key={sz} 
                        onClick={() => setFontSize(sz)} 
                        className="w-full text-left px-5 py-3 text-[11px] font-bold text-slate-600 hover:bg-blue-50 hover:text-blue-600 transition-all flex items-center justify-between group"
                      >
                        {sz}
                        <i className="fas fa-plus text-[8px] opacity-0 group-hover:opacity-100 transition-opacity"></i>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="w-[1px] h-6 bg-slate-200 mx-2"></div>
              <ToolbarButton icon="fa-list-ul" label="List" onClick={handleList} />
              <ToolbarButton icon="fa-table" label="Table" onClick={insertTable} />
              <ToolbarButton icon="fa-table-cells" label="Cards Grid" onClick={insertCardsGrid} />
              <ToolbarButton icon="fa-minus" label="HR" onClick={() => insertText(editorFormat === 'markdown' ? '\n---\n' : '\n<hr />\n')} />
              <ToolbarButton icon="fa-quote-left" label="Quote" onClick={() => insertText('\n<blockquote>\n  <p>\n    \n  </p>\n</blockquote>\n')} />
              
              <div className="w-[1px] h-6 bg-slate-200 mx-2"></div>
              <ToolbarButton icon="fa-circle-info" label="Info" onClick={() => insertCallout('info')} />
              <ToolbarButton icon="fa-triangle-exclamation" label="Warn" onClick={() => insertCallout('warn')} />
              <ToolbarButton icon="fa-circle-check" label="Success" onClick={() => insertCallout('success')} />
              <ToolbarButton icon="fa-code" label="Code" onClick={insertCodeSnippet} />

              <div className="w-[1px] h-6 bg-slate-200 mx-2"></div>
              
              <div className="relative" ref={colorMenuRef}>
                <button 
                  onClick={() => setShowColorMenu(!showColorMenu)}
                  className={`h-10 px-3 flex items-center gap-2 rounded-xl transition-all border ${
                    showColorMenu ? 'bg-slate-900 text-white shadow-lg border-slate-900' : 'text-slate-500 hover:text-blue-600 hover:bg-white border-transparent'
                  }`}
                  title="Text Color"
                >
                  <i className="fas fa-palette text-sm"></i>
                  <i className={`fas fa-chevron-down text-[8px] transition-transform ${showColorMenu ? 'rotate-180' : ''}`}></i>
                </button>
                {showColorMenu && (
                  <div className="absolute top-full left-0 mt-2 w-52 bg-white border border-slate-200 rounded-[2rem] shadow-2xl p-5 z-[70] animate-fadeIn overflow-hidden">
                    <div className="space-y-4">
                      {Object.entries(COLOR_PALETTE).map(([theme, colors]) => (
                        <div key={theme} className="space-y-2">
                          <p className="text-[8px] font-black text-slate-300 uppercase tracking-widest">{theme} theme</p>
                          <div className="flex flex-wrap gap-1.5">
                            {colors.map(color => (
                              <button 
                                key={color}
                                onClick={() => {
                                  insertText(`<span style="color: ${color}">`, '</span>');
                                  setShowColorMenu(false);
                                }}
                                className="w-6 h-6 rounded-full border border-black/5 hover:scale-125 transition-transform shadow-sm"
                                style={{ backgroundColor: color }}
                              />
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-4 shrink-0">
              <div className="flex items-center gap-2 bg-white border border-slate-200 px-3 py-1.5 rounded-2xl shadow-sm">
                <span className={`text-[9px] font-black uppercase tracking-widest ${editorFormat === 'markdown' ? 'text-blue-600' : 'text-slate-400'}`}>MD</span>
                <button onClick={() => setEditorFormat(editorFormat === 'markdown' ? 'html' : 'markdown')} className={`w-10 h-5 rounded-full relative transition-all ${editorFormat === 'markdown' ? 'bg-slate-200' : 'bg-blue-600'}`}>
                  <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${editorFormat === 'markdown' ? 'left-0.5' : 'left-5'}`}></div>
                </button>
                <span className={`text-[9px] font-black uppercase tracking-widest ${editorFormat === 'html' ? 'text-blue-600' : 'text-slate-400'}`}>HTML</span>
              </div>
              <button 
                onClick={() => setViewMode(viewMode === 'preview' ? 'edit' : 'preview')} 
                className={`px-4 py-1.5 text-[9px] font-black uppercase tracking-widest rounded-xl transition-all ${viewMode === 'preview' ? 'bg-slate-900 text-white shadow-lg shadow-black/20' : 'bg-white border border-slate-200 text-slate-500 hover:border-blue-500 hover:text-blue-600'}`}
              >
                <i className={`fas ${viewMode === 'preview' ? 'fa-pen-to-square' : 'fa-eye'} mr-2`}></i> 
                {viewMode === 'preview' ? 'Return to Editor' : 'Full Preview'}
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-hidden relative bg-white">
            {viewMode === 'edit' ? (
              <textarea 
                ref={textAreaRef} 
                value={content} 
                onChange={(e) => setContent(e.target.value)} 
                className="w-full h-full border-none focus:ring-0 p-12 text-slate-700 leading-relaxed resize-none text-lg font-medium placeholder:text-slate-200 bg-transparent custom-scrollbar font-medium" 
                placeholder="Edit artifact content..." 
              />
            ) : (
              <div className="absolute inset-0 overflow-y-auto p-12 bg-white custom-scrollbar">
                <div className="max-w-5xl mx-auto">
                  <WikiPageDisplay page={previewPage} />
                </div>
              </div>
            )}
          </div>
        </div>

        <aside className="w-80 border-l border-slate-200 bg-slate-50 p-8 space-y-10 shrink-0 overflow-y-auto custom-scrollbar">
          <div className="space-y-6">
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <i className="fas fa-cog"></i> Configuration
            </h4>
            <SidebarField label="Type" value={category} onChange={setCategory} options={WIKI_CATEGORIES} />
            <SidebarField label="Visual Theme" value={themeKey} onChange={setThemeKey} options={[{ id: '', name: 'Use Space Default' }, ...themes.map(t => ({ id: t.key, name: t.name }))]} />
            <SidebarField label="Business Bundle" value={bundleId} onChange={setBundleId} options={BUNDLES.map(b => ({ id: b.id, name: b.name }))} />
            <SidebarField label="App Context" value={applicationId} onChange={setApplicationId} options={APPLICATIONS.map(a => ({ id: a.id, name: a.name }))} />
          </div>
        </aside>
      </div>
    </div>
  );
};

const ToolbarButton = ({ icon, label, onClick }: any) => (
  <button onClick={onClick} title={label} className="w-10 h-10 flex items-center justify-center text-slate-500 hover:text-blue-600 hover:bg-white border border-transparent hover:border-slate-100 rounded-xl transition-all">
    <i className={`fas ${icon} text-sm`}></i>
  </button>
);

const SidebarField = ({ label, value, onChange, options }: any) => (
  <div className="space-y-2">
    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">{label}</label>
    <select value={value} onChange={(e) => onChange(e.target.value)} className="w-full bg-white border border-slate-200 rounded-2xl px-5 py-4 text-xs font-bold text-slate-700 focus:border-blue-500 outline-none transition-all shadow-sm">
      {options.map((o: any) => typeof o === 'string' ? <option key={o} value={o}>{o}</option> : <option key={o.id} value={o.id}>{o.name}</option>)}
    </select>
  </div>
);

export default WikiForm;
