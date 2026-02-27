
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

  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, zIndex: 50 } : undefined;
  const getIcon = (type: WorkItemType) => {
    switch (type) {
      case WorkItemType.EPIC: return 'fa-layer-group text-purple-500';
      case WorkItemType.BUG: return 'fa-bug text-red-500';
      case WorkItemType.RISK: return 'fa-triangle-exclamation text-rose-500';
      case WorkItemType.DEPENDENCY: return 'fa-link text-indigo-500';
      default: return 'fa-file-lines text-blue-500';
    }
  };

  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes} onClick={onClick} className={`bg-white border border-slate-100 p-4 rounded-2xl shadow-sm hover:shadow-md transition-all group cursor-grab active:cursor-grabbing ${isDragging ? 'opacity-30' : ''}`}>
       <div className="flex justify-between items-start mb-2">
          <div className="flex items-center gap-2">
             <i className={`fas ${getIcon(item.type)} text-[10px]`}></i>
             <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">{item.key}</span>
          </div>
          {item.isFlagged && <i className="fas fa-flag text-red-500 text-[8px] animate-pulse"></i>}
       </div>
       <h5 className="text-xs font-bold text-slate-700 leading-tight mb-3 pointer-events-none">{item.title}</h5>
       <div className="flex items-center justify-between">
          <span className="text-[8px] font-black text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">{item.storyPoints || 0} pts</span>
          <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(item.assignedTo || 'U')}&background=random&size=24`} className="w-4 h-4 rounded-full" />
       </div>
    </div>
  );
};

const MilestoneColumn: React.FC<{ milestone: Milestone; items: WorkItem[]; onCardClick: (i: WorkItem) => void }> = ({ milestone, items, onCardClick }) => {
  const { setNodeRef, isOver } = useDroppable({ id: milestone._id as string });
  const totalPoints = items.reduce((acc, curr) => acc + (curr.storyPoints || 0), 0);
  const progress = items.length > 0 ? Math.round((items.filter(i => i.status === WorkItemStatus.DONE).length / items.length) * 100) : 0;
  const utilization = milestone.targetCapacity ? Math.round((totalPoints / milestone.targetCapacity) * 100) : null;
  const isOverCapacity = utilization && utilization > 100;

  return (
    <div className="w-80 flex flex-col shrink-0">
      <header className={`mb-6 p-4 rounded-[2rem] transition-all ${isOverCapacity ? 'bg-red-50 border-red-100' : 'bg-transparent'}`}>
         <div className="flex items-center gap-3 mb-4">
            <span className={`w-8 h-8 rounded-xl flex items-center justify-center text-[10px] font-black ${isOver ? 'bg-blue-600 text-white animate-pulse' : 'bg-slate-900 text-white'}`}><i className="fas fa-flag-checkered"></i></span>
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-black uppercase tracking-tight truncate">{milestone.name}</h4>
              <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">{new Date(milestone.startDate).toLocaleDateString()} — {new Date(milestone.endDate).toLocaleDateString()}</span>
            </div>
         </div>
         <div className="space-y-1.5 px-1">
            <div className="flex justify-between text-[8px] font-black uppercase tracking-widest">
               <span className={isOverCapacity ? 'text-red-500' : 'text-slate-400'}>Utilization {utilization ? `(${utilization}%)` : ''}</span>
               <span className={isOverCapacity ? 'text-red-600' : 'text-slate-600'}>{totalPoints} / {milestone.targetCapacity || '∞'} pts</span>
            </div>
            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden flex"><div className={`h-full transition-all duration-700 ${isOverCapacity ? 'bg-red-500' : 'bg-blue-600'}`} style={{ width: `${Math.min(utilization || 0, 100)}%` }} /></div>
         </div>
      </header>
      <div ref={setNodeRef} className={`flex-1 rounded-[2.5rem] p-4 space-y-3 overflow-y-auto custom-scrollbar border transition-all ${isOver ? 'bg-blue-50/50 border-dashed border-blue-200 shadow-inner' : 'bg-slate-50/50 border-slate-100'}`}>
         {items.map(item => <DraggableItem key={(item._id || item.id) as string} item={item} onClick={() => onCardClick(item)} />)}
      </div>
    </div>
  );
};

const WorkItemsMilestonePlanningView: React.FC<WorkItemsMilestonePlanningViewProps> = ({ selBundleId, selAppId, searchQuery, bundles, applications }) => {
  const [items, setItems] = useState<WorkItem[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeItem, setActiveItem] = useState<WorkItem | null>(null);
  const [draggedItem, setDraggedItem] = useState<WorkItem | null>(null);
  const { setNodeRef: setBacklogRef, isOver: isOverBacklog } = useDroppable({ id: 'backlog' });

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const fetchData = async () => {
    const params = new URLSearchParams({ bundleId: selBundleId, applicationId: selAppId, q: searchQuery });
    const [iRes, mRes] = await Promise.all([fetch(`/api/work-items?${params.toString()}`), fetch(`/api/milestones?${params.toString()}`)]);
    setItems(await iRes.json());
    setMilestones(await mRes.json());
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [selBundleId, selAppId, searchQuery]);

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setDraggedItem(null);
    if (!over) return;
    const itemId = active.id as string;
    const targetId = over.id as string;
    const milestoneIds = targetId === 'backlog' ? [] : [targetId];
    setItems(prev => prev.map(i => (i._id || i.id) === itemId ? { ...i, milestoneIds } : i));
    await fetch(`/api/work-items/${itemId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ milestoneIds }) });
  };

  const loadPerEngineer = useMemo(() => {
    const load: Record<string, number> = {};
    items.forEach(i => {
      if (i.assignedTo && i.status !== WorkItemStatus.DONE) {
        load[i.assignedTo] = (load[i.assignedTo] || 0) + (i.storyPoints || 0);
      }
    });
    return Object.entries(load).sort((a, b) => b[1] - a[1]);
  }, [items]);

  return (
    <DndContext sensors={sensors} onDragStart={(e) => setDraggedItem(e.active.data.current?.item)} onDragEnd={handleDragEnd}>
      <div className="flex h-[800px] bg-white rounded-[3rem] border border-slate-200 shadow-2xl overflow-hidden animate-fadeIn relative">
        <aside className="w-[380px] border-r border-slate-100 flex flex-col shrink-0">
          <div className="p-8 border-b border-slate-100 bg-slate-50/50">
             <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Execution Backlog</h3>
             <p className="text-xs font-bold text-slate-500">{items.filter(i => !i.milestoneIds?.length).length} unscheduled artifacts</p>
          </div>
          <div
            ref={setBacklogRef}
            className={`flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar transition-all ${isOverBacklog ? 'bg-blue-50/50 border-2 border-dashed border-blue-200' : 'bg-slate-50/20'}`}
          >
             {items.filter(i => !i.milestoneIds?.length).map(item => <DraggableItem key={(item._id || item.id) as string} item={item} onClick={() => setActiveItem(item)} />)}
          </div>
          <div className="p-6 border-t border-slate-100 bg-white">
             <h4 className="text-[9px] font-black text-slate-300 uppercase tracking-widest mb-4">Engineer Load Intelligence</h4>
             <div className="space-y-4 max-h-48 overflow-y-auto custom-scrollbar pr-2">
                {loadPerEngineer.map(([name, points]) => (
                  <div key={name} className="flex flex-col gap-1.5">
                     <div className="flex justify-between items-center text-[10px] font-bold">
                        <span className="text-slate-600 truncate mr-2">{name}</span>
                        <span className={points > 8 ? 'text-red-500 font-black' : 'text-slate-400'}>{points} pts</span>
                     </div>
                     <div className="h-1 bg-slate-100 rounded-full overflow-hidden"><div className={`h-full transition-all duration-700 ${points > 8 ? 'bg-red-500' : 'bg-emerald-500'}`} style={{ width: `${Math.min((points / 8) * 100, 100)}%` }} /></div>
                  </div>
                ))}
             </div>
          </div>
        </aside>

        <main className="flex-1 overflow-x-auto p-10 bg-white flex gap-10 custom-scrollbar">
           {milestones.map(m => <MilestoneColumn key={m._id} milestone={m} items={items.filter(i => i.milestoneIds?.includes(m._id!))} onCardClick={setActiveItem} />)}
           <div className="w-80 shrink-0 border-2 border-dashed border-slate-100 rounded-[2.5rem] flex flex-col items-center justify-center opacity-40 hover:opacity-100 transition-all cursor-pointer"><i className="fas fa-plus mb-2"></i><span className="text-[10px] font-black uppercase tracking-widest">New Cycle</span></div>
        </main>

        <DragOverlay>
           {draggedItem && <div className="bg-white border-2 border-blue-500 p-4 rounded-2xl shadow-2xl w-80 opacity-90 rotate-2"><h5 className="text-xs font-bold text-slate-700">{draggedItem.title}</h5></div>}
        </DragOverlay>

        {activeItem && <div className="absolute inset-y-0 right-0 w-[650px] bg-white shadow-2xl border-l border-slate-200 z-50 animate-slideIn"><WorkItemDetails item={activeItem} bundles={bundles} applications={applications} onUpdate={fetchData} onClose={() => setActiveItem(null)} /></div>}
      </div>
    </DndContext>
  );
};

export default WorkItemsMilestonePlanningView;
