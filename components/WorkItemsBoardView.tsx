
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
import { WorkItem, WorkItemType, WorkItemStatus, Bundle, Application, Sprint } from '../types';
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

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const fetchSprints = async () => {
    const params = new URLSearchParams();
    if (selBundleId !== 'all') params.set('bundleId', selBundleId);
    if (selAppId !== 'all') params.set('applicationId', selAppId);
    const res = await fetch(`/api/sprints?${params.toString()}`);
    const data: Sprint[] = await res.json();
    setSprints(data);
  };

  const fetchBoard = async () => {
    setLoading(true);
    const params = new URLSearchParams({
      bundleId: selBundleId,
      applicationId: selAppId,
      milestoneId: selMilestone,
      q: searchQuery,
      epicId: selEpicId,
      sprintId: activeSprintId
    });
    if (quickFilter) params.set('quickFilter', quickFilter);

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
    fetchSprints();
  }, [selBundleId, selAppId]);

  useEffect(() => {
    fetchBoard();
  }, [selBundleId, selAppId, selMilestone, selEpicId, searchQuery, activeSprintId, quickFilter]);

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
      if (overItemIndex === -1) newCols[overIdx].items.push(movedItem);
      else newCols[overIdx].items.splice(overItemIndex, 0, movedItem);
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
    let newRank = (activeCol.items[index-1]?.rank || 0) + 1000;
    item.rank = newRank;

    try {
      const res = await fetch(`/api/work-items/${active.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toStatus: activeCol.statusId, newRank })
      });
      if (!res.ok) fetchBoard();
    } catch (err) { fetchBoard(); }
  };

  const swimlaneRows = useMemo(() => {
    if (groupBy === 'status') return null;
    const allItems = boardData.columns.flatMap(c => c.items);
    
    // Create a map for row keys
    const rowMap: Record<string, any[]> = {};
    const epicIdToTitle: Record<string, string> = {};
    
    // Pre-scan for epics if grouping by epic
    if (groupBy === 'epic') {
      allItems.forEach(item => {
        if (item.type === WorkItemType.EPIC) {
          epicIdToTitle[item._id || item.id] = `${item.key}: ${item.title}`;
        }
      });
    }

    allItems.forEach(item => {
      let key = 'Unassigned';
      if (groupBy === 'assignee') {
        key = item.assignedTo || 'Unassigned';
      } else if (groupBy === 'epic') {
        key = item.parentId ? (epicIdToTitle[item.parentId] || `Epic: ${item.parentId}`) : 'No Epic Association';
      }
      
      if (!rowMap[key]) rowMap[key] = [];
      rowMap[key].push(item);
    });

    return Object.entries(rowMap).sort(([a], [b]) => {
      if (a === 'Unassigned' || a === 'No Epic Association') return 1;
      if (b === 'Unassigned' || b === 'No Epic Association') return -1;
      return a.localeCompare(b);
    });
  }, [boardData, groupBy]);

  return (
    <div className="flex flex-col h-[850px] overflow-hidden relative">
      <div className="flex items-center justify-between mb-6 px-4 shrink-0">
         <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl">
               <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-3">Sprint Filter:</span>
               <select 
                value={activeSprintId}
                onChange={(e) => setActiveSprintId(e.target.value)}
                className="bg-transparent text-[10px] font-bold outline-none pr-2 cursor-pointer"
               >
                 <option value="all">Full Backlog</option>
                 {sprints.map(s => <option key={s._id} value={s._id}>{s.name} ({s.status})</option>)}
               </select>
            </div>
            <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl shadow-inner">
               <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-3 border-r border-slate-200">Group By:</span>
               {['status', 'assignee', 'epic'].map(mode => (
                 <button 
                   key={mode}
                   onClick={() => setGroupBy(mode as any)}
                   className={`px-5 py-1.5 text-[9px] font-black uppercase rounded-lg transition-all ${groupBy === mode ? 'bg-white shadow-md text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
                 >
                   {mode}
                 </button>
               ))}
            </div>
         </div>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd}>
        <div className="flex-1 overflow-auto custom-scrollbar bg-slate-50/20 rounded-[2rem] border border-slate-100">
          {groupBy === 'status' ? (
            <div className="flex gap-6 h-full min-w-max p-6">
              {boardData.columns.map(col => (
                <KanbanColumn key={col.statusId} column={col} onItemClick={setActiveItem} />
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-1 px-6 min-w-max pb-20">
              <div className="flex gap-6 sticky top-0 bg-white/80 backdrop-blur-md z-30 py-4 border-b border-slate-100 mb-4">
                {boardData.columns.map(col => (
                   <div key={col.statusId} className="w-80 flex items-center justify-between px-4">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{col.statusName}</span>
                   </div>
                ))}
              </div>
              {swimlaneRows?.map(([rowName, rowItems]) => (
                <div key={rowName} className="mb-8 last:mb-0">
                   <div className="flex items-center gap-4 mb-4 group cursor-pointer sticky left-0">
                      <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                      <span className="text-[11px] font-black text-slate-800 uppercase tracking-wider bg-white border border-slate-200 px-5 py-2 rounded-2xl shadow-sm group-hover:border-blue-300 transition-colors">
                        {rowName}
                        <span className="ml-3 text-[9px] text-slate-400 font-bold">({rowItems.length} items)</span>
                      </span>
                      <div className="h-[1px] flex-1 bg-slate-100"></div>
                   </div>
                   <div className="flex gap-6 min-h-[120px]">
                      {boardData.columns.map(col => (
                        <KanbanColumn 
                          key={`${rowName}-${col.statusId}`} 
                          column={{ ...col, items: rowItems.filter(i => i.status === col.statusId) }} 
                          onItemClick={setActiveItem} 
                          hideHeader 
                        />
                      ))}
                   </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <DragOverlay>{draggedItem ? <WorkItemCard item={draggedItem} isOverlay /> : null}</DragOverlay>
      </DndContext>

      {activeItem && (
        <div className="absolute inset-y-0 right-0 w-[650px] bg-white shadow-[0_0_100px_rgba(0,0,0,0.1)] border-l border-slate-200 z-[100] animate-slideIn">
           <WorkItemDetails item={activeItem} bundles={bundles} applications={applications} onUpdate={fetchBoard} onClose={() => setActiveItem(null)} />
        </div>
      )}
    </div>
  );
};

export default WorkItemsBoardView;
