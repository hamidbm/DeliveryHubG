
import React, { useState, useEffect, useMemo } from 'react';
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
      
      // Auto-expand top level on first load
      if (expandedNodes.size === 0 && data.length > 0) {
        setExpandedNodes(new Set(data.map((n: any) => n.id)));
      }
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

  // Helper to check for risk in a node or any of its recursive children
  const checkNodeRisk = (node: any): 'CRITICAL' | 'WARNING' | 'HEALTHY' => {
    if (node.status === WorkItemStatus.BLOCKED) return 'CRITICAL';
    
    if (node.children && node.children.length > 0) {
      for (const child of node.children) {
        const childRisk = checkNodeRisk(child);
        if (childRisk === 'CRITICAL' || childRisk === 'WARNING') return 'WARNING';
      }
    }
    return 'HEALTHY';
  };

  const renderTreeNode = (node: any, depth = 0) => {
    const isExpanded = expandedNodes.has(node.id);
    const hasChildren = node.children && node.children.length > 0;
    const isActive = activeItem && (activeItem._id === node.workItemId || activeItem.id === node.workItemId);
    const risk = checkNodeRisk(node);

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
          className={`flex items-center gap-3 px-3 py-2.5 rounded-2xl transition-all text-left group border border-transparent mb-1 ${
            isActive ? 'bg-blue-600 text-white shadow-xl shadow-blue-500/20' : 'hover:bg-white hover:shadow-sm text-slate-600 hover:border-slate-100'
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
          <div className="relative shrink-0">
            <i className={`fas ${getIcon(node.type)} text-lg ${isActive ? 'text-white' : ''}`}></i>
            {risk !== 'HEALTHY' && (
              <div className={`absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 ${isActive ? 'border-blue-600' : 'border-white'} ${risk === 'CRITICAL' ? 'bg-red-500' : 'bg-amber-500 animate-pulse shadow-sm shadow-amber-200'}`}></div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <span className={`text-sm font-black truncate block tracking-tight ${isActive ? 'text-white' : 'text-slate-800'}`}>
              {node.label}
            </span>
          </div>
          {node.status && (
             <span className={`shrink-0 text-[8px] font-black px-2 py-0.5 rounded uppercase tracking-wider border ${
               isActive ? 'bg-white/20 border-white/30 text-white' :
               node.status === WorkItemStatus.DONE || node.status === 'Released' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
               node.status === WorkItemStatus.IN_PROGRESS || node.status === 'Active' ? 'bg-blue-50 text-blue-700 border-blue-100' :
               node.status === WorkItemStatus.BLOCKED ? 'bg-red-50 text-red-700 border-red-100' :
               'bg-slate-50 text-slate-500 border-slate-100'
             }`}>
               {node.status.replace('_', ' ')}
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
             <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Work Hierarchy</h3>
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

        <nav className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          {loading ? (
             <div className="space-y-4">
                {[...Array(8)].map((_, i) => (
                  <div key={i} className="h-12 bg-slate-100 rounded-2xl animate-pulse" style={{ opacity: 1 - i * 0.1 }}></div>
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
