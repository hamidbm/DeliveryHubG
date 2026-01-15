
import React, { useState, useEffect } from 'react';
import { WorkItem, WorkItemStatus, Bundle, Application, Milestone } from '../types';
import WorkItemDetails from './WorkItemDetails';
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
}

const WorkItemsListView: React.FC<WorkItemsListViewProps> = ({ 
  applications, bundles, selBundleId, selAppId, selMilestone, selEpicId, searchQuery, quickFilter 
}) => {
  const [items, setItems] = useState<WorkItem[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeItem, setActiveItem] = useState<WorkItem | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);
  const [activeBulkAction, setActiveBulkAction] = useState<'status' | 'assignee' | 'milestone' | null>(null);

  const fetchItems = async () => {
    setLoading(true);
    const params = new URLSearchParams({
      bundleId: selBundleId, applicationId: selAppId, milestoneId: selMilestone, q: searchQuery, epicId: selEpicId
    });
    if (quickFilter) params.set('quickFilter', quickFilter);
    try {
      const [iRes, mRes] = await Promise.all([
        fetch(`/api/work-items?${params.toString()}`),
        fetch('/api/milestones')
      ]);
      setItems(await iRes.json());
      setMilestones(await mRes.json());
      setSelectedIds(new Set());
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchItems(); }, [selBundleId, selAppId, selMilestone, selEpicId, searchQuery, quickFilter]);

  const toggleSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const next = new Set(selectedIds);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelectedIds(next);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === items.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(items.map(i => (i._id || i.id) as string)));
    }
  };

  const handleBulkUpdate = async (updates: Partial<WorkItem>) => {
    setIsBulkProcessing(true);
    try {
      const res = await fetch('/api/work-items/bulk', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selectedIds), updates })
      });
      if (res.ok) {
        await fetchItems();
        setActiveBulkAction(null);
      }
    } finally {
      setIsBulkProcessing(false);
    }
  };

  const getItemHealth = (item: WorkItem) => {
    const selfBlocked = item.status === WorkItemStatus.BLOCKED || item.links?.some(l => l.type === 'IS_BLOCKED_BY');
    if (selfBlocked) return { label: 'Blocked', color: 'text-red-500 bg-red-50', icon: 'fa-hand' };
    return { label: 'Healthy', color: 'text-emerald-600 bg-emerald-50', icon: 'fa-circle-check' };
  };

  return (
    <div className="flex h-[800px] bg-white rounded-[3rem] border border-slate-200 shadow-2xl overflow-hidden animate-fadeIn relative">
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="px-10 py-6 border-b border-slate-100 flex items-center justify-between shrink-0 bg-slate-50/30">
           <div className="flex items-center gap-4">
             <input 
              type="checkbox" 
              checked={selectedIds.size === items.length && items.length > 0} 
              onChange={toggleSelectAll}
              className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
             />
             <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Registry Inventory ({items.length})</h3>
           </div>
           {selectedIds.size > 0 && (
             <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-4 py-1.5 rounded-full animate-pulse uppercase tracking-widest">
               {selectedIds.size} Artifacts Staged
             </span>
           )}
        </header>

        <div className="flex-1 overflow-auto custom-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead className="bg-white sticky top-0 z-10 border-b border-slate-100 shadow-sm">
              <tr>
                <th className="w-10 px-6 py-4"></th>
                <th className="px-6 py-4 text-[9px] font-black text-slate-300 uppercase tracking-widest">Key</th>
                <th className="px-6 py-4 text-[9px] font-black text-slate-300 uppercase tracking-widest">Title</th>
                <th className="px-6 py-4 text-[9px] font-black text-slate-300 uppercase tracking-widest text-center">Health</th>
                <th className="px-6 py-4 text-[9px] font-black text-slate-300 uppercase tracking-widest">Status</th>
                <th className="px-6 py-4 text-[9px] font-black text-slate-300 uppercase tracking-widest">Assignee</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {items.map(item => {
                const id = (item._id || item.id) as string;
                const isSelected = selectedIds.has(id);
                const health = getItemHealth(item);
                return (
                  <tr 
                    key={id} 
                    onClick={() => setActiveItem(item)} 
                    className={`hover:bg-blue-50/30 cursor-pointer transition-colors group ${isSelected ? 'bg-blue-50/50' : ''}`}
                  >
                    <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                       <input 
                        type="checkbox" 
                        checked={isSelected} 
                        onChange={(e) => toggleSelect(id, e as any)}
                        className="w-4 h-4 rounded border-slate-300 text-blue-600"
                       />
                    </td>
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

      {/* Bulk Action Command Plane */}
      {selectedIds.size > 0 && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-slate-900/95 backdrop-blur-xl border border-white/10 px-8 py-5 rounded-[2.5rem] shadow-2xl flex items-center gap-10 z-[110] animate-fadeIn ring-1 ring-blue-500/20">
           <div className="flex items-center gap-4 border-r border-white/10 pr-10">
              <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-black text-sm shadow-xl animate-pulse">
                {selectedIds.size}
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-black text-white uppercase tracking-widest">Triage Plane</span>
                <span className="text-[8px] font-bold text-slate-400 uppercase">Mass Update Mode</span>
              </div>
           </div>

           <div className="flex items-center gap-6">
              {/* Status Action */}
              <div className="flex flex-col gap-2">
                <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest ml-1">Workflow</span>
                <div className="flex items-center gap-2">
                  {[WorkItemStatus.TODO, WorkItemStatus.IN_PROGRESS, WorkItemStatus.DONE, WorkItemStatus.BLOCKED].map(s => (
                    <button 
                      key={s}
                      onClick={() => handleBulkUpdate({ status: s })}
                      disabled={isBulkProcessing}
                      className="px-4 py-1.5 bg-white/5 hover:bg-white/15 text-white text-[9px] font-black uppercase rounded-lg transition-all border border-white/5 disabled:opacity-50"
                    >
                      {s.replace('_', ' ')}
                    </button>
                  ))}
                </div>
              </div>

              <div className="h-10 w-[1px] bg-white/5"></div>

              {/* Assignment/Milestone Actions */}
              <div className="flex items-center gap-4">
                 <button 
                  onClick={() => setActiveBulkAction(activeBulkAction === 'assignee' ? null : 'assignee')}
                  className={`px-5 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center gap-2 transition-all ${
                    activeBulkAction === 'assignee' ? 'bg-blue-600 text-white' : 'bg-white/5 text-slate-300 hover:bg-white/10'
                  }`}
                 >
                   <i className="fas fa-user-plus"></i> Reassign
                 </button>
                 <button 
                  onClick={() => setActiveBulkAction(activeBulkAction === 'milestone' ? null : 'milestone')}
                  className={`px-5 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center gap-2 transition-all ${
                    activeBulkAction === 'milestone' ? 'bg-indigo-600 text-white' : 'bg-white/5 text-slate-300 hover:bg-white/10'
                  }`}
                 >
                   <i className="fas fa-flag-checkered"></i> Milestone
                 </button>
              </div>
           </div>

           {/* Contextual Bulk Action Inputs */}
           {activeBulkAction === 'assignee' && (
             <div className="absolute bottom-full left-0 right-0 mb-4 bg-slate-800 p-4 rounded-3xl border border-white/10 shadow-2xl animate-slideUp">
                <AssigneeSearch onSelect={(name) => handleBulkUpdate({ assignedTo: name })} />
             </div>
           )}

           {activeBulkAction === 'milestone' && (
             <div className="absolute bottom-full left-0 right-0 mb-4 bg-slate-800 p-4 rounded-3xl border border-white/10 shadow-2xl animate-slideUp">
                <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto custom-scrollbar">
                   {milestones.map(m => (
                     <button 
                        key={m._id} 
                        onClick={() => handleBulkUpdate({ milestoneIds: [m._id!] })}
                        className="text-left px-4 py-2 hover:bg-white/10 rounded-xl text-[10px] font-bold text-white transition-all border border-white/5"
                     >
                        {m.name}
                     </button>
                   ))}
                </div>
             </div>
           )}

           <button 
            onClick={() => { setSelectedIds(new Set()); setActiveBulkAction(null); }}
            className="w-10 h-10 rounded-2xl bg-white/5 text-white/40 hover:text-white hover:bg-red-500/20 transition-all flex items-center justify-center border border-white/5"
           >
             <i className="fas fa-times"></i>
           </button>
        </div>
      )}

      {activeItem && (
        <div className="absolute inset-y-0 right-0 w-[600px] bg-white shadow-2xl border-l border-slate-200 z-50 animate-slideIn">
           <WorkItemDetails item={activeItem} bundles={bundles} applications={applications} onUpdate={fetchItems} onClose={() => setActiveItem(null)} />
        </div>
      )}

      <style jsx global>{`
        @keyframes slideUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .animate-slideUp { animation: slideUp 0.3s cubic-bezier(0.23, 1, 0.32, 1); }
      `}</style>
    </div>
  );
};

export default WorkItemsListView;
