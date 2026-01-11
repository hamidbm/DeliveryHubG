
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { WikiPage, WikiSpace } from '../types';
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
  const [spaces, setSpaces] = useState<WikiSpace[]>([]);
  const [activeSpaceId, setActiveSpaceId] = useState<string | null>(null);
  const [pages, setPages] = useState<WikiPage[]>([]);
  const [activePage, setActivePage] = useState<WikiPage | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [viewHistory, setViewHistory] = useState(false);
  const [loading, setLoading] = useState(true);
  const [creatingParentId, setCreatingParentId] = useState<string | undefined>(undefined);
  
  const [isCreatingSpace, setIsCreatingSpace] = useState(false);
  const [newSpaceName, setNewSpaceName] = useState('');
  const [newSpaceKey, setNewSpaceKey] = useState('');
  const [newSpaceDesc, setNewSpaceDesc] = useState('');

  const searchInputRef = useRef<HTMLInputElement>(null);

  const loadSpaces = async () => {
    try {
      const res = await fetch('/api/wiki/spaces');
      const data = await res.json();
      setSpaces(data);
      if (data.length > 0 && !activeSpaceId) {
        setActiveSpaceId(data[0]._id || data[0].id);
      }
    } catch (err) {
      console.error("Wiki spaces load error:", err);
    }
  };

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
      }
    } catch (err) {
      console.error("Wiki load error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSpaces();
    loadPages();
  }, []);

  const handleCreateSpace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSpaceName.trim() || !newSpaceKey.trim()) return;
    
    try {
      const res = await fetch('/api/wiki/spaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          name: newSpaceName, 
          key: newSpaceKey.toUpperCase(), 
          description: newSpaceDesc, 
          visibility: 'internal',
          icon: 'fa-book' 
        }),
      });
      if (res.ok) {
        setNewSpaceName('');
        setNewSpaceKey('');
        setNewSpaceDesc('');
        setIsCreatingSpace(false);
        await loadSpaces();
      }
    } catch (err) {
      console.error("Space creation failed", err);
    }
  };

  const activeSpace = spaces.find(s => (s._id || s.id) === activeSpaceId);

  const filteredPagesBySpace = useMemo(() => {
    if (!activeSpaceId) return [];
    return pages.filter(p => p.spaceId === activeSpaceId);
  }, [pages, activeSpaceId]);

  const handleSaveSuccess = (savedId: string) => {
    setIsEditing(false);
    setIsCreating(false);
    setCreatingParentId(undefined);
    loadPages(savedId);
  };

  const handleNavigate = (id: string) => {
    const found = pages.find(p => p._id === id || p.id === id);
    if (found) {
      setActivePage(found);
      setIsEditing(false);
      setIsCreating(false);
      setViewHistory(false);
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

  const { filteredTree } = useMemo(() => {
    const spacePages = filteredPagesBySpace;
    const map = new Map<string, WikiPage & { children: any[] }>();
    const tree: any[] = [];

    spacePages.forEach(p => {
      const id = p._id || p.id;
      if (id) map.set(id, { ...p, children: [] });
    });

    spacePages.forEach(p => {
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
      return { filteredTree: tree };
    }

    const lowerQuery = searchQuery.toLowerCase();
    const prune = (nodes: any[]): any[] => {
      return nodes
        .map(node => ({ ...node, children: prune(node.children) }))
        .filter(node => 
          node.title.toLowerCase().includes(lowerQuery) || 
          (node.content || '').toLowerCase().includes(lowerQuery) || 
          node.children.length > 0
        );
    };

    return { filteredTree: prune(tree) };
  }, [filteredPagesBySpace, searchQuery]);

  const renderSidebarItem = (node: any, depth = 0) => {
    const pageId = node._id || node.id;
    const isActive = activePage?._id === pageId || activePage?.id === pageId;
    return (
      <div key={pageId} className="flex flex-col animate-fadeIn">
        <button
          onClick={() => {
            setActivePage(node);
            setIsEditing(false);
            setIsCreating(false);
            setViewHistory(false);
          }}
          className={`w-full text-left px-4 py-2 rounded-xl transition-all flex items-start gap-3 group mb-0.5 ${
            isActive ? 'bg-blue-600 text-white shadow-md font-bold' : 'text-slate-600 hover:bg-white hover:shadow-sm'
          }`}
          style={{ marginLeft: `${depth * 12}px` }}
        >
          <div className="mt-1 flex-shrink-0">
            <i className={`fas ${node.children.length > 0 ? 'fa-folder-tree' : 'fa-file-lines'} text-[10px] opacity-50`}></i>
          </div>
          <span className="text-sm truncate flex-1">{node.title}</span>
        </button>
        {node.children.length > 0 && (
          <div className="border-l border-slate-200 ml-5">
            {node.children.map((child: any) => renderSidebarItem(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex bg-white rounded-[2.5rem] border border-slate-200 shadow-xl overflow-hidden min-h-[850px] animate-fadeIn">
      {/* 1. Space Navigator (Far Left Icons) */}
      <aside className="w-16 md:w-20 border-r border-slate-100 bg-slate-900 flex flex-col items-center py-8 gap-4 shrink-0">
        <div className="mb-4">
           <i className="fas fa-compass text-blue-500 text-xl"></i>
        </div>
        <div className="w-8 h-[2px] bg-slate-800 mb-2"></div>
        {spaces.map(space => (
          <button
            key={space._id || space.id}
            onClick={() => {
              setActiveSpaceId(space._id || space.id || null);
              setActivePage(null);
            }}
            className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all relative group ${
              activeSpaceId === (space._id || space.id) 
              ? 'bg-blue-600 text-white shadow-lg scale-110' 
              : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'
            }`}
          >
            <span className="text-xs font-black uppercase tracking-tighter">{(space.key || space.name).substring(0, 3)}</span>
            <div className="absolute left-16 bg-slate-800 text-white text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-all whitespace-nowrap z-50">
              {space.name}
            </div>
            {activeSpaceId === (space._id || space.id) && (
              <div className="absolute -left-1.5 w-1.5 h-6 bg-blue-500 rounded-full"></div>
            )}
          </button>
        ))}
        <button
          onClick={() => setIsCreatingSpace(true)}
          className="w-12 h-12 rounded-2xl bg-slate-800 border-2 border-dashed border-slate-700 text-slate-500 flex items-center justify-center hover:bg-slate-700 hover:text-white transition-all mt-4"
          title="Create New Space"
        >
          <i className="fas fa-plus"></i>
        </button>
      </aside>

      {/* 2. Document Hierarchy (Middle Panel) */}
      <aside className="w-64 md:w-80 border-r border-slate-100 flex flex-col bg-slate-50/20 shrink-0">
        <div className="p-6 border-b border-slate-100 bg-white">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] truncate pr-2">
              {activeSpace?.name || 'Knowledge Hub'}
            </h2>
            <div className="flex items-center gap-1.5 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
               <span className="w-1 h-1 rounded-full bg-emerald-500"></span>
               <span className="text-[8px] font-black text-emerald-600 uppercase">Live</span>
            </div>
          </div>
          
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-300">
              <i className="fas fa-search text-xs"></i>
            </div>
            <input 
              ref={searchInputRef}
              type="text" 
              placeholder="Search space..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-100 border-none rounded-xl pl-9 pr-4 py-2.5 text-xs focus:ring-2 focus:ring-blue-500/10 placeholder:text-slate-400 font-medium"
            />
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto p-4 custom-scrollbar">
          {loading && pages.length === 0 ? (
            <div className="space-y-3">
              {[1,2,3,4,5].map(i => <div key={i} className="h-8 bg-slate-100 rounded-lg animate-pulse"></div>)}
            </div>
          ) : filteredTree.length > 0 ? (
            <div className="space-y-1">
              {filteredTree.map(node => renderSidebarItem(node))}
            </div>
          ) : (
            <div className="py-20 text-center px-6">
               <i className="fas fa-file-circle-plus text-slate-100 text-4xl mb-4"></i>
               <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Space is currently empty</p>
            </div>
          )}
          
          <button 
            onClick={() => startNewPage()}
            className="w-full mt-6 py-3 border border-dashed border-slate-200 rounded-xl text-slate-400 font-black text-[9px] hover:border-blue-500 hover:text-blue-600 transition-all uppercase tracking-widest flex items-center justify-center gap-2"
          >
            <i className="fas fa-plus-circle"></i>
            New Document Node
          </button>
        </nav>
      </aside>

      {/* 3. Main Stage (Right Panel) */}
      <main className="flex-1 flex flex-col relative bg-white overflow-y-auto custom-scrollbar">
        {isCreatingSpace && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-6">
            <form onSubmit={handleCreateSpace} className="bg-white rounded-[2.5rem] w-full max-w-md p-10 shadow-2xl animate-fadeIn border border-slate-100">
              <h3 className="text-2xl font-black text-slate-900 mb-2">Initialize Knowledge Space</h3>
              <p className="text-sm text-slate-500 mb-8 font-medium">Functional silos to organize enterprise documentation.</p>
              
              <div className="space-y-6">
                <div className="grid grid-cols-3 gap-4">
                  <div className="col-span-2 space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Space Name</label>
                    <input 
                      type="text" required value={newSpaceName} onChange={(e) => setNewSpaceName(e.target.value)}
                      className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 text-slate-700 focus:border-blue-500 transition-all font-bold"
                      placeholder="Engineering..."
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Space Key</label>
                    <input 
                      type="text" required maxLength={3} value={newSpaceKey} onChange={(e) => setNewSpaceKey(e.target.value)}
                      className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 text-slate-700 focus:border-blue-500 transition-all font-black text-center"
                      placeholder="ENG"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Description</label>
                  <textarea 
                    value={newSpaceDesc} onChange={(e) => setNewSpaceDesc(e.target.value)}
                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 text-slate-700 focus:border-blue-500 transition-all font-medium h-24 resize-none"
                    placeholder="Describe the context of this space..."
                  />
                </div>
              </div>

              <div className="flex items-center gap-4 mt-10">
                <button type="button" onClick={() => setIsCreatingSpace(false)} className="flex-1 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-800 transition-all">Discard</button>
                <button type="submit" className="flex-1 py-4 bg-slate-900 text-white text-[10px] font-black rounded-2xl shadow-xl hover:bg-slate-800 transition-all uppercase tracking-widest">Provision Space</button>
              </div>
            </form>
          </div>
        )}

        {viewHistory && activePage ? (
          <WikiHistory 
            page={activePage} 
            onClose={() => setViewHistory(false)} 
            onRevert={(id) => handleSaveSuccess(id)} 
          />
        ) : isCreating ? (
          <CreateWikiPageForm 
            parentId={creatingParentId}
            allPages={pages}
            spaceId={activeSpaceId || 'default'}
            currentUser={currentUser}
            onSaveSuccess={handleSaveSuccess}
            onCancel={() => setIsCreating(false)}
          />
        ) : isEditing ? (
          <WikiForm 
            id={activePage?._id || activePage?.id}
            initialTitle={activePage?.title || ''}
            initialContent={activePage?.content || ''}
            parentId={activePage?.parentId}
            spaceId={activePage?.spaceId || 'default'}
            initialBundleId={activePage?.bundleId}
            initialApplicationId={activePage?.applicationId}
            initialMilestoneId={activePage?.milestoneId}
            allPages={pages}
            currentUser={currentUser}
            initialAuthor={activePage?.author}
            initialCreatedAt={activePage?.createdAt}
            onSaveSuccess={handleSaveSuccess}
            onCancel={() => setIsEditing(false)}
          />
        ) : activePage ? (
          <div className="flex flex-col h-full animate-fadeIn">
            <div className="px-10 py-5 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white/90 backdrop-blur-md z-10 shadow-sm">
              <div className="flex items-center gap-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.1em]">
                <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
                   <i className="fas fa-file-lines text-xs"></i>
                </div>
                <div className="flex flex-col">
                  <span className="text-slate-600 truncate max-w-[200px] leading-tight">{activePage.title}</span>
                  <span className="text-[8px] opacity-70">Knowledge Artifact</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setViewHistory(true)} className="px-4 py-2 bg-white text-slate-600 text-[10px] font-black rounded-xl border border-slate-200 hover:bg-slate-50 transition-all uppercase tracking-widest flex items-center gap-2">
                  <i className="fas fa-clock-rotate-left"></i> History
                </button>
                <button onClick={() => startEditing()} className="px-6 py-2 bg-slate-900 text-white text-[10px] font-black rounded-xl hover:bg-slate-800 transition-all uppercase tracking-widest flex items-center gap-2 shadow-lg">
                  <i className="fas fa-pen-fancy"></i> Edit Node
                </button>
              </div>
            </div>

            <div className="p-12 md:p-20 max-w-6xl mx-auto w-full flex-1">
              <WikiPageDisplay page={activePage} onNavigate={handleNavigate} />
              
              <div className="mt-20 pt-20 border-t border-slate-100">
                <WikiComments pageId={(activePage._id || activePage.id) as string} currentUser={currentUser} />
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-20 text-center animate-fadeIn bg-slate-50/10">
            <div className="w-32 h-32 rounded-[3.5rem] bg-white flex items-center justify-center text-slate-100 mb-8 border border-slate-100 shadow-2xl relative">
              <i className={`fas ${activeSpace?.icon || 'fa-book-atlas'} text-6xl opacity-10`}></i>
              <div className="absolute inset-0 flex items-center justify-center">
                 <i className={`fas ${activeSpace?.icon || 'fa-book-atlas'} text-4xl text-blue-500 opacity-20`}></i>
              </div>
            </div>
            <h3 className="text-3xl font-black text-slate-800 tracking-tighter">
              {activeSpace?.name || 'Knowledge Repository'}
            </h3>
            <p className="text-slate-400 mt-4 max-w-sm font-medium leading-relaxed">
              {activeSpace?.description || 'Select a functional space to begin browsing the decentralized enterprise knowledge base.'}
            </p>
            {!activeSpaceId ? (
              <div className="mt-10 grid grid-cols-2 gap-4 max-w-md w-full">
                {spaces.slice(0, 4).map(s => (
                  <button 
                    key={s._id} 
                    onClick={() => setActiveSpaceId(s._id || null)}
                    className="p-6 bg-white border border-slate-100 rounded-3xl text-left hover:border-blue-500 hover:shadow-xl transition-all group"
                  >
                    <span className="text-[9px] font-black text-blue-600 uppercase tracking-widest mb-2 block">{s.key}</span>
                    <h4 className="font-black text-slate-800 group-hover:text-blue-600 transition-colors">{s.name}</h4>
                  </button>
                ))}
              </div>
            ) : (
              <button onClick={() => startNewPage()} className="mt-10 px-12 py-4 bg-blue-600 text-white text-[10px] font-black rounded-2xl hover:bg-blue-500 transition-all uppercase tracking-widest shadow-2xl shadow-blue-600/20">
                Create First Entry
              </button>
            )}
          </div>
        )}
      </main>
      
      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
      `}</style>
    </div>
  );
};

// Internal Comments Component
const WikiComments: React.FC<{ pageId: string, currentUser?: any }> = ({ pageId, currentUser }) => {
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadComments = async () => {
      try {
        const res = await fetch(`/api/wiki/comments?pageId=${pageId}`);
        const data = await res.json();
        setComments(data);
      } catch (e) {}
    };
    loadComments();
  }, [pageId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    setLoading(true);
    try {
      const res = await fetch('/api/wiki/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pageId,
          content: newComment,
          author: currentUser?.name || 'System',
          authorRole: currentUser?.role || 'Guest'
        }),
      });
      if (res.ok) {
        setNewComment('');
        const freshRes = await fetch(`/api/wiki/comments?pageId=${pageId}`);
        setComments(await freshRes.json());
      }
    } catch (e) {} finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl">
      <h3 className="text-xl font-black text-slate-900 tracking-tight mb-8 flex items-center gap-3">
        <i className="fas fa-comments text-blue-500"></i>
        Discussions
        <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">{comments.length}</span>
      </h3>

      <div className="space-y-8 mb-12">
        {comments.map((c, i) => (
          <div key={i} className="flex gap-5 group animate-fadeIn">
            <div className="shrink-0">
               <div className="w-10 h-10 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 font-black text-[10px]">
                  {c.author.substring(0, 2).toUpperCase()}
               </div>
            </div>
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-3">
                <span className="text-sm font-black text-slate-800">{c.author}</span>
                <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">{c.authorRole}</span>
                <span className="text-[9px] text-slate-400 ml-auto">{new Date(c.createdAt).toLocaleDateString()}</span>
              </div>
              <p className="text-sm text-slate-600 leading-relaxed font-medium bg-slate-50/50 p-4 rounded-2xl border border-slate-100">
                {c.content}
              </p>
            </div>
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="relative">
        <textarea 
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="Collaborate and provide feedback..."
          className="w-full bg-slate-50 border-2 border-slate-100 rounded-3xl p-6 text-sm font-medium focus:border-blue-500 focus:outline-none transition-all resize-none h-32 pr-24"
        />
        <button 
          disabled={loading || !newComment.trim()}
          className="absolute bottom-6 right-6 px-6 py-2.5 bg-slate-900 text-white text-[10px] font-black rounded-xl hover:bg-slate-800 transition-all uppercase tracking-widest disabled:opacity-30"
        >
          Post
        </button>
      </form>
    </div>
  );
};

export default Wiki;
