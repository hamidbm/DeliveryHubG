
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

// Fix: Defined the missing interface WorkItemsBacklogViewProps for component props
interface WorkItemsBacklogViewProps {
  applications: Application[];
  bundles: Bundle[];
  selBundleId: string;
  selAppId: string;
  selMilestone: string;
  selEpicId: string;
  searchQuery: string;
  quickFilter: 'all' | 'my' | 'updated' | 'blocked';
  activeFilters?: { types: string[]; priorities: string[]; health: string[] };
  externalTrigger?: string | null;
  onTriggerProcessed?: () => void;
}

const SortableBacklogItem: React.FC<{ item: WorkItem, onClick: () => void }> = ({ item, onClick }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: (item._id || item.id) as string });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1, zIndex: isDragging ? 50 : 'auto' };
  const getIcon = (type: WorkItemType) => {
    switch (type) {
      case WorkItemType.EPIC: return 'fa-layer-group text-purple-500';
      case WorkItemType.BUG: return 'fa-bug text-red-500';
      default: return 'fa-file-lines text-blue-500';
    }
  };
  return (
    <div ref={setNodeRef} style={style} {...attributes} className="flex items-center gap-4 bg-white border border-slate-100 p-3 rounded-xl hover:shadow-md transition-all group">
      <div {...listeners} className="cursor-grab text-slate-200 hover:text-slate-400 px-1"><i className="fas fa-grip-vertical"></i></div>
      <div className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer" onClick={onClick}>
        <i className={`fas ${getIcon(item.type)} text-[10px]`}></i>
        <div className="flex items-center gap-2 w-20 shrink-0">
          <span className="text-[10px] font-black text-slate-400">{item.key}</span>
          {item.isFlagged && <i className="fas fa-flag text-red-500 text-[8px] animate-pulse"></i>}
        </div>
        <span className="text-sm font-bold text-slate-700 truncate">{item.title}</span>
      </div>
      {item.links && item.links.length > 0 && (
        <div className="flex items-center gap-1 flex-wrap">
          {Array.from(new Set(item.links.map(l => l.type))).slice(0, 2).map(t => (
            <span key={t} className="text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded border bg-slate-50 text-slate-500 border-slate-100">
              {t.replace(/_/g, ' ')}
            </span>
          ))}
        </div>
      )}
      <div className="flex items-center gap-3 shrink-0">
        <span className={`text-[8px] font-black px-2 py-0.5 rounded uppercase tracking-tighter ${item.priority === 'CRITICAL' ? 'bg-red-50 text-red-600' : 'bg-slate-50 text-slate-400'}`}>{item.priority}</span>
        <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-500">{item.storyPoints || '-'}</div>
      </div>
    </div>
  );
};

const SprintContainer: React.FC<{ sprint: Sprint, items: WorkItem[], onItemClick: (i: WorkItem) => void, onStartSprint?: () => void, onCompleteSprint?: () => void }> = ({ sprint, items, onItemClick, onStartSprint, onCompleteSprint }) => {
  const { setNodeRef } = useDroppable({ id: sprint._id! });
  const totalPoints = items.reduce((sum, i) => sum + (i.storyPoints || 0), 0);
  const donePoints = items.filter(i => i.status === WorkItemStatus.DONE).reduce((sum, i) => sum + (i.storyPoints || 0), 0);

  return (
    <div className="mb-10 animate-fadeIn">
      <div className="flex items-center justify-between mb-4 bg-slate-50 p-6 rounded-t-2xl border-x border-t border-slate-100">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
             <i className="fas fa-bolt text-amber-500"></i>
             <h4 className="font-black text-slate-800 uppercase tracking-tight">{sprint.name}</h4>
             <span className={`text-[8px] font-black px-2 py-0.5 rounded uppercase ${sprint.status === 'ACTIVE' ? 'bg-emerald-50 text-white' : 'bg-slate-200 text-slate-600'}`}>{sprint.status}</span>
          </div>
          <div className="h-6 w-[1px] bg-slate-200"></div>
          <div className="flex flex-col">
             <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Velocity</span>
             <span className="text-[10px] font-bold text-slate-600">{donePoints} / {totalPoints} pts</span>
          </div>
          {sprint.goal && (
            <div className="flex flex-col border-l border-slate-200 pl-6">
               <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Goal</span>
               <span className="text-[10px] font-bold text-slate-600 truncate max-w-md">{sprint.goal}</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-3">
           {sprint.status === 'PLANNED' ? (
             <button onClick={onStartSprint} className="px-6 py-2 bg-slate-900 text-white text-[9px] font-black uppercase rounded-xl hover:bg-blue-600 transition-all shadow-lg shadow-black/10">Start Sprint</button>
           ) : sprint.status === 'ACTIVE' ? (
             <button onClick={onCompleteSprint} className="px-6 py-2 bg-blue-600 text-white text-[9px] font-black uppercase rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20">Complete Sprint</button>
           ) : null}
        </div>
      </div>
      <div ref={setNodeRef} className="min-h-[100px] border border-slate-100 p-3 bg-slate-50/20 rounded-b-2xl space-y-2">
        <SortableContext items={items.map(i => (i._id || i.id) as string)} strategy={verticalListSortingStrategy}>
          {items.map(item => <SortableBacklogItem key={(item._id || item.id) as string} item={item} onClick={() => onItemClick(item)} />)}
        </SortableContext>
        {items.length === 0 && <div className="py-10 text-center text-slate-300 italic text-xs">Drag items here to plan your sprint</div>}
      </div>
    </div>
  );
};

// Fix: WorkItemsBacklogView now uses the defined WorkItemsBacklogViewProps interface
const WorkItemsBacklogView: React.FC<WorkItemsBacklogViewProps> = ({ applications, bundles, selBundleId, selAppId, selMilestone, selEpicId, searchQuery, quickFilter, activeFilters, externalTrigger, onTriggerProcessed }) => {
  const [items, setItems] = useState<WorkItem[]>([]);
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeItem, setActiveItem] = useState<WorkItem | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

  const fetchSprintsData = async () => {
    const params = new URLSearchParams();
    if (selBundleId !== 'all') params.set('bundleId', selBundleId);
    if (selAppId !== 'all') params.set('applicationId', selAppId);
    const res = await fetch(`/api/sprints?${params.toString()}`);
    setSprints(await res.json());
  };

  const fetchItems = async () => {
    setLoading(true);
    const params = new URLSearchParams({ bundleId: selBundleId, applicationId: selAppId, milestoneId: selMilestone, q: searchQuery, epicId: selEpicId });
    if (quickFilter) params.set('quickFilter', quickFilter);
    if (activeFilters?.types?.length) params.set('types', activeFilters.types.join(','));
    if (activeFilters?.priorities?.length) params.set('priorities', activeFilters.priorities.join(','));
    if (activeFilters?.health?.length) params.set('health', activeFilters.health.join(','));
    const res = await fetch(`/api/work-items?${params.toString()}`);
    setItems(await res.json());
    setLoading(false);
  };

  useEffect(() => { fetchSprintsData(); fetchItems(); }, [selBundleId, selAppId, selMilestone, selEpicId, searchQuery, quickFilter]);

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;
    const itemId = active.id as string;
    const overId = over.id as string;
    const targetSprint = sprints.find(s => s._id === overId);
    const item = items.find(i => (i._id || i.id) === itemId);

    if (targetSprint && item) {
       setItems(prev => prev.map(i => (i._id || i.id) === itemId ? { ...i, sprintId: targetSprint._id } : i));
       await fetch(`/api/work-items/${itemId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sprintId: targetSprint._id }) });
       return;
    }
    if (overId === 'backlog-droppable' && item) {
       setItems(prev => prev.map(i => (i._id || i.id) === itemId ? { ...i, sprintId: undefined } : i));
       await fetch(`/api/work-items/${itemId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sprintId: null }) });
       return;
    }
    if (active.id !== over.id) {
       const backlogIds = backlogItems.map(i => (i._id || i.id) as string);
       if (!backlogIds.includes(active.id as string) || !backlogIds.includes(over.id as string)) return;
       const oldIndex = backlogIds.findIndex(id => id === active.id);
       const newIndex = backlogIds.findIndex(id => id === over.id);
       const nextOrder = arrayMove(backlogIds, oldIndex, newIndex);

       const prevId = nextOrder[newIndex - 1];
       const nextId = nextOrder[newIndex + 1];
       const prevRank = prevId ? (items.find(i => (i._id || i.id) === prevId)?.rank || 0) : 0;
       const nextRank = nextId ? (items.find(i => (i._id || i.id) === nextId)?.rank || 0) : 0;
       let newRank = prevRank + 1000;
       if (nextRank && nextRank > prevRank) newRank = Math.floor((prevRank + nextRank) / 2);

       setItems((all) => {
         const backlog = all.filter(i => !i.sprintId);
         const sprintItems = all.filter(i => i.sprintId);
         const backlogMap = new Map(backlog.map(i => [(i._id || i.id) as string, i]));
         const reordered = nextOrder.map(id => backlogMap.get(id)!).filter(Boolean);
         return [...reordered, ...sprintItems];
       });

       await fetch(`/api/work-items/${active.id}`, {
         method: 'PATCH',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ rank: newRank })
       });
    }
  };

  const createSprint = async () => {
    const name = window.prompt("Enter Sprint Name:");
    const goal = window.prompt("Sprint Goal:");
    if (!name) return;
    await fetch('/api/sprints', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, goal, status: 'PLANNED', bundleId: selBundleId, applicationId: selAppId }) });
    fetchSprintsData();
  };

  const completeSprint = async (sprintId: string) => {
    if (!window.confirm("Complete Sprint? Incomplete items will be moved back to the backlog.")) return;
    const sprintItems = items.filter(i => i.sprintId === sprintId && i.status !== WorkItemStatus.DONE);
    await Promise.all([
      fetch(`/api/sprints`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ _id: sprintId, status: 'CLOSED' }) }),
      ...sprintItems.map(item => fetch(`/api/work-items/${item._id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sprintId: null }) }))
    ]);
    fetchSprintsData();
    fetchItems();
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
        </header>
        <div className="flex-1 overflow-y-auto p-10 custom-scrollbar bg-[#FDFDFD]">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            {sprints.filter(s => s.status !== 'CLOSED').map(s => <SprintContainer key={s._id} sprint={s} items={items.filter(i => i.sprintId === s._id)} onItemClick={setActiveItem} onStartSprint={() => fetch('/api/sprints', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ _id: s._id, status: 'ACTIVE' }) }).then(fetchSprintsData)} onCompleteSprint={() => completeSprint(s._id!)} />)}
            <div className="mt-12">
               <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-3 px-4"><i className="fas fa-layer-group"></i> Active Backlog ({backlogItems.length})</h4>
               <div ref={setBacklogRef} className="min-h-[200px] bg-slate-50/10 p-2 rounded-2xl border border-dashed border-slate-100">
                  <SortableContext items={backlogItems.map(i => (i._id || i.id) as string)} strategy={verticalListSortingStrategy}>
                    <div className="space-y-2">{backlogItems.map(item => <SortableBacklogItem key={(item._id || item.id) as string} item={item} onClick={() => setActiveItem(item)} />)}</div>
                  </SortableContext>
               </div>
            </div>
          </DndContext>
        </div>
      </div>
      {activeItem && <div className="absolute inset-y-0 right-0 w-[650px] bg-white shadow-2xl border-l border-slate-200 z-50 animate-slideIn"><WorkItemDetails item={activeItem} bundles={bundles} applications={applications} onUpdate={() => { fetchItems(); fetchSprintsData(); }} onClose={() => setActiveItem(null)} /></div>}
    </div>
  );
};

export default WorkItemsBacklogView;
