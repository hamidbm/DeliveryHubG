
import React, { useState, useEffect, useMemo } from 'react';
import { 
  DndContext, 
  useDraggable, 
  useDroppable, 
  DragEndEvent, 
  PointerSensor, 
  useSensor, 
  useSensors,
  DragOverlay,
  defaultDropAnimationSideEffects
} from '@dnd-kit/core';
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

// Fix: Use React.FC to allow standard props like key in the call site
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
       </div>
       <h5 className="text-xs font-bold text-slate-700 leading-tight mb-3 group-hover:text-blue-600 transition-colors pointer-events-none">{item.title}</h5>
       <div className="flex items-center justify-between pointer-events-none">
          <div className="flex items-center gap-2">
             <span className={`text-[8px] font-black px-1.5 py-0.5 rounded bg-slate-50 text-slate-400 uppercase`}>{item.priority}</span>
             {item.storyPoints && <span className="text-[8px] font-black text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">{item.storyPoints} pts</span>}
          </div>
          <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(item.assignedTo || 'U')}&background=random&size=24`} className="w-4 h-4 rounded-full" />
       </div>
    </div>
  );
};

// Fix: Use React.FC to allow standard props like key in the call site
const MilestoneColumn: React.FC<{ id: string; items: WorkItem[]; onCardClick: (i: WorkItem) => void }> = ({ id, items, onCardClick }) => {
  const { setNodeRef, isOver } = useDroppable({
    id: id,
  });

  const points = items.reduce((acc, curr) => acc + (curr.storyPoints || 0), 0);

  return (
    <div className="w-80 flex flex-col shrink-0">
      <header className="mb-6 flex items-center justify-between px-4">
         <div className="flex items-center gap-3">
            <span className={`w-8 h-8 rounded-xl flex items-center justify-center text-[10px] font-black transition-all ${isOver ? 'bg-blue-600 text-white animate-pulse' : 'bg-slate-900 text-white'}`}>
              {id}
            </span>
            <div>
              <h4 className="text-sm font-black text-slate-800 uppercase tracking-tight">Milestone {id.substring(1)}</h4>
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{items.length} Items • {points} pts</span>
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
           <div className="h-full flex flex-col items-center justify-center text-slate-200 opacity-40 py-20 pointer-events-none">
              <i className="fas fa-arrow-down-to-bracket text-4xl mb-4"></i>
              <p className="text-[10px] font-black uppercase tracking-widest text-center">Drop Items Here<br/>to Plan {id}</p>
           </div>
         )}
      </div>
    </div>
  );
};

const WorkItemsMilestonePlanningView: React.FC<WorkItemsMilestonePlanningViewProps> = ({ 
  applications, bundles, selBundleId, selAppId, searchQuery 
}) => {
  const [items, setItems] = useState<WorkItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeItem, setActiveItem] = useState<WorkItem | null>(null);
  const [draggedItem, setDraggedItem] = useState<WorkItem | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

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

  const handleDragStart = (event: any) => {
    setDraggedItem(event.active.data.current.item);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setDraggedItem(null);
    
    if (!over) return;

    const itemId = active.id as string;
    const targetMilestone = over.id as string;
    
    // If target is 'backlog', we unassign the milestone
    const milestoneIds = targetMilestone === 'backlog' ? [] : [targetMilestone];

    // Optimistic local update
    setItems(prev => prev.map(i => {
      if ((i._id || i.id) === itemId) {
        return { ...i, milestoneIds };
      }
      return i;
    }));

    // Persistence
    try {
      await fetch(`/api/work-items/${itemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ milestoneIds })
      });
    } catch (e) {
      console.error("Failed to save milestone mapping", e);
      fetchItems(); // Rollback on error
    }
  };

  const unassignedItems = useMemo(() => items.filter(i => !i.milestoneIds || i.milestoneIds.length === 0), [items]);
  
  const { setNodeRef: setBacklogRef, isOver: isOverBacklog } = useDroppable({
    id: 'backlog',
  });

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex h-[800px] bg-white rounded-[3rem] border border-slate-200 shadow-2xl overflow-hidden animate-fadeIn relative">
        {/* Sidebar: Unassigned Items (Backlog) */}
        <aside 
          ref={setBacklogRef}
          className={`w-96 border-r border-slate-100 flex flex-col shrink-0 transition-all ${
            isOverBacklog ? 'bg-blue-50/50' : 'bg-slate-50/30'
          }`}
        >
          <header className="p-8 border-b border-slate-100 bg-white/50 backdrop-blur shrink-0">
            <div className="flex justify-between items-center mb-1">
               <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Planning Backlog</h3>
               {isOverBacklog && <span className="text-[9px] font-black text-blue-600 animate-pulse">DROP TO UNASSIGN</span>}
            </div>
            <p className="text-xs font-bold text-slate-500">{unassignedItems.length} items to be scheduled</p>
          </header>
          <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
             {unassignedItems.map(item => (
               <DraggableItem key={(item._id || item.id) as string} item={item} onClick={() => setActiveItem(item)} />
             ))}
             {unassignedItems.length === 0 && (
               <div className="py-20 text-center px-10">
                 <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">All work items in current scope have been assigned to milestones.</p>
               </div>
             )}
          </div>
        </aside>

        {/* Main Content: Milestone Columns */}
        <main className="flex-1 overflow-x-auto p-10 bg-white flex gap-6 custom-scrollbar">
           {MILESTONE_BUCKETS.map(m => (
             <MilestoneColumn 
               key={m} 
               id={m} 
               items={items.filter(i => i.milestoneIds?.includes(m))} 
               onCardClick={setActiveItem} 
             />
           ))}
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
      
      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; height: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
      `}</style>
    </DndContext>
  );
};

export default WorkItemsMilestonePlanningView;
