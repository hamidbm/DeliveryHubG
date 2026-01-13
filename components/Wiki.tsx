
import React, { useState, useEffect, useMemo } from 'react';
import { WikiPage, WikiTheme, HierarchyMode, Application, WikiSpace, Bundle } from '../types';
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
  selSpaceId: string;
  selBundleId: string;
  selAppId: string;
  selMilestone: string;
  searchQuery: string;
  externalTrigger?: string | null;
  onTriggerProcessed?: () => void;
  bundles: Bundle[];
  applications: Application[];
}

const Wiki: React.FC<WikiProps> = ({ 
  currentUser, 
  selSpaceId, 
  selBundleId, 
  selAppId, 
  selMilestone, 
  searchQuery,
  externalTrigger,
  onTriggerProcessed,
  bundles,
  applications
}) => {
  const [spaces, setSpaces] = useState<WikiSpace[]>([]);
  const [themes, setThemes] = useState<WikiTheme[]>([]);
  const [pages, setPages] = useState<WikiPage[]>([]);
  const [activePage, setActivePage] = useState<WikiPage | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isSettingSpace, setIsSettingSpace] = useState(false);
  const [viewHistory, setViewHistory] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showComments, setShowComments] = useState(false);
  // Define hierarchyMode state to handle navigation tree projections
  const [hierarchyMode, setHierarchyMode] = useState<HierarchyMode>(HierarchyMode.APP_MILESTONE_TYPE);
  
  // UI Control
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

  // Modals
  const [isCreatingSpace, setIsCreatingSpace] = useState(false);
  const [newSpaceName, setNewSpaceName] = useState('');
  const [newSpaceKey, setNewSpaceKey] = useState('');
  const [spaceTheme, setSpaceTheme] = useState('');

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
        const [spRes, pgRes, thRes] = await Promise.all([
          fetch('/api/wiki/spaces'),
          fetch('/api/wiki'),
          fetch('/api/wiki/themes?active=true')
        ]);
        
        const spacesData = await spRes.json();
        const pagesData = await pgRes.json();
        const themesData = await thRes.json();

        setSpaces(spacesData);
        setPages(pagesData);
        setThemes(themesData);
      } catch (e) {
        console.error("Wiki Init Error", e);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

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
        p.content.toLowerCase().includes(q)
      );
    }

    const tree: any[] = [];
    const allFolderIds: string[] = [];

    const buildPath = (path: string[], page: WikiPage) => {
      let currentLevel = tree;
      let pathAcc = '';
      path.forEach((part, i) => {
        pathAcc = pathAcc ? `${pathAcc}/${part}` : part;
        const nodeId = `lvl-${i}-${pathAcc}`;
        let node = currentLevel.find(n => n.label === part && n.type === 'folder');
        if (!node) {
          node = { label: part, type: 'folder', children: [], id: nodeId };
          currentLevel.push(node);
          allFolderIds.push(nodeId);
        }
        currentLevel = node.children;
        if (i === path.length - 1) {
          currentLevel.push({ 
            label: page.title, 
            type: 'page', 
            data: page, 
            id: `page-${page._id || page.id}`
          });
        }
      });
    };

    filtered.forEach(page => {
      const app = applications.find(a => a._id === page.applicationId || a.id === page.applicationId)?.name || 'Unassigned App';
      const ms = page.milestoneId || 'No Milestone';
      const type = page.category || 'General Documentation';
      const space = spaces.find(s => s._id === page.spaceId || s.id === page.spaceId)?.name || 'Registry';
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

    // Expand everything by default on first load or mode change
    setExpandedNodes(prev => {
      const next = new Set(prev);
      allFolderIds.forEach(id => next.add(id));
      return next;
    });

    return tree;
  }, [pages, selSpaceId, selBundleId, selAppId, selMilestone, searchQuery, hierarchyMode, applications, spaces]);

  const getIconForNode = (node: any, depth: number) => {
    if (node.type === 'page') return 'fa-file-lines text-blue-500/60';
    
    // Determine logical mapping based on current hierarchy projection
    const modeParts = hierarchyMode.split(' → ');
    const levelType = modeParts[depth] || '';

    if (levelType.includes('Space')) return 'fa-layer-group text-indigo-500';
    if (levelType.includes('Application')) return 'fa-cube text-blue-500';
    if (levelType.includes('Milestone')) return 'fa-flag-checkered text-amber-500';
    if (levelType.includes('Type') || levelType.includes('Vendor')) return 'fa-tags text-slate-400';

    return 'fa-circle-dot text-slate-300';
  };

  const toggleNode = (nodeId: string) => {
    setExpandedNodes(prev => {
      const next = new Set(prev);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
  };

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
        body: JSON.stringify({ name: newSpaceName, key: newSpaceKey.toUpperCase(), visibility: 'internal', icon: 'fa-book' }),
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
    const isExpanded = expandedNodes.has(node.id);
    const isActive = isPage && (activePage?._id === node.data?._id || activePage?.id === node.data?.id);

    return (
      <div key={node.id} className="flex flex-col relative">
        <div className="flex items-center group/node relative">
          {/* Vertical Linkage Line */}
          {depth > 0 && (
            <div 
              className="absolute border-l border-slate-200" 
              style={{ 
                left: `${(depth - 1) * 22 + 11}px`, 
                top: '0', 
                bottom: (node.children && isExpanded) ? 'auto' : '50%', 
                height: (node.children && isExpanded) ? '100%' : '50%', 
                width: '1px' 
              }} 
            />
          )}
          {/* Horizontal Branch Line */}
          {depth > 0 && (
            <div 
              className="absolute border-t border-slate-200" 
              style={{ left: `${(depth - 1) * 22 + 11}px`, top: '50%', width: '11px' }} 
            />
          )}

          <button
            onClick={() => {
              if (isPage) {
                setActivePage(node.data);
                setIsEditing(false);
                setIsCreating(false);
              } else {
                toggleNode(node.id);
              }
            }}
            className={`w-full text-left pl-2 pr-3 py-2 flex items-center gap-2.5 transition-all rounded-xl my-0.5 relative z-10 ${
              isActive 
              ? 'bg-blue-50/60 text-blue-700 font-bold shadow-sm' 
              : 'text-slate-600 hover:bg-slate-100/60'
            }`}
            style={{ marginLeft: `${depth * 22}px` }}
          >
            {!isPage && (
              <i className={`fas ${isExpanded ? 'fa-caret-down' : 'fa-caret-right'} text-[11px] w-4 flex-shrink-0 opacity-40 transition-transform`}></i>
            )}
            {isPage && <div className="w-4"></div>}
            
            <i className={`fas ${getIconForNode(node, depth)} text-[14px] flex-shrink-0 opacity-80 group-hover/node:opacity-100 transition-opacity`}></i>
            
            <span className="text-[13px] font-semibold truncate leading-none">{node.label}</span>
            
            {isActive && (
               <div className="ml-auto w-1.5 h-3.5 rounded-full bg-blue-500 animate-fadeIn shadow-sm"></div>
            )}
          </button>
        </div>
        
        {node.children && isExpanded && (
          <div className="flex flex-col relative">
            {/* Continuation line for children if this node is expanded */}
            <div 
              className="absolute border-l border-slate-200" 
              style={{ left: `${depth * 22 + 11}px`, top: '0', bottom: '12px', width: '1px' }} 
            />
            {node.children.map((child: any) => renderTreeNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  const activeSpace = spaces.find(s => s._id === activePage?.spaceId || s.id === activePage?.spaceId);

  return (
    <div className="flex bg-white min-h-[850px] border border-slate-200 rounded-[2.5rem] shadow-2xl overflow-hidden animate-fadeIn relative">
      
      {/* Sidebar Toggle */}
      {!isEditing && !isCreating && (
        <button 
          onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          className={`absolute z-[60] top-4 w-7 h-7 rounded-full bg-white border border-slate-200 shadow-md flex items-center justify-center text-slate-400 hover:text-blue-600 transition-all ${isSidebarCollapsed ? 'left-4' : 'left-[306px]'}`}
          title={isSidebarCollapsed ? 'Show Explorer' : 'Hide Explorer'}
        >
          <i className={`fas ${isSidebarCollapsed ? 'fa-chevron-right' : 'fa-chevron-left'} text-[10px]`}></i>
        </button>
      )}

      <div className="flex flex-1 overflow-hidden relative">
        
        {/* Left Pane: Tree Explorer */}
        {!isEditing && !isCreating && (
          <aside className={`border-r border-slate-100 flex flex-col shrink-0 bg-slate-50/20 transition-all duration-500 ease-in-out ${isSidebarCollapsed ? 'w-0 opacity-0 -translate-x-full' : 'w-80 opacity-100'}`}>
            <div className="p-6 pt-16 border-b border-slate-100 space-y-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Projection Mode</label>
                <select 
                  value={hierarchyMode}
                  onChange={(e) => setHierarchyMode(e.target.value as HierarchyMode)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-[12px] font-bold text-slate-600 outline-none focus:border-blue-500 transition-all shadow-sm"
                >
                  {Object.values(HierarchyMode).map(mode => (
                    <option key={mode} value={mode}>{mode}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button 
                  onClick={() => setIsCreating(true)}
                  className="py-2.5 border border-slate-200 rounded-xl text-[9px] font-black text-slate-500 hover:text-blue-600 hover:border-blue-500 transition-all flex items-center justify-center gap-2 bg-white shadow-sm"
                >
                  <i className="fas fa-plus"></i> New Artifact
                </button>
                <button 
                  disabled={selSpaceId === 'all'}
                  onClick={() => setIsSettingSpace(true)}
                  className="py-2.5 border border-slate-100 rounded-xl text-[9px] font-black text-slate-400 hover:bg-white disabled:opacity-30 transition-all flex items-center justify-center gap-2"
                >
                  <i className="fas fa-cog"></i> Configure
                </button>
              </div>
            </div>
            <nav className="flex-1 overflow-y-auto p-4 custom-scrollbar">
              <div className="space-y-0.5">
                {treeData.length > 0 ? (
                  treeData.map(node => renderTreeNode(node))
                ) : (
                  <div className="py-20 text-center px-4">
                    <i className="fas fa-database text-slate-100 text-5xl mb-4 block"></i>
                    <p className="text-[11px] font-black text-slate-300 uppercase tracking-widest leading-relaxed">No documentation mapped in this projection.</p>
                  </div>
                )}
              </div>
            </nav>
          </aside>
        )}

        {/* Right Pane: Main Content */}
        <div className="flex-1 flex flex-col overflow-y-auto custom-scrollbar bg-white">
          
          {isSettingSpace && (
            <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[200] flex items-center justify-center p-6">
              <div className="bg-white rounded-[2.5rem] w-full max-w-md p-10 shadow-2xl animate-fadeIn border border-slate-100">
                <h3 className="text-2xl font-black text-slate-900 mb-2">Space Settings</h3>
                <p className="text-sm text-slate-500 mb-8 font-medium">Define defaults for the current functional domain.</p>
                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Default Space Theme</label>
                    <select 
                      value={spaceTheme} onChange={(e) => setSpaceTheme(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-slate-700 focus:border-blue-500 transition-all font-bold"
                    >
                      <option value="">Standard Framework</option>
                      {themes.map(t => (
                        <option key={t.key} value={t.key}>{t.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="flex items-center gap-4 mt-10">
                  <button onClick={() => setIsSettingSpace(false)} className="flex-1 py-4 text-[10px] font-black text-slate-400 uppercase hover:text-slate-800">Cancel</button>
                  <button onClick={handleSaveSpaceSettings} className="flex-1 py-4 bg-blue-600 text-white text-[10px] font-black rounded-2xl shadow-xl hover:bg-blue-700">Update Space</button>
                </div>
              </div>
            </div>
          )}

          {isCreatingSpace && (
            <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[200] flex items-center justify-center p-6">
              <form onSubmit={handleCreateSpace} className="bg-white rounded-[2.5rem] w-full max-w-md p-10 shadow-2xl animate-fadeIn border border-slate-100">
                <h3 className="text-2xl font-black text-slate-900 mb-2">New Knowledge Space</h3>
                <div className="space-y-6 mt-8">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="col-span-2 space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Name</label>
                      <input 
                        type="text" required value={newSpaceName} onChange={(e) => setNewSpaceName(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-slate-700 font-bold"
                        placeholder="e.g. Platform Engineering"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center block">Key</label>
                      <input 
                        type="text" required maxLength={3} value={newSpaceKey} onChange={(e) => setNewSpaceKey(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-slate-700 font-black text-center"
                        placeholder="PLT"
                      />
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4 mt-10">
                  <button type="button" onClick={() => setIsCreatingSpace(false)} className="flex-1 py-4 text-[10px] font-black text-slate-400 uppercase">Discard</button>
                  <button type="submit" className="flex-1 py-4 bg-slate-900 text-white text-[10px] font-black rounded-2xl">Create</button>
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
              bundles={bundles}
              applications={applications}
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
              bundles={bundles}
              applications={applications}
            />
          ) : viewHistory && activePage ? (
            <WikiHistory page={activePage} onClose={() => setViewHistory(false)} onRevert={handleSaveSuccess} bundles={bundles} applications={applications} />
          ) : activePage ? (
            <div className="animate-fadeIn min-h-full flex flex-col">
              <div className="px-10 py-6 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white/95 backdrop-blur-md z-30 shadow-sm">
                <div className="flex items-center gap-3">
                   <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <i className="fas fa-link text-blue-500/40"></i>
                    <span>{activeSpace?.name || 'Registry Node'}</span>
                   </div>
                   <div className="w-1 h-1 rounded-full bg-slate-200"></div>
                   <span className="text-sm font-bold text-slate-800 truncate max-w-[400px]">{activePage.title}</span>
                </div>
                <div className="flex items-center gap-1">
                  <ActionIcon icon="fa-pen-to-square" tooltip="Revise" onClick={() => setIsEditing(true)} />
                  <ActionIcon icon="fa-comments" tooltip="Discussion" onClick={() => setShowComments(!showComments)} active={showComments} />
                  <ActionIcon icon="fa-clock-rotate-left" tooltip="Timeline" onClick={() => setViewHistory(true)} />
                </div>
              </div>
              <div className="p-16 max-w-5xl mx-auto flex-1 w-full">
                <WikiPageDisplay page={activePage} bundles={bundles} applications={applications} />
                {showComments && (
                  <div className="mt-24 pt-12 border-t border-slate-100">
                    <WikiComments pageId={(activePage._id || activePage.id)!} currentUser={currentUser} />
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-20 text-center">
              <div className="w-24 h-24 rounded-3xl bg-slate-50 flex items-center justify-center mb-8 shadow-inner">
                <i className="fas fa-book text-slate-200 text-4xl"></i>
              </div>
              <h3 className="text-xl font-black text-slate-900 tracking-tight">Enterprise Knowledge Base</h3>
              <p className="text-slate-400 font-medium mt-2 max-w-sm">Select an artifact from the explorer to review delivery standards and blueprints.</p>
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
    className={`w-9 h-9 flex items-center justify-center rounded-xl transition-all ${
      active ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-50 hover:text-blue-600'
    }`}
  >
    <i className={`fas ${icon} text-[13px]`}></i>
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
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pageId, content: text, author: currentUser?.name || 'System' })
    });
    setText('');
    const res = await fetch(`/api/wiki/comments?pageId=${pageId}`);
    setComments(await res.json());
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      <h3 className="text-2xl font-black text-slate-900 tracking-tighter">Peer Reviews</h3>
      <div className="space-y-6">
        {comments.length > 0 ? comments.map((c, i) => (
          <div key={i} className="flex gap-5 group">
            <div className="w-10 h-10 bg-slate-100 rounded-2xl flex items-center justify-center text-[11px] font-black text-slate-500 group-hover:bg-blue-600 group-hover:text-white transition-all">
              {c.author[0]}
            </div>
            <div className="flex-1 bg-white p-6 rounded-[1.5rem] border border-slate-100 shadow-sm transition-all group-hover:shadow-md">
              <div className="flex justify-between mb-2">
                <span className="text-xs font-black text-slate-800">{c.author}</span>
                <span className="text-[10px] text-slate-300 font-bold uppercase">{new Date(c.createdAt).toLocaleDateString()}</span>
              </div>
              <p className="text-[13px] text-slate-600 leading-relaxed font-medium">{c.content}</p>
            </div>
          </div>
        )) : (
          <p className="text-slate-300 italic text-sm py-10 text-center">No reviews submitted for this artifact.</p>
        )}
      </div>
      <div className="flex gap-4 mt-12 bg-slate-50/50 p-6 rounded-[2rem] border border-slate-100">
        <textarea 
          value={text} onChange={(e) => setText(e.target.value)}
          placeholder="Record review feedback or architectural concerns..."
          className="flex-1 bg-white border border-slate-200 rounded-2xl p-5 text-sm font-medium focus:border-blue-500 outline-none h-28 shadow-sm transition-all"
        />
        <button 
          onClick={post} 
          className="px-8 bg-slate-900 text-white text-[10px] font-black rounded-2xl uppercase tracking-widest shadow-xl hover:bg-slate-800 transition-all h-14 self-end"
        >
          Submit
        </button>
      </div>
    </div>
  );
};

export default Wiki;
