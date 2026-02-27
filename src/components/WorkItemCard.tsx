
// Fix: Added useMemo to the React import to resolve "Cannot find name 'useMemo'" error.
import React, { useMemo } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { WorkItem, WorkItemType, WorkItemStatus } from '../types';

interface WorkItemCardProps {
  item: WorkItem;
  onClick?: () => void;
  isOverlay?: boolean;
  disableDrag?: boolean;
}

const WorkItemCard: React.FC<WorkItemCardProps> = ({ item, onClick, isOverlay, disableDrag }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: (item._id || item.id) as string, disabled: !!disableDrag });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
  };

  const getIcon = (type: WorkItemType) => {
    switch (type) {
      case WorkItemType.EPIC: return 'fa-layer-group text-purple-500';
      case WorkItemType.FEATURE: return 'fa-star text-amber-500';
      case WorkItemType.STORY: return 'fa-file-lines text-blue-500';
      case WorkItemType.TASK: return 'fa-check text-slate-400';
      case WorkItemType.BUG: return 'fa-bug text-red-500';
      case WorkItemType.RISK: return 'fa-triangle-exclamation text-rose-500';
      case WorkItemType.DEPENDENCY: return 'fa-link text-indigo-500';
      default: return 'fa-circle text-slate-300';
    }
  };

  const getPriorityColor = (p: string) => {
    switch (p) {
      case 'CRITICAL': return 'text-red-600 bg-red-50';
      case 'HIGH': return 'text-orange-600 bg-orange-50';
      case 'MEDIUM': return 'text-blue-600 bg-blue-50';
      default: return 'text-slate-400 bg-slate-50';
    }
  };

  const isBlocked = item.links?.some(l => l.type === 'IS_BLOCKED_BY');
  
  // Logic: Staleness Detection (> 3 days without update)
  const isStale = useMemo(() => {
    if (item.status === WorkItemStatus.DONE) return false;
    const lastUpdate = new Date(item.updatedAt || item.createdAt || 0).getTime();
    const threeDaysAgo = new Date().getTime() - (3 * 24 * 60 * 60 * 1000);
    return lastUpdate < threeDaysAgo;
  }, [item.updatedAt, item.createdAt, item.status]);

  return (
    <div 
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className={`bg-white p-5 rounded-2xl border transition-all ${disableDrag ? 'cursor-default' : 'cursor-grab active:cursor-grabbing'} group ${
        isOverlay ? 'shadow-2xl ring-2 ring-blue-500 rotate-2' : 'shadow-sm border-slate-100 hover:shadow-xl hover:shadow-200/50'
      } ${item.isFlagged ? 'border-l-4 border-l-red-500 ring-1 ring-red-100' : isBlocked ? 'border-l-4 border-l-amber-500' : ''} ${isStale ? 'grayscale-[0.4] opacity-90' : ''}`}
    >
      <div className="flex justify-between items-start mb-3">
        <div className="flex items-center gap-2">
           <i className={`fas ${getIcon(item.type)} text-xs`}></i>
           <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{item.key}</span>
        </div>
        <div className="flex items-center gap-2">
           {isStale && (
             <div className="w-5 h-5 bg-slate-900 text-white rounded-full flex items-center justify-center animate-pulse" title="Node is Stale (>3d no activity)">
               <i className="fas fa-clock-rotate-left text-[8px]"></i>
             </div>
           )}
           {item.isFlagged && (
             <span className="animate-pulse flex items-center justify-center w-5 h-5 bg-red-100 text-red-600 rounded-full" title="Artifact has active Impediment">
               <i className="fas fa-flag text-[8px]"></i>
             </span>
           )}
           <span className={`text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-tighter ${getPriorityColor(item.priority)}`}>
              {item.priority}
           </span>
        </div>
      </div>
      
      <h4 className="text-sm font-bold text-slate-800 leading-snug mb-4 group-hover:text-blue-600 transition-colors">
        {item.title}
      </h4>
      {item.links && item.links.length > 0 && (
        <div className="flex items-center gap-1 flex-wrap mb-3">
          {Array.from(new Set(item.links.map(l => l.type))).slice(0, 3).map(t => (
            <span key={t} className="text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded border bg-slate-50 text-slate-500 border-slate-100">
              {t.replace(/_/g, ' ')}
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between mt-auto pt-3 border-t border-slate-50">
        <div className="flex items-center gap-2">
           {item.storyPoints && (
             <span className="w-5 h-5 bg-slate-100 rounded-full flex items-center justify-center text-[10px] font-bold text-slate-500">
               {item.storyPoints}
             </span>
           )}
           {item.timeLogged && item.timeLogged > 0 ? (
             <span className="text-[9px] font-bold text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded flex items-center gap-1">
               <i className="fas fa-clock text-[7px]"></i>
               {item.timeLogged}h
             </span>
           ) : null}
        </div>
        <div className="flex items-center gap-2">
           <img 
             src={`https://ui-avatars.com/api/?name=${encodeURIComponent(item.assignedTo || 'Unassigned')}&background=random&size=32`} 
             className="w-6 h-6 rounded-full border border-white shadow-sm" 
           />
        </div>
      </div>
    </div>
  );
};

export default WorkItemCard;
