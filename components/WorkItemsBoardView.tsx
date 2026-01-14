
import React, { useState, useEffect, useMemo } from 'react';
import { 
  DndContext, 
  DragOverlay, 
  closestCorners, 
  KeyboardSensor, 
  PointerSensor, 
  useSensor, 
  useSensors,
  DragStartEvent,
  DragOverEvent,
  DragEndEvent
} from '@dnd-kit/core';
import { 
  arrayMove, 
  SortableContext, 
  sortableKeyboardCoordinates, 
  verticalListSortingStrategy 
} from '@dnd-kit/sortable';
import { WorkItem, WorkItemType, WorkItemStatus, Bundle, Application } from '../types';
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
  externalTrigger?: string | null;
  onTriggerProcessed?: () => void;
}

const WorkItemsBoardView: React.FC<WorkItemsBoardViewProps> = ({ 
  applications, bundles, selBundleId, selAppId, selMilestone, selEpicId, searchQuery, externalTrigger, onTriggerProcessed 
}) => {
  const [boardData, setBoardData] = useState<{ columns: any[] }>({ columns: [] });
  const [activeItem, setActiveItem] = useState<WorkItem | null>(null);
  const [draggedItem, setDraggedItem] = useState<WorkItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [groupBy, setGroupBy] = useState<'status' | 'assignee' | 'epic'>('status');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // WIP Limits configuration
  const wipLimits: Record<string, number> = {
    'IN_PROGRESS': 5,
    'REVIEW': 3,
    'BLOCKED': 2
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => {
    if (externalTrigger === 'create-item') {
      setIsCreating(true);
      onTriggerProcessed?.();
    }
  }, [externalTrigger, onTriggerProcessed]);

  const fetchBoard = async () => {
    setLoading(true);
    const params = new URLSearchParams({
      bundleId: selBundleId,
      applicationId: selAppId,
      milestoneId: selMilestone,
      q: searchQuery,
      epicId: selEpicId
    });

    try {
      const res = await fetch(`/api/work-items/board?${params.toString()}`);
      const data = await res.json();
      setBoardData(data);
    } catch (err) {
      console.error("Failed to fetch board", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBoard();
  }, [selBundleId, selAppId, selMilestone, selEpicId, searchQuery]);

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const item = boardData.columns.flatMap(c => c.items).find(i => (i._id || i.id) === active.id);
    setDraggedItem(item);
    setErrorMsg(null);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id;
    const overId = over.id;

    const activeCol = boardData.columns.find(c => c.items.some((i: any) => (i._id || i.id) === activeId));
    const overCol = boardData.columns.find(c => c.statusId === overId || c.items.some((i: any) => (i._id || i.id) === overId));

    if (!activeCol || !overCol || activeCol === overCol) return;

    setBoardData(prev => {
      const newCols = [...prev.columns];
      const activeIdx = newCols.findIndex(c => c.statusId === activeCol.statusId);
      const overIdx = newCols.findIndex(c => c.statusId === overCol.statusId);
      
      const activeItemIndex = newCols[activeIdx].items.findIndex((i: any) => (i._id || i.id) === activeId);
      const [movedItem] = newCols[activeIdx].items.splice(activeItemIndex, 1);
      
      movedItem.status = overCol.statusId;
      
      const overItemIndex = newCols[overIdx].items.findIndex((i: any) => (i._id || i.id) === overId);
      if (overItemIndex === -1) {
        newCols[overIdx].items.push(movedItem);
      } else {
        newCols[overIdx].items.splice(overItemIndex, 0, movedItem);
      }
      
      return { columns: newCols };
    });
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setDraggedItem(null);
    if (!over) return;

    const activeCol = boardData.columns.find(c => c.items.some((i: any) => (i._id || i.id) === active.id));
    if (!activeCol) return;

    const item = activeCol.items.find((i: any) => (i._id || i.id) === active.id);
    const index = activeCol.items.indexOf(item);
    
    let newRank = 1000;
    const prevItem = activeCol.items[index - 1];
    const nextItem = activeCol.items[index + 1];

    if (prevItem && nextItem) {
      newRank = (prevItem.rank + nextItem.rank) / 2;
    } else if (prevItem) {
      newRank = prevItem.rank + 1000;
    } else if (nextItem) {
      newRank = nextItem.rank / 2;
    }

    item.rank = newRank;

    try {
      const res = await fetch(`/api/work-items/${active.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toStatus: activeCol.statusId, newRank })
      });
      if (!res.ok) {
        const err = await res.json();
        setErrorMsg(err.error || "Workflow restriction encountered.");
        fetchBoard(); // Revert
      }
    } catch (err) {
      setErrorMsg("Network error during sync.");
      fetchBoard();
    }
  };

  if (loading && boardData.columns.length === 0) {
    return (
      <div className="h-[600px] flex flex-col items-center justify-center bg-white rounded-[3rem] border border-slate-100">
        <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-slate-400 font-bold text-[10px] uppercase tracking-widest animate-pulse">Mapping Delivery Stream...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[850px] overflow-hidden relative">
      {/* Board Controls */}
      <div className="flex items-center justify-between mb-6 px-4">
         <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-3">Swimlanes:</span>
            {['status', 'assignee', 'epic'].map(mode => (
              <button 
                key={mode}
                onClick={() => setGroupBy(mode as any)}
                className={`px-4 py-1.5 text-[9px] font-black uppercase rounded-lg transition-all ${groupBy === mode ? 'bg-white shadow-sm text-blue-600' : 'text-slate-400'}`}
              >
                {mode}
              </button>
            ))}
         </div>
         {errorMsg && (
           <div className="px-6 py-2 bg-red-50 text-red-600 text-[10px] font-black uppercase tracking-widest rounded-xl border border-red-100 animate-bounce flex items-center gap-3">
             <i className="fas fa-triangle-exclamation"></i>
             {errorMsg}
           </div>
         )}
      </div>

      <DndContext 
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="flex-1 flex gap-6 overflow-x-auto pb-6 px-4 custom-scrollbar-h">
          {boardData.columns.map(col => (
            <KanbanColumn 
              key={col.statusId} 
              column={col} 
              onItemClick={(item) => setActiveItem(item)}
              wipLimit={wipLimits[col.statusId]}
            />
          ))}
        </div>

        <DragOverlay>
          {draggedItem ? <WorkItemCard item={draggedItem} isOverlay /> : null}
        </DragOverlay>
      </DndContext>

      {activeItem && (
        <div className="absolute inset-y-0 right-0 w-[650px] bg-white shadow-2xl border-l border-slate-200 z-[100] animate-slideIn">
           <WorkItemDetails 
             item={activeItem} 
             bundles={bundles} 
             applications={applications} 
             onUpdate={() => { fetchBoard(); }} 
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
          onSuccess={(item) => {
            setIsCreating(false);
            fetchBoard();
          }}
        />
      )}
    </div>
  );
};

export default WorkItemsBoardView;
