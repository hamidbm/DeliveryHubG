
import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import WorkItemCard from './WorkItemCard';

interface KanbanColumnProps {
  column: {
    statusId: string;
    statusName: string;
    items: any[];
  };
  onItemClick: (item: any) => void;
}

const KanbanColumn: React.FC<KanbanColumnProps> = ({ column, onItemClick }) => {
  const { setNodeRef } = useDroppable({
    id: column.statusId,
  });

  return (
    <div className="w-80 flex flex-col shrink-0">
      <div className="flex items-center justify-between mb-4 px-2">
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{column.statusName}</span>
          <span className="bg-slate-100 text-slate-500 text-[10px] font-bold px-2 py-0.5 rounded-full">{column.items.length}</span>
        </div>
        <button className="w-6 h-6 rounded-lg hover:bg-slate-100 text-slate-300 transition-colors">
          <i className="fas fa-ellipsis"></i>
        </button>
      </div>

      <div 
        ref={setNodeRef}
        className="flex-1 bg-slate-50/50 rounded-[2rem] p-3 flex flex-col gap-3 min-h-[150px] border border-slate-100/50"
      >
        <SortableContext 
          id={column.statusId}
          items={column.items.map(i => i._id || i.id)}
          strategy={verticalListSortingStrategy}
        >
          {column.items.map(item => (
            <WorkItemCard key={item._id || item.id} item={item} onClick={() => onItemClick(item)} />
          ))}
        </SortableContext>
      </div>
    </div>
  );
};

export default KanbanColumn;
