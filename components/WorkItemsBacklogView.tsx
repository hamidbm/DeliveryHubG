
import React, { useState, useEffect, useMemo } from 'react';
import { WorkItem, WorkItemType, WorkItemStatus, Bundle, Application, Sprint } from '../types';
import WorkItemDetails from './WorkItemDetails';
import CreateWorkItemModal from './CreateWorkItemModal';
import { 
  DndContext, 
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  useDroppable
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface WorkItemsBacklogViewProps {
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

const SortableBacklogItem: React.FC<{ item: WorkItem, onClick: () => void }> = ({ item, onClick }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: (item._id || item.id) as string });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : 'auto'
  };

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
      {...attributes} 
      className="flex items-center gap-4 bg-white border border-slate-100 p-3 rounded-xl hover:shadow-md transition-all group"
    >
      <div {...listeners} className="cursor-grab text-slate-200 hover:text-slate-400 px-1">
        <i className="fas fa-grip-vertical"></i>
      </div>
      <div className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer" onClick={onClick}>
        <i className={`fas ${getIcon(item.type)} text-[10px]`}></i>
        <span className="text-[10px] font-black text-slate-400 w-16 shrink-0">{item.key}</span>
        <span className="text-sm font-bold text-slate-700 truncate">{item.title}</span>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <span className={`text-[8px] font-black px-2 py-0.5 rounded uppercase tracking-tighter ${
          item.priority === 'CRITICAL' ? 'bg-red-50 text-red-600' : 'bg-slate-50 text-slate-400'
        }`}>
          {item.priority}
        </span>
        <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-500">
          {item.storyPoints || '-'}
        </div>
      </div>
    </div>
  );
};

const SprintContainer: React.FC<{ 
  sprint: Sprint, 
  items: WorkItem[], 
  onItemClick: (i: WorkItem) => void,
  onStartSprint?: () => void
}> = ({ sprint, items, onItemClick, onStartSprint }) => {
  const { setNodeRef } = useDroppable({ id: sprint._id! });
  const totalPoints = items.reduce((sum, i) => sum + (i.storyPoints || 0), 0);

  return (
    <div className="mb-10 animate-fadeIn">
      <div className="flex items-center justify-between mb-4 bg-slate-50 p-4 rounded-t-2xl border-x border-t border-slate-100">
        <div className="flex items-center gap-4">
          <i className="fas fa-bolt text-amber-500"></i>
          <h4 className="font-black text-slate-800 uppercase tracking-tight">{sprint.name}</h4>
          <span className={`text-[8px] font-black px-2 py-0.5 rounded uppercase ${sprint.status === 'ACTIVE' ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-600'}`}>
            {sprint.status}
          </span>
          <span className="text-[10px] text-slate-400 font-bold">{items.length} items • {totalPoints} pts</span>
        </div>
        <div className="flex items-center gap-3">
           {sprint.status === 'PLANNED' && (
             <button onClick={onStartSprint} className="px-4 py-1.5 bg-slate-900 text-white text-[9px] font-black uppercase rounded-lg hover:bg-blue-600 transition-all">Start Sprint</button>
           )}
           <button className="text-slate-400 hover:text-slate-600"><i className="fas fa-ellipsis"></i></button>
        </div>
      </div>
      <div 
        ref={setNodeRef}
        className="min-h-[100px] border border-slate-100 p-2 bg-slate-50/20 rounded-b-2xl space-y-2"
      >
        <SortableContext 
          items={items.map(i => (i._id || i.id) as string)} 
          strategy={verticalListSortingStrategy}
        >
          {items.map(item => (
            <SortableBacklogItem key={(item._id || item.id) as string} item={item} onClick={() => onItemClick(item)} />
          ))}
        </SortableContext>
        {items.length === 0 && (
          <div className="py-10 text-center text-slate-300 italic text-xs">Drag items here to plan your sprint</div>
        )}
      </div>
    </div>
  );
};

const WorkItemsBacklogView: React.FC<WorkItemsBacklogViewProps> = ({ 
  applications, bundles, selBundleId, selAppId, selMilestone, selEpicId, searchQuery, externalTrigger, onTriggerProcessed 
}) => {
  const [items, setItems] = useState<WorkItem[]>([]);
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeItem, setActiveItem] = useState<WorkItem | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const fetchSprintsData = async () => {
    const params = new URLSearchParams();
    if (selBundleId !== 'all') params.set('bundleId', selBundleId);
    if (selAppId !== 'all') params.set('applicationId', selAppId);
    const res = await fetch(`/api/sprints?${params.toString()}`);
    setSprints(await res.json());
  };

  const fetchItems = async () => {
    setLoading(true);
    const params = new URLSearchParams({
      bundleId: selBundleId,
      applicationId: selAppId,
      milestoneId: selMilestone,
      q: searchQuery,
      epicId: selEpicId
    });
    const res = await fetch(`/api/work-items?${params.toString()}`);
    setItems(await res.json());
    setLoading(false);
  };

  useEffect(() => {
    fetchSprintsData();
    fetchItems();
  }, [selBundleId, selAppId, selMilestone, selEpicId, searchQuery]);

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    const itemId = active.id as string;
    const overId = over.id as string;

    // Check if moving to a sprint container
    const targetSprint = sprints.find(s => s._id === overId);
    const item = items.find(i => (i._id || i.id) === itemId);

    if (targetSprint && item) {
       // Update sprintId for the item
       setItems(prev => prev.map(i => (i._id || i.id) === itemId ? { ...i, sprintId: targetSprint._id } : i));
       await fetch(`/api/work-items/${itemId}`, {
         method: 'PATCH',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ sprintId: targetSprint._id })
       });
       return;
    }

    // Move to Backlog (unassigned)
    if (overId === 'backlog-droppable' && item) {
       setItems(prev => prev.map(i => (i._id || i.id) === itemId ? { ...i, sprintId: undefined } : i));
       await fetch(`/api/work-items/${itemId}`, {
         method: 'PATCH',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ sprintId: null })
       });
       return;
    }

    // Standard reorder
    if (active.id !== over.id) {
       setItems((items) => {
         const oldIndex = items.findIndex(i => (i._id || i.id) === active.id);
         const newIndex = items.findIndex(i => (i._id || i.id) === over.id);
         return arrayMove(items, oldIndex, newIndex);
       });
    }
  };

  const createSprint = async () => {
    const name = window.prompt("Enter Sprint Name (e.g. Sprint 24.01):");
    if (!name) return;
    await fetch('/api/sprints', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, status: 'PLANNED', bundleId: selBundleId, applicationId: selAppId })
    });
    fetchSprintsData();
  };

  const startSprint = async (sprintId: string) => {
    await fetch(`/api/sprints`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ _id: sprintId, status: 'ACTIVE' })
    });
    fetchSprintsData();
  };

  const backlogItems = useMemo(() => items.filter(i => !i.sprintId), [items]);
  const { setNodeRef: setBacklogRef } = useDroppable({ id: 'backlog-droppable' });

  return (
    <div className="flex h-[800px] bg-white rounded-[3rem] border border-slate-200 shadow-2xl overflow-hidden animate-fadeIn relative">
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="px-10 py-6 border-b border-slate-100 flex items-center justify-between shrink-0 bg-slate-50/30">
           <div className="flex items-center gap-6">
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Delivery Planning Engine</h3>
              <div className="h-6 w-[1px] bg-slate-200"></div>
              <button onClick={createSprint} className="text-[10px] font-black text-blue-600 bg-blue-50 px-4 py-2 rounded-xl uppercase tracking-widest hover:bg-blue-100 transition-all">+ Create Sprint</button>
           </div>
           <button onClick={() => setIsCreating(true)} className="text-[10px] font-black text-slate-400 uppercase hover:text-blue-600">+ Add Requirement</button>
        </header>

        <div className="flex-1 overflow-y-auto p-10 custom-scrollbar bg-[#FDFDFD]">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            
            {/* Sprints Section */}
            {sprints.map(s => (
              <SprintContainer 
                key={s._id} 
                sprint={s} 
                items={items.filter(i => i.sprintId === s._id)} 
                onItemClick={setActiveItem}
                onStartSprint={() => startSprint(s._id!)}
              />
            ))}

            {/* Backlog Section */}
            <div className="mt-12">
               <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-3 px-4">
                 <i className="fas fa-layer-group"></i>
                 Active Backlog ({backlogItems.length})
               </h4>
               <div ref={setBacklogRef} className="min-h-[200px] bg-slate-50/10 p-2 rounded-2xl border border-dashed border-slate-100">
                  <SortableContext items={backlogItems.map(i => (i._id || i.id) as string)} strategy={verticalListSortingStrategy}>
                    <div className="space-y-2">
                      {backlogItems.map(item => (
                        <SortableBacklogItem key={(item._id || item.id) as string} item={item} onClick={() => setActiveItem(item)} />
                      ))}
                      {backlogItems.length === 0 && !loading && (
                        <div className="py-20 text-center text-slate-200">
                           <p className="text-xs font-bold uppercase tracking-widest">Backlog is empty.</p>
                        </div>
                      )}
                    </div>
                  </SortableContext>
               </div>
            </div>

          </DndContext>
        </div>
      </div>

      {activeItem && (
        <div className="absolute inset-y-0 right-0 w-[650px] bg-white shadow-2xl border-l border-slate-200 z-50 animate-slideIn">
           <WorkItemDetails 
             item={activeItem} 
             bundles={bundles} 
             applications={applications} 
             onUpdate={() => { fetchItems(); fetchSprintsData(); }} 
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
          onSuccess={() => { setIsCreating(false); fetchItems(); }}
        />
      )}
    </div>
  );
};

export default WorkItemsBacklogView;
