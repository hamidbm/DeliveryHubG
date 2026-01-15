
import React, { useState, useEffect, useMemo } from 'react';
import { WorkItem, WorkItemType, WorkItemStatus, Bundle, Application } from '../types';
import WorkItemDetails from './WorkItemDetails';
import CreateWorkItemModal from './CreateWorkItemModal';
import AssigneeSearch from './AssigneeSearch';

interface WorkItemsListViewProps {
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

type SortKey = 'key' | 'title' | 'status' | 'assignedTo' | 'updatedAt';
type SortDirection = 'asc' | 'desc';

const WorkItemsListView: React.FC<WorkItemsListViewProps> = ({ 
  applications, bundles, selBundleId, selAppId, selMilestone, selEpicId, searchQuery, quickFilter, externalTrigger, onTriggerProcessed 
}) => {
  const [items, setItems] = useState<WorkItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [activeItem, setActiveItem] = useState<WorkItem | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isBulkEditing, setIsBulkEditing] = useState(false);
  const [bulkAction, setBulkAction] = useState<{ field: string, value: any } | null>(null);
  
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
    if (quickFilter) params.set('quickFilter', quickFilter);

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
  }, [selBundleId, selAppId, selMilestone, selEpicId, searchQuery, quickFilter]);

  const sortedItems = useMemo(() => {
    if (!sortConfig) return items;

    return [...items].sort((a, b) => {
      let aVal: any = a[sortConfig.key] || '';
      let bVal: any = b[sortConfig.key] || '';

      if (sortConfig.key === 'updatedAt') {
        aVal = a.updatedAt || a.createdAt || '';
        bVal = b.updatedAt || b.createdAt || '';
      }

      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
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
    if (selectedIds.size === items.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(items.map(i => (i._id || i.id) as string)));
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelectedIds(next);
  };

  const handleBulkUpdate = async () => {
    if (!bulkAction) return;
    setLoading(true);
    const ids = Array.from(selectedIds);
    
    try {
      await Promise.all(ids.map(id => 
        fetch(`/api/work-items/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ [bulkAction.field]: bulkAction.value })
        })
      ));
      setIsBulkEditing(false);
      setBulkAction(null);
      setSelectedIds(new Set());
      fetchItems();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
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
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
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
                   <button onClick={() => setIsBulkEditing(true)} className="text-[9px] font-black text-slate-400 uppercase hover:text-blue-600 transition-colors">Bulk Update</button>
                   <button className="text-[9px] font-black text-slate-400 uppercase hover:text-red-500 transition-colors">Archive Items</button>
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
                   <input type="checkbox" checked={items.length > 0 && selectedIds.size === items.length} onChange={toggleSelectAll} className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer" />
                </th>
                <SortableHeader label="Key" sortKey="key" sortConfig={sortConfig} onSort={handleSort} />
                <SortableHeader label="Title" sortKey="title" sortConfig={sortConfig} onSort={handleSort} />
                <th className="px-6 py-4 text-[9px] font-black text-slate-300 uppercase tracking-widest">Type</th>
                <SortableHeader label="Status" sortKey="status" sortConfig={sortConfig} onSort={handleSort} />
                <SortableHeader label="Assignee" sortKey="assignedTo" sortConfig={sortConfig} onSort={handleSort} />
                <SortableHeader label="Updated" sortKey="updatedAt" sortConfig={sortConfig} onSort={handleSort} align="right" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                [...Array(10)].map((_, i) => <tr key={i} className="animate-pulse"><td colSpan={7} className="px-8 py-4"><div className="h-4 bg-slate-50 rounded w-full"></div></td></tr>)
              ) : sortedItems.map(item => {
                const id = (item._id || item.id) as string;
                return (
                  <tr key={id} onClick={() => setActiveItem(item)} className={`hover:bg-blue-50/30 cursor-pointer transition-colors group ${activeItem?._id === id ? 'bg-blue-50/50' : ''}`}>
                    <td className="px-6 py-4 text-center" onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" checked={selectedIds.has(id)} onChange={() => toggleSelect(id)} className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer" />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-[10px] font-black text-slate-400 uppercase tracking-tighter">{item.key}</td>
                    <td className="px-6 py-4 max-w-md text-sm font-bold text-slate-700 group-hover:text-blue-600 truncate block">{item.title}</td>
                    <td className="px-6 py-4 whitespace-nowrap flex items-center gap-2 mt-1">
                       <i className={`fas ${getIcon(item.type)} text-xs`}></i>
                       <span className="text-[9px] font-bold text-slate-500 uppercase">{item.type}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border ${
                        item.status === WorkItemStatus.DONE ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                        item.status === WorkItemStatus.IN_PROGRESS ? 'bg-blue-50 text-blue-600 border-blue-100' :
                        'bg-slate-50 text-slate-500 border-slate-100'
                      }`}>{item.status.replace('_', ' ')}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                         <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(item.assignedTo || 'U')}&background=random&size=24`} className="w-5 h-5 rounded-full shadow-sm" />
                         <span className="text-xs font-medium text-slate-500">{item.assignedTo || 'Unassigned'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-[10px] font-bold text-slate-400 uppercase tracking-tighter">{formatDate(item.updatedAt || item.createdAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {isBulkEditing && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 animate-fadeIn">
          <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm" onClick={() => setIsBulkEditing(false)}></div>
          <div className="bg-white rounded-[3rem] w-full max-w-lg p-10 shadow-2xl relative border border-slate-100">
             <h3 className="text-2xl font-black text-slate-900 tracking-tight mb-2">Bulk Transformation</h3>
             <p className="text-slate-400 text-sm font-medium mb-8">Refining {selectedIds.size} selected registry entries.</p>
             
             <div className="space-y-6">
                <div className="space-y-2">
                   <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Attribute to Update</label>
                   <select 
                    value={bulkAction?.field || ''} 
                    onChange={(e) => setBulkAction({ field: e.target.value, value: '' })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold outline-none"
                   >
                      <option value="">Select Field...</option>
                      <option value="status">Status</option>
                      <option value="assignedTo">Assignee</option>
                      <option value="priority">Priority</option>
                   </select>
                </div>

                {bulkAction?.field === 'status' && (
                  <div className="space-y-2 animate-fadeIn">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Target Status</label>
                    <select 
                      onChange={(e) => setBulkAction({ ...bulkAction, value: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold outline-none"
                    >
                       {Object.values(WorkItemStatus).map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                )}

                {bulkAction?.field === 'assignedTo' && (
                  <div className="space-y-2 animate-fadeIn">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Target Assignee</label>
                    <AssigneeSearch onSelect={(val) => setBulkAction({ ...bulkAction, value: val })} />
                  </div>
                )}
             </div>

             <div className="mt-10 flex gap-4 pt-6 border-t border-slate-50">
                <button onClick={() => setIsBulkEditing(false)} className="flex-1 py-4 text-[10px] font-black text-slate-400 uppercase">Cancel</button>
                <button 
                  onClick={handleBulkUpdate} 
                  disabled={!bulkAction?.value || loading}
                  className="flex-[2] py-4 bg-slate-900 text-white text-[10px] font-black rounded-2xl shadow-xl hover:bg-blue-600 disabled:opacity-50 transition-all uppercase tracking-widest"
                >
                  {loading ? 'Processing...' : 'Apply Transformation'}
                </button>
             </div>
          </div>
        </div>
      )}

      {activeItem && (
        <div className="absolute inset-y-0 right-0 w-[600px] bg-white shadow-2xl border-l border-slate-200 z-50 animate-slideIn">
           <WorkItemDetails item={activeItem} bundles={bundles} applications={applications} onUpdate={fetchItems} onClose={() => setActiveItem(null)} />
        </div>
      )}
    </div>
  );
};

const SortableHeader = ({ label, sortKey, sortConfig, onSort, align = 'left' }: any) => {
  const isSorted = sortConfig?.key === sortKey;
  return (
    <th 
      className={`px-6 py-4 text-[9px] font-black text-slate-300 uppercase tracking-widest cursor-pointer hover:text-blue-600 transition-colors group ${align === 'right' ? 'text-right' : ''}`}
      onClick={() => onSort(sortKey)}
    >
      <div className={`flex items-center ${align === 'right' ? 'justify-end' : ''}`}>
        {label}
        {isSorted ? (
          <i className={`fas ${sortConfig.direction === 'asc' ? 'fa-sort-up' : 'fa-sort-down'} ml-2 text-blue-600 text-[10px]`}></i>
        ) : (
          <i className="fas fa-sort ml-2 opacity-20 text-[8px] group-hover:opacity-100 transition-opacity"></i>
        )}
      </div>
    </th>
  );
};

export default WorkItemsListView;
