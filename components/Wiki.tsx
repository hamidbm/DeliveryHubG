
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { WikiPage } from '../types';
import WikiForm from './WikiForm';
import CreateWikiPageForm from './CreateWikiPageForm';
import WikiPageDisplay from './WikiPageDisplay';
import WikiHistory from './WikiHistory';

interface WikiProps {
  currentUser?: {
    name: string;
    role: string;
    email: string;
  };
}

const Wiki: React.FC<WikiProps> = ({ currentUser }) => {
  const [pages, setPages] = useState<WikiPage[]>([]);
  const [activePage, setActivePage] = useState<WikiPage | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [viewHistory, setViewHistory] = useState(false);
  const [loading, setLoading] = useState(true);
  const [creatingParentId, setCreatingParentId] = useState<string | undefined>(undefined);
  
  const searchInputRef = useRef<HTMLInputElement>(null);

  const loadPages = async (selectId?: string) => {
    setLoading(true);
    try {
      const res = await fetch('/api/wiki');
      const data = await res.json();
      setPages(data);
      
      const currentId = selectId || activePage?._id || activePage?.id;
      if (currentId) {
        const found = data.find((p: any) => p._id === currentId || p.id === currentId);
        if (found) {
          setActivePage(found);
          setIsEditing(false);
          setIsCreating(false);
          setViewHistory(false);
        }
      } else if (data.length > 0 && !activePage) {
        setActivePage(data[0]);
      }
    } catch (err) {
      console.error("Wiki load error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPages();
  }, []);

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      if (e.key === 'Escape') {
        if (document.activeElement === searchInputRef.current) {
          if (searchQuery) {
            setSearchQuery('');
          } else {
            searchInputRef.current?.blur();
          }
        }
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [searchQuery]);

  const handleSaveSuccess = (savedId: string) => {
    setIsEditing(false);
    setIsCreating(false);
    setCreatingParentId(undefined);
    loadPages(savedId);
  };

  const handleRevertSuccess = async (versionId: string) => {
    if (!activePage) return;
    const pageId = activePage._id || activePage.id;
    try {
      const res = await fetch('/api/wiki/revert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pageId, versionId }),
      });
      if (res.ok) {
        loadPages(pageId as string);
      }
    } catch (err) {
      console.error("Revert failed", err);
    }
  };

  const handleNavigate = (id: string) => {
    const found = pages.find(p => p._id === id || p.id === id);
    if (found) {
      setActivePage(found);
      setIsEditing(false);
      setIsCreating(false);
      setViewHistory(false);
    } else {
      loadPages(id);
    }
  };

  const startNewPage = (parentId?: string) => {
    setCreatingParentId(parentId);
    setActivePage(null);
    setIsCreating(true);
    setIsEditing(false);
    setViewHistory(false);
  };

  const startEditing = () => {
    setIsEditing(true);
    setIsCreating(false);
    setViewHistory(false);
  };

  const startHistory = () => {
    setViewHistory(true);
    setIsEditing(false);
    setIsCreating(false);
  };

  // Helper for highlighting text segments
  const highlightMatch = (text: string, query: string) => {
    if (!query.trim()) return text;
    const parts = text.split(new RegExp(`(${query.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')})`, 'gi'));
    return (
      <>
        {parts.map((part, i) => 
          part.toLowerCase() === query.toLowerCase() 
            ? <mark key={i} className="bg-yellow-200 text-slate-900 rounded-sm">{part}</mark> 
            : part
        )}
      </>
    );
  };

  // Helper for generating search snippets
  const getContentSnippet = (content: string, query: string) => {
    if (!query.trim()) return null;
    const idx = content.toLowerCase().indexOf(query.toLowerCase());
    if (idx === -1) return null;
    
    const start = Math.max(0, idx - 15);
    const end = Math.min(content.length, idx + query.length + 15);
    let snippet = content.substring(start, end).replace(/\n/g, ' ');
    
    if (start > 0) snippet = '...' + snippet;
    if (end < content.length) snippet = snippet + '...';
    
    return highlightMatch(snippet, query);
  };

  // Build the hierarchical tree and apply search filter
  const { filteredTree, totalResults } = useMemo(() => {
    const map = new Map<string, WikiPage & { children: any[] }>();
    const tree: any[] = [];
    let matchCount = 0;

    pages.forEach(p => {
      const id = p._id || p.id;
      if (id) map.set(id, { ...p, children: [] });
    });

    pages.forEach(p => {
      const id = p._id || p.id;
      const parentId = p.parentId;
      if (parentId && map.has(parentId)) {
        map.get(parentId)!.children.push(map.get(id!)!);
      } else if (!parentId) {
        const node = map.get(id!);
        if (node) tree.push(node);
      }
    });

    if (!searchQuery.trim()) {
      return { filteredTree: tree, totalResults: 0 };
    }

    const lowerQuery = searchQuery.toLowerCase();
    const prune = (nodes: any[]): any[] => {
      return nodes
        .map(node => ({
          ...node,
          children: prune(node.children)
        }))
        .filter(node => {
          const titleMatch = node.title.toLowerCase().includes(lowerQuery);
          const contentMatch = (node.content || '').toLowerCase().includes(lowerQuery);
          const hasMatchingChildren = node.children.length > 0;
          
          if (titleMatch || contentMatch) {
            matchCount++;
          }
          
          return titleMatch || contentMatch || hasMatchingChildren;
        });
    };

    return { filteredTree: prune(tree), totalResults: matchCount };
  }, [pages, searchQuery]);

  const renderSidebarItem = (node: any, depth = 0) => {
    const pageId = node._id || node.id;
    const activeId = activePage?._id || activePage?.id;
    const isActive = activeId === pageId;
    
    const lowerQuery = searchQuery.toLowerCase();
    const titleMatch = searchQuery && node.title.toLowerCase().includes(lowerQuery);
    const contentSnippet = searchQuery ? getContentSnippet(node.content || '', searchQuery) : null;

    return (
      <div key={pageId} className="flex flex-col animate-fadeIn">
        <button
          onClick={() => {
            setActivePage(node);
            setIsEditing(false);
            setIsCreating(false);
            setViewHistory(false);
            setCreatingParentId(undefined);
          }}
          className={`w-full text-left px-4 py-3 rounded-xl transition-all flex items-start gap-3 group mb-1 ${
            isActive && !creatingParentId && !isCreating && !viewHistory
            ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20 font-bold'
            : 'text-slate-600 hover:bg-white hover:shadow-sm'
          }`}
          style={{ marginLeft: `${depth * 12}px` }}
        >
          <div className="mt-1">
            {depth > 0 ? (
              <i className="fas fa-turn-up rotate-90 text-[10px] opacity-30"></i>
            ) : (
              <i className={`fas ${node.children.length > 0 ? 'fa-folder' : 'fa-file-lines'} text-[10px] ${isActive ? 'text-blue-200' : 'text-slate-400'}`}></i>
            )}
          </div>
          <div className="flex flex-col flex-1 min-w-0">
            <span className="text-sm truncate">
              {highlightMatch(node.title || 'Untitled Page', searchQuery)}
            </span>
            
            {contentSnippet && (
              <span className={`text-[10px] truncate leading-tight mt-1 font-medium ${isActive ? 'text-blue-100' : 'text-slate-400'}`}>
                {contentSnippet}
              </span>
            )}
          </div>
          
          {node.children.length > 0 && !isActive && !searchQuery && (
             <span className="text-[9px] font-black opacity-30 px-1.5 py-0.5 bg-slate-200 rounded-md text-slate-600 group-hover:bg-blue-100 group-hover:text-blue-600 transition-colors">
               {node.children.length}
             </span>
          )}
        </button>
        {node.children.length > 0 && (
          <div className="border-l border-slate-200/50 ml-6">
            {node.children.map((child: any) => renderSidebarItem(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden min-h-[800px] animate-fadeIn">
      <aside className="w-80 border-r border-slate-100 flex flex-col bg-slate-50/50 shrink-0">
        <div className="p-6 border-b border-slate-100 bg-white shadow-sm z-10">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Documentation</h2>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></span>
              <span className="text-[8px] font-bold text-slate-400">READY</span>
            </div>
          </div>
          
          <div className="relative group/search">
            <input 
              ref={searchInputRef}
              type="text" 
              placeholder="Search title & content..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-100 border-2 border-transparent rounded-2xl px-4 py-3 text-sm focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 focus:bg-white transition-all pl-11 pr-10 placeholder:text-slate-400 shadow-inner"
            />
            <i className="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 text-xs transition-colors group-focus-within/search:text-blue-500"></i>
            
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
              {searchQuery ? (
                <button 
                  onClick={() => { setSearchQuery(''); searchInputRef.current?.focus(); }} 
                  className="w-5 h-5 flex items-center justify-center bg-slate-200 text-slate-500 rounded-full hover:bg-slate-900 hover:text-white transition-all shadow-sm"
                  title="Clear Search (Esc)"
                >
                  <i className="fas fa-times text-[10px]"></i>
                </button>
              ) : (
                <span className="text-[10px] font-black text-slate-300 bg-white px-1.5 py-0.5 rounded border border-slate-100 group-focus-within/search:hidden">/</span>
              )}
            </div>
          </div>
          
          {searchQuery && (
            <div className="mt-3 px-1 flex items-center justify-between animate-fadeIn">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                {totalResults} {totalResults === 1 ? 'match' : 'matches'} found
              </span>
              <button 
                onClick={() => setSearchQuery('')}
                className="text-[9px] font-black text-blue-600 uppercase tracking-widest hover:underline"
              >
                Clear
              </button>
            </div>
          )}
        </div>

        <nav className="flex-1 overflow-y-auto p-4 custom-scrollbar">
          {loading && pages.length === 0 ? (
            <div className="space-y-3">
              {[1,2,3,4,5].map(i => <div key={i} className="h-12 bg-slate-200/50 rounded-xl animate-pulse"></div>)}
            </div>
          ) : filteredTree.length > 0 ? (
            <div className="space-y-1">
              {filteredTree.map(node => renderSidebarItem(node))}
            </div>
          ) : (
            <div className="py-20 text-center px-6 flex flex-col items-center animate-fadeIn">
               <div className="w-20 h-20 bg-slate-100 rounded-[2rem] flex items-center justify-center mb-6 text-slate-200 shadow-inner">
                  <i className={`fas ${searchQuery ? 'fa-magnifying-glass-minus' : 'fa-book-open'} text-3xl`}></i>
               </div>
               <p className="text-sm font-bold text-slate-800 tracking-tight">
                 {searchQuery ? 'No results found' : 'The Knowledge Base is empty'}
               </p>
               <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                 {searchQuery 
                   ? `We couldn't find any documents matching "${searchQuery}". Try a different term or clear the filter.` 
                   : 'Begin documenting your enterprise procedures and system logs.'}
               </p>
               {searchQuery && (
                 <button 
                  onClick={() => { setSearchQuery(''); searchInputRef.current?.focus(); }}
                  className="mt-6 px-6 py-2 text-[10px] font-black text-blue-600 uppercase tracking-widest bg-blue-50 rounded-xl hover:bg-blue-600 hover:text-white transition-all shadow-sm active:scale-95"
                 >
                   Clear Search
                 </button>
               )}
            </div>
          )}
          
          {!searchQuery && (
            <button 
              onClick={() => startNewPage()}
              className="w-full mt-6 flex items-center justify-center gap-3 py-4 border-2 border-dashed border-slate-200 rounded-2xl text-slate-400 font-bold text-[10px] hover:border-blue-500 hover:text-blue-600 hover:bg-blue-50/50 hover:shadow-inner transition-all uppercase tracking-widest group"
            >
              <i className="fas fa-plus-circle group-hover:rotate-90 transition-transform"></i>
              Add New Registry
            </button>
          )}
        </nav>

        <div className="p-4 bg-white/50 border-t border-slate-100">
           <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-2xl border border-blue-100">
              <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white text-[10px] shadow-sm">
                <i className="fas fa-bolt"></i>
              </div>
              <p className="text-[9px] font-bold text-blue-800 leading-tight uppercase tracking-wider">
                Full-Text Indexing v2.1
              </p>
           </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col relative bg-white overflow-y-auto">
        {loading && pages.length > 0 && !isEditing && !isCreating && !viewHistory ? (
          <div className="flex-1 flex items-center justify-center">
             <div className="flex flex-col items-center gap-4">
               <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
               <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Synchronizing...</span>
             </div>
          </div>
        ) : viewHistory && activePage ? (
          <WikiHistory 
            page={activePage} 
            onClose={() => setViewHistory(false)} 
            onRevert={handleRevertSuccess} 
          />
        ) : isCreating ? (
          <CreateWikiPageForm 
            parentId={creatingParentId}
            allPages={pages}
            currentUser={currentUser}
            onSaveSuccess={handleSaveSuccess}
            onCancel={() => setIsCreating(false)}
          />
        ) : isEditing ? (
          <WikiForm 
            id={activePage?._id || activePage?.id}
            initialTitle={activePage?.title || ''}
            initialContent={activePage?.content || ''}
            parentId={creatingParentId || activePage?.parentId}
            allPages={pages}
            currentUser={currentUser}
            initialAuthor={activePage?.author}
            initialCreatedAt={activePage?.createdAt}
            onSaveSuccess={handleSaveSuccess}
            onCancel={() => setIsEditing(false)}
          />
        ) : activePage ? (
          <div className="flex flex-col h-full">
            <div className="px-10 py-6 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white/80 backdrop-blur-xl z-10">
              <div className="flex items-center gap-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                <i className="fas fa-book-open text-blue-500"></i>
                <span className="hover:text-blue-600 cursor-pointer transition-colors" onClick={() => loadPages()}>Knowledge Base</span>
                <i className="fas fa-chevron-right text-[7px] opacity-30"></i>
                <span className="text-slate-600 truncate max-w-[200px]">{activePage.title}</span>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={startHistory}
                  className="px-4 py-2 bg-white text-slate-600 text-[10px] font-black rounded-xl border border-slate-200 hover:bg-slate-50 transition-all uppercase tracking-widest flex items-center gap-2 shadow-sm active:scale-95"
                >
                  <i className="fas fa-clock-rotate-left"></i>
                  History
                </button>
                <button 
                  onClick={() => startNewPage(activePage._id || activePage.id)}
                  className="px-4 py-2 bg-white text-slate-600 text-[10px] font-black rounded-xl border border-slate-200 hover:bg-slate-50 transition-all uppercase tracking-widest flex items-center gap-2 shadow-sm active:scale-95"
                >
                  <i className="fas fa-plus"></i>
                  Subpage
                </button>
                <button 
                  onClick={startEditing}
                  className="px-6 py-2 bg-slate-900 text-white text-[10px] font-black rounded-xl hover:bg-slate-800 transition-all uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-black/10 active:scale-95"
                >
                  <i className="fas fa-pen-fancy"></i>
                  Edit Page
                </button>
              </div>
            </div>

            <div className="p-12 md:p-20 max-w-5xl mx-auto w-full flex-1">
              <WikiPageDisplay page={activePage} onNavigate={handleNavigate} />
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-20 text-center animate-fadeIn">
            <div className="w-32 h-32 rounded-[3rem] bg-slate-50 flex items-center justify-center text-slate-100 mb-8 border border-slate-100 shadow-inner">
              <i className="fas fa-book-open text-6xl"></i>
            </div>
            <h3 className="text-2xl font-black text-slate-800 tracking-tight">Nexus Knowledge Base</h3>
            <p className="text-slate-400 mt-3 max-w-sm font-medium leading-relaxed">
              Access the centralized repository for delivery governance, technical documentation, and architecture standards.
            </p>
            <button 
              onClick={() => startNewPage()}
              className="mt-8 px-8 py-4 bg-blue-600 text-white text-[10px] font-black rounded-2xl hover:bg-blue-500 transition-all uppercase tracking-widest shadow-xl shadow-blue-600/20 active:scale-95"
            >
              Create First Entry
            </button>
          </div>
        )}
      </main>
      
      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #cbd5e1; }
        
        mark {
          background-color: #fef08a; /* yellow-200 */
          color: #0f172a; /* slate-900 */
          border-radius: 2px;
          padding: 0 1px;
        }
      `}</style>
    </div>
  );
};

export default Wiki;
