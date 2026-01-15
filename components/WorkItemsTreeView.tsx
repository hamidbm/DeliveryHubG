
import React, { useState, useEffect } from 'react';
import { WorkItem, WorkItemType, WorkItemStatus, Bundle, Application } from '../types';
import WorkItemDetails from './WorkItemDetails';
import CreateWorkItemModal from './CreateWorkItemModal';

interface WorkItemsTreeViewProps {
  applications: Application[];
  bundles: Bundle[];
  selBundleId: string;
  selAppId: string;
  selMilestone: string;
  selEpicId: string;
  searchQuery: string;
  quickFilter?: string;
  externalTrigger?: string | null;
  onTriggerProcessed?: () => void;
}

const WorkItemsTreeView: React.FC<WorkItemsTreeViewProps> = ({ 
  applications, bundles, selBundleId, selAppId, selMilestone, selEpicId, searchQuery, quickFilter, externalTrigger, onTriggerProcessed 
}) => {
  const [treeData, setTreeData] = useState<any[]>([]);
  const [activeItem, setActiveItem] = useState<WorkItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [treeMode, setTreeMode] = useState<'hierarchy' | 'milestone'>('hierarchy');
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    if (externalTrigger === 'create-item') {
      setIsCreating(true);
      onTriggerProcessed?.();
    }
  }, [externalTrigger, onTriggerProcessed]);

  const fetchTree = async () => {
    setLoading(true);
    const params = new URLSearchParams({
      bundleId: selBundleId,
      applicationId: selAppId,
      milestoneId: selMilestone,
      q: searchQuery,
      treeMode
    });
    if (selEpicId !== 'all') params.set('epicId', selEpicId);
    if (quickFilter) params.set('quickFilter', quickFilter);

    try {
      const res = await fetch(`/api/work-items/tree?${params.toString()}`);
      const data = await res.json();
      setTreeData(data);
    } catch (err) {
      console.error("Failed to fetch tree", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTree();
  }, [selBundleId, selAppId, selMilestone, selEpicId, searchQuery, treeMode, quickFilter]);

  const handleNodeSelect = async (node: any) => {
    if (node.nodeType === 'WORK_ITEM') {
      try {
        const res = await fetch(`/api/work-items/${node.workItemId}`);
        const data = await res.json();
        setActiveItem(data);
      } catch (err) {
        console.error("Failed to fetch item", err);
      }
    }
  };

  const getIcon = (type: any) => {
    switch (type) {
      case 'MILESTONE': return 'fa-flag-checkered text-emerald-500';
      case WorkItemType.EPIC: return 'fa-layer-group text-purple-500';
      case WorkItemType.FEATURE: return 'fa-star text-amber-500';
      case WorkItemType.STORY: return 'fa-file-lines text-blue-500';
      case WorkItemType.TASK: return 'fa-check text-slate-400';
      case WorkItemType.BUG: return 'fa-bug text-red-500';
      default: return 'fa-circle text-slate-300';
    }
  };

  const renderTreeNode = (node: any, depth = 0) => {
    const isExpanded = expandedNodes.has(node.id);
    const hasChildren = node.children && node.children.length > 0;
    const isActive = activeItem && (activeItem._id === node.workItemId || activeItem.id === node.workItemId);

    return (
      <div key={node.id} className="flex flex-col">
        <button
          onClick={() => {
            if (hasChildren) {
              setExpandedNodes(prev => {
                const next = new Set(prev);
                next.has(node.id) ? next.delete(node.id) : next.add(node.id);
                return next;
              });
            }
            handleNodeSelect(node);
          }}
          className={`flex items-center gap-3 px-3 py-1 rounded-xl transition-all text-left ${
            isActive ? 'bg-blue-50 text-blue-700 ring-1 ring-blue-100' : 'hover:bg-slate-50 text-slate-600'
          }`}
          style={{ marginLeft: `${depth * 14}px` }}
        >
          <div className="w-4 flex justify-center shrink-0">
            {hasChildren ? (
              <i className={`fas fa-caret-${isExpanded ? 'down' : 'right'} text-[12px] opacity-40`}></i>
            ) : (
              <div className="w-1 h-1 bg-slate-200 rounded-full"></div>
            )}
          </div>
          <i className={`fas ${getIcon(node.type)} text-xl shrink-0`}></i>
          <span className={`text-base font-semibold truncate ${isActive ? 'text-blue-800' : 'text-slate-700'}`}>
            {node.label}
          </span>
          {node.status && (
             <span className={`ml-auto text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider border ${
               node.status === WorkItemStatus.DONE || node.status === 'Released' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' :
               node.status === WorkItemStatus.IN_PROGRESS || node.status === 'Active' ? 'bg-blue-100 text-blue-700 border-blue-200' :
               'bg-slate-100 text-slate-500 border-slate-200'
             }`}>
               {node.status}
             </span>
          )}
        </button>
        {isExpanded && node.children && (
          <div className="flex flex-col">
            {node.children.map((child: any) => renderTreeNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex h-[800px] bg-white rounded-[3rem] border border-slate-200 shadow-2xl overflow-hidden animate-fadeIn">
      <aside className="w-[450px] border-r border-slate-100 flex flex-col bg-slate-50/30 shrink-0">
        <header className="p-8 border-b border-slate-100 bg-white/50 backdrop-blur shrink-0">
          <div className="flex items-center justify-between mb-4">
             <h3 className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Work Hierarchy</h3>
             <div className="flex bg-slate-200 p-0.5 rounded-xl">
                <button 
                  onClick={() => setTreeMode('hierarchy')}
                  className={`px-4 py-2 text-[10px] font-black uppercase rounded-lg transition-all ${treeMode === 'hierarchy' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-400'}`}
                >
                  Delivery
                </button>
                <button 
                  onClick={() => setTreeMode('milestone')}
                  className={`px-4 py-2 text-[10px] font-black uppercase rounded-lg transition-all ${treeMode === 'milestone' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-400'}`}
                >
                  Milestone
                </button>
             </div>
          </div>
        </header>

        <nav className="flex-1 overflow-y-auto p-4 custom-scrollbar">
          {loading ? (
             <div className="space-y-1 p-4">
                {[...Array(12)].map((_, i) => (
                  <div key={i} className="h-10 bg-slate-100 rounded-lg animate-pulse" style={{ opacity: 1 - i * 0.05 }}></div>
                ))}
             </div>
          ) : treeData.length === 0 ? (
             <div className="p-10 text-center">
                <i className="fas fa-search text-slate-200 text-5xl mb-6 opacity-50"></i>
                <p className="text-sm font-bold text-slate-400 uppercase tracking-widest leading-relaxed">No items match current criteria.</p>
             </div>
          ) : (
            <div className="space-y-0">
               {treeData.map(node => renderTreeNode(node))}
            </div>
          )}
        </nav>
      </aside>

      <main className="flex-1 overflow-y-auto bg-white relative custom-scrollbar">
        {activeItem ? (
          <WorkItemDetails 
            item={activeItem} 
            bundles={bundles} 
            applications={applications} 
            onUpdate={() => { fetchTree(); }} 
            onClose={() => setActiveItem(null)}
          />
        ) : (
          <div className="h-full flex flex-col items-center justify-center p-20 text-center bg-slate-50/10">
            <div className="w-24 h-24 bg-white rounded-[2.5rem] flex items-center justify-center mb-8 border border-slate-100 shadow-xl shadow-slate-200/50">
               <i className="fas fa-tasks text-slate-100 text-4xl"></i>
            </div>
            <h3 className="text-xl font-black text-slate-800 tracking-tight uppercase">Hierarchy Explorer</h3>
            <p className="text-slate-400 font-medium max-w-xs mt-3 leading-relaxed">Select an artifact to view implementation details and dependencies.</p>
          </div>
        )}
      </main>

      {isCreating && (
        <CreateWorkItemModal 
          bundles={bundles}
          applications={applications}
          initialBundleId={selBundleId !== 'all' ? selBundleId : ''}
          initialAppId={selAppId !== 'all' ? selAppId : ''}
          onClose={() => setIsCreating(false)}
          onSuccess={(item) => {
            setIsCreating(false);
            fetchTree();
            handleNodeSelect({ nodeType: 'WORK_ITEM', workItemId: item.insertedId || item.id });
          }}
        />
      )}
    </div>
  );
};

export default WorkItemsTreeView;
