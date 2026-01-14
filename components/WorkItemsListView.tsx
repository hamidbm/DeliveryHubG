
import React, { useState, useEffect, useMemo } from 'react';
import { WorkItem, WorkItemType, WorkItemStatus, Bundle, Application } from '../types';
import WorkItemDetails from './WorkItemDetails';
import CreateWorkItemModal from './CreateWorkItemModal';

interface WorkItemsListViewProps {
  applications: Application[];
  bundles: Bundle[];
  selBundleId: string;
  selAppId: string;
  selMilestone: string;
  selEpicId: string;
  searchQuery: string;
  externalTrigger?: string | null;
  onTriggerProcessed?: () => void;
}

type SortKey = 'key' | 'title' | 'status' | 'assignedTo' | 'updatedAt';
type SortDirection = 'asc' | 'desc';

const WorkItemsListView: React.FC<WorkItemsListViewProps> = ({ 
  applications, bundles, selBundleId, selAppId, selMilestone, selEpicId, searchQuery, externalTrigger, onTriggerProcessed 
}) => {
  const [items, setItems] = useState<WorkItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [activeItem, setActiveItem] = useState<WorkItem | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: SortDirection } | null>({
    key: 'updatedAt',
    direction: 'desc'
  });

  useEffect(() => {
    if (externalTrigger === 'create-item') {
      setIsCreating(true);
      onTriggerProcessed?.();
    }
  }, [externalTrigger, onTriggerProcessed]);

  const fetchItems = async () => {
    setLoading(true);
    const params = new URLSearchParams({
      bundleId: selBundleId,
      applicationId: selAppId,
      milestoneId: selMilestone,
      q: searchQuery,
      epicId: selEpicId
    });

    try {
      const res = await fetch(`/api/work-items?${params.toString()}`);
      const data = await res.json();
      setItems(data);
    } catch (err) {
      console.error("Failed to fetch list", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, [selBundleId, selAppId, selMilestone, selEpicId, searchQuery]);

  const sortedItems = useMemo(() => {
    if (!sortConfig) return items;

    return [...items].sort((a, b) => {
      let aVal: any = a[sortConfig.key] || '';
      let bVal: any = b[sortConfig.key] || '';

      // Handle special cases
      if (sortConfig.key === 'updatedAt') {
        aVal = a.updatedAt || a.createdAt || '';
        bVal = b.updatedAt || b.createdAt || '';
      }

      if (aVal < bVal) {
        return sortConfig.direction === 'asc' ? -1 : 1;
      }
      if (aVal > bVal) {
        return sortConfig.direction === 'asc' ? 1 : -1;
      }
      return 0;
    });
  }, [items, sortConfig]);

  const handleSort = (key: SortKey) => {
    let direction: SortDirection = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === items.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(items.map(i => (i._id || i.id) as string)));
    }
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelectedIds(next);
  };

  const getIcon = (type: WorkItemType) => {
    switch (type) {
      case WorkItemType.EPIC: return 'fa-layer-group text-purple-500';
      case WorkItemType.FEATURE: return 'fa-star text-amber-500';
      case WorkItemType.STORY: return 'fa-file-lines text-blue-500';
      case WorkItemType.TASK: return 'fa-check text-slate-400';
      case WorkItemType.BUG: return 'fa-bug text-red-500';
      case WorkItemType.SUBTASK: return 'fa-diagram-project text-slate-400';
      default: return 'fa-circle text-slate-300';
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const SortIndicator = ({ columnKey }: { columnKey: SortKey }) => {
    if (!sortConfig || sortConfig.key !== columnKey) {
      return <i className="fas fa-sort ml-2 opacity-20 text-[8px]"></i>;
    }
    return (
      <i className={`fas ${sortConfig.direction === 'asc' ? 'fa-sort-up' : 'fa-sort-down'} ml-2 text-blue-600 text-[10px]`}></i>
    );
  };

  return (
    <div className="flex h-[800px] bg-white rounded-[3rem] border border-slate-200 shadow-2xl overflow-hidden animate-fadeIn relative">
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="px-10 py-6 border-b border-slate-100 flex items-center justify-between shrink-0 bg-slate-50/30">
           <div className="flex items-center gap-6">
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Artifact Navigator ({items.length})</h3>
              {selectedIds.size > 0 && (
                <div className="flex items-center gap-3 animate-fadeIn">
                   <span className="text-[9px] font-black text-blue-600 bg-blue-50 px-3 py-1 rounded-full uppercase tracking-widest">{selectedIds.size} Selected</span>
                   <button className="text-[9px] font-black text-slate-400 uppercase hover:text-red-500 transition-colors">Bulk Delete</button>
                   <button className="text-[9px] font-black text-slate-400 uppercase hover:text-blue-600 transition-colors">Update Status</button>
                </div>
              )}
           </div>
           <div className="flex gap-4">
              <button className="p-2 text-slate-400 hover:text-blue-600 transition-colors"><i className="fas fa-file-export"></i></button>
              <button className="p-2 text-slate-400 hover:text-blue-600 transition-colors"><i className="fas fa-filter"></i></button>
           </div>
        </header>

        <div className="flex-1 overflow-auto custom-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead className="bg-white sticky top-0 z-10 border-b border-slate-100 shadow-sm">
              <tr>
                <th className="px-6 py-4 w-10 text-center">
                   <input 
                    type="checkbox" 
                    checked={items.length > 0 && selectedIds.size === items.length} 
                    onChange={toggleSelectAll}
                    className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                   />
                </th>
                <th 
                  className="px-6 py-4 text-[9px] font-black text-slate-300 uppercase tracking-widest cursor-pointer hover:text-blue-600 transition-colors group"
                  onClick={() => handleSort('key')}
                >
                  <div className="flex items-center">
                    Key
                    <SortIndicator columnKey="key" />
                  </div>
                </th>
                <th 
                  className="px-6 py-4 text-[9px] font-black text-slate-300 uppercase tracking-widest cursor-pointer hover:text-blue-600 transition-colors group"
                  onClick={() => handleSort('title')}
                >
                  <div className="flex items-center">
                    Title
                    <SortIndicator columnKey="title" />
                  </div>
                </th>
                <th className="px-6 py-4 text-[9px] font-black text-slate-300 uppercase tracking-widest">
                  Type
                </th>
                <th 
                  className="px-6 py-4 text-[9px] font-black text-slate-300 uppercase tracking-widest cursor-pointer hover:text-blue-600 transition-colors group"
                  onClick={() => handleSort('status')}
                >
                  <div className="flex items-center">
                    Status
                    <SortIndicator columnKey="status" />
                  </div>
                </th>
                <th 
                  className="px-6 py-4 text-[9px] font-black text-slate-300 uppercase tracking-widest cursor-pointer hover:text-blue-600 transition-colors group"
                  onClick={() => handleSort('assignedTo')}
                >
                  <div className="flex items-center">
                    Assignee
                    <SortIndicator columnKey="assignedTo" />
                  </div>
                </th>
                <th 
                  className="px-6 py-4 text-[9px] font-black text-slate-300 uppercase tracking-widest text-right cursor-pointer hover:text-blue-600 transition-colors group"
                  onClick={() => handleSort('updatedAt')}
                >
                  <div className="flex items-center justify-end">
                    Updated
                    <SortIndicator columnKey="updatedAt" />
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                [...Array(10)].map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={7} className="px-8 py-4"><div className="h-4 bg-slate-50 rounded w-full"></div></td>
                  </tr>
                ))
              ) : sortedItems.map(item => {
                const id = (item._id || item.id) as string;
                return (
                  <tr 
                    key={id} 
                    onClick={() => setActiveItem(item)}
                    className={`hover:bg-blue-50/30 cursor-pointer transition-colors group ${activeItem?._id === id ? 'bg-blue-50/50' : ''}`}
                  >
                    <td className="px-6 py-4 text-center" onClick={(e) => e.stopPropagation()}>
                      <input 
                        type="checkbox" 
                        checked={selectedIds.has(id)} 
                        onChange={() => toggleSelect(id)}
                        className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">{item.key}</span>
                    </td>
                    <td className="px-6 py-4 max-w-md">
                      <span className="text-sm font-bold text-slate-700 group-hover:text-blue-600 truncate block">{item.title}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                         <i className={`fas ${getIcon(item.type)} text-xs`}></i>
                         <span className="text-[9px] font-bold text-slate-500 uppercase">{item.type}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border ${
                        item.status === WorkItemStatus.DONE ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                        item.status === WorkItemStatus.IN_PROGRESS ? 'bg-blue-50 text-blue-600 border-blue-100' :
                        item.status === WorkItemStatus.BLOCKED ? 'bg-red-50 text-red-600 border-red-100' :
                        'bg-slate-50 text-slate-500 border-slate-100'
                      }`}>
                        {item.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                         <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(item.assignedTo || 'U')}&background=random&size=24`} className="w-5 h-5 rounded-full shadow-sm" />
                         <span className="text-xs font-medium text-slate-500">{item.assignedTo || 'Unassigned'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">{formatDate(item.updatedAt || item.createdAt)}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {activeItem && (
        <div className="absolute inset-y-0 right-0 w-[600px] bg-white shadow-2xl border-l border-slate-200 z-50 animate-slideIn">
           <WorkItemDetails 
             item={activeItem} 
             bundles={bundles} 
             applications={applications} 
             onUpdate={() => { fetchItems(); }} 
             onClose={() => setActiveItem(null)}
           />
        </div>
      )}

      {isCreating && (
        <CreateWorkItemModal 
          bundles={bundles}
          applications={applications}
          initialBundleId={selBundleId !== 'all' ? selBundleId : ''}
          initialAppId={selAppId !== 'all' ? selAppId : ''}
          onClose={() => setIsCreating(false)}
          onSuccess={(item) => {
            setIsCreating(false);
            fetchItems();
          }}
        />
      )}
    </div>
  );
};

export default WorkItemsListView;
