import React, { useState, useEffect, useMemo, useCallback } from 'react';
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

  // 1. Initial Data Fetch (Only on Mount)
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [spRes, pgRes, thRes, catRes, typRes] = await Promise.all([
          fetch('/api/wiki/spaces'),
          fetch('/api/wiki'),
          fetch('/api/wiki/themes?active=true'),
          fetch('/api/taxonomy/categories?active=true'),
          fetch('/api/taxonomy/document-types?active=true')
        ]);
        
        const rawSpaces = await spRes.json();
        const pagesData = await pgRes.json();
        const themesData = await thRes.json();
        const categoriesData = await catRes.json();
        const typesData = await typRes.json();
        
        const validSpaces = Array.isArray(rawSpaces) ? rawSpaces : [];
        const validPages = Array.isArray(pagesData) ? pagesData : [];
        
        const spaceMap = new Map<string, WikiSpace>();
        validSpaces.forEach(s => {
          const id = String(s._id || s.id);
          if (!spaceMap.has(id)) spaceMap.set(id, s);
        });
        const uniqueSpaces = Array.from(spaceMap.values());
        
        setSpaces(uniqueSpaces);
        setPages(validPages);
        setThemes(Array.isArray(themesData) ? themesData : []);
        setCategories(Array.isArray(categoriesData) ? categoriesData : []);
        setDocTypes(Array.isArray(typesData) ? typesData : []);

        const urlPageId = searchParams.get('pageId');
        if (!urlPageId) {
          const rootIds = uniqueSpaces.map(s => `folder-space-${String(s._id || s.id)}`);
          setExpandedNodes(new Set(rootIds));
        }
      } catch (e) { 
        console.error("Wiki Init Error", e); 
      } finally { 
        setLoading(false); 
      }
    };
    fetchData();
  }, []);

  const resolvePage = useCallback((target: string, pageList: WikiPage[]): WikiPage | null => {
    if (!target || !Array.isArray(pageList)) return null;
    return pageList.find(p => 
      String(p._id) === target || 
      String(p.id) === target || 
      p.slug === target
    ) || null;
  }, []);

  // 2. Sync Active Page with URL and Expand Parents
  useEffect(() => {
    if (loading || !Array.isArray(pages) || pages.length === 0) return;

    const urlPageId = searchParams.get('pageId');
    if (urlPageId) {
      const page = resolvePage(urlPageId, pages);
      if (page) {
        setActivePage(page);
        
        const sId = page.spaceId ? String(page.spaceId) : 'unassigned';
        const bId = page.bundleId ? String(page.bundleId) : 'general';
        const aId = page.applicationId ? String(page.applicationId) : 'no_app';
        const mId = page.milestoneId || 'no_milestone';

        setExpandedNodes(prev => {
          const next = new Set(prev);
          next.add(`folder-space-${sId}`);
          next.add(`folder-bundle-${sId}-${bId}`);
          next.add(`folder-app-${sId}-${bId}-${aId}`);
          next.add(`folder-ms-${sId}-${bId}-${aId}-${mId}`);
          return next;
        });
      }
    }
  }, [searchParams, pages, loading, resolvePage]);

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
    const validPages = Array.isArray(newPages) ? newPages : [];
    setPages(validPages);
    if (activeId) {
      const updated = resolvePage(activeId, validPages);
      if (updated) setActivePage(updated);
    }
  };

  const treeData = useMemo(() => {
    if (!Array.isArray(pages) || !Array.isArray(spaces)) return [];
    
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
    const getFolder = (list: any[], label: string, type: string, id: string) => {
      let node = list.find(n => n.id === id);
      if (!node) {
        node = { id, label, type: 'folder', nodeType: type, children: [] };
        list.push(node);
      }
      return node;
    };

    filtered.forEach(page => {
      const sId = page.spaceId ? String(page.spaceId) : 'unassigned';
      const bId = page.bundleId ? String(page.bundleId) : 'general';
      const aId = page.applicationId ? String(page.applicationId) : 'no_app';
      const mId = page.milestoneId || 'no_milestone';
      const dtId = page.documentTypeId ? String(page.documentTypeId) : 'artifact';

      const spaceObj = spaces.find(s => String(s._id || s.id) === sId);
      const bundleObj = bundles.find(b => String(b._id || b.id) === bId);
      const appObj = applications.find(a => String(a._id || a.id) === aId);
      const typeObj = docTypes.find(t => String(t._id || t.id) === dtId);

      const spaceName = spaceObj?.name || (sId === 'unassigned' ? 'Shared Registry' : 'Unknown Space');
      const bundleName = bId === 'general' ? 'General' : (bundleObj?.name || 'Unknown Cluster');
      const appName = aId === 'no_app' ? 'No App' : (appObj?.name || 'Unknown App');
      const msName = mId === 'no_milestone' ? 'No Milestone' : mId;
      const typeName = typeObj?.name || 'Artifact';

      let currentLevel = tree;
      const addNode = (label: string, type: string, id: string) => {
        const folder = getFolder(currentLevel, label, type, id);
        currentLevel = folder.children;
      };

      if (hierarchyMode === HierarchyMode.SPACE_BUNDLE_APP_MILESTONE) {
        addNode(spaceName, 'space', `folder-space-${sId}`);
        addNode(bundleName, 'bundle', `folder-bundle-${sId}-${bId}`);
        addNode(appName, 'app', `folder-app-${sId}-${bId}-${aId}`);
        addNode(msName, 'milestone', `folder-ms-${sId}-${bId}-${aId}-${mId}`);
      } else if (hierarchyMode === HierarchyMode.BUNDLE_MILESTONE_TYPE) {
        addNode(bundleName, 'bundle', `folder-bundle-${bId}`);
        addNode(msName, 'milestone', `folder-ms-${bId}-${mId}`);
        addNode(typeName, 'type', `folder-type-${bId}-${mId}-${dtId}`);
      } else {
        addNode(spaceName, 'space', `folder-space-${sId}`);
        addNode(bundleName, 'bundle', `folder-bundle-${sId}-${bId}`);
        addNode(appName, 'app', `folder-app-${sId}-${bId}-${aId}`);
      }

      currentLevel.push({
        id: `page-${page._id || page.id}`,
        label: page.title,
        type: 'page',
        data: page
      });
    });

    const sortTree = (list: any[]) => {
      list.sort((a, b) => {
        if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
        return a.label.localeCompare(b.label);
      });
      list.forEach(n => { if (n.children) sortTree(n.children); });
    };
    sortTree(tree);
    return tree;
  }, [pages, spaces, bundles, applications, selSpaceId, selBundleId, selAppId, selMilestone, searchQuery, hierarchyMode, docTypes]);

  const renderTreeNode = (node: any, depth = 0) => {
    const isPage = node.type === 'page';
    const isExpanded = expandedNodes.has(node.id);
    const isActive = isPage && (String(activePage?._id) === String(node.data?._id) || String(activePage?.id) === String(node.data?.id));
    
    const getIcon = () => {
      if (isPage) return 'fa-file-lines';
      switch (node.nodeType) {
        case 'space': return 'fa-rocket';
        case 'bundle': return 'fa-boxes-stacked';
        case 'app': return 'fa-cube';
        case 'milestone': return 'fa-flag-checkered';
        case 'type': return 'fa-file-contract';
        default: return 'fa-folder';
      }
    };

    return (
      <div key={node.id} className="flex flex-col">
        <button 
          onClick={() => isPage ? handlePageSelect(node.data) : setExpandedNodes(prev => { 
            const n = new Set(prev); 
            n.has(node.id) ? n.delete(node.id) : n.add(node.id); 
            return n; 
          })}
          className={`text-left px-3 py-2 flex items-center gap-3 rounded-xl hover:bg-white hover:shadow-sm transition-all group ${isActive ? 'bg-blue-50 text-blue-700 font-bold' : 'text-slate-600'}`} 
          style={{ marginLeft: `${depth * 12}px` }}
        >
          {!isPage && <i className={`fas ${isExpanded ? 'fa-caret-down' : 'fa-caret-right'} w-2 opacity-30 text-[10px]`}></i>}
          {isPage && <div className="w-2"></div>}
          <i className={`fas ${getIcon()} ${isActive ? 'text-blue-500' : 'text-slate-300 group-hover:text-blue-400'} text-[10px] w-4 text-center`}></i>
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
    <div className="flex flex-col items-center justify-center h-[500px] bg-white rounded-[3rem] border border-slate-100">
      <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
      <p className="text-slate-400 font-bold text-[10px] uppercase tracking-widest animate-pulse">Initializing Wiki...</p>
    </div>
  );

  return (
    <div className="flex h-[800px] bg-white rounded-[3rem] border border-slate-200 shadow-2xl overflow-hidden animate-fadeIn">
      {isSidebarVisible && (
        <aside className="w-80 border-r border-slate-100 flex flex-col bg-slate-50/30 shrink-0">
          <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-white/50 backdrop-blur">
            <h3 className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Registry Navigator</h3>
            <button onClick={() => setIsSidebarVisible(false)} className="text-slate-300 hover:text-slate-500 transition-colors">
              <i className="fas fa-chevron-left"></i>
            </button>
          </div>
          <nav className="flex-1 overflow-y-auto p-4 custom-scrollbar">
            {treeData.length === 0 ? (
               <div className="p-10 text-center">
                 <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-relaxed">No artifacts in current scope.</p>
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

      {/* Fix: Replaced style jsx with standard style tag and dangerouslySetInnerHTML for compatibility */}
      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
      `}} />
    </div>
  );
};

export default Wiki;