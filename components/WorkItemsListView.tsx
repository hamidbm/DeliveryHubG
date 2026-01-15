
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

const WorkItemsListView: React.FC<WorkItemsListViewProps> = ({ 
  applications, bundles, selBundleId, selAppId, selMilestone, selEpicId, searchQuery, quickFilter, externalTrigger, onTriggerProcessed 
}) => {
  const [items, setItems] = useState<WorkItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeItem, setActiveItem] = useState<WorkItem | null>(null);

  const fetchItems = async () => {
    setLoading(true);
    const params = new URLSearchParams({
      bundleId: selBundleId, applicationId: selAppId, milestoneId: selMilestone, q: searchQuery, epicId: selEpicId
    });
    if (quickFilter) params.set('quickFilter', quickFilter);
    try {
      const res = await fetch(`/api/work-items?${params.toString()}`);
      setItems(await res.json());
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchItems(); }, [selBundleId, selAppId, selMilestone, selEpicId, searchQuery, quickFilter]);

  const getItemHealth = (item: WorkItem) => {
    const selfBlocked = item.status === WorkItemStatus.BLOCKED || item.links?.some(l => l.type === 'IS_BLOCKED_BY');
    if (selfBlocked) return { label: 'Blocked', color: 'text-red-500 bg-red-50', icon: 'fa-hand' };
    
    // Simple child check logic for the list view context
    const hasBlockedChild = items.some(i => i.parentId === (item._id || item.id) && (i.status === WorkItemStatus.BLOCKED));
    if (hasBlockedChild) return { label: 'Risk', color: 'text-amber-600 bg-amber-50', icon: 'fa-triangle-exclamation' };
    
    return { label: 'Healthy', color: 'text-emerald-600 bg-emerald-50', icon: 'fa-circle-check' };
  };

  return (
    <div className="flex h-[800px] bg-white rounded-[3rem] border border-slate-200 shadow-2xl overflow-hidden animate-fadeIn relative">
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="px-10 py-6 border-b border-slate-100 flex items-center justify-between shrink-0 bg-slate-50/30">
           <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Artifact Navigator ({items.length})</h3>
        </header>

        <div className="flex-1 overflow-auto custom-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead className="bg-white sticky top-0 z-10 border-b border-slate-100 shadow-sm">
              <tr>
                <th className="px-6 py-4 text-[9px] font-black text-slate-300 uppercase tracking-widest">Key</th>
                <th className="px-6 py-4 text-[9px] font-black text-slate-300 uppercase tracking-widest">Title</th>
                <th className="px-6 py-4 text-[9px] font-black text-slate-300 uppercase tracking-widest text-center">Health</th>
                <th className="px-6 py-4 text-[9px] font-black text-slate-300 uppercase tracking-widest">Status</th>
                <th className="px-6 py-4 text-[9px] font-black text-slate-300 uppercase tracking-widest">Assignee</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {items.map(item => {
                const health = getItemHealth(item);
                return (
                  <tr key={item._id || item.id} onClick={() => setActiveItem(item)} className="hover:bg-blue-50/30 cursor-pointer transition-colors group">
                    <td className="px-6 py-4 whitespace-nowrap text-[10px] font-black text-slate-400 uppercase tracking-tighter">{item.key}</td>
                    <td className="px-6 py-4 text-sm font-bold text-slate-700 group-hover:text-blue-600 truncate">{item.title}</td>
                    <td className="px-6 py-4 text-center">
                       <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest ${health.color}`}>
                          <i className={`fas ${health.icon}`}></i>
                          {health.label}
                       </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border ${
                        item.status === WorkItemStatus.DONE ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                        item.status === WorkItemStatus.IN_PROGRESS ? 'bg-blue-50 text-blue-600 border-blue-100' :
                        'bg-slate-50 text-slate-500 border-slate-100'
                      }`}>{item.status}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                         <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(item.assignedTo || 'U')}&background=random&size=24`} className="w-5 h-5 rounded-full" />
                         <span className="text-xs font-medium text-slate-500">{item.assignedTo || 'Unassigned'}</span>
                      </div>
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
           <WorkItemDetails item={activeItem} bundles={bundles} applications={applications} onUpdate={fetchItems} onClose={() => setActiveItem(null)} />
        </div>
      )}
    </div>
  );
};

export default WorkItemsListView;
