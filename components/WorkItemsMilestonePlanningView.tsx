
import React, { useState, useEffect, useMemo } from 'react';
import { WorkItem, WorkItemType, Bundle, Application, WorkItemStatus } from '../types';
import WorkItemDetails from './WorkItemDetails';

interface WorkItemsMilestonePlanningViewProps {
  applications: Application[];
  bundles: Bundle[];
  selBundleId: string;
  selAppId: string;
  searchQuery: string;
}

const MILESTONE_BUCKETS = ['M1', 'M2', 'M3', 'M4', 'M5', 'M6', 'M7', 'M8', 'M9', 'M10'];

const WorkItemsMilestonePlanningView: React.FC<WorkItemsMilestonePlanningViewProps> = ({ 
  applications, bundles, selBundleId, selAppId, searchQuery 
}) => {
  const [items, setItems] = useState<WorkItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeItem, setActiveItem] = useState<WorkItem | null>(null);

  const fetchItems = async () => {
    setLoading(true);
    const params = new URLSearchParams({
      bundleId: selBundleId,
      applicationId: selAppId,
      q: searchQuery,
    });
    const res = await fetch(`/api/work-items?${params.toString()}`);
    setItems(await res.json());
    setLoading(false);
  };

  useEffect(() => {
    fetchItems();
  }, [selBundleId, selAppId, searchQuery]);

  const handleUpdateMilestone = async (itemId: string, milestone: string | null) => {
    // Optimistic update
    setItems(prev => prev.map(i => {
      if ((i._id || i.id) === itemId) {
        return { ...i, milestoneIds: milestone ? [milestone] : [] };
      }
      return i;
    }));

    await fetch(`/api/work-items/${itemId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ milestoneIds: milestone ? [milestone] : [] })
    });
  };

  const unassignedItems = useMemo(() => items.filter(i => !i.milestoneIds || i.milestoneIds.length === 0), [items]);

  return (
    <div className="flex h-[800px] bg-white rounded-[3rem] border border-slate-200 shadow-2xl overflow-hidden animate-fadeIn relative">
      {/* Sidebar: Unassigned Items */}
      <aside className="w-96 border-r border-slate-100 flex flex-col bg-slate-50/30 shrink-0">
        <header className="p-8 border-b border-slate-100 bg-white/50 backdrop-blur shrink-0">
          <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Planning Backlog</h3>
          <p className="text-xs font-bold text-slate-500">{unassignedItems.length} items to be scheduled</p>
        </header>
        <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
           {unassignedItems.map(item => (
             <DraggablePlanningItem key={item._id || item.id} item={item} onClick={() => setActiveItem(item)} />
           ))}
        </div>
      </aside>

      {/* Main Content: Milestone Columns */}
      <main className="flex-1 overflow-x-auto p-10 bg-white flex gap-6 custom-scrollbar">
         {MILESTONE_BUCKETS.map(m => {
           const bucketItems = items.filter(i => i.milestoneIds?.includes(m));
           const points = bucketItems.reduce((acc, curr) => acc + (curr.storyPoints || 0), 0);
           return (
             <div key={m} className="w-80 flex flex-col shrink-0">
                <header className="mb-6 flex items-center justify-between px-4">
                   <div className="flex items-center gap-3">
                      <span className="w-8 h-8 rounded-xl bg-slate-900 text-white flex items-center justify-center text-[10px] font-black">{m}</span>
                      <div>
                        <h4 className="text-sm font-black text-slate-800 uppercase tracking-tight">Milestone {m.substring(1)}</h4>
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{bucketItems.length} Items • {points} pts</span>
                      </div>
                   </div>
                </header>
                <div className="flex-1 bg-slate-50/50 border border-slate-100 rounded-[2.5rem] p-4 space-y-3 overflow-y-auto custom-scrollbar shadow-inner">
                   {bucketItems.map(item => (
                     <DraggablePlanningItem key={item._id || item.id} item={item} activeInBucket onClick={() => setActiveItem(item)} onRemove={() => handleUpdateMilestone((item._id || item.id) as string, null)} />
                   ))}
                   {bucketItems.length === 0 && (
                     <div className="h-full flex flex-col items-center justify-center text-slate-200 opacity-40 py-20">
                        <i className="fas fa-arrow-down-to-bracket text-4xl mb-4"></i>
                        <p className="text-[10px] font-black uppercase tracking-widest">Drop Items Here</p>
                     </div>
                   )}
                </div>
             </div>
           );
         })}
      </main>

      {activeItem && (
        <div className="absolute inset-y-0 right-0 w-[650px] bg-white shadow-2xl border-l border-slate-200 z-50 animate-slideIn">
           <WorkItemDetails 
             item={activeItem} 
             bundles={bundles} 
             applications={applications} 
             onUpdate={fetchItems} 
             onClose={() => setActiveItem(null)}
           />
        </div>
      )}
    </div>
  );
};

const DraggablePlanningItem = ({ item, onClick, onRemove, activeInBucket }: any) => {
  const getIcon = (type: WorkItemType) => {
    switch (type) {
      case WorkItemType.EPIC: return 'fa-layer-group text-purple-500';
      case WorkItemType.BUG: return 'fa-bug text-red-500';
      default: return 'fa-file-lines text-blue-500';
    }
  };

  return (
    <div className="bg-white border border-slate-100 p-4 rounded-2xl shadow-sm hover:shadow-md transition-all group cursor-pointer" onClick={onClick}>
       <div className="flex justify-between items-start mb-2">
          <div className="flex items-center gap-2">
             <i className={`fas ${getIcon(item.type)} text-[10px]`}></i>
             <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">{item.key}</span>
          </div>
          {activeInBucket && (
            <button 
              onClick={(e) => { e.stopPropagation(); onRemove(); }}
              className="text-slate-200 hover:text-red-500 transition-colors"
            >
              <i className="fas fa-times-circle"></i>
            </button>
          )}
       </div>
       <h5 className="text-xs font-bold text-slate-700 leading-tight mb-3 group-hover:text-blue-600 transition-colors">{item.title}</h5>
       <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
             <span className="text-[8px] font-black px-1.5 py-0.5 rounded bg-slate-50 text-slate-400 uppercase">{item.priority}</span>
             {item.storyPoints && <span className="text-[8px] font-black text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">{item.storyPoints} pts</span>}
          </div>
          <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(item.assignedTo || 'U')}&background=random&size=24`} className="w-4 h-4 rounded-full" />
       </div>
    </div>
  );
};

export default WorkItemsMilestonePlanningView;
