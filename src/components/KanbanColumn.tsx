
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
  disableDrag?: boolean;
  enableInlinePointsEdit?: boolean;
  onItemUpdated?: (id: string, patch: any) => void;
}

const KanbanColumn: React.FC<KanbanColumnProps> = ({ column, onItemClick, wipLimit, hideHeader, disableDrag, enableInlinePointsEdit, onItemUpdated }) => {
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
             <div className="flex items-center gap-2 text-red-500 animate-pulse">
                <span className="text-[8px] font-black uppercase tracking-tighter">Capacity Breach</span>
                <i className="fas fa-triangle-exclamation text-[10px]"></i>
             </div>
          )}
        </div>
      )}

      <div 
        ref={setNodeRef}
        className={`flex-1 rounded-[2.5rem] p-3 flex flex-col gap-3 min-h-[100px] border transition-all duration-500 ${
          isOverWip 
          ? 'bg-red-50/30 border-red-200 ring-2 ring-red-500/10 shadow-inner' 
          : 'bg-slate-50/50 border-slate-100/50 group-hover/col:bg-slate-50 transition-colors'
        }`}
      >
        <SortableContext 
          id={column.statusId}
          items={column.items.map(i => i._id || i.id)}
          strategy={verticalListSortingStrategy}
        >
          {column.items.map(item => (
            <WorkItemCard
              key={item._id || item.id}
              item={item}
              onClick={() => onItemClick(item)}
              disableDrag={disableDrag}
              enableInlinePointsEdit={enableInlinePointsEdit}
              onItemUpdated={onItemUpdated}
            />
          ))}
        </SortableContext>
        
        {column.items.length === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-slate-100/30 rounded-[2rem] opacity-20 py-12">
             <i className="fas fa-plus-circle text-3xl mb-2 text-slate-400"></i>
             <p className="text-[9px] font-black uppercase tracking-widest">LANE EMPTY</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default KanbanColumn;
