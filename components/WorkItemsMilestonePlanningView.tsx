
import React, { useState, useEffect, useMemo } from 'react';
import { 
  DndContext, 
  useDraggable, 
  useDroppable, 
  DragEndEvent, 
  PointerSensor, 
  useSensor, 
  useSensors,
  DragOverlay
} from '@dnd-kit/core';
import { WorkItem, WorkItemType, Bundle, Application, WorkItemStatus, Milestone, MilestoneStatus } from '../types';
import WorkItemDetails from './WorkItemDetails';

interface WorkItemsMilestonePlanningViewProps {
  applications: Application[];
  bundles: Bundle[];
  selBundleId: string;
  selAppId: string;
  searchQuery: string;
}

const DraggableItem: React.FC<{ item: WorkItem; onClick: () => void }> = ({ item, onClick }) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: (item._id || item.id) as string,
    data: { item }
  });

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
    zIndex: 50,
  } : undefined;

  const getIcon = (type: WorkItemType) => {
    switch (type) {
      case WorkItemType.EPIC: return 'fa-layer-group text-purple-500';
      case WorkItemType.BUG: return 'fa-bug text-red-500';
      default: return 'fa-file-lines text-blue-500';
    }
  };

  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      {...listeners} 
      {...attributes}
      onClick={onClick}
      className={`bg-white border border-slate-100 p-4 rounded-2xl shadow-sm hover:shadow-md transition-all group cursor-grab active:cursor-grabbing ${isDragging ? 'opacity-30' : ''}`}
    >
       <div className="flex justify-between items-start mb-2">
          <div className="flex items-center gap-2">
             <i className={`fas ${getIcon(item.type)} text-[10px]`}></i>
             <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">{item.key}</span>
          </div>
          <span className={`text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-tighter ${
            item.status === WorkItemStatus.DONE ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-50 text-slate-400'
          }`}>{item.status}</span>
       </div>
       <h5 className="text-xs font-bold text-slate-700 leading-tight mb-3 group-hover:text-blue-600 transition-colors pointer-events-none">{item.title}</h5>
       <div className="flex items-center justify-between pointer-events-none">
          <div className="flex items-center gap-2">
             <span className={`text-[8px] font-black px-1.5 py-0.5 rounded bg-slate-50 text-slate-400 uppercase`}>{item.priority}</span>
             {item.storyPoints && <span className="text-[8px] font-black text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">{item.storyPoints} pts</span>}
          </div>
          <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(item.assignedTo || 'U')}&background=random&size=24`} className="w-4 h-4 rounded-full shadow-sm" />
       </div>
    </div>
  );
};

const MilestoneColumn: React.FC<{ milestone: Milestone; items: WorkItem[]; onCardClick: (i: WorkItem) => void }> = ({ milestone, items, onCardClick }) => {
  const { setNodeRef, isOver } = useDroppable({
    id: milestone._id as string,
  });

  const totalPoints = items.reduce((acc, curr) => acc + (curr.storyPoints || 0), 0);
  const doneItems = items.filter(i => i.status === WorkItemStatus.DONE).length;
  const progress = items.length > 0 ? Math.round((doneItems / items.length) * 100) : 0;
  const capacityPct = milestone.targetCapacity ? Math.round((totalPoints / milestone.targetCapacity) * 100) : null;

  return (
    <div className="w-80 flex flex-col shrink-0">
      <header className="mb-6 px-4 space-y-4">
         <div className="flex items-center gap-3">
            <span className={`w-8 h-8 rounded-xl flex items-center justify-center text-[10px] font-black transition-all ${isOver ? 'bg-blue-600 text-white animate-pulse' : 'bg-slate-900 text-white'}`}>
              <i className="fas fa-flag-checkered"></i>
            </span>
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-black text-slate-800 uppercase tracking-tight truncate">{milestone.name}</h4>
              <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">
                {new Date(milestone.startDate).toLocaleDateString('en-US', {month: 'short', day: 'numeric'})} — {new Date(milestone.endDate).toLocaleDateString('en-US', {month: 'short', day: 'numeric'})}
              </span>
            </div>
         </div>
         
         <div className="space-y-1.5">
            <div className="flex justify-between text-[8px] font-black uppercase tracking-widest text-slate-400">
               <span>Progress ({progress}%)</span>
               <span>{totalPoints} / {milestone.targetCapacity || '-'} pts</span>
            </div>
            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden flex">
               <div className="h-full bg-emerald-500 transition-all duration-700" style={{ width: `${progress}%` }} />
               {capacityPct !== null && totalPoints > (milestone.targetCapacity || 0) && (
                 <div className="h-full bg-red-400 animate-pulse flex-1" />
               )}
            </div>
         </div>
      </header>

      <div 
        ref={setNodeRef}
        className={`flex-1 rounded-[2.5rem] p-4 space-y-3 overflow-y-auto custom-scrollbar transition-all ${
          isOver ? 'bg-blue-50/50 border-2 border-dashed border-blue-200 shadow-inner' : 'bg-slate-50/50 border border-slate-100 shadow-inner'
        }`}
      >
         {items.map(item => (
           <DraggableItem key={(item._id || item.id) as string} item={item} onClick={() => onCardClick(item)} />
         ))}
         {items.length === 0 && (
           <div className="h-full flex flex-col items-center justify-center text-slate-200 opacity-40 py-20 text-center pointer-events-none">
              <i className="fas fa-arrow-down-to-bracket text-4xl mb-4"></i>
              <p className="text-[10px] font-black uppercase tracking-widest">Drop Items to Plan Cycle</p>
           </div>
         )}
      </div>
    </div>
  );
};

const WorkItemsMilestonePlanningView: React.FC<WorkItemsMilestonePlanningViewProps> = ({ 
  selBundleId, selAppId, searchQuery, bundles, applications 
}) => {
  const [items, setItems] = useState<WorkItem[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeItem, setActiveItem] = useState<WorkItem | null>(null);
  const [draggedItem, setDraggedItem] = useState<WorkItem | null>(null);
  const [isMilestoneModalOpen, setIsMilestoneModalOpen] = useState(false);
  const [newMilestone, setNewMilestone] = useState<Partial<Milestone>>({
    name: '', status: MilestoneStatus.PLANNED, startDate: new Date().toISOString().split('T')[0], endDate: new Date().toISOString().split('T')[0], targetCapacity: 0
  });

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const fetchData = async () => {
    setLoading(true);
    const params = new URLSearchParams({ bundleId: selBundleId, applicationId: selAppId, q: searchQuery });
    const [iRes, mRes] = await Promise.all([
      fetch(`/api/work-items?${params.toString()}`),
      fetch(`/api/milestones?${params.toString()}`)
    ]);
    setItems(await iRes.json());
    setMilestones(await mRes.json());
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [selBundleId, selAppId, searchQuery]);

  const handleDragStart = (event: any) => { setDraggedItem(event.active.data.current.item); };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setDraggedItem(null);
    if (!over) return;

    const itemId = active.id as string;
    const targetId = over.id as string;
    const milestoneIds = targetId === 'backlog' ? [] : [targetId];

    setItems(prev => prev.map(i => (i._id || i.id) === itemId ? { ...i, milestoneIds } : i));
    await fetch(`/api/work-items/${itemId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ milestoneIds })
    });
  };

  const handleCreateMilestone = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch('/api/milestones', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...newMilestone, bundleId: selBundleId !== 'all' ? selBundleId : undefined, applicationId: selAppId !== 'all' ? selAppId : undefined })
    });
    setIsMilestoneModalOpen(false);
    fetchData();
  };

  const unassignedItems = useMemo(() => items.filter(i => !i.milestoneIds || i.milestoneIds.length === 0), [items]);
  const { setNodeRef: setBacklogRef, isOver: isOverBacklog } = useDroppable({ id: 'backlog' });

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex h-[800px] bg-white rounded-[3rem] border border-slate-200 shadow-2xl overflow-hidden animate-fadeIn relative">
        <aside ref={setBacklogRef} className={`w-96 border-r border-slate-100 flex flex-col shrink-0 transition-all ${isOverBacklog ? 'bg-blue-50/50' : 'bg-slate-50/30'}`}>
          <header className="p-8 border-b border-slate-100 bg-white/50 backdrop-blur shrink-0">
            <div className="flex justify-between items-center mb-1">
               <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Execution Backlog</h3>
               {isOverBacklog && <span className="text-[9px] font-black text-blue-600 animate-pulse">DROP TO UNASSIGN</span>}
            </div>
            <p className="text-xs font-bold text-slate-500">{unassignedItems.length} items to be scheduled</p>
          </header>
          <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
             {unassignedItems.map(item => <DraggableItem key={(item._id || item.id) as string} item={item} onClick={() => setActiveItem(item)} />)}
          </div>
        </aside>

        <main className="flex-1 overflow-x-auto p-10 bg-white flex gap-10 custom-scrollbar">
           {milestones.length === 0 ? (
             <div className="flex-1 flex flex-col items-center justify-center text-center p-20 opacity-40">
                <i className="fas fa-route text-6xl mb-6"></i>
                <h4 className="text-lg font-black text-slate-900 tracking-tight uppercase">No Delivery Milestones Defined</h4>
                <p className="text-sm font-medium text-slate-500 max-w-sm mt-2 mb-6">Initialize your release schedule to start mapping work items to delivery windows.</p>
                <button 
                  onClick={() => setIsMilestoneModalOpen(true)}
                  className="px-8 py-3 bg-slate-900 text-white text-[10px] font-black rounded-xl uppercase tracking-widest hover:bg-blue-600 transition-all shadow-xl"
                >
                  Provision First Milestone
                </button>
             </div>
           ) : (
             <>
               {milestones.map(m => (
                 <MilestoneColumn key={m._id} milestone={m} items={items.filter(i => i.milestoneIds?.includes(m._id!))} onCardClick={setActiveItem} />
               ))}
               <button 
                onClick={() => setIsMilestoneModalOpen(true)}
                className="w-80 shrink-0 border-2 border-dashed border-slate-100 rounded-[2.5rem] flex flex-col items-center justify-center group hover:border-blue-200 transition-all hover:bg-blue-50/10"
               >
                  <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-300 group-hover:bg-blue-100 group-hover:text-blue-500 transition-all mb-4">
                    <i className="fas fa-plus"></i>
                  </div>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest group-hover:text-blue-600 transition-colors">Add Milestone</span>
               </button>
             </>
           )}
        </main>

        <DragOverlay>
           {draggedItem ? (
             <div className="bg-white border-2 border-blue-500 p-4 rounded-2xl shadow-2xl w-80 opacity-90 scale-105 cursor-grabbing rotate-2">
                <div className="flex justify-between items-start mb-2">
                   <span className="text-[9px] font-black text-blue-600 uppercase tracking-widest">{draggedItem.key}</span>
                </div>
                <h5 className="text-xs font-bold text-slate-700 leading-tight">{draggedItem.title}</h5>
             </div>
           ) : null}
        </DragOverlay>

        {activeItem && (
          <div className="absolute inset-y-0 right-0 w-[650px] bg-white shadow-2xl border-l border-slate-200 z-50 animate-slideIn">
             <WorkItemDetails item={activeItem} bundles={bundles} applications={applications} onUpdate={fetchData} onClose={() => setActiveItem(null)} />
          </div>
        )}

        {isMilestoneModalOpen && (
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-md z-[210] flex items-center justify-center p-6">
            <div className="bg-white rounded-[3rem] w-full max-w-xl p-12 shadow-2xl animate-fadeIn border border-slate-100">
              <h3 className="text-3xl font-black text-slate-900 tracking-tight mb-8 italic">Quick Milestone Provision</h3>
              <form onSubmit={handleCreateMilestone} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Release Name</label>
                  <input required value={newMilestone.name} onChange={(e) => setNewMilestone({...newMilestone, name: e.target.value})} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 text-slate-700 font-bold outline-none focus:border-blue-500 transition-all" placeholder="e.g. Q4 Platform Readiness" />
                </div>
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Start Date</label>
                    <input type="date" required value={newMilestone.startDate} onChange={(e) => setNewMilestone({...newMilestone, startDate: e.target.value})} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 text-slate-700 font-bold" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">End Date</label>
                    <input type="date" required value={newMilestone.endDate} onChange={(e) => setNewMilestone({...newMilestone, endDate: e.target.value})} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 text-slate-700 font-bold" />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Target Capacity (Story Points)</label>
                  <input type="number" value={newMilestone.targetCapacity} onChange={(e) => setNewMilestone({...newMilestone, targetCapacity: parseInt(e.target.value)})} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 text-slate-700 font-bold" />
                </div>
                <div className="flex gap-4 pt-8">
                  <button type="button" onClick={() => setIsMilestoneModalOpen(false)} className="flex-1 py-4 text-[10px] font-black text-slate-400 uppercase">Discard</button>
                  <button type="submit" className="flex-[2] py-4 bg-slate-900 text-white text-[10px] font-black rounded-2xl shadow-xl hover:bg-blue-600 transition-all uppercase tracking-widest">Commit Milestone</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </DndContext>
  );
};

export default WorkItemsMilestonePlanningView;
