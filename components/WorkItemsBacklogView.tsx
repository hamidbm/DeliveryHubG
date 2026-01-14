import React, { useState, useEffect } from 'react';
import { WorkItem, WorkItemType, WorkItemStatus, Bundle, Application } from '../types';
import WorkItemDetails from './WorkItemDetails';
import CreateWorkItemModal from './CreateWorkItemModal';
import { 
  DndContext, 
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent
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

// Fix: Typed BacklogItem as React.FC to allow for standard React props like 'key'.
const BacklogItem: React.FC<{ item: WorkItem, onClick: () => void }> = ({ item, onClick }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: (item._id || item.id) as string });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
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
      {/* Fix: Merged duplicate className attributes into a single string. */}
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
        <img 
          src={`https://ui-avatars.com/api/?name=${encodeURIComponent(item.assignedTo || 'U')}&background=random&size=24`} 
          className="w-5 h-5 rounded-full" 
        />
      </div>
    </div>
  );
};

const WorkItemsBacklogView: React.FC<WorkItemsBacklogViewProps> = ({ 
  applications, bundles, selBundleId, selAppId, selMilestone, selEpicId, searchQuery, externalTrigger, onTriggerProcessed 
}) => {
  const [items, setItems] = useState<WorkItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeItem, setActiveItem] = useState<WorkItem | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    if (externalTrigger === 'create-item') {
      setIsCreating(true);
      onTriggerProcessed?.();
    }
  }, [externalTrigger, onTriggerProcessed]);

  const fetchItems = async () => {
    setLoading(true);
    const params = new URLSearchParams({
      bundleId: selBundleId,
      applicationId: selAppId,
      milestoneId: selMilestone,
      q: searchQuery,
      epicId: selEpicId
    });

    try {
      const res = await fetch(`/api/work-items?${params.toString()}`);
      const data = await res.json();
      setItems(data);
    } catch (err) {
      console.error("Failed to fetch backlog", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, [selBundleId, selAppId, selMilestone, selEpicId, searchQuery]);

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setItems((items) => {
        const oldIndex = items.findIndex(i => (i._id || i.id) === active.id);
        const newIndex = items.findIndex(i => (i._id || i.id) === over.id);
        const newItems = arrayMove(items, oldIndex, newIndex);
        
        // In a real app, we would update the ranks in DB here.
        // For brevity, we just update local state.
        return newItems;
      });
    }
  };

  return (
    <div className="flex h-[800px] bg-white rounded-[3rem] border border-slate-200 shadow-2xl overflow-hidden animate-fadeIn relative">
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="px-10 py-6 border-b border-slate-100 flex items-center justify-between shrink-0 bg-slate-50/30">
           <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Prioritization Engine ({items.length} artifacts)</h3>
           <div className="flex items-center gap-3">
              <button onClick={() => setIsCreating(true)} className="text-[10px] font-black text-blue-600 uppercase hover:underline">+ New Requirement</button>
           </div>
        </header>

        <div className="flex-1 overflow-y-auto p-10 custom-scrollbar bg-[#FDFDFD]">
          {loading ? (
            <div className="space-y-3">
               {[...Array(8)].map((_, i) => <div key={i} className="h-14 bg-slate-50 rounded-xl animate-pulse"></div>)}
            </div>
          ) : (
            <DndContext 
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext 
                items={items.map(i => (i._id || i.id) as string)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-2">
                  <div className="px-4 py-2 text-[9px] font-black text-slate-300 uppercase tracking-widest">Active Backlog</div>
                  {items.map(item => (
                    <BacklogItem 
                      key={(item._id || item.id) as string} 
                      item={item} 
                      onClick={() => setActiveItem(item)} 
                    />
                  ))}
                  {items.length === 0 && (
                    <div className="py-20 text-center text-slate-300">
                       <i className="fas fa-box-open text-5xl mb-4 opacity-10"></i>
                       <p className="text-xs font-bold uppercase tracking-widest">No work artifacts in scope.</p>
                    </div>
                  )}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </div>
      </div>

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

      {isCreating && (
        <CreateWorkItemModal 
          bundles={bundles}
          applications={applications}
          initialBundleId={selBundleId !== 'all' ? selBundleId : ''}
          initialAppId={selAppId !== 'all' ? selAppId : ''}
          onClose={() => setIsCreating(false)}
          onSuccess={() => {
            setIsCreating(false);
            fetchItems();
          }}
        />
      )}
    </div>
  );
};

export default WorkItemsBacklogView;