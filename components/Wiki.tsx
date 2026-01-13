
import React, { useState, useEffect, useMemo } from 'react';
import { WikiPage, WikiTheme, HierarchyMode, Application, WikiSpace, Bundle, TaxonomyCategory, TaxonomyDocumentType } from '../types';
import WikiForm from './WikiForm';
import CreateWikiPageForm from './CreateWikiPageForm';
import WikiPageDisplay from './WikiPageDisplay';
import WikiHistory from './WikiHistory';

interface WikiProps {
  currentUser?: { name: string; role: string; email: string; };
  selSpaceId: string;
  selBundleId: string;
  selAppId: string;
  selMilestone: string;
  searchQuery: string;
  externalTrigger?: string | null;
  onTriggerProcessed?: () => void;
  bundles?: Bundle[];
  applications?: Application[];
}

const Wiki: React.FC<WikiProps> = ({ 
  currentUser, selSpaceId, selBundleId, selAppId, selMilestone, searchQuery, externalTrigger, onTriggerProcessed, bundles = [], applications = []
}) => {
  const [spaces, setSpaces] = useState<WikiSpace[]>([]);
  const [themes, setThemes] = useState<WikiTheme[]>([]);
  const [pages, setPages] = useState<WikiPage[]>([]);
  const [categories, setCategories] = useState<TaxonomyCategory[]>([]);
  const [docTypes, setDocTypes] = useState<TaxonomyDocumentType[]>([]);
  const [activePage, setActivePage] = useState<WikiPage | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [loading, setLoading] = useState(true);
  
  // Default hierarchyMode updated to Space → Bundle → Application → Milestone
  const [hierarchyMode, setHierarchyMode] = useState<HierarchyMode>(HierarchyMode.SPACE_BUNDLE_APP_MILESTONE);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      try {
        const [spRes, pgRes, thRes, catRes, typRes] = await Promise.all([
          fetch('/api/wiki/spaces'),
          fetch('/api/wiki'),
          fetch('/api/wiki/themes?active=true'),
          fetch('/api/taxonomy/categories?active=true'),
          fetch('/api/taxonomy/document-types?active=true')
        ]);
        setSpaces(await spRes.json());
        setPages(await pgRes.json());
        setThemes(await thRes.json());
        setCategories(await catRes.json());
        setDocTypes(await typRes.json());
      } catch (e) { console.error("Wiki Init Error", e); }
      finally { setLoading(false); }
    };
    init();
  }, []);

  const treeData = useMemo(() => {
    if (!applications || !bundles) return [];
    let filtered = pages;
    if (selSpaceId !== 'all') filtered = filtered.filter(p => p.spaceId === selSpaceId);
    if (selBundleId !== 'all') filtered = filtered.filter(p => p.bundleId === selBundleId);
    if (selAppId !== 'all') filtered = filtered.filter(p => p.applicationId === selAppId);
    if (selMilestone !== 'all') filtered = filtered.filter(p => p.milestoneId === selMilestone);
    
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(p => p.title.toLowerCase().includes(q));
    }

    const tree: any[] = [];
    const buildPath = (path: string[], page: WikiPage) => {
      let currentLevel = tree;
      path.forEach((part, i) => {
        const nodeId = `lvl-${i}-${path.slice(0, i+1).join('/')}`;
        let node = currentLevel.find(n => n.label === part && n.type === 'folder');
        if (!node) {
          node = { label: part, type: 'folder', children: [], id: nodeId };
          currentLevel.push(node);
        }
        currentLevel = node.children;
        if (i === path.length - 1) {
          currentLevel.push({ label: page.title, type: 'page', data: page, id: `page-${page._id || page.id}` });
        }
      });
    };

    filtered.forEach(page => {
      const app = applications.find(a => a._id === page.applicationId || a.id === page.applicationId)?.name || 'Generic';
      const bundle = bundles.find(b => b._id === page.bundleId || b.id === page.bundleId)?.name || 'Unassigned';
      const ms = page.milestoneId || 'Ongoing';
      const typeObj = docTypes.find(t => t._id === page.documentTypeId);
      const catObj = categories.find(c => c._id === typeObj?.categoryId);
      const type = typeObj?.name || 'General';
      const cat = catObj?.name || 'Uncategorized';
      const space = spaces.find(s => s._id === page.spaceId || s.id === page.spaceId)?.name || 'Registry';

      let path: string[] = [];
      switch (hierarchyMode) {
        case HierarchyMode.SPACE_BUNDLE_APP_MILESTONE: path = [space, bundle, app, ms]; break;
        case HierarchyMode.BUNDLE_MILESTONE_TYPE: path = [bundle, ms, type]; break;
        case HierarchyMode.BUNDLE_TYPE: path = [bundle, type]; break;
        case HierarchyMode.BUNDLE_APP_MILESTONE_TYPE: path = [bundle, app, ms, type]; break;
        case HierarchyMode.APP_MILESTONE_TYPE: path = [app, ms, type]; break;
        default: path = [space, bundle, app, ms];
      }
      buildPath(path, page);
    });
    return tree;
  }, [pages, selSpaceId, selBundleId, selAppId, selMilestone, searchQuery, hierarchyMode, applications, bundles, spaces, docTypes, categories]);

  const renderTreeNode = (node: any, depth = 0) => {
    const isPage = node.type === 'page';
    const isExpanded = expandedNodes.has(node.id);
    const isActive = isPage && (activePage?._id === node.data?._id || activePage?.id === node.data?.id);
    return (
      <div key={node.id} className="flex flex-col">
        <button onClick={() => isPage ? setActivePage(node.data) : setExpandedNodes(prev => { const n = new Set(prev); n.has(node.id) ? n.delete(node.id) : n.add(node.id); return n; })}
          className={`text-left px-3 py-2 flex items-center gap-3 rounded-xl hover:bg-slate-100 transition-all ${isActive ? 'bg-blue-50 text-blue-700 font-bold' : 'text-slate-600'}`} style={{ marginLeft: `${depth * 20}px` }}>
          {!isPage && <i className={`fas ${isExpanded ? 'fa-caret-down' : 'fa-caret-right'} w-2`}></i>}
          {isPage && <div className="w-2"></div>}
          <i className={`fas ${isPage ? 'fa-file-lines opacity-40' : 'fa-folder opacity-40'}`}></i>
          <span className="text-[13px] truncate font-medium">{node.label}</span>
        </button>
        {node.children && isExpanded && node.children.map((child: any) => renderTreeNode(child, depth + 1))}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="h-[600px] flex items-center justify-center bg-white rounded-[2.5rem] border border-slate-200">
         <div className="flex flex-col items-center gap-4">
           <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
           <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Accessing Registry Knowledge...</span>
         </div>
      </div>
    );
  }

  return (
    <div className="flex bg-white min-h-[850px] border border-slate-200 rounded-[2.5rem] shadow-2xl overflow-hidden relative">
      <aside className="w-80 border-r border-slate-100 bg-slate-50/20 flex flex-col shrink-0">
        <div className="p-6 border-b border-slate-100 space-y-4">
          <div className="space-y-1">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Projection Mode</label>
            <select value={hierarchyMode} onChange={(e) => setHierarchyMode(e.target.value as HierarchyMode)} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-[12px] font-bold text-slate-600 outline-none shadow-sm focus:border-blue-500 transition-all">
              {Object.values(HierarchyMode).map(mode => <option key={mode} value={mode}>{mode}</option>)}
            </select>
          </div>
          <button onClick={() => setIsCreating(true)} className="w-full py-2.5 bg-slate-900 text-white rounded-xl text-[9px] font-black uppercase tracking-widest shadow-xl hover:bg-slate-800 transition-all">+ New Artifact</button>
        </div>
        <nav className="flex-1 overflow-y-auto p-4 custom-scrollbar">
          {treeData.map(node => renderTreeNode(node))}
        </nav>
      </aside>
      <main className="flex-1 overflow-y-auto custom-scrollbar bg-white">
        {isCreating ? <CreateWikiPageForm spaceId={selSpaceId === 'all' ? (spaces[0]?._id || 'default') : selSpaceId} allPages={pages} currentUser={currentUser} onSaveSuccess={() => { setIsCreating(false); fetch('/api/wiki').then(r => r.json()).then(setPages); }} onCancel={() => setIsCreating(false)} bundles={bundles} applications={applications} />
        : isEditing && activePage ? <WikiForm id={activePage._id} initialTitle={activePage.title} initialContent={activePage.content} spaceId={activePage.spaceId} onSaveSuccess={() => { setIsEditing(false); fetch('/api/wiki').then(r => r.json()).then(setPages); }} onCancel={() => setIsEditing(false)} bundles={bundles} applications={applications} />
        : activePage ? (
          <div className="p-16 max-w-5xl mx-auto animate-fadeIn">
            <div className="flex justify-between items-center mb-12">
               <div className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Enterprise Artifact v{activePage.version || 1}</div>
               <button onClick={() => setIsEditing(true)} className="px-6 py-2 border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all">Revise Document</button>
            </div>
            <WikiPageDisplay page={activePage} bundles={bundles} applications={applications} />
          </div>
        ) : <div className="h-full flex flex-col items-center justify-center text-slate-300 p-20 text-center">
             <div className="w-24 h-24 rounded-3xl bg-slate-50 flex items-center justify-center mb-8 shadow-inner">
                <i className="fas fa-book-open text-slate-100 text-5xl"></i>
             </div>
             <h3 className="text-xl font-black text-slate-900 tracking-tight">Enterprise Knowledge Base</h3>
             <p className="text-slate-400 font-medium mt-2 max-w-xs">Select an artifact from the explorer to review delivery standards and blueprints.</p>
           </div>}
      </main>
      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
      `}</style>
    </div>
  );
};

export default Wiki;
