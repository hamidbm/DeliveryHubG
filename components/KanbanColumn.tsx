
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
  hideHeader?: boolean;
}

const KanbanColumn: React.FC<KanbanColumnProps> = ({ column, onItemClick, wipLimit, hideHeader }) => {
  const { setNodeRef } = useDroppable({
    id: column.statusId,
  });

  const isOverWip = wipLimit && column.items.length > wipLimit;

  return (
    <div className="w-80 flex flex-col shrink-0 group/col">
      {!hideHeader && (
        <div className="flex items-center justify-between mb-4 px-2">
          <div className="flex items-center gap-3">
            <span className={`text-[10px] font-black uppercase tracking-widest transition-colors ${isOverWip ? 'text-red-500' : 'text-slate-400'}`}>
              {column.statusName}
            </span>
            <div className="flex items-center gap-1">
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full transition-all ${isOverWip ? 'bg-red-500 text-white shadow-lg shadow-red-200 animate-bounce' : 'bg-slate-100 text-slate-500'}`}>
                {column.items.length}
              </span>
              {wipLimit && (
                <span className="text-[8px] font-black text-slate-300 uppercase tracking-tighter">/ {wipLimit} MAX</span>
              )}
            </div>
          </div>
          {isOverWip && (
             <i className="fas fa-triangle-exclamation text-red-500 text-xs animate-pulse"></i>
          )}
        </div>
      )}

      <div 
        ref={setNodeRef}
        className={`flex-1 rounded-[2.5rem] p-3 flex flex-col gap-3 min-h-[100px] border transition-all duration-500 ${
          isOverWip 
          ? 'bg-red-50/20 border-red-200 ring-2 ring-red-500/5' 
          : 'bg-slate-50/50 border-slate-100/50 group-hover/col:bg-slate-50 transition-colors'
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
          <div className="flex-1 flex items-center justify-center border-2 border-dashed border-slate-100/30 rounded-[2rem] opacity-20">
             <i className="fas fa-plus-circle text-slate-400"></i>
          </div>
        )}
      </div>
    </div>
  );
};

export default KanbanColumn;
