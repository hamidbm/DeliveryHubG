
import React, { useState, useEffect, useMemo } from 'react';
import { WorkItem, WorkItemType, WorkItemStatus, Bundle, Application } from '../types';
import WorkItemDetails from './WorkItemDetails';
import CreateWorkItemModal from './CreateWorkItemModal';
import { useSearchParams } from '../App';

interface WorkItemsTreeViewProps {
  applications: Application[];
  bundles: Bundle[];
  selBundleId: string;
  selAppId: string;
  selMilestone: string;
  selEpicId: string;
  searchQuery: string;
  quickFilter?: string;
  activeFilters?: { types: string[]; priorities: string[]; health: string[] };
  includeArchived?: boolean;
  externalTrigger?: string | null;
  onTriggerProcessed?: () => void;
}

const WorkItemsTreeView: React.FC<WorkItemsTreeViewProps> = ({ 
  applications, bundles, selBundleId, selAppId, selMilestone, selEpicId, searchQuery, quickFilter, activeFilters, includeArchived, externalTrigger, onTriggerProcessed 
}) => {
  const searchParams = useSearchParams();
  const [treeData, setTreeData] = useState<any[]>([]);
  const [activeItem, setActiveItem] = useState<WorkItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [treeMode, setTreeMode] = useState<'hierarchy' | 'milestone'>('hierarchy');
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [isCreating, setIsCreating] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const deepLinkThreadId = searchParams.get('threadId');
  const deepLinkWorkItemId = searchParams.get('workItemId');

  useEffect(() => {
    if (externalTrigger === 'create-item') {
      setIsCreating(true);
      onTriggerProcessed?.();
    }
  }, [externalTrigger, onTriggerProcessed]);

  useEffect(() => {
    const workItemId = searchParams.get('workItemId');
    if (!workItemId) return;
    const load = async () => {
      try {
        const res = await fetch(`/api/work-items/${encodeURIComponent(workItemId)}`);
        if (!res.ok) return;
        const data = await res.json();
        setActiveItem(data);
        const nodeKey = String(data._id || data.id || workItemId);
        setSelectedNodeId(nodeKey);
        if (data.parentId) {
          const expandIds: string[] = [];
          let currentId = String(data.parentId);
          const seen = new Set<string>();
          while (currentId && !seen.has(currentId)) {
            seen.add(currentId);
            expandIds.push(currentId);
            try {
              const parentRes = await fetch(`/api/work-items/${encodeURIComponent(currentId)}`);
              if (!parentRes.ok) break;
              const parent = await parentRes.json();
              if (!parent?.parentId) break;
              currentId = String(parent.parentId);
            } catch {
              break;
            }
          }
          if (expandIds.length) {
            setExpandedNodes(prev => {
              const next = new Set(prev);
              expandIds.forEach(id => next.add(id));
              return next;
            });
          }
        }
      } catch {}
    };
    load();
  }, [searchParams]);

  const fetchTree = async () => {
    setLoading(true);
    const params = new URLSearchParams({
      bundleId: selBundleId, applicationId: selAppId, milestoneId: selMilestone, q: searchQuery, treeMode
    });
    if (selEpicId !== 'all') params.set('epicId', selEpicId);
    if (quickFilter) params.set('quickFilter', quickFilter);
    if (activeFilters?.types?.length) params.set('types', activeFilters.types.join(','));
    if (activeFilters?.priorities?.length) params.set('priorities', activeFilters.priorities.join(','));
    if (activeFilters?.health?.length) params.set('health', activeFilters.health.join(','));
    if (includeArchived) params.set('includeArchived', 'true');

    try {
      const res = await fetch(`/api/work-items/tree?${params.toString()}`);
      const data = await res.json();
      setTreeData(data);
      if (expandedNodes.size === 0 && data.length > 0) setExpandedNodes(new Set(data.map((n: any) => n.id)));
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchTree(); }, [selBundleId, selAppId, selMilestone, selEpicId, searchQuery, treeMode, quickFilter]);

  const handleNodeSelect = async (node: any) => {
    if (node.nodeType === 'WORK_ITEM') {
      try {
        const res = await fetch(`/api/work-items/${node.workItemId}`);
        if (!res.ok) {
          setActiveItem(null);
          return;
        }
        const data = await res.json();
        setActiveItem(data);
      } catch (err) { console.error("Node fetch failed", err); }
    }
  };

  const expandAll = () => {
    const allIds: string[] = [];
    const collect = (nodes: any[]) => nodes.forEach(n => { if (n.children?.length > 0) { allIds.push(n.id); collect(n.children); } });
    collect(treeData);
    setExpandedNodes(new Set(allIds));
  };

  const collapseAll = () => setExpandedNodes(new Set());

  const getIcon = (type: any) => {
    switch (type) {
      case 'MILESTONE': return 'fa-flag-checkered text-emerald-500';
      case WorkItemType.EPIC: return 'fa-layer-group text-purple-500';
      case WorkItemType.FEATURE: return 'fa-star text-amber-500';
      case WorkItemType.STORY: return 'fa-file-lines text-blue-500';
      case WorkItemType.TASK: return 'fa-check text-slate-400';
      case WorkItemType.BUG: return 'fa-bug text-red-500';
      case WorkItemType.RISK: return 'fa-triangle-exclamation text-rose-500';
      case WorkItemType.DEPENDENCY: return 'fa-link text-indigo-500';
      default: return 'fa-circle text-slate-300';
    }
  };

  const getStatusDot = (status?: string) => {
    switch (status) {
      case WorkItemStatus.DONE:
        return 'bg-emerald-500';
      case WorkItemStatus.IN_PROGRESS:
        return 'bg-blue-500';
      case WorkItemStatus.BLOCKED:
        return 'bg-red-500';
      case WorkItemStatus.REVIEW:
        return 'bg-amber-500';
      default:
        return 'bg-slate-300';
    }
  };

  const handleQuickAdd = (node: any) => {
    if (node.nodeType === 'WORK_ITEM') {
      handleNodeSelect(node);
      setIsCreating(true);
    }
  };

  const toggleFlag = async (node: any) => {
    if (node.nodeType !== 'WORK_ITEM') return;
    try {
      await fetch(`/api/work-items/${node.workItemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isFlagged: !node.isFlagged })
      });
      fetchTree();
    } catch {}
  };

  const getAllowedParentType = (childType?: WorkItemType) => {
    if (childType === WorkItemType.FEATURE) return WorkItemType.EPIC;
    if (childType === WorkItemType.STORY) return WorkItemType.FEATURE;
    if (childType === WorkItemType.TASK || childType === WorkItemType.BUG || childType === WorkItemType.RISK || childType === WorkItemType.DEPENDENCY) return WorkItemType.STORY;
    return null;
  };

  const handleDragStart = (e: React.DragEvent, node: any) => {
    if (node.nodeType !== 'WORK_ITEM') return;
    const payload = { id: node.workItemId, type: node.type };
    e.dataTransfer.setData('application/json', JSON.stringify(payload));
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDrop = async (e: React.DragEvent, target: any) => {
    e.preventDefault();
    if (target.nodeType !== 'WORK_ITEM') return;
    const raw = e.dataTransfer.getData('application/json');
    if (!raw) return;
    try {
      const dragged = JSON.parse(raw);
      if (!dragged?.id || dragged.id === target.workItemId) return;
      const allowedParent = getAllowedParentType(dragged.type);
      if (!allowedParent || allowedParent !== target.type) return;
      await fetch(`/api/work-items/${dragged.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parentId: target.workItemId })
      });
      fetchTree();
    } catch {}
  };

  const renderTreeNode = (node: any, depth = 0) => {
    const isExpanded = expandedNodes.has(node.id);
    const hasChildren = node.children && node.children.length > 0;
    const nodeKey = node.nodeType === 'WORK_ITEM' ? String(node.workItemId) : String(node.id);
    const isActive = selectedNodeId ? selectedNodeId === nodeKey : (activeItem && (activeItem._id === node.workItemId || activeItem.id === node.workItemId));
    const linkBadges = Array.from(
      new Set((node.links || []).map((l: any) => String(l.type)).filter(Boolean))
    ).slice(0, 3) as string[];

    return (
      <div key={node.id} className="flex flex-col">
        <button
          draggable={node.nodeType === 'WORK_ITEM'}
          onDragStart={(e) => handleDragStart(e, node)}
          onDragOver={(e) => {
            if (node.nodeType === 'WORK_ITEM') e.preventDefault();
          }}
          onDrop={(e) => handleDrop(e, node)}
          onClick={() => {
            setSelectedNodeId(nodeKey);
            if (hasChildren) setExpandedNodes(prev => { const n = new Set(prev); n.has(node.id) ? n.delete(node.id) : n.add(node.id); return n; });
            handleNodeSelect(node);
          }}
          className={`flex items-center gap-3 px-3 py-2 rounded-2xl transition-all text-left group border border-transparent mb-1 ${
            isActive ? 'bg-blue-600 text-white shadow-xl shadow-blue-500/20' : 'hover:bg-white hover:shadow-sm text-slate-600 hover:border-slate-100'
          }`}
          style={{ marginLeft: `${depth * 14}px` }}
        >
          <div className="w-4 flex justify-center shrink-0">
            {hasChildren ? <i className={`fas fa-caret-${isExpanded ? 'down' : 'right'} text-[12px] opacity-40`}></i> : <div className="w-1 h-1 bg-slate-200 rounded-full"></div>}
          </div>
          <div className="relative shrink-0">
            <i className={`fas ${getIcon(node.type)} text-lg ${isActive ? 'text-white' : ''}`}></i>
            {node.status && (
              <span className={`absolute -bottom-1 -right-1 w-2 h-2 rounded-full border-2 border-white ${getStatusDot(node.status)}`}></span>
            )}
            {node.isFlagged && (
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-white animate-pulse" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <span className={`text-sm font-black truncate block tracking-tight ${isActive ? 'text-white' : 'text-slate-800'}`}>{node.label}</span>
            {linkBadges.length > 0 && (
              <div className="flex items-center gap-1 mt-1 flex-wrap">
                {linkBadges.map((t) => (
                  <span
                    key={t}
                    className={`text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded border ${
                      isActive ? 'bg-white/15 text-white border-white/20' : 'bg-slate-50 text-slate-500 border-slate-100'
                    }`}
                  >
                    {t.replace(/_/g, ' ')}
                  </span>
                ))}
              </div>
            )}
            {hasChildren && node.completion !== undefined && (
              <div className="flex items-center gap-2 mt-1">
                <div className={`h-1 flex-1 rounded-full overflow-hidden ${isActive ? 'bg-white/20' : 'bg-slate-100 shadow-inner'}`}>
                  <div className={`h-full transition-all duration-700 ${isActive ? 'bg-white' : 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]'}`} style={{ width: `${node.completion}%` }}></div>
                </div>
                <span className={`text-[8px] font-black uppercase ${isActive ? 'text-white/60' : 'text-slate-400'}`}>{node.completion}%</span>
              </div>
            )}
          </div>
          {node.status && !hasChildren && (
             <span className={`shrink-0 text-[8px] font-black px-2 py-0.5 rounded uppercase tracking-wider border ${
               isActive ? 'bg-white/20 border-white/30 text-white' :
               node.status === WorkItemStatus.DONE ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
               node.status === WorkItemStatus.IN_PROGRESS ? 'bg-blue-50 text-blue-700 border-blue-100' :
               'bg-slate-50 text-slate-500 border-slate-100'
             }`}>{node.status.replace('_', ' ')}</span>
          )}
          {node.nodeType === 'WORK_ITEM' && (
            <div className={`ml-auto items-center gap-2 ${isActive ? 'flex' : 'hidden group-hover:flex'}`}>
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => { e.stopPropagation(); handleQuickAdd(node); }}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); handleQuickAdd(node); } }}
                className={`w-6 h-6 rounded-lg flex items-center justify-center text-[10px] transition-all cursor-pointer ${
                  isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-400 hover:text-blue-600'
                }`}
                title="Add child"
                aria-label="Add child"
              >
                <i className="fas fa-plus"></i>
              </span>
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => { e.stopPropagation(); toggleFlag(node); }}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); toggleFlag(node); } }}
                className={`w-6 h-6 rounded-lg flex items-center justify-center text-[10px] transition-all cursor-pointer ${
                  isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-400 hover:text-red-500'
                }`}
                title={node.isFlagged ? 'Clear flag' : 'Raise flag'}
                aria-label="Toggle flag"
              >
                <i className={`fas ${node.isFlagged ? 'fa-flag' : 'fa-flag-checkered'}`}></i>
              </span>
            </div>
          )}
        </button>
        {isExpanded && node.children && <div className="flex flex-col">{node.children.map((child: any) => renderTreeNode(child, depth + 1))}</div>}
      </div>
    );
  };

  const getSubArtifactType = (type?: string): WorkItemType => {
    if (type === WorkItemType.EPIC) return WorkItemType.FEATURE;
    if (type === WorkItemType.FEATURE) return WorkItemType.STORY;
    return WorkItemType.TASK;
  };

  return (
    <div className="flex h-[800px] bg-white rounded-[3rem] border border-slate-200 shadow-2xl overflow-hidden animate-fadeIn">
      <aside className="w-[450px] border-r border-slate-100 flex flex-col bg-slate-50/30 shrink-0">
        <header className="sticky top-0 z-10 p-8 border-b border-slate-100 bg-white/90 backdrop-blur shrink-0 space-y-6">
          <div className="flex items-center justify-between gap-4">
             <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Work Hierarchy</h3>
             <div className="flex items-center gap-2">
               <div className="flex bg-slate-200 p-0.5 rounded-xl">
                  <button onClick={() => setTreeMode('hierarchy')} className={`px-4 py-2 text-[10px] font-black uppercase rounded-lg transition-all ${treeMode === 'hierarchy' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-400'}`}>Delivery</button>
                  <button onClick={() => setTreeMode('milestone')} className={`px-4 py-2 text-[10px] font-black uppercase rounded-lg transition-all ${treeMode === 'milestone' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-400'}`}>Milestone</button>
               </div>
               <div className="flex items-center gap-1">
                 <button
                   onClick={expandAll}
                   className="w-8 h-8 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-all flex items-center justify-center"
                   title="Expand all"
                   aria-label="Expand all"
                 >
                   <img src="/icons/expand.gif" alt="" className="w-4 h-4" />
                 </button>
                 <button
                   onClick={collapseAll}
                   className="w-8 h-8 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-all flex items-center justify-center"
                   title="Collapse all"
                   aria-label="Collapse all"
                 >
                   <img src="/icons/collapse.gif" alt="" className="w-4 h-4" />
                 </button>
               </div>
             </div>
          </div>
        </header>

        <nav className="flex-1 overflow-y-auto p-6 custom-scrollbar">{loading ? <div className="space-y-4">{[...Array(8)].map((_, i) => <div key={i} className="h-12 bg-slate-100 rounded-2xl animate-pulse" style={{ opacity: 1 - i * 0.1 }}></div>)}</div> : treeData.length === 0 ? <div className="p-10 text-center"><i className="fas fa-search text-slate-200 text-5xl mb-6 opacity-50"></i><p className="text-sm font-bold text-slate-400 uppercase tracking-widest leading-relaxed">No items match current criteria.</p></div> : <div className="space-y-0">{treeData.map(node => renderTreeNode(node))}</div>}</nav>
        
        <div className="p-6 bg-white border-t border-slate-100">
           <button onClick={() => setIsCreating(true)} className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-blue-600/20 hover:bg-blue-700 transition-all flex items-center justify-center gap-2 group/add"><i className="fas fa-plus group-hover/add:rotate-90 transition-transform"></i>{activeItem ? `Spawn ${getSubArtifactType(activeItem.type)}` : 'New Artifact'}</button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto bg-white relative custom-scrollbar">
        {activeItem ? (
          <WorkItemDetails
            key={(activeItem._id || activeItem.id) as string}
            item={activeItem}
            bundles={bundles}
            applications={applications}
            onUpdate={fetchTree}
            onClose={() => setActiveItem(null)}
            initialActiveTab={deepLinkThreadId && deepLinkWorkItemId && String(activeItem._id || activeItem.id) === String(deepLinkWorkItemId) ? 'comments' : undefined}
            initialThreadId={deepLinkThreadId && deepLinkWorkItemId && String(activeItem._id || activeItem.id) === String(deepLinkWorkItemId) ? deepLinkThreadId : null}
          />
        ) : (
          <div className="h-full flex flex-col items-center justify-center p-20 text-center bg-slate-50/10">
            <div className="w-24 h-24 bg-white rounded-[2.5rem] flex items-center justify-center mb-8 border border-slate-100 shadow-xl shadow-slate-200/50"><i className="fas fa-tasks text-slate-100 text-4xl"></i></div>
            <h3 className="text-xl font-black text-slate-800 tracking-tight uppercase">Hierarchy Explorer</h3>
            <p className="text-slate-400 font-medium max-w-xs mt-3 leading-relaxed">Select an artifact to view implementation details and status roll-ups.</p>
          </div>
        )}
      </main>

      {isCreating && <CreateWorkItemModal bundles={bundles} applications={applications} initialBundleId={activeItem?.bundleId || (selBundleId !== 'all' ? selBundleId : '')} initialAppId={activeItem?.applicationId || (selAppId !== 'all' ? selAppId : '')} initialParentId={activeItem?._id || activeItem?.id} initialType={getSubArtifactType(activeItem?.type)} onClose={() => setIsCreating(false)} onSuccess={(item) => { setIsCreating(false); fetchTree(); handleNodeSelect({ nodeType: 'WORK_ITEM', workItemId: item.insertedId || item.id }); }} />}
    </div>
  );
};

export default WorkItemsTreeView;
