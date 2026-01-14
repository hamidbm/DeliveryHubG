
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
  wipLimit?: number;
}

const KanbanColumn: React.FC<KanbanColumnProps> = ({ column, onItemClick, wipLimit }) => {
  const { setNodeRef } = useDroppable({
    id: column.statusId,
  });

  const isOverWip = wipLimit && column.items.length > wipLimit;

  return (
    <div className="w-80 flex flex-col shrink-0">
      <div className="flex items-center justify-between mb-4 px-2">
        <div className="flex items-center gap-3">
          <span className={`text-[10px] font-black uppercase tracking-widest ${isOverWip ? 'text-red-500' : 'text-slate-400'}`}>
            {column.statusName}
          </span>
          <div className="flex items-center gap-1">
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${isOverWip ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-500'}`}>
              {column.items.length}
            </span>
            {wipLimit && (
              <span className="text-[8px] font-black text-slate-300 uppercase tracking-tighter">/ MAX {wipLimit}</span>
            )}
          </div>
        </div>
        <button className="w-6 h-6 rounded-lg hover:bg-slate-100 text-slate-300 transition-colors">
          <i className="fas fa-ellipsis"></i>
        </button>
      </div>

      <div 
        ref={setNodeRef}
        className={`flex-1 rounded-[2.5rem] p-3 flex flex-col gap-3 min-h-[200px] border transition-all duration-500 ${
          isOverWip ? 'bg-red-50/30 border-red-100/50 shadow-inner' : 'bg-slate-50/50 border-slate-100/50'
        }`}
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
        
        {column.items.length === 0 && (
          <div className="flex-1 flex items-center justify-center border-2 border-dashed border-slate-100 rounded-[2rem] opacity-40">
             <i className="fas fa-arrow-down-to-bracket text-slate-200"></i>
          </div>
        )}
      </div>
    </div>
  );
};

export default KanbanColumn;
