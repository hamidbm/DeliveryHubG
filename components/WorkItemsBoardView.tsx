
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
  const [columns, setColumns] = useState<any[]>([]);
  const [activeItem, setActiveItem] = useState<WorkItem | null>(null);
  const [draggedItem, setDraggedItem] = useState<WorkItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);

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
      setColumns(data.columns || []);
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
    const item = columns.flatMap(c => c.items).find(i => (i._id || i.id) === active.id);
    setDraggedItem(item);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id;
    const overId = over.id;

    const activeCol = columns.find(c => c.items.some((i: any) => (i._id || i.id) === activeId));
    const overCol = columns.find(c => c.statusId === overId || c.items.some((i: any) => (i._id || i.id) === overId));

    if (!activeCol || !overCol || activeCol === overCol) return;

    setColumns(prev => {
      const newCols = [...prev];
      const activeItemIndex = activeCol.items.findIndex((i: any) => (i._id || i.id) === activeId);
      const [movedItem] = activeCol.items.splice(activeItemIndex, 1);
      
      movedItem.status = overCol.statusId;
      
      const overItemIndex = overCol.items.findIndex((i: any) => (i._id || i.id) === overId);
      if (overItemIndex === -1) {
        overCol.items.push(movedItem);
      } else {
        overCol.items.splice(overItemIndex, 0, movedItem);
      }
      
      return newCols;
    });
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setDraggedItem(null);
    if (!over) return;

    const activeCol = columns.find(c => c.items.some((i: any) => (i._id || i.id) === active.id));
    if (!activeCol) return;

    const item = activeCol.items.find((i: any) => (i._id || i.id) === active.id);
    const index = activeCol.items.indexOf(item);
    
    // Simple numeric ranking: midpoint between neighbors
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
      await fetch(`/api/work-items/${active.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toStatus: activeCol.statusId, newRank })
      });
    } catch (err) {
      console.error("Failed to sync drag status", err);
      fetchBoard(); // Revert on failure
    }
  };

  if (loading && columns.length === 0) {
    return (
      <div className="h-[600px] flex flex-col items-center justify-center bg-white rounded-[3rem] border border-slate-100">
        <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-slate-400 font-bold text-[10px] uppercase tracking-widest animate-pulse">Provisioning Board Data...</p>
      </div>
    );
  }

  return (
    <div className="flex h-[800px] overflow-hidden relative">
      <DndContext 
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="flex-1 flex gap-6 overflow-x-auto pb-4 custom-scrollbar-h no-scrollbar">
          {columns.map(col => (
            <KanbanColumn 
              key={col.statusId} 
              column={col} 
              onItemClick={(item) => setActiveItem(item)}
            />
          ))}
        </div>

        <DragOverlay>
          {draggedItem ? <WorkItemCard item={draggedItem} isOverlay /> : null}
        </DragOverlay>
      </DndContext>

      {/* Side Panel for Details */}
      {activeItem && (
        <div className="absolute inset-y-0 right-0 w-[600px] bg-white shadow-2xl border-l border-slate-200 z-50 animate-slideIn">
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

      <style jsx global>{`
        @keyframes slideIn {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        .animate-slideIn { animation: slideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1); }
      `}</style>
    </div>
  );
};

export default WorkItemsBoardView;
