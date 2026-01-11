
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { WikiPage, WikiSpace, HierarchyMode, Bundle, Application, Milestone } from '../types';
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
  // Layer 1 - Filter States
  const [spaces, setSpaces] = useState<WikiSpace[]>([]);
  const [bundles, setBundles] = useState<Bundle[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  
  const [selSpaceId, setSelSpaceId] = useState<string>('all');
  const [selBundleId, setSelBundleId] = useState<string>('all');
  const [selAppId, setSelAppId] = useState<string>('all');
  const [selMilestone, setSelMilestone] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Layer 2 - UI Mode & Content States
  const [hierarchyMode, setHierarchyMode] = useState<HierarchyMode>(HierarchyMode.APP_MILESTONE_TYPE);
  const [pages, setPages] = useState<WikiPage[]>([]);
  const [activePage, setActivePage] = useState<WikiPage | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [viewHistory, setViewHistory] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showComments, setShowComments] = useState(false);
  
  // Modals
  const [isCreatingSpace, setIsCreatingSpace] = useState(false);
  const [newSpaceName, setNewSpaceName] = useState('');
  const [newSpaceKey, setNewSpaceKey] = useState('');

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      try {
        const [spRes, bnRes, apRes, msRes, pgRes] = await Promise.all([
          fetch('/api/wiki/spaces'),
          fetch('/api/bundles'), // You might need to add this API or fetch from seed
          fetch('/api/applications'),
          fetch('/api/milestones'),
          fetch('/api/wiki')
        ]);
        
        setSpaces(await spRes.json());
        setBundles(await bnRes.json().catch(() => []));
        setApplications(await apRes.json().catch(() => []));
        setMilestones(await msRes.json().catch(() => []));
        setPages(await pgRes.json());
      } catch (e) {
        console.error("Wiki Init Error", e);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  // Filter application list based on bundle
  const filteredApps = useMemo(() => {
    if (selBundleId === 'all') return applications;
    return applications.filter(a => a.bundleId === selBundleId);
  }, [selBundleId, applications]);

  // Layer 3 - Dynamic Tree Explorer (PROJECTION LOGIC)
  const treeData = useMemo(() => {
    // 1. Filter pages based on Layer 1 context bar
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

    // 2. Build the projection tree based on hierarchyMode
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
    <div className="flex flex-col bg-white min-h-[900px] border border-slate-200 rounded-[2.5rem] shadow-2xl overflow-hidden animate-fadeIn">
      
      {/* Layer 1: Wiki Context Bar */}
      <div className="h-20 border-b border-slate-100 flex items-center px-8 gap-6 bg-slate-50/30 sticky top-0 z-40 backdrop-blur-md">
        <div className="flex items-center gap-4 flex-1">
          <FilterSelect label="Space" value={selSpaceId} onChange={setSelSpaceId} options={spaces.map(s => ({ id: s._id || s.id!, name: s.name }))} />
          <FilterSelect label="Bundle" value={selBundleId} onChange={setSelBundleId} options={bundles.map(b => ({ id: b.id, name: b.name }))} />
          <FilterSelect label="App" value={selAppId} onChange={setSelAppId} options={filteredApps.map(a => ({ id: a.id, name: a.name }))} />
          <FilterSelect label="Milestone" value={selMilestone} onChange={setSelMilestone} options={[...Array(10)].map((_, i) => ({ id: `M${i+1}`, name: `M${i+1}` }))} />
        </div>

        <div className="flex items-center gap-4">
          <div className="relative">
            <i className="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 text-xs"></i>
            <input 
              type="text" 
              placeholder="Search wiki..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-white border-2 border-slate-100 rounded-2xl pl-10 pr-4 py-2.5 text-xs focus:border-blue-500 transition-all w-48 font-bold"
            />
          </div>
          <button 
            onClick={() => setIsCreatingSpace(true)}
            className="px-6 py-2.5 bg-slate-900 text-white text-[10px] font-black rounded-xl hover:bg-slate-800 transition-all uppercase tracking-widest shadow-xl shadow-slate-900/10 flex items-center gap-2"
          >
            <i className="fas fa-plus"></i> Space
          </button>
        </div>
      </div>

      {/* Layer 2: Main Workspace Area */}
      <div className="flex flex-1 overflow-hidden relative">
        
        {/* Layer 3: Dynamic Tree Explorer */}
        {!isEditing && !isCreating && (
          <aside className="w-80 border-r border-slate-100 flex flex-col shrink-0 bg-slate-50/10">
            <div className="p-6 border-b border-slate-100 space-y-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Hierarchy Projection</label>
                <select 
                  value={hierarchyMode}
                  onChange={(e) => setHierarchyMode(e.target.value as HierarchyMode)}
                  className="w-full bg-white border-2 border-slate-100 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-600 outline-none focus:border-blue-500 transition-all"
                >
                  {Object.values(HierarchyMode).map(mode => (
                    <option key={mode} value={mode}>{mode}</option>
                  ))}
                </select>
              </div>
              <button 
                onClick={() => setIsCreating(true)}
                className="w-full py-3 border-2 border-dashed border-slate-200 rounded-2xl text-[10px] font-black text-slate-300 uppercase tracking-widest hover:border-blue-500 hover:text-blue-500 transition-all flex items-center justify-center gap-2"
              >
                <i className="fas fa-plus-circle"></i> Create New Page
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto p-4 custom-scrollbar">
              {treeData.map(node => renderTreeNode(node))}
            </nav>
          </aside>
        )}

        {/* Layer 4: Content Viewer / Editor */}
        <div className="flex-1 flex flex-col overflow-y-auto custom-scrollbar relative">
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
              allPages={pages}
              currentUser={currentUser}
              onSaveSuccess={handleSaveSuccess}
              onCancel={() => setIsEditing(false)}
            />
          ) : viewHistory && activePage ? (
            <WikiHistory page={activePage} onClose={() => setViewHistory(false)} onRevert={handleSaveSuccess} />
          ) : activePage ? (
            <div className="animate-fadeIn">
              <div className="px-10 py-6 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white/90 backdrop-blur-md z-30">
                <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  <i className="fas fa-link text-blue-500"></i>
                  <span>Registry Node</span>
                </div>
                <div className="flex items-center gap-3">
                  <ActionIcon icon="fa-pen-fancy" tooltip="Edit Page" onClick={() => setIsEditing(true)} />
                  <ActionIcon icon="fa-comments" tooltip="Comments" onClick={() => setShowComments(!showComments)} active={showComments} />
                  <ActionIcon icon="fa-clock-rotate-left" tooltip="History" onClick={() => setViewHistory(true)} />
                  <ActionIcon icon="fa-star" tooltip="Watch" onClick={() => {}} />
                  <ActionIcon icon="fa-link" tooltip="Copy Link" onClick={() => {}} />
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

const FilterSelect = ({ label, value, onChange, options }: any) => (
  <div className="flex flex-col gap-1 min-w-[120px]">
    <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">{label}</label>
    <select 
      value={value} 
      onChange={(e) => onChange(e.target.value)}
      className="bg-white border-2 border-slate-100 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-600 focus:border-blue-500 transition-all outline-none"
    >
      <option value="all">All {label}s</option>
      {options.map((o: any) => <option key={o.id} value={o.id}>{o.name}</option>)}
    </select>
  </div>
);

const ActionIcon = ({ icon, tooltip, onClick, active }: any) => (
  <button 
    title={tooltip}
    onClick={onClick}
    className={`w-10 h-10 flex items-center justify-center rounded-xl transition-all ${
      active ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-100 hover:text-blue-600'
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
      <h3 className="text-xl font-black text-slate-800">Collaborative Feedback</h3>
      <div className="space-y-6">
        {comments.map((c, i) => (
          <div key={i} className="flex gap-4">
            <div className="w-10 h-10 bg-slate-100 rounded-2xl flex items-center justify-center text-[10px] font-black">{c.author[0]}</div>
            <div className="flex-1 bg-slate-50 p-4 rounded-2xl border border-slate-100">
              <div className="flex justify-between mb-2">
                <span className="text-xs font-black">{c.author}</span>
                <span className="text-[10px] text-slate-400">{new Date(c.createdAt).toLocaleDateString()}</span>
              </div>
              <p className="text-sm text-slate-600 leading-relaxed">{c.content}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="flex gap-4 mt-10">
        <textarea 
          value={text} onChange={(e) => setText(e.target.value)}
          placeholder="Join the discussion..."
          className="flex-1 bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 text-sm focus:border-blue-500 outline-none h-24"
        />
        <button onClick={post} className="px-8 bg-slate-900 text-white text-[10px] font-black rounded-2xl uppercase tracking-widest shadow-xl">Post</button>
      </div>
    </div>
  );
};

export default Wiki;
