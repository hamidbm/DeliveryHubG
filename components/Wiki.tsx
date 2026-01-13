
import React, { useState, useEffect, useMemo } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { WikiPage, WikiTheme, HierarchyMode, Application, WikiSpace, Bundle, TaxonomyCategory, TaxonomyDocumentType } from '../types';
import WikiForm from './WikiForm';
import CreateWikiPageForm from './CreateWikiPageForm';
import WikiPageDisplay from './WikiPageDisplay';

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
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const [spaces, setSpaces] = useState<WikiSpace[]>([]);
  const [themes, setThemes] = useState<WikiTheme[]>([]);
  const [pages, setPages] = useState<WikiPage[]>([]);
  const [categories, setCategories] = useState<TaxonomyCategory[]>([]);
  const [docTypes, setDocTypes] = useState<TaxonomyDocumentType[]>([]);
  const [activePage, setActivePage] = useState<WikiPage | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isSidebarVisible, setIsSidebarVisible] = useState(true);
  const [copyFeedback, setCopyFeedback] = useState(false);
  
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
        
        // 1. Strict Space Deduplication
        const rawSpaces: WikiSpace[] = await spRes.json();
        const spaceMap = new Map();
        rawSpaces.forEach(s => {
          const id = String(s._id || s.id);
          if (!spaceMap.has(id)) spaceMap.set(id, s);
        });
        const uniqueSpaces = Array.from(spaceMap.values());
        
        const pagesData = await pgRes.json();
        setSpaces(uniqueSpaces);
        setPages(pagesData);
        setThemes(await thRes.json());
        setCategories(await catRes.json());
        setDocTypes(await typRes.json());

        const urlPageId = searchParams.get('pageId');
        if (urlPageId) {
          const page = resolvePage(urlPageId, pagesData);
          if (page) setActivePage(page);
        }

        // Default expansion for root nodes (Spaces)
        const rootNodeIds = uniqueSpaces.map(s => `lvl-0-${String(s._id || s.id)}`);
        setExpandedNodes(new Set(rootNodeIds));

      } catch (e) { 
        console.error("Wiki Init Error", e); 
      } finally { 
        setLoading(false); 
      }
    };
    init();
  }, [searchParams]);

  const resolvePage = (target: string, pageList: WikiPage[]): WikiPage | null => {
    if (!target) return null;
    return pageList.find(p => 
      String(p._id) === target || 
      String(p.id) === target || 
      p.slug === target
    ) || null;
  };

  const handleNavigate = (target: string) => {
    const page = resolvePage(target, pages);
    if (page) {
      handlePageSelect(page);
    }
  };

  const handlePageSelect = (page: WikiPage) => {
    setActivePage(page);
    const params = new URLSearchParams(searchParams.toString());
    params.set('pageId', (page.slug || page._id || page.id || '') as string);
    router.push(`${pathname}?${params.toString()}`);
  };

  const handleCopyLink = () => {
    if (!activePage) return;
    navigator.clipboard.writeText(window.location.href);
    setCopyFeedback(true);
    setTimeout(() => setCopyFeedback(false), 2000);
  };

  const refreshPages = async (activeId?: string) => {
    const pgRes = await fetch('/api/wiki');
    const newPages = await pgRes.json();
    setPages(newPages);
    if (activeId) {
      const updated = resolvePage(activeId, newPages);
      if (updated) setActivePage(updated);
    }
  };

  const treeData = useMemo(() => {
    if (!applications || !bundles || !spaces) return [];
    
    // Filtering logic:
    // If specific filters are chosen, only show pages belonging to that scope.
    // "General" pages (missing bundleId) only show when Bundle filter is "All".
    let filtered = pages;
    
    if (selSpaceId !== 'all') {
      filtered = filtered.filter(p => String(p.spaceId) === String(selSpaceId));
    }
    
    if (selBundleId !== 'all') {
      filtered = filtered.filter(p => p.bundleId && String(p.bundleId) === String(selBundleId));
    }
    
    if (selAppId !== 'all') {
      filtered = filtered.filter(p => p.applicationId && String(p.applicationId) === String(selAppId));
    }
    
    if (selMilestone !== 'all') {
      filtered = filtered.filter(p => p.milestoneId && String(p.milestoneId) === String(selMilestone));
    }
    
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(p => p.title.toLowerCase().includes(q));
    }

    const tree: any[] = [];
    
    const buildPath = (path: string[], pathTypes: string[], pathIds: string[], page: WikiPage) => {
      let currentLevel = tree;
      path.forEach((part, i) => {
        // Unique ID for folder to avoid duplication at the same hierarchy depth
        // We use string IDs to ensure ObjectIds don't cause splits
        const nodeId = `lvl-${i}-${pathIds.slice(0, i+1).join('/')}`;
        let node = currentLevel.find(n => n.id === nodeId && n.type === 'folder');
        
        if (!node) {
          node = { label: part, type: 'folder', nodeType: pathTypes[i], children: [], id: nodeId };
          currentLevel.push(node);
        }
        currentLevel = node.children;
        
        if (i === path.length - 1) {
          const pageNodeId = `page-${page._id || page.id}`;
          if (!currentLevel.some(n => n.id === pageNodeId)) {
            currentLevel.push({ 
              label: page.title, 
              type: 'page', 
              nodeType: 'page', 
              data: page, 
              id: pageNodeId 
            });
          }
        }
      });
    };

    filtered.forEach(page => {
      // Resolve Metadata with Explicit "General" Sentinels
      // Use strict string normalization to prevent mismatches
      const sId = page.spaceId ? String(page.spaceId) : '';
      const bId = page.bundleId ? String(page.bundleId) : '';
      const aId = page.applicationId ? String(page.applicationId) : '';
      const mId = page.milestoneId || '';
      const dtId = page.documentTypeId ? String(page.documentTypeId) : '';

      const spaceObj = spaces.find(s => String(s._id || s.id) === sId);
      const bundleObj = bundles.find(b => String(b._id || b.id) === bId);
      const appObj = applications.find(a => String(a._id || a.id) === aId);
      const typeObj = docTypes.find(t => String(t._id || t.id) === dtId);

      // Human Labels as per PRD
      const spaceName = spaceObj?.name || 'Unassigned Space';
      const bundleName = bId ? (bundleObj?.name || 'Unknown Cluster') : 'General';
      const appName = aId ? (appObj?.name || 'Unknown App') : 'No App';
      const msName = mId || 'No Milestone';
      const typeName = typeObj?.name || 'Generic Artifact';

      // Sentinel Keys for tree folder IDs
      const spaceKey = sId || '__unassigned_space__';
      const bundleKey = bId || '__general_bundle__';
      const appKey = aId || '__no_app__';
      const msKey = mId || '__no_milestone__';
      const typeKey = dtId || '__generic_type__';

      let path: string[] = [];
      let pathTypes: string[] = [];
      let pathIds: string[] = [];

      switch (hierarchyMode) {
        case HierarchyMode.SPACE_BUNDLE_APP_MILESTONE: 
          path = [spaceName, bundleName, appName, msName]; 
          pathTypes = ['space', 'bundle', 'app', 'milestone'];
          pathIds = [spaceKey, bundleKey, appKey, msKey];
          break;
        case HierarchyMode.BUNDLE_MILESTONE_TYPE: 
          path = [bundleName, msName, typeName]; 
          pathTypes = ['bundle', 'milestone', 'type'];
          pathIds = [bundleKey, msKey, typeKey];
          break;
        case HierarchyMode.BUNDLE_TYPE: 
          path = [bundleName, typeName]; 
          pathTypes = ['bundle', 'type'];
          pathIds = [bundleKey, typeKey];
          break;
        case HierarchyMode.BUNDLE_APP_MILESTONE_TYPE: 
          path = [bundleName, appName, msName, typeName]; 
          pathTypes = ['bundle', 'app', 'milestone', 'type'];
          pathIds = [bundleKey, appKey, msKey, typeKey];
          break;
        case HierarchyMode.APP_MILESTONE_TYPE: 
          path = [appName, msName, typeName]; 
          pathTypes = ['app', 'milestone', 'type'];
          pathIds = [appKey, msKey, typeKey];
          break;
        default:
          path = [spaceName, bundleName, appName, msName]; 
          pathTypes = ['space', 'bundle', 'app', 'milestone'];
          pathIds = [spaceKey, bundleKey, appKey, msKey];
      }
      buildPath(path, pathTypes, pathIds, page);
    });

    // Sort folders: Spaces first, then alphabetical labels
    return tree.sort((a, b) => a.label.localeCompare(b.label));
  }, [pages, spaces, bundles, applications, selSpaceId, selBundleId, selAppId, selMilestone, searchQuery, hierarchyMode, docTypes]);

  const getNodeIcon = (node: any) => {
    if (node.type === 'page') return 'fa-file-lines';
    switch (node.nodeType) {
      case 'space': return 'fa-rocket';
      case 'bundle': return 'fa-boxes-stacked';
      case 'app': return 'fa-cube';
      case 'milestone': return 'fa-flag-checkered';
      case 'type': return 'fa-file-contract';
      default: return 'fa-folder';
    }
  };

  const renderTreeNode = (node: any, depth = 0) => {
    const isPage = node.type === 'page';
    const isExpanded = expandedNodes.has(node.id);
    const isActive = isPage && (String(activePage?._id) === String(node.data?._id) || String(activePage?.id) === String(node.data?.id));
    const iconClass = getNodeIcon(node);

    return (
      <div key={node.id} className="flex flex-col">
        <button 
          onClick={() => isPage ? handlePageSelect(node.data) : setExpandedNodes(prev => { 
            const n = new Set(prev); 
            n.has(node.id) ? n.delete(node.id) : n.add(node.id); 
            return n; 
          })}
          className={`text-left px-3 py-2 flex items-center gap-3 rounded-xl hover:bg-white hover:shadow-sm transition-all group ${isActive ? 'bg-blue-50 text-blue-700 font-bold' : 'text-slate-600'}`} 
          style={{ marginLeft: `${depth * 16}px` }}
        >
          {!isPage && <i className={`fas ${isExpanded ? 'fa-caret-down' : 'fa-caret-right'} w-2 opacity-30`}></i>}
          {isPage && <div className="w-2"></div>}
          <i className={`fas ${iconClass} ${isActive ? 'text-blue-500' : 'text-slate-300 group-hover:text-blue-400'} text-[10px] w-4 text-center transition-colors`}></i>
          <span className="text-[12px] truncate font-medium">{node.label}</span>
        </button>
        {node.children && isExpanded && (
          <div className="flex flex-col">
            {node.children.map((child: any) => renderTreeNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-[500px] bg-white rounded-[2.5rem] border border-slate-100">
      <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
      <p className="text-slate-400 font-bold text-[10px] uppercase tracking-widest animate-pulse">Initializing Wiki Registry...</p>
    </div>
  );

  return (
    <div className="flex h-[800px] bg-white rounded-[3rem] border border-slate-200 shadow-2xl overflow-hidden animate-fadeIn">
      {isSidebarVisible && (
        <aside className="w-80 border-r border-slate-100 flex flex-col bg-slate-50/40 shrink-0">
          <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-white/50 backdrop-blur">
            <h3 className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Registry Navigator</h3>
            <button onClick={() => setIsSidebarVisible(false)} className="text-slate-300 hover:text-slate-500 transition-colors">
              <i className="fas fa-chevron-left"></i>
            </button>
          </div>
          <nav className="flex-1 overflow-y-auto p-4 custom-scrollbar">
            {treeData.length === 0 ? (
               <div className="p-10 text-center">
                 <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-relaxed">No matching artifacts in current scope.</p>
               </div>
            ) : treeData.map((node: any) => renderTreeNode(node))}
          </nav>
          <div className="p-6 border-t border-slate-100 bg-white">
             <button onClick={() => setIsCreating(true)} className="w-full py-3.5 bg-blue-600 text-white text-[10px] font-black rounded-2xl uppercase tracking-widest shadow-xl shadow-blue-500/20 hover:bg-blue-700 active:scale-95 transition-all flex items-center justify-center gap-2">
               <i className="fas fa-plus"></i>
               New Artifact
             </button>
          </div>
        </aside>
      )}

      <main className="flex-1 overflow-y-auto bg-white relative custom-scrollbar">
        {!isSidebarVisible && (
          <button onClick={() => setIsSidebarVisible(true)} className="absolute left-6 top-6 w-10 h-10 rounded-xl bg-white border border-slate-100 flex items-center justify-center text-slate-400 hover:text-blue-600 shadow-sm z-10 transition-all">
            <i className="fas fa-bars"></i>
          </button>
        )}

        {activePage ? (
          <div className="p-16 max-w-5xl mx-auto animate-fadeIn">
             <div className="flex justify-end gap-3 mb-10">
                <button onClick={handleCopyLink} className="px-6 py-2.5 bg-white border border-slate-200 text-slate-600 text-[10px] font-black rounded-xl uppercase tracking-widest hover:bg-slate-50 transition-all flex items-center gap-2">
                   <i className={`fas ${copyFeedback ? 'fa-check text-emerald-500' : 'fa-link'}`}></i>
                   {copyFeedback ? 'URL Copied' : 'Share Link'}
                </button>
                <button onClick={() => setIsEditing(true)} className="px-8 py-2.5 bg-slate-900 text-white text-[10px] font-black rounded-xl uppercase tracking-widest hover:bg-slate-800 transition-all shadow-lg shadow-black/10 flex items-center gap-2">
                   <i className="fas fa-edit"></i>
                   Refine Artifact
                </button>
             </div>
             <WikiPageDisplay page={activePage} onNavigate={handleNavigate} bundles={bundles} applications={applications} />
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center p-20 text-center bg-slate-50/10">
            <div className="w-24 h-24 bg-white rounded-[2.5rem] flex items-center justify-center mb-8 border border-slate-100 shadow-xl shadow-slate-200/50">
               <i className="fas fa-book-open text-slate-100 text-4xl"></i>
            </div>
            <h3 className="text-xl font-black text-slate-800 tracking-tight uppercase">Knowledge Registry</h3>
            <p className="text-slate-400 font-medium max-w-xs mt-3 leading-relaxed">Select a delivery artifact or blueprint from the navigator to begin review.</p>
          </div>
        )}
      </main>

      {isEditing && activePage && (
        <WikiForm 
          id={activePage._id || activePage.id}
          initialTitle={activePage.title}
          initialContent={activePage.content}
          initialSlug={activePage.slug}
          spaceId={activePage.spaceId}
          initialBundleId={activePage.bundleId}
          initialApplicationId={activePage.applicationId}
          initialDocumentTypeId={activePage.documentTypeId}
          initialThemeKey={activePage.themeKey}
          onSaveSuccess={(id) => { setIsEditing(false); refreshPages(id); }}
          onCancel={() => setIsEditing(false)}
          currentUser={currentUser}
          bundles={bundles}
          applications={applications}
        />
      )}

      {isCreating && (
        <CreateWikiPageForm 
          spaceId={selSpaceId === 'all' ? (spaces[0]?._id || spaces[0]?.id || 'default') : selSpaceId}
          allPages={pages}
          currentUser={currentUser}
          onSaveSuccess={(id) => { setIsCreating(false); refreshPages(id); }}
          onCancel={() => setIsCreating(false)}
          bundles={bundles}
          applications={applications}
        />
      )}

      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
      `}</style>
    </div>
  );
};

export default Wiki;
    