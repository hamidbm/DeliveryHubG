
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
  externalTrigger?: string | null;
  onTriggerProcessed?: () => void;
}

const WorkItemsBoardView: React.FC<WorkItemsBoardViewProps> = ({ 
  applications, bundles, selBundleId, selAppId, selMilestone, selEpicId, searchQuery, quickFilter, externalTrigger, onTriggerProcessed 
}) => {
  const [boardData, setBoardData] = useState<{ columns: any[] }>({ columns: [] });
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [activeSprintId, setActiveSprintId] = useState<string>('all');
  const [activeItem, setActiveItem] = useState<WorkItem | null>(null);
  const [draggedItem, setDraggedItem] = useState<WorkItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [groupBy, setGroupBy] = useState<'status' | 'assignee' | 'epic'>('status');

  // Point WIP Limits (Hardcoded for this demo, usually defined in Admin/Team settings)
  const wipLimits: Record<string, number> = {
    'IN_PROGRESS': 5,
    'REVIEW': 3
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const fetchBoard = async () => {
    setLoading(true);
    const params = new URLSearchParams({
      bundleId: selBundleId, applicationId: selAppId, milestoneId: selMilestone, q: searchQuery, epicId: selEpicId, sprintId: activeSprintId
    });
    if (quickFilter) params.set('quickFilter', quickFilter);

    try {
      const res = await fetch(`/api/work-items/board?${params.toString()}`);
      setBoardData(await res.json());
    } catch (err) { console.error("Board fetch failed", err); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    fetch(`/api/sprints?bundleId=${selBundleId}&applicationId=${selAppId}`).then(r => r.json()).then(setSprints);
  }, [selBundleId, selAppId]);

  useEffect(() => { fetchBoard(); }, [selBundleId, selAppId, selMilestone, selEpicId, searchQuery, activeSprintId, quickFilter]);

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

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setDraggedItem(null);
    if (!over) return;
    const activeCol = boardData.columns.find(c => c.items.some((i: any) => (i._id || i.id) === active.id));
    if (!activeCol) return;
    const item = activeCol.items.find((i: any) => (i._id || i.id) === active.id);
    const index = activeCol.items.indexOf(item);
    let newRank = (activeCol.items[index-1]?.rank || 0) + 1000;

    try {
      await fetch(`/api/work-items/${active.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toStatus: activeCol.statusId, newRank })
      });
    } catch (err) { fetchBoard(); }
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
         <div className="flex items-center gap-2 text-[9px] font-black text-slate-400 uppercase tracking-widest bg-amber-50 border border-amber-100 px-4 py-2 rounded-xl">
            <i className="fas fa-shield-halved text-amber-500"></i>
            WIP Enforcement Active
         </div>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="flex-1 overflow-auto custom-scrollbar bg-slate-50/20 rounded-[2rem] border border-slate-100">
          <div className="flex gap-6 h-full min-w-max p-6">
            {boardData.columns.map(col => (
              <KanbanColumn 
                key={col.statusId} 
                column={col} 
                onItemClick={setActiveItem} 
                wipLimit={wipLimits[col.statusId]}
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
