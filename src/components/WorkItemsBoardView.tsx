
import React, { useState, useEffect, useMemo } from 'react';
import { 
  DndContext, DragOverlay, closestCorners, KeyboardSensor, PointerSensor, useSensor, useSensors, DragStartEvent, DragOverEvent, DragEndEvent
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { WorkItem, WorkItemType, Bundle, Application, Sprint } from '../types';
import KanbanColumn from './KanbanColumn';
import WorkItemCard from './WorkItemCard';
import WorkItemDetails from './WorkItemDetails';
import CreateWorkItemModal from './CreateWorkItemModal';

interface WorkItemsBoardViewProps {
  applications: Application[];
  bundles: Bundle[];
  selBundleId: string;
  selAppId: string;
  selMilestone: string;
  selEpicId: string;
  searchQuery: string;
  quickFilter?: string;
  activeFilters?: { types: string[]; priorities: string[]; health: string[] };
  includeArchived?: boolean;
  externalTrigger?: string | null;
  onTriggerProcessed?: () => void;
}

const WorkItemsBoardView: React.FC<WorkItemsBoardViewProps> = ({ 
  applications, bundles, selBundleId, selAppId, selMilestone, selEpicId, searchQuery, quickFilter, activeFilters, includeArchived, externalTrigger, onTriggerProcessed 
}) => {
  const [boardData, setBoardData] = useState<{ columns: any[] }>({ columns: [] });
  const [items, setItems] = useState<WorkItem[]>([]);
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [activeSprintId, setActiveSprintId] = useState<string>('all');
  const [activeItem, setActiveItem] = useState<WorkItem | null>(null);
  const [draggedItem, setDraggedItem] = useState<WorkItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [groupBy, setGroupBy] = useState<'status' | 'assignee' | 'epic'>('status');

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const activeBundle = useMemo(() => bundles.find(b => b._id === selBundleId), [bundles, selBundleId]);
  const wipLimits = activeBundle?.wipLimits || {};

  const fetchBoard = async () => {
    setLoading(true);
    const params = new URLSearchParams({
      bundleId: selBundleId, applicationId: selAppId, milestoneId: selMilestone, q: searchQuery, epicId: selEpicId, sprintId: activeSprintId
    });
    if (quickFilter) params.set('quickFilter', quickFilter);
    if (activeFilters?.types?.length) params.set('types', activeFilters.types.join(','));
    if (activeFilters?.priorities?.length) params.set('priorities', activeFilters.priorities.join(','));
    if (activeFilters?.health?.length) params.set('health', activeFilters.health.join(','));
    if (includeArchived) params.set('includeArchived', 'true');

    try {
      if (groupBy === 'status') {
        const res = await fetch(`/api/work-items/board?${params.toString()}`);
        const data = await res.json();
        setBoardData(data);
      } else {
        const res = await fetch(`/api/work-items?${params.toString()}`);
        const data = await res.json();
        setItems(data);
        const columns = buildGroupedColumns(data, groupBy);
        setBoardData({ columns });
      }
    } catch (err) { console.error("Board fetch failed", err); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    fetch(`/api/sprints?bundleId=${selBundleId}&applicationId=${selAppId}`).then(r => r.json()).then(setSprints);
  }, [selBundleId, selAppId]);

  useEffect(() => { fetchBoard(); }, [selBundleId, selAppId, selMilestone, selEpicId, searchQuery, activeSprintId, quickFilter, groupBy]);

  useEffect(() => {
    if (externalTrigger === 'create-item') {
      setIsCreating(true);
      onTriggerProcessed?.();
    }
  }, [externalTrigger, onTriggerProcessed]);

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const item = boardData.columns.flatMap(c => c.items).find(i => (i._id || i.id) === active.id);
    setDraggedItem(item);
  };

  const findColumnByItemId = (itemId: string) =>
    boardData.columns.find(c => c.items.some((i: any) => (i._id || i.id) === itemId));

  const findColumnById = (id: string) =>
    boardData.columns.find(c => c.statusId === id);

  const handleDragOver = (event: DragOverEvent) => {
    if (groupBy !== 'status') return;
    const { active, over } = event;
    if (!over) return;
    const activeId = active.id as string;
    const overId = over.id as string;
    if (activeId === overId) return;

    const activeCol = findColumnByItemId(activeId);
    if (!activeCol) return;
    const overCol = findColumnByItemId(overId) || findColumnById(overId);
    if (!overCol) return;
    if (activeCol.statusId === overCol.statusId) return;

    setBoardData(prev => {
      const nextCols = prev.columns.map(col => {
        if (col.statusId === activeCol.statusId) {
          return { ...col, items: col.items.filter((i: any) => (i._id || i.id) !== activeId) };
        }
        if (col.statusId === overCol.statusId) {
          const nextItems = [...col.items];
          const insertIndex = col.items.findIndex((i: any) => (i._id || i.id) === overId);
          const item = activeCol.items.find((i: any) => (i._id || i.id) === activeId);
          if (!item) return col;
          if (insertIndex >= 0) nextItems.splice(insertIndex, 0, { ...item, status: overCol.statusId });
          else nextItems.push({ ...item, status: overCol.statusId });
          return { ...col, items: nextItems };
        }
        return col;
      });
      return { columns: nextCols };
    });
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setDraggedItem(null);
    if (!over) return;
    if (groupBy !== 'status') return;

    const activeCol = findColumnByItemId(active.id as string);
    if (!activeCol) return;

    const overId = over.id as string;
    const overCol = findColumnByItemId(overId) || findColumnById(overId);
    if (!overCol) return;

    const itemId = active.id as string;
    const item = overCol.items.find((i: any) => (i._id || i.id) === itemId) 
      || activeCol.items.find((i: any) => (i._id || i.id) === itemId);
    if (!item) return;

    const overIndex = overCol.items.findIndex((i: any) => (i._id || i.id) === overId);
    const insertIndex = overIndex >= 0 ? overIndex : overCol.items.length - 1;
    const prevRank = insertIndex > 0 ? (overCol.items[insertIndex - 1]?.rank || 0) : 0;
    const nextRank = overCol.items[insertIndex + 1]?.rank;
    let newRank = prevRank + 1000;
    if (nextRank && nextRank > prevRank) {
      newRank = Math.floor((prevRank + nextRank) / 2);
    } else if (overCol.items.length === 0) {
      newRank = 1000;
    }

    try {
      const res = await fetch(`/api/work-items/${active.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toStatus: overCol.statusId, newRank })
      });
      if (!res.ok) throw new Error('Status update failed');
      await fetchBoard();
    } catch (err) { fetchBoard(); }
  };

  const buildGroupedColumns = (data: WorkItem[], mode: 'status' | 'assignee' | 'epic') => {
    if (mode === 'assignee') {
      const groups = new Map<string, WorkItem[]>();
      data.forEach(item => {
        const key = item.assignedTo || 'Unassigned';
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(item);
      });
      return Array.from(groups.entries()).map(([key, list]) => ({
        statusId: key,
        statusName: key,
        items: list
      }));
    }
    if (mode === 'epic') {
      const epics = new Map<string, WorkItem>();
      data.filter(i => i.type === WorkItemType.EPIC).forEach(e => epics.set((e._id || e.id) as string, e));
      const groups = new Map<string, WorkItem[]>();
      data.forEach(item => {
        const key = item.parentId && epics.has(item.parentId) ? item.parentId : 'no-epic';
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(item);
      });
      return Array.from(groups.entries()).map(([key, list]) => {
        const epic = key !== 'no-epic' ? epics.get(key) : null;
        return {
          statusId: key,
          statusName: epic ? `${epic.key}: ${epic.title}` : 'No Epic',
          items: list
        };
      });
    }
    return [];
  };

  return (
    <div className="flex flex-col h-[850px] overflow-hidden relative">
      <div className="flex items-center justify-between mb-6 px-4 shrink-0">
         <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl">
               <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-3">Sprint:</span>
               <select value={activeSprintId} onChange={(e) => setActiveSprintId(e.target.value)} className="bg-transparent text-[10px] font-bold outline-none cursor-pointer">
                 <option value="all">Active Backlog</option>
                 {sprints.map(s => <option key={s._id} value={s._id}>{s.name}</option>)}
               </select>
            </div>
            <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl shadow-inner">
               <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-3 border-r border-slate-200">Group:</span>
               {['status', 'assignee', 'epic'].map(mode => (
                 <button key={mode} onClick={() => setGroupBy(mode as any)} className={`px-5 py-1.5 text-[9px] font-black uppercase rounded-lg transition-all ${groupBy === mode ? 'bg-white shadow-md text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}>{mode}</button>
               ))}
            </div>
         </div>
         {Object.keys(wipLimits).length > 0 && (
           <div className="flex items-center gap-2 text-[9px] font-black text-amber-600 uppercase tracking-widest bg-amber-50 border border-amber-100 px-4 py-2 rounded-xl">
              <i className="fas fa-shield-halved text-amber-500"></i>
              Adaptive WIP Control Active
           </div>
         )}
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd}>
        <div className="flex-1 overflow-auto custom-scrollbar bg-slate-50/20 rounded-[2rem] border border-slate-100">
          <div className="flex gap-6 h-full min-w-max p-6">
            {boardData.columns.map(col => (
              <KanbanColumn 
                key={col.statusId} 
                column={col} 
                onItemClick={setActiveItem} 
                wipLimit={wipLimits[col.statusId]}
                disableDrag={groupBy !== 'status'}
              />
            ))}
          </div>
        </div>
        <DragOverlay>{draggedItem ? <WorkItemCard item={draggedItem} isOverlay /> : null}</DragOverlay>
      </DndContext>

      {activeItem && (
        <div className="absolute inset-y-0 right-0 w-[650px] bg-white shadow-[0_0_100px_rgba(0,0,0,0.1)] border-l border-slate-200 z-[100] animate-slideIn">
           <WorkItemDetails item={activeItem} bundles={bundles} applications={applications} onUpdate={fetchBoard} onClose={() => setActiveItem(null)} />
        </div>
      )}
      {isCreating && (
        <CreateWorkItemModal bundles={bundles} applications={applications} initialBundleId={selBundleId} initialAppId={selAppId} onClose={() => setIsCreating(false)} onSuccess={() => { setIsCreating(false); fetchBoard(); }} />
      )}
    </div>
  );
};

export default WorkItemsBoardView;
