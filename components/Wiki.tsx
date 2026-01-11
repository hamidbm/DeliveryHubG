
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
  
  // Space Creation Modal
  const [isCreatingSpace, setIsCreatingSpace] = useState(false);
  const [newSpaceName, setNewSpaceName] = useState('');
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
    if (!newSpaceName.trim()) return;
    
    try {
      const res = await fetch('/api/wiki/spaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newSpaceName, description: newSpaceDesc }),
      });
      if (res.ok) {
        setNewSpaceName('');
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
    }
  };

  const startNewPage = (parentId?: string) => {
    setCreatingParentId(parentId);
    setActivePage(null);
    setIsCreating(true);
    setIsEditing(false);
    setViewHistory(false);
  };

  // Fixed missing startEditing function
  const startEditing = () => {
    setIsEditing(true);
    setIsCreating(false);
    setViewHistory(false);
  };

  const { filteredTree, totalResults } = useMemo(() => {
    const spacePages = filteredPagesBySpace;
    const map = new Map<string, WikiPage & { children: any[] }>();
    const tree: any[] = [];
    let matchCount = 0;

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
          if (titleMatch || contentMatch) matchCount++;
          return titleMatch || contentMatch || hasMatchingChildren;
        });
    };

    return { filteredTree: prune(tree), totalResults: matchCount };
  }, [filteredPagesBySpace, searchQuery]);

  const renderSidebarItem = (node: any, depth = 0) => {
    const pageId = node._id || node.id;
    const isActive = activePage?._id === pageId;
    return (
      <div key={pageId} className="flex flex-col animate-fadeIn">
        <button
          onClick={() => {
            setActivePage(node);
            setIsEditing(false);
            setIsCreating(false);
            setViewHistory(false);
          }}
          className={`w-full text-left px-4 py-2.5 rounded-xl transition-all flex items-start gap-3 group mb-0.5 ${
            isActive ? 'bg-blue-600 text-white shadow-md font-bold' : 'text-slate-600 hover:bg-white hover:shadow-sm'
          }`}
          style={{ marginLeft: `${depth * 12}px` }}
        >
          <div className="mt-1">
            <i className={`fas ${node.children.length > 0 ? 'fa-folder' : 'fa-file-lines'} text-[10px] opacity-50`}></i>
          </div>
          <span className="text-sm truncate flex-1">{node.title}</span>
        </button>
        {node.children.length > 0 && (
          <div className="border-l border-slate-200 ml-6">
            {node.children.map((child: any) => renderSidebarItem(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden min-h-[850px] animate-fadeIn">
      {/* Space Navigator */}
      <aside className="w-20 border-r border-slate-100 bg-slate-900 flex flex-col items-center py-8 gap-4 shrink-0">
        {spaces.map(space => (
          <button
            key={space._id || space.id}
            onClick={() => setActiveSpaceId(space._id || space.id || null)}
            className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all relative group ${
              activeSpaceId === (space._id || space.id) 
              ? 'bg-blue-600 text-white shadow-lg scale-110' 
              : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'
            }`}
            title={space.name}
          >
            <i className={`fas ${space.icon || 'fa-folder'} text-lg`}></i>
            <div className="absolute left-16 bg-slate-800 text-white text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-all whitespace-nowrap z-50">
              {space.name}
            </div>
            {activeSpaceId === (space._id || space.id) && (
              <div className="absolute -left-1 w-1.5 h-6 bg-white rounded-full"></div>
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

      {/* Document Sidebar */}
      <aside className="w-72 border-r border-slate-100 flex flex-col bg-slate-50/30 shrink-0">
        <div className="p-6 border-b border-slate-100 bg-white shadow-sm z-10">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-widest truncate max-w-[150px]">
              {activeSpace?.name || 'Registry'}
            </h2>
            <div className="flex items-center gap-1.5">
               <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
               <span className="text-[8px] font-bold text-slate-400">SYNC</span>
            </div>
          </div>
          
          <div className="relative">
            <input 
              ref={searchInputRef}
              type="text" 
              placeholder="Filter nodes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-100 border-none rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500/10 placeholder:text-slate-400"
            />
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto p-4 custom-scrollbar">
          {loading && pages.length === 0 ? (
            <div className="space-y-2">
              {[1,2,3].map(i => <div key={i} className="h-10 bg-slate-100 rounded-lg animate-pulse"></div>)}
            </div>
          ) : filteredTree.length > 0 ? (
            <div className="space-y-0.5">
              {filteredTree.map(node => renderSidebarItem(node))}
            </div>
          ) : (
            <div className="py-20 text-center px-6">
               <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">No documents found</p>
            </div>
          )}
          
          {!searchQuery && (
            <button 
              onClick={() => startNewPage()}
              className="w-full mt-6 py-3 border border-dashed border-slate-200 rounded-xl text-slate-400 font-bold text-[9px] hover:border-blue-500 hover:text-blue-600 transition-all uppercase tracking-widest flex items-center justify-center gap-2"
            >
              <i className="fas fa-plus-circle"></i>
              Add Registry Node
            </button>
          )}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col relative bg-white overflow-y-auto">
        {isCreatingSpace && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-6">
            <form onSubmit={handleCreateSpace} className="bg-white rounded-[2.5rem] w-full max-w-md p-10 shadow-2xl animate-fadeIn">
              <h3 className="text-2xl font-black text-slate-900 mb-2">Create Knowledge Space</h3>
              <p className="text-sm text-slate-500 mb-8 font-medium">Group related documents into a dedicated functional space.</p>
              
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Space Identity</label>
                  <input 
                    type="text"
                    required
                    value={newSpaceName}
                    onChange={(e) => setNewSpaceName(e.target.value)}
                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 text-slate-700 focus:outline-none focus:border-blue-500 transition-all font-bold"
                    placeholder="Engineering Playbooks..."
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Description</label>
                  <textarea 
                    value={newSpaceDesc}
                    onChange={(e) => setNewSpaceDesc(e.target.value)}
                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 text-slate-700 focus:outline-none focus:border-blue-500 transition-all font-medium h-32 resize-none"
                    placeholder="Describe the context of this space..."
                  />
                </div>
              </div>

              <div className="flex items-center gap-4 mt-10">
                <button 
                  type="button"
                  onClick={() => setIsCreatingSpace(false)}
                  className="flex-1 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-800 transition-all"
                >
                  Discard
                </button>
                <button 
                  type="submit"
                  className="flex-1 py-4 bg-slate-900 text-white text-[10px] font-black rounded-2xl shadow-xl hover:bg-slate-800 transition-all uppercase tracking-widest"
                >
                  Initialize Space
                </button>
              </div>
            </form>
          </div>
        )}

        {viewHistory && activePage ? (
          <WikiHistory 
            page={activePage} 
            onClose={() => setViewHistory(false)} 
            onRevert={handleRevertSuccess} 
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
          <div className="flex flex-col h-full">
            <div className="px-10 py-6 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white/80 backdrop-blur-xl z-10">
              <div className="flex items-center gap-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                <i className="fas fa-book-open text-blue-500"></i>
                <span className="text-slate-600 truncate max-w-[300px]">{activePage.title}</span>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setViewHistory(true)}
                  className="px-4 py-2 bg-white text-slate-600 text-[10px] font-black rounded-xl border border-slate-200 hover:bg-slate-50 transition-all uppercase tracking-widest flex items-center gap-2"
                >
                  <i className="fas fa-clock-rotate-left"></i>
                  History
                </button>
                <button 
                  onClick={() => startEditing()}
                  className="px-6 py-2 bg-slate-900 text-white text-[10px] font-black rounded-xl hover:bg-slate-800 transition-all uppercase tracking-widest flex items-center gap-2 shadow-lg"
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
            <div className="w-32 h-32 rounded-[3rem] bg-slate-50 flex items-center justify-center text-slate-200 mb-8 border border-slate-100 shadow-inner">
              <i className={`fas ${activeSpace?.icon || 'fa-book-open'} text-6xl`}></i>
            </div>
            <h3 className="text-2xl font-black text-slate-800 tracking-tight">
              {activeSpace?.name || 'Knowledge Base'}
            </h3>
            <p className="text-slate-400 mt-3 max-w-sm font-medium leading-relaxed">
              {activeSpace?.description || 'Access and contribute to the centralized enterprise knowledge repository.'}
            </p>
            <button 
              onClick={() => startNewPage()}
              className="mt-8 px-10 py-4 bg-blue-600 text-white text-[10px] font-black rounded-2xl hover:bg-blue-500 transition-all uppercase tracking-widest shadow-xl shadow-blue-600/20"
            >
              Create New Entry
            </button>
          </div>
        )}
      </main>
      
      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #cbd5e1; }
      `}</style>
    </div>
  );
};

export default Wiki;
