import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter, useSearchParams, usePathname } from '../App';
import { WikiPage, WikiAsset, WikiTheme, HierarchyMode, Application, WikiSpace, Bundle, TaxonomyCategory, TaxonomyDocumentType } from '../types';
import WikiForm from './WikiForm';
import CreateWikiPageForm from './CreateWikiPageForm';
import WikiPageDisplay from './WikiPageDisplay';
import WikiAssetDisplay from './WikiAssetDisplay';

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

interface TreeContext {
  spaceId?: string;
  bundleId?: string;
  applicationId?: string;
  milestoneId?: string;
}

const Wiki: React.FC<WikiProps> = ({ 
  currentUser, selSpaceId, selBundleId, selAppId, selMilestone, searchQuery, externalTrigger, onTriggerProcessed, bundles = [], applications = []
}) => {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [spaces, setSpaces] = useState<WikiSpace[]>([]);
  const [themes, setThemes] = useState<WikiTheme[]>([]);
  const [pages, setPages] = useState<WikiPage[]>([]);
  const [assets, setAssets] = useState<WikiAsset[]>([]);
  const [categories, setCategories] = useState<TaxonomyCategory[]>([]);
  const [docTypes, setDocTypes] = useState<TaxonomyDocumentType[]>([]);
  
  const [activeArtifact, setActiveArtifact] = useState<WikiPage | WikiAsset | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isSidebarVisible, setIsSidebarVisible] = useState(true);
  const [copyFeedback, setCopyFeedback] = useState(false);
  
  const [primaryGrouping, setPrimaryGrouping] = useState<'app' | 'type'>('app');
  const [showBundle, setShowBundle] = useState(true);
  const [showDocType, setShowDocType] = useState(true);
  const [showMilestone, setShowMilestone] = useState(true);

  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [contextualMetadata, setContextualMetadata] = useState<TreeContext>({});

  useEffect(() => {
    if (externalTrigger === 'create-wiki-artifact') {
      setIsCreating(true);
      if (onTriggerProcessed) onTriggerProcessed();
    }
  }, [externalTrigger, onTriggerProcessed]);

  const loadAllWikiData = useCallback(async () => {
    setLoading(true);
    try {
      const safeFetch = async (url: string) => {
        try {
          const res = await fetch(url);
          if (!res.ok) return [];
          const data = await res.json();
          return Array.isArray(data) ? data : [];
        } catch (e) {
          console.warn(`Wiki silent fetch fail: ${url}`, e);
          return [];
        }
      };

      const [rawSpaces, rawPages, rawAssets, rawThemes, rawCats, rawTypes] = await Promise.all([
        safeFetch('/api/wiki/spaces'),
        safeFetch('/api/wiki'),
        safeFetch('/api/wiki/assets'),
        safeFetch('/api/wiki/themes?active=true'),
        safeFetch('/api/taxonomy/categories?active=true'),
        safeFetch('/api/taxonomy/document-types?active=true')
      ]);
      
      setSpaces(rawSpaces);
      setPages(rawPages);
      setAssets(rawAssets);
      setThemes(rawThemes);
      setCategories(rawCats);
      setDocTypes(rawTypes);

      const urlArtifactId = searchParams.get('pageId');
      if (!urlArtifactId && rawSpaces.length > 0) {
        const rootIds = rawSpaces.map(s => `space-${String(s._id || s.id)}`);
        setExpandedNodes(new Set(rootIds));
      }
    } catch (e) { 
      console.error("Wiki Critical Init Error", e); 
    } finally { 
      setLoading(false); 
    }
  }, [searchParams]);

  useEffect(() => {
    loadAllWikiData();
  }, []);

  const resolveArtifact = useCallback((target: string, pageList: WikiPage[], assetList: WikiAsset[]): (WikiPage | WikiAsset | null) => {
    if (!target) return null;
    const page = pageList.find(p => String(p._id) === target || String(p.id) === target || p.slug === target);
    if (page) return page;
    const asset = assetList.find(a => String(a._id) === target || String(a.id) === target);
    return asset || null;
  }, []);

  useEffect(() => {
    if (loading || (pages.length === 0 && assets.length === 0)) return;
    const urlId = searchParams.get('pageId');
    if (urlId) {
      const art = resolveArtifact(urlId, pages, assets);
      if (art) {
        setActiveArtifact(art);
        const prefix = ('file' in art) ? 'asset-' : 'page-';
        setSelectedNodeId(`${prefix}${art._id || art.id}`);
        setContextualMetadata({
          spaceId: art.spaceId,
          bundleId: art.bundleId,
          applicationId: art.applicationId,
          milestoneId: art.milestoneId
        });
      }
    }
  }, [searchParams, pages, assets, loading, resolveArtifact]);

  const handleArtifactSelect = (art: WikiPage | WikiAsset) => {
    setActiveArtifact(art);
    const prefix = ('file' in art) ? 'asset-' : 'page-';
    setSelectedNodeId(`${prefix}${art._id || art.id}`);
    setContextualMetadata({
      spaceId: art.spaceId,
      bundleId: art.bundleId,
      applicationId: art.applicationId,
      milestoneId: art.milestoneId
    });
    const params = new URLSearchParams(searchParams.toString());
    params.set('pageId', (('slug' in art && art.slug) || art._id || art.id || '') as string);
    router.push(`?${params.toString()}`);
  };

  const handleFolderSelect = (nodeId: string, context: TreeContext) => {
    setSelectedNodeId(nodeId);
    setContextualMetadata(context);
    setExpandedNodes(prev => { 
      const n = new Set(prev); 
      n.has(nodeId) ? n.delete(nodeId) : n.add(nodeId); 
      return n; 
    });
  };

  const handleCopyLink = () => {
    if (!activeArtifact) return;
    navigator.clipboard.writeText(window.location.href);
    setCopyFeedback(true);
    setTimeout(() => setCopyFeedback(false), 2000);
  };

  const refreshRegistry = async (activeId?: string) => {
    try {
      const [pRes, aRes] = await Promise.all([fetch('/api/wiki'), fetch('/api/wiki/assets')]);
      const newPages = await pRes.json();
      const newAssets = await aRes.json();
      setPages(Array.isArray(newPages) ? newPages : []);
      setAssets(Array.isArray(newAssets) ? newAssets : []);
      if (activeId) {
        const art = resolveArtifact(activeId, newPages, newAssets);
        if (art) setActiveArtifact(art);
      }
    } catch (e) {}
  };

  const treeData = useMemo(() => {
    const allArtifacts = [...pages.map(p => ({ ...p, __type: 'page' })), ...assets.map(a => ({ ...a, __type: 'asset' }))];
    let filtered = allArtifacts;
    
    if (selSpaceId !== 'all') filtered = filtered.filter(p => String(p.spaceId) === String(selSpaceId));
    if (selBundleId !== 'all') filtered = filtered.filter(p => p.bundleId && String(p.bundleId) === String(selBundleId));
    if (selAppId !== 'all') filtered = filtered.filter(p => p.applicationId && String(p.applicationId) === String(selAppId));
    if (selMilestone !== 'all') filtered = filtered.filter(p => p.milestoneId && String(p.milestoneId) === String(selMilestone));
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(p => p.title.toLowerCase().includes(q));
    }

    const tree: any[] = [];
    const findOrCreateNode = (list: any[], id: string, label: string, type: string, context: TreeContext) => {
      let node = list.find(n => n.id === id);
      if (!node) {
        node = { id, label, type: 'folder', nodeType: type, children: [], context };
        list.push(node);
      }
      return node;
    };

    filtered.forEach(art => {
      const sId = art.spaceId || 'unassigned';
      const bId = art.bundleId || 'general';
      const aId = art.applicationId || 'no_app';
      const dtId = art.documentTypeId || 'artifact';
      const msId = art.milestoneId || 'no_milestone';

      const spaceObj = spaces.find(s => String(s._id || s.id) === sId);
      const bundleObj = bundles.find(b => String(b._id || b.id) === bId);
      const appObj = applications.find(a => String(a._id || a.id) === aId);
      const typeObj = docTypes.find(t => String(t._id || t.id) === dtId);

      const spaceName = spaceObj?.name || 'Shared Space';
      const bundleName = bundleObj?.name || 'General';
      const appName = appObj?.name || 'App Context';
      const typeName = typeObj?.name || 'Protocol';
      const milestoneName = msId;

      let currentLevel = tree;
      let path = "";
      const currentContext: TreeContext = { spaceId: sId };

      path += `space-${sId}`;
      const spaceNode = findOrCreateNode(currentLevel, path, spaceName, 'space', { ...currentContext });
      currentLevel = spaceNode.children;

      if (showBundle) {
        path += `:bundle-${bId}`;
        currentContext.bundleId = bId;
        const bundleNode = findOrCreateNode(currentLevel, path, bundleName, 'bundle', { ...currentContext });
        currentLevel = bundleNode.children;
      } else { currentContext.bundleId = bId; }

      const buildMiddle = () => {
        if (primaryGrouping === 'app') {
          path += `:app-${aId}`;
          currentContext.applicationId = aId;
          const appNode = findOrCreateNode(currentLevel, path, appName, 'app', { ...currentContext });
          currentLevel = appNode.children;
          if (showDocType) {
            path += `:type-${dtId}`;
            const typeNode = findOrCreateNode(currentLevel, path, typeName, 'type', { ...currentContext });
            currentLevel = typeNode.children;
          }
        } else {
          if (showDocType) {
            path += `:type-${dtId}`;
            const typeNode = findOrCreateNode(currentLevel, path, typeName, 'type', { ...currentContext });
            currentLevel = typeNode.children;
          }
          path += `:app-${aId}`;
          currentContext.applicationId = aId;
          const appNode = findOrCreateNode(currentLevel, path, appName, 'app', { ...currentContext });
          currentLevel = appNode.children;
        }
      };
      buildMiddle();

      if (showMilestone) {
        path += `:ms-${msId}`;
        currentContext.milestoneId = msId;
        const msNode = findOrCreateNode(currentLevel, path, milestoneName, 'milestone', { ...currentContext });
        currentLevel = msNode.children;
      } else { currentContext.milestoneId = msId; }

      currentLevel.push({
        id: `${art.__type === 'asset' ? 'asset-' : 'page-'}${art._id || art.id}`,
        label: art.title,
        type: art.__type,
        data: art,
        context: { ...currentContext }
      });
    });

    const sortTree = (list: any[]) => {
      list.sort((a, b) => {
        if (a.type !== 'folder' && b.type === 'folder') return 1;
        if (a.type === 'folder' && b.type !== 'folder') return -1;
        return a.label.localeCompare(b.label);
      });
      list.forEach(n => { if (n.children) sortTree(n.children); });
    };
    sortTree(tree);
    return tree;
  }, [pages, assets, spaces, bundles, applications, docTypes, selSpaceId, selBundleId, selAppId, selMilestone, searchQuery, primaryGrouping, showBundle, showDocType, showMilestone]);

  const renderTreeNode = (node: any, depth = 0) => {
    const isArtifact = node.type === 'page' || node.type === 'asset';
    const isExpanded = expandedNodes.has(node.id);
    const isSelected = selectedNodeId === node.id;
    
    const getIcon = () => {
      if (node.type === 'page') return 'fa-file-lines';
      if (node.type === 'asset') {
        const ext = node.data?.file?.ext || '';
        if (ext === 'pdf') return 'fa-file-pdf text-red-500';
        if (['xlsx', 'xls', 'csv'].includes(ext)) return 'fa-file-excel text-emerald-600';
        if (['docx', 'doc'].includes(ext)) return 'fa-file-word text-blue-600';
        if (['pptx', 'ppt'].includes(ext)) return 'fa-file-powerpoint text-orange-500';
        if (['png', 'jpg', 'jpeg', 'gif'].includes(ext)) return 'fa-file-image text-indigo-500';
        return 'fa-file-import';
      }
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
          onClick={() => isArtifact ? handleArtifactSelect(node.data) : handleFolderSelect(node.id, node.context)}
          className={`text-left px-3 py-2 flex items-center gap-3 rounded-xl transition-all group ${isSelected ? 'bg-blue-600 text-white shadow-xl' : 'text-slate-600 hover:bg-slate-100/60'}`} 
          style={{ marginLeft: `${depth * 10}px` }}
        >
          {!isArtifact && <i className={`fas ${isExpanded ? 'fa-caret-down' : 'fa-caret-right'} w-2 opacity-30 text-[10px]`}></i>}
          {isArtifact && <div className="w-2"></div>}
          <i className={`fas ${getIcon()} ${isSelected ? 'text-white' : 'text-slate-300 group-hover:text-blue-400'} text-[10px] w-4 text-center`}></i>
          <span className={`text-[11px] truncate ${isSelected ? 'font-black' : 'font-medium'}`}>{node.label}</span>
        </button>
        {node.children && isExpanded && (
          <div className="flex flex-col">{node.children.map((child: any) => renderTreeNode(child, depth + 1))}</div>
        )}
      </div>
    );
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-[500px] bg-white rounded-[3rem] border border-slate-100">
      <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
      <p className="text-slate-400 font-bold text-[10px] uppercase tracking-widest animate-pulse">Syncing Unified Registry...</p>
    </div>
  );

  return (
    <div className="flex h-[800px] bg-white rounded-[3rem] border border-slate-200 shadow-2xl overflow-hidden animate-fadeIn">
      {isSidebarVisible && (
        <aside className="w-80 border-r border-slate-100 flex flex-col bg-slate-50/30 shrink-0">
          <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-white/50 backdrop-blur">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Nexus Registry</h3>
            <button onClick={() => setIsSidebarVisible(false)} className="text-slate-300 hover:text-slate-500 transition-colors"><i className="fas fa-chevron-left"></i></button>
          </div>

          <div className="px-6 py-5 bg-white border-b border-slate-50 space-y-4">
             <div className="flex flex-col gap-2">
                <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">Organize By</label>
                <select value={primaryGrouping} onChange={(e) => setPrimaryGrouping(e.target.value as any)} className="w-full bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 text-[10px] font-bold text-slate-600 focus:ring-2 focus:ring-blue-500/10 outline-none transition-all">
                  <option value="app">Application → Type</option>
                  <option value="type">Type → Application</option>
                </select>
             </div>
             <div className="grid grid-cols-1 gap-2 pt-2 border-t border-slate-50">
                <HierarchyToggle label="Show Bundles" active={showBundle} onToggle={setShowBundle} />
                <HierarchyToggle label="Show Doc Types" active={showDocType} onToggle={setShowDocType} />
                <HierarchyToggle label="Show Milestones" active={showMilestone} onToggle={setShowMilestone} />
             </div>
          </div>

          <nav className="flex-1 overflow-y-auto p-4 custom-scrollbar">
            {treeData.length === 0 ? <div className="p-10 text-center text-slate-300"><p className="text-[10px] font-bold uppercase tracking-widest">Scope Empty</p></div> : treeData.map((node: any) => renderTreeNode(node))}
          </nav>
          
          <div className="p-6 border-t border-slate-100 bg-white">
             <button
               onClick={() => setIsCreating(true)}
               className="w-full py-4 bg-blue-600 text-white text-[10px] font-black rounded-2xl uppercase tracking-widest shadow-xl shadow-blue-500/20 hover:bg-blue-700 active:scale-95 transition-all flex items-center justify-center gap-2"
             >
               <i className="fas fa-plus"></i> New Artifact
             </button>
          </div>
        </aside>
      )}

      <main className="flex-1 overflow-y-auto bg-white relative custom-scrollbar">
        {!isSidebarVisible && <button onClick={() => setIsSidebarVisible(true)} className="absolute left-6 top-6 w-10 h-10 rounded-xl bg-white border border-slate-100 flex items-center justify-center text-slate-400 hover:text-blue-600 shadow-sm z-10 transition-all"><i className="fas fa-bars"></i></button>}

        {activeArtifact ? (
          <div className="p-16 max-w-5xl mx-auto animate-fadeIn">
             <div className="flex justify-end gap-3 mb-10">
                <button onClick={handleCopyLink} className="px-6 py-2.5 bg-white border border-slate-200 text-slate-600 text-[10px] font-black rounded-xl uppercase tracking-widest hover:bg-slate-50 transition-all flex items-center gap-2">
                   <i className={`fas ${copyFeedback ? 'fa-check text-emerald-500' : 'fa-link'}`}></i>
                   {copyFeedback ? 'Link Ready' : 'Share Artifact'}
                </button>
                {('content' in activeArtifact) && (
                  <button onClick={() => setIsEditing(true)} className="px-8 py-2.5 bg-slate-900 text-white text-[10px] font-black rounded-xl uppercase tracking-widest hover:bg-slate-800 transition-all shadow-lg shadow-black/10 flex items-center gap-2">
                     <i className="fas fa-edit"></i> Refine Artifact
                  </button>
                )}
             </div>
             {('file' in activeArtifact) ? (
               <WikiAssetDisplay asset={activeArtifact as WikiAsset} bundles={bundles} applications={applications} />
             ) : (
               <WikiPageDisplay page={activeArtifact as WikiPage} bundles={bundles} applications={applications} />
             )}
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center p-20 text-center bg-slate-50/10">
            <div className="w-24 h-24 bg-white rounded-[2.5rem] flex items-center justify-center mb-8 border border-slate-100 shadow-xl shadow-slate-200/50"><i className="fas fa-book-open text-slate-100 text-4xl"></i></div>
            <h3 className="text-xl font-black text-slate-800 tracking-tight uppercase">Unified Registry</h3>
            <p className="text-slate-400 font-medium max-w-xs mt-3 leading-relaxed">Select a delivery artifact, blueprint, or document from the navigator to begin review.</p>
          </div>
        )}
      </main>

      {isEditing && activeArtifact && ('content' in activeArtifact) && (
        <WikiForm id={activeArtifact._id} initialTitle={activeArtifact.title} initialContent={activeArtifact.content} initialSlug={activeArtifact.slug} spaceId={activeArtifact.spaceId} initialBundleId={activeArtifact.bundleId} initialApplicationId={activeArtifact.applicationId} initialDocumentTypeId={activeArtifact.documentTypeId} initialThemeKey={activeArtifact.themeKey} onSaveSuccess={(id) => { setIsEditing(false); refreshRegistry(id); }} onCancel={() => setIsEditing(false)} currentUser={currentUser} bundles={bundles} applications={applications} />
      )}

      {isCreating && (
        <CreateWikiPageForm
          spaceId={contextualMetadata.spaceId || (spaces[0]?._id || 'default')}
          initialBundleId={contextualMetadata.bundleId}
          initialApplicationId={contextualMetadata.applicationId}
          initialMilestoneId={contextualMetadata.milestoneId}
          allPages={pages}
          currentUser={currentUser}
          onSaveSuccess={(id) => { setIsCreating(false); refreshRegistry(id); }}
          onCancel={() => setIsCreating(false)}
          bundles={bundles}
          applications={applications}
        />
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
      `}} />
    </div>
  );
};

const HierarchyToggle: React.FC<{ label: string; active: boolean; onToggle: (v: boolean) => void }> = ({ label, active, onToggle }) => (
  <button onClick={() => onToggle(!active)} className="flex items-center justify-between group py-1">
     <span className={`text-[9px] font-bold uppercase tracking-tight transition-colors ${active ? 'text-slate-600' : 'text-slate-300'}`}>{label}</span>
     <div className={`w-6 h-3 rounded-full relative transition-all ${active ? 'bg-blue-600' : 'bg-slate-200'}`}>
        <div className={`absolute top-0.5 w-2 h-2 bg-white rounded-full transition-all ${active ? 'left-3.5' : 'left-0.5'}`} />
     </div>
  </button>
);

export default Wiki;
