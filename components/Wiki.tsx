
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { WikiPage, WikiSpace, HierarchyMode, Bundle, Application, Milestone, WikiTheme } from '../types';
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
  // Filters passed from parent (App.tsx -> Layout)
  selSpaceId: string;
  selBundleId: string;
  selAppId: string;
  selMilestone: string;
  searchQuery: string;
  
  // External control triggers
  externalTrigger?: string | null;
  onTriggerProcessed?: () => void;
}

const Wiki: React.FC<WikiProps> = ({ 
  currentUser, 
  selSpaceId, 
  selBundleId, 
  selAppId, 
  selMilestone, 
  searchQuery,
  externalTrigger,
  onTriggerProcessed
}) => {
  // Layer 2 - UI Mode & Content States
  const [spaces, setSpaces] = useState<WikiSpace[]>([]);
  const [themes, setThemes] = useState<WikiTheme[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [hierarchyMode, setHierarchyMode] = useState<HierarchyMode>(HierarchyMode.APP_MILESTONE_TYPE);
  const [pages, setPages] = useState<WikiPage[]>([]);
  const [activePage, setActivePage] = useState<WikiPage | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isSettingSpace, setIsSettingSpace] = useState(false);
  const [viewHistory, setViewHistory] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showComments, setShowComments] = useState(false);
  
  // Modals
  const [isCreatingSpace, setIsCreatingSpace] = useState(false);
  const [newSpaceName, setNewSpaceName] = useState('');
  const [newSpaceKey, setNewSpaceKey] = useState('');

  // Space Settings form state
  const [spaceTheme, setSpaceTheme] = useState('');

  // Handle external triggers from the Global Context Bar (Layout)
  useEffect(() => {
    if (externalTrigger === 'create-space') {
      setIsCreatingSpace(true);
      onTriggerProcessed?.();
    }
  }, [externalTrigger, onTriggerProcessed]);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      try {
        const [spRes, apRes, pgRes, thRes] = await Promise.all([
          fetch('/api/wiki/spaces'),
          fetch('/api/applications'),
          fetch('/api/wiki'),
          fetch('/api/wiki/themes?active=true')
        ]);
        
        setSpaces(await spRes.json());
        setApplications(await apRes.json().catch(() => []));
        setPages(await pgRes.json());
        setThemes(await thRes.json());
      } catch (e) {
        console.error("Wiki Init Error", e);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  // Layer 3 - Dynamic Tree Explorer (PROJECTION LOGIC)
  const treeData = useMemo(() => {
    let filtered = pages;
    if (selSpaceId !== 'all') filtered = filtered.filter(p => p.spaceId === selSpaceId);
    if (selBundleId !== 'all') filtered = filtered.filter(p => p.bundleId === selBundleId);
    if (selAppId !== 'all') filtered = filtered.filter(p => p.applicationId === selAppId);
    if (selMilestone !== 'all') filtered = filtered.filter(p => p.milestoneId === selMilestone);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(p => 
        p.title.toLowerCase().includes(q) || 
        p.content.toLowerCase().includes(q) || 
        p.tags?.some(t => t.toLowerCase().includes(q))
      );
    }

    const tree: any[] = [];
    const buildPath = (path: string[], page: WikiPage) => {
      let currentLevel = tree;
      path.forEach((part, i) => {
        let node = currentLevel.find(n => n.label === part && n.type === 'folder');
        if (!node) {
          node = { label: part, type: 'folder', children: [] };
          currentLevel.push(node);
        }
        currentLevel = node.children;
        if (i === path.length - 1) {
          currentLevel.push({ label: page.title, type: 'page', data: page });
        }
      });
    };

    filtered.forEach(page => {
      const app = applications.find(a => a.id === page.applicationId)?.name || 'Unassigned App';
      const ms = page.milestoneId || 'No Milestone';
      const type = page.category || 'Documentation';
      const space = spaces.find(s => s._id === page.spaceId || s.id === page.spaceId)?.name || 'Default Space';
      const vendor = page.vendorCompany || 'In-House';

      let path: string[] = [];
      switch (hierarchyMode) {
        case HierarchyMode.APP_MILESTONE_TYPE: path = [app, ms, type]; break;
        case HierarchyMode.TYPE_APP_MILESTONE: path = [type, app, ms]; break;
        case HierarchyMode.VENDOR_APP_MILESTONE_TYPE: path = [vendor, app, ms, type]; break;
        case HierarchyMode.SPACE_APP_MILESTONE_TYPE: path = [space, app, ms, type]; break;
        case HierarchyMode.SPACE_TYPE_APP_MILESTONE: path = [space, type, app, ms]; break;
      }
      buildPath(path, page);
    });

    return tree;
  }, [pages, selSpaceId, selBundleId, selAppId, selMilestone, searchQuery, hierarchyMode, applications, spaces]);

  const handleSaveSuccess = async (savedId: string) => {
    setIsEditing(false);
    setIsCreating(false);
    const res = await fetch('/api/wiki');
    const data = await res.json();
    setPages(data);
    const found = data.find((p: any) => p._id === savedId || p.id === savedId);
    if (found) setActivePage(found);
  };

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
          visibility: 'internal',
          icon: 'fa-book' 
        }),
      });
      if (res.ok) {
        setNewSpaceName('');
        setNewSpaceKey('');
        setIsCreatingSpace(false);
        const spRes = await fetch('/api/wiki/spaces');
        setSpaces(await spRes.json());
      }
    } catch (err) {
      console.error("Space creation failed", err);
    }
  };

  const handleSaveSpaceSettings = async () => {
    if (selSpaceId === 'all') return;
    try {
      const res = await fetch('/api/wiki/spaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ _id: selSpaceId, defaultThemeKey: spaceTheme })
      });
      if (res.ok) {
        const spRes = await fetch('/api/wiki/spaces');
        setSpaces(await spRes.json());
        setIsSettingSpace(false);
      }
    } catch (err) {
      console.error("Space update failed", err);
    }
  };

  const renderTreeNode = (node: any, depth = 0) => {
    const isPage = node.type === 'page';
    const isActive = isPage && (activePage?._id === node.data?._id || activePage?.id === node.data?.id);

    return (
      <div key={node.label + depth} className="flex flex-col">
        <button
          onClick={() => {
            if (isPage) {
              setActivePage(node.data);
              setIsEditing(false);
              setIsCreating(false);
            }
          }}
          className={`w-full text-left px-4 py-2 flex items-center gap-3 transition-all rounded-xl ${
            isActive ? 'bg-blue-600 text-white shadow-lg font-bold' : 'text-slate-600 hover:bg-slate-100/50'
          }`}
          style={{ marginLeft: `${depth * 12}px` }}
        >
          <i className={`fas ${isPage ? 'fa-file-lines' : 'fa-folder-closed'} text-[10px] opacity-40`}></i>
          <span className="text-sm truncate">{node.label}</span>
        </button>
        {node.children && node.children.map((child: any) => renderTreeNode(child, depth + 1))}
      </div>
    );
  };

  return (
    <div className="flex bg-white min-h-[850px] border border-slate-200 rounded-[2.5rem] shadow-2xl overflow-hidden animate-fadeIn">
      <div className="flex flex-1 overflow-hidden relative">
        
        {/* Left Pane: Tree */}
        {!isEditing && !isCreating && (
          <aside className="w-80 border-r border-slate-100 flex flex-col shrink-0 bg-slate-50/10">
            <div className="p-6 border-b border-slate-100 space-y-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Hierarchy Projection</label>
                <select 
                  value={hierarchyMode}
                  onChange={(e) => setHierarchyMode(e.target.value as HierarchyMode)}
                  className="w-full bg-white border-2 border-slate-100 rounded-xl px-4 py-2 text-xs font-bold text-slate-600 outline-none focus:border-blue-500 transition-all"
                >
                  {Object.values(HierarchyMode).map(mode => (
                    <option key={mode} value={mode}>{mode}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button 
                  onClick={() => setIsCreating(true)}
                  className="py-3 border-2 border-dashed border-slate-200 rounded-2xl text-[10px] font-black text-slate-400 uppercase tracking-widest hover:border-blue-500 hover:text-blue-500 transition-all flex items-center justify-center gap-2"
                >
                  <i className="fas fa-plus-circle"></i> Page
                </button>
                <button 
                  disabled={selSpaceId === 'all'}
                  onClick={() => {
                    const sp = spaces.find(s => s._id === selSpaceId || s.id === selSpaceId);
                    setSpaceTheme(sp?.defaultThemeKey || '');
                    setIsSettingSpace(true);
                  }}
                  className="py-3 border-2 border-slate-100 rounded-2xl text-[10px] font-black text-slate-400 uppercase tracking-widest hover:bg-slate-100 disabled:opacity-30 transition-all flex items-center justify-center gap-2"
                >
                  <i className="fas fa-cog"></i> Settings
                </button>
              </div>
            </div>
            <nav className="flex-1 overflow-y-auto p-4 custom-scrollbar">
              {treeData.map(node => renderTreeNode(node))}
            </nav>
          </aside>
        )}

        {/* Right Pane: Content */}
        <div className="flex-1 flex flex-col overflow-y-auto custom-scrollbar relative">
          
          {/* Space Settings Modal */}
          {isSettingSpace && (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-6">
              <div className="bg-white rounded-[2.5rem] w-full max-w-md p-10 shadow-2xl animate-fadeIn border border-slate-100">
                <h3 className="text-2xl font-black text-slate-900 mb-2">Space Settings</h3>
                <p className="text-sm text-slate-500 mb-8 font-medium">Configure defaults for this knowledge domain.</p>
                
                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Default Space Theme</label>
                    <select 
                      value={spaceTheme} onChange={(e) => setSpaceTheme(e.target.value)}
                      className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 text-slate-700 focus:border-blue-500 transition-all font-bold"
                    >
                      <option value="">System Default</option>
                      {themes.map(t => (
                        <option key={t.key} value={t.key}>{t.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex items-center gap-4 mt-10">
                  <button onClick={() => setIsSettingSpace(false)} className="flex-1 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-800 transition-all">Cancel</button>
                  <button onClick={handleSaveSpaceSettings} className="flex-1 py-4 bg-blue-600 text-white text-[10px] font-black rounded-2xl shadow-xl hover:bg-blue-700 transition-all uppercase tracking-widest">Apply Settings</button>
                </div>
              </div>
            </div>
          )}

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
                </div>

                <div className="flex items-center gap-4 mt-10">
                  <button type="button" onClick={() => setIsCreatingSpace(false)} className="flex-1 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-800 transition-all">Discard</button>
                  <button type="submit" className="flex-1 py-4 bg-slate-900 text-white text-[10px] font-black rounded-2xl shadow-xl hover:bg-slate-800 transition-all uppercase tracking-widest">Provision Space</button>
                </div>
              </form>
            </div>
          )}

          {isCreating ? (
            <CreateWikiPageForm 
              spaceId={selSpaceId === 'all' ? (spaces[0]?._id || 'default') : selSpaceId}
              allPages={pages}
              currentUser={currentUser}
              onSaveSuccess={handleSaveSuccess}
              onCancel={() => setIsCreating(false)}
            />
          ) : isEditing && activePage ? (
            <WikiForm 
              id={activePage._id || activePage.id}
              initialTitle={activePage.title}
              initialContent={activePage.content}
              spaceId={activePage.spaceId}
              initialAuthor={activePage.author}
              initialCreatedAt={activePage.createdAt}
              initialCategory={activePage.category}
              initialBundleId={activePage.bundleId}
              initialApplicationId={activePage.applicationId}
              initialMilestoneId={activePage.milestoneId}
              allPages={pages}
              currentUser={currentUser}
              onSaveSuccess={handleSaveSuccess}
              onCancel={() => setIsEditing(false)}
            />
          ) : viewHistory && activePage ? (
            <WikiHistory page={activePage} onClose={() => setViewHistory(false)} onRevert={handleSaveSuccess} />
          ) : activePage ? (
            <div className="animate-fadeIn">
              <div className="px-10 py-6 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white/90 backdrop-blur-md z-30 shadow-sm">
                <div className="flex items-center gap-3">
                   <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <i className="fas fa-link text-blue-500"></i>
                    <span>{spaces.find(s => s._id === activePage.spaceId || s.id === activePage.spaceId)?.name || 'Registry Node'}</span>
                   </div>
                   <div className="w-1 h-1 rounded-full bg-slate-200"></div>
                   <span className="text-sm font-bold text-slate-800 truncate max-w-[300px]">{activePage.title}</span>
                </div>
                <div className="flex items-center gap-1">
                  <ActionIcon icon="fa-pen-fancy" tooltip="Edit Node" onClick={() => setIsEditing(true)} />
                  <ActionIcon icon="fa-comments" tooltip="Feedback Loop" onClick={() => setShowComments(!showComments)} active={showComments} />
                  <ActionIcon icon="fa-clock-rotate-left" tooltip="Version Control" onClick={() => setViewHistory(true)} />
                </div>
              </div>
              <div className="p-16 max-w-5xl mx-auto">
                <WikiPageDisplay page={activePage} />
                {showComments && (
                  <div className="mt-20 pt-10 border-t border-slate-100">
                    <WikiComments pageId={(activePage._id || activePage.id)!} currentUser={currentUser} />
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-20 text-center text-slate-200">
              <i className="fas fa-book-open-reader text-8xl mb-6 opacity-5"></i>
              <h3 className="text-xl font-black text-slate-300 uppercase tracking-[0.2em]">Select a page to view</h3>
              <p className="text-xs font-bold text-slate-400 mt-2">Browse the dynamic projection tree on the left.</p>
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
      `}</style>
    </div>
  );
};

const ActionIcon = ({ icon, tooltip, onClick, active }: any) => (
  <button 
    title={tooltip}
    onClick={onClick}
    className={`w-10 h-10 flex items-center justify-center rounded-xl transition-all ${
      active ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-100 hover:text-blue-600'
    }`}
  >
    <i className={`fas ${icon} text-sm`}></i>
  </button>
);

const WikiComments = ({ pageId, currentUser }: any) => {
  const [comments, setComments] = useState<any[]>([]);
  const [text, setText] = useState('');
  useEffect(() => {
    fetch(`/api/wiki/comments?pageId=${pageId}`).then(res => res.json()).then(setComments);
  }, [pageId]);

  const post = async () => {
    if (!text.trim()) return;
    await fetch('/api/wiki/comments', {
      method: 'POST',
      body: JSON.stringify({ pageId, content: text, author: currentUser?.name || 'System' })
    });
    setText('');
    const res = await fetch(`/api/wiki/comments?pageId=${pageId}`);
    setComments(await res.json());
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      <h3 className="text-xl font-black text-slate-800 tracking-tighter">Collaborative Feedback</h3>
      <div className="space-y-6">
        {comments.map((c, i) => (
          <div key={i} className="flex gap-4 group">
            <div className="w-10 h-10 bg-slate-100 rounded-2xl flex items-center justify-center text-[10px] font-black group-hover:bg-blue-50 transition-colors">{c.author[0]}</div>
            <div className="flex-1 bg-slate-50/50 p-4 rounded-2xl border border-slate-100">
              <div className="flex justify-between mb-2">
                <span className="text-xs font-black">{c.author}</span>
                <span className="text-[10px] text-slate-400 font-bold uppercase">{new Date(c.createdAt).toLocaleDateString()}</span>
              </div>
              <p className="text-sm text-slate-600 leading-relaxed font-medium">{c.content}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="flex gap-4 mt-10">
        <textarea 
          value={text} onChange={(e) => setText(e.target.value)}
          placeholder="Provide architectural feedback or ask questions..."
          className="flex-1 bg-white border border-slate-200 rounded-2xl p-5 text-sm font-medium focus:border-blue-500 outline-none h-24 shadow-sm"
        />
        <button onClick={post} className="px-8 bg-slate-900 text-white text-[10px] font-black rounded-2xl uppercase tracking-widest shadow-xl h-12 self-end">Post</button>
      </div>
    </div>
  );
};

export default Wiki;
