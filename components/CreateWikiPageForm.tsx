
import React, { useState, useRef, useMemo, useEffect } from 'react';
import { WikiPage } from '../types';
import { marked } from 'marked';

interface CreateWikiPageFormProps {
  parentId?: string;
  allPages: WikiPage[];
  currentUser?: { name: string };
  onSaveSuccess: (savedId: string) => void;
  onCancel: () => void;
}

const WIKI_CATEGORIES = ["Technical", "Governance", "Process", "Security", "Architecture", "Operational"];

const CreateWikiPageForm: React.FC<CreateWikiPageFormProps> = ({ 
  parentId: initialParentId, 
  allPages,
  currentUser,
  onSaveSuccess,
  onCancel
}) => {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [parentId, setParentId] = useState(initialParentId || '');
  const [category, setCategory] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [viewMode, setViewMode] = useState<'edit' | 'preview' | 'split'>('edit');
  
  // Internal Linking States
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestionQuery, setSuggestionQuery] = useState('');
  const [suggestionIndex, setSuggestionIndex] = useState(0);
  const [coords, setCoords] = useState({ top: 0, left: 0 });

  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  const mirrorRef = useRef<HTMLDivElement>(null);

  const renderedContent = useMemo(() => {
    try {
      return marked.parse(content || '_No content to preview_');
    } catch (e) {
      return 'Error rendering preview';
    }
  }, [content]);

  const filteredSuggestions = useMemo(() => {
    return allPages
      .filter(p => p.title.toLowerCase().includes(suggestionQuery.toLowerCase()))
      .slice(0, 10);
  }, [allPages, suggestionQuery]);

  const syncCursorPos = () => {
    const textarea = textAreaRef.current;
    const mirror = mirrorRef.current;
    if (!textarea || !mirror) return;

    const pos = textarea.selectionStart;
    const textBefore = content.substring(0, pos);
    
    const style = window.getComputedStyle(textarea);
    mirror.style.width = style.width;
    mirror.style.fontFamily = style.fontFamily;
    mirror.style.fontSize = style.fontSize;
    mirror.style.lineHeight = style.lineHeight;
    mirror.style.padding = style.padding;
    mirror.style.whiteSpace = 'pre-wrap';
    mirror.style.wordWrap = 'break-word';
    
    mirror.textContent = textBefore;
    const span = document.createElement('span');
    span.textContent = '|';
    mirror.appendChild(span);
    
    setCoords({
      top: span.offsetTop - textarea.scrollTop + 30,
      left: Math.min(span.offsetLeft, textarea.clientWidth - 280)
    });
  };

  const handleTextAreaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    const pos = e.target.selectionStart;
    setContent(val);

    const lastOpenBracketIdx = val.lastIndexOf('[[', pos);

    if (lastOpenBracketIdx !== -1 && lastOpenBracketIdx >= pos - 30) {
      const query = val.substring(lastOpenBracketIdx + 2, pos);
      if (!query.includes('\n') && !query.includes(']]')) {
        setSuggestionQuery(query);
        setShowSuggestions(true);
        setSuggestionIndex(0);
        syncCursorPos();
        return;
      }
    }
    setShowSuggestions(false);
  };

  const selectSuggestion = (page: WikiPage) => {
    const textarea = textAreaRef.current;
    if (!textarea) return;

    const pos = textarea.selectionStart;
    const lastOpenBracketIdx = content.lastIndexOf('[[', pos);
    
    const link = `[${page.title}](#wiki-${page._id || page.id})`;
    const newContent = 
      content.substring(0, lastOpenBracketIdx) + 
      link + 
      content.substring(pos);
    
    setContent(newContent);
    setShowSuggestions(false);
    
    const newCursorPos = lastOpenBracketIdx + link.length;
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (showSuggestions) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSuggestionIndex(prev => (prev + 1) % Math.max(1, filteredSuggestions.length));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSuggestionIndex(prev => (prev - 1 + filteredSuggestions.length) % Math.max(1, filteredSuggestions.length));
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        if (filteredSuggestions.length > 0) {
          e.preventDefault();
          selectSuggestion(filteredSuggestions[suggestionIndex]);
        }
      } else if (e.key === 'Escape') {
        setShowSuggestions(false);
      }
    }
  };

  const insertFormatting = (before: string, after: string = '') => {
    const textarea = textAreaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = content.substring(0, start) === '' && content.substring(end) === '' ? '' : content.substring(start, end);
    const newText = 
      content.substring(0, start) + 
      before + selectedText + after + 
      content.substring(end);
    
    setContent(newText);
    const newCursorPos = start + before.length + selectedText.length + after.length;

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  };

  const handleSave = async () => {
    if (!title.trim()) return;
    setIsSaving(true);

    const tags = tagsInput.split(',').map(t => t.trim()).filter(t => t !== '');

    const payload = {
      title: title.trim(),
      content,
      parentId: parentId || undefined,
      category: category || undefined,
      tags: tags.length > 0 ? tags : undefined,
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
      }
    } catch (err) {
      console.error("Knowledge creation failed:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const toolbar = [
    { label: 'Bold', icon: 'fa-bold', action: () => insertFormatting('**', '**') },
    { label: 'Italic', icon: 'fa-italic', action: () => insertFormatting('_', '_') },
    { label: 'Heading 1', icon: 'fa-heading', action: () => insertFormatting('# ', '') },
    { label: 'Heading 2', icon: 'H2', action: () => insertFormatting('## ', '') },
    { label: 'List', icon: 'fa-list-ul', action: () => insertFormatting('- ', '') },
    { label: 'Code', icon: 'fa-code', action: () => insertFormatting('```\n', '\n```') },
    { label: 'Quote', icon: 'fa-quote-left', action: () => insertFormatting('> ', '') },
    { label: 'Internal Wiki Link', icon: 'fa-book-bookmark', action: () => insertFormatting('[[', '') },
  ];

  return (
    <div className="flex flex-col h-full bg-white animate-fadeIn relative">
      <header className="px-10 py-6 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white/90 backdrop-blur-md z-30 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-lg shadow-blue-500/20">
            <i className="fas fa-plus text-sm"></i>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Creation Mode</span>
            <span className="text-sm font-bold text-slate-800">New Documentation Node</span>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="flex bg-slate-100 p-1 rounded-xl mr-4 border border-slate-200">
            <button 
              onClick={() => setViewMode('edit')}
              className={`px-4 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${viewMode === 'edit' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
            >
              Write
            </button>
            <button 
              onClick={() => setViewMode('split')}
              className={`hidden lg:block px-4 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${viewMode === 'split' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
            >
              Split
            </button>
            <button 
              onClick={() => setViewMode('preview')}
              className={`px-4 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${viewMode === 'preview' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
            >
              Preview
            </button>
          </div>
          <button 
            onClick={onCancel}
            className="px-5 py-2.5 text-xs font-black text-slate-400 hover:text-slate-800 transition-all uppercase tracking-widest rounded-xl hover:bg-slate-50"
          >
            Cancel
          </button>
          <button 
            onClick={handleSave}
            disabled={!title.trim() || isSaving}
            className="px-8 py-2.5 bg-slate-900 text-white text-xs font-black rounded-xl shadow-xl shadow-slate-900/10 hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-all uppercase tracking-widest flex items-center gap-3"
          >
            {isSaving ? <i className="fas fa-circle-notch fa-spin"></i> : <i className="fas fa-cloud-arrow-up"></i>}
            {isSaving ? 'Publishing...' : 'Publish Entry'}
          </button>
        </div>
      </header>

      <div className="px-10 py-3 border-b border-slate-50 bg-slate-50/50 flex flex-wrap items-center gap-6 sticky top-[85px] z-20">
        <div className="flex items-center gap-1">
          {toolbar.map((btn, i) => (
            <button
              key={i}
              onClick={btn.action}
              className="w-9 h-9 flex items-center justify-center rounded-lg text-slate-400 hover:text-blue-600 hover:bg-white hover:shadow-sm transition-all"
              title={btn.label}
              disabled={viewMode === 'preview'}
            >
              {btn.icon.startsWith('fa') ? <i className={`fas ${btn.icon} text-xs`}></i> : <span className="text-[10px] font-black">{btn.icon}</span>}
            </button>
          ))}
        </div>

        <div className="h-6 w-[1px] bg-slate-200 hidden sm:block"></div>

        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Nesting:</label>
            <select 
              value={parentId}
              onChange={(e) => setParentId(e.target.value)}
              className="text-[10px] font-bold text-slate-600 bg-white border border-slate-200 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none"
            >
              <option value="">Top Level</option>
              {allPages.map(p => (
                <option key={p._id || p.id} value={p._id || p.id}>{p.title}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Category:</label>
            <select 
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="text-[10px] font-bold text-slate-600 bg-white border border-slate-200 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none"
            >
              <option value="">Uncategorized</option>
              {WIKI_CATEGORIES.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 min-w-[200px]">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Tags:</label>
            <input 
              type="text"
              placeholder="Cloud, API, Security..."
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              className="flex-1 text-[10px] font-bold text-slate-600 bg-white border border-slate-200 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none"
            />
          </div>
        </div>
      </div>

      <div className={`flex-1 flex w-full overflow-hidden ${viewMode === 'split' ? 'flex-row' : 'flex-col'}`}>
        <div className={`flex flex-col h-full overflow-y-auto custom-scrollbar transition-all duration-300 ${viewMode === 'split' ? 'w-1/2 border-r border-slate-100' : viewMode === 'preview' ? 'hidden' : 'w-full'}`}>
          <div className="p-12 md:p-16 lg:p-24 max-w-5xl mx-auto w-full">
            <div className="space-y-12">
              <input 
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="text-6xl font-black text-slate-900 w-full border-none focus:ring-0 p-0 placeholder:text-slate-100 tracking-tighter bg-transparent"
                placeholder="New Entry Title"
                autoFocus
              />
              <div className="relative">
                {/* Mirror div for position calculation */}
                <div ref={mirrorRef} className="absolute invisible pointer-events-none whitespace-pre-wrap break-words border-none p-0 overflow-hidden" style={{ top: 0, left: 0 }}></div>
                
                <textarea 
                  ref={textAreaRef}
                  value={content}
                  onChange={handleTextAreaChange}
                  onKeyDown={handleKeyDown}
                  className="w-full min-h-[500px] border-none focus:ring-0 p-0 text-slate-600 leading-relaxed resize-none text-xl placeholder:text-slate-100 font-medium bg-transparent"
                  placeholder="Start drafting... Type [[ to link an existing document."
                />

                {showSuggestions && (
                  <div 
                    className="absolute z-[100] w-72 bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden animate-fadeIn"
                    style={{ top: coords.top, left: coords.left }}
                  >
                    <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <i className="fas fa-link text-[10px] text-blue-500"></i>
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Internal Link</span>
                      </div>
                    </div>
                    
                    <div className="max-h-64 overflow-y-auto custom-scrollbar">
                      {filteredSuggestions.length > 0 ? (
                        filteredSuggestions.map((page, idx) => (
                          <button
                            key={page._id || page.id}
                            onClick={() => selectSuggestion(page)}
                            onMouseEnter={() => setSuggestionIndex(idx)}
                            className={`w-full text-left px-4 py-3 text-sm transition-all flex items-center justify-between border-l-4 ${
                              idx === suggestionIndex 
                              ? 'bg-blue-600 text-white border-blue-400' 
                              : 'text-slate-600 hover:bg-slate-50 border-transparent'
                            }`}
                          >
                            <div className="flex items-center gap-3 truncate">
                              <i className={`fas fa-file-lines text-[10px] ${idx === suggestionIndex ? 'text-blue-200' : 'text-slate-300'}`}></i>
                              <span className="truncate font-bold">{page.title}</span>
                            </div>
                            {idx === suggestionIndex && <i className="fas fa-chevron-right text-[10px] text-white/50"></i>}
                          </button>
                        ))
                      ) : (
                        <div className="px-4 py-8 text-center">
                          <i className="fas fa-search-minus text-slate-200 text-xl mb-2"></i>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">No results found</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className={`flex flex-col h-full overflow-y-auto custom-scrollbar transition-all duration-300 bg-slate-50/30 ${viewMode === 'split' ? 'w-1/2' : viewMode === 'edit' ? 'hidden' : 'w-full'}`}>
          <div className="p-12 md:p-16 lg:p-24 max-w-5xl mx-auto w-full">
            <div className="prose prose-slate prose-xl max-w-none" dangerouslySetInnerHTML={{ __html: renderedContent }} />
          </div>
        </div>
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

export default CreateWikiPageForm;
