
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
  enableInlinePointsEdit?: boolean;
  onItemUpdated?: (id: string, patch: Partial<WorkItem>) => void;
}

const WorkItemCard: React.FC<WorkItemCardProps> = ({ item, onClick, isOverlay, disableDrag, enableInlinePointsEdit, onItemUpdated }) => {
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

  const isBlocked = item.status === WorkItemStatus.BLOCKED || item.isBlocked || (item.linkSummary?.openBlockersCount || 0) > 0;
  const [isEditingPoints, setIsEditingPoints] = React.useState(false);
  const [pointsValue, setPointsValue] = React.useState<number | ''>(item.storyPoints ?? '');
  const [pointsError, setPointsError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setPointsValue(item.storyPoints ?? '');
  }, [item.storyPoints]);

  const dependencyTooltip = useMemo(() => {
    const blocks = item.linkSummary?.blocks || [];
    const blockedBy = item.linkSummary?.blockedBy || [];
    const topBlocks = blocks.slice(0, 2).map((b) => b.targetKey || b.targetId).filter(Boolean);
    const topBlockedBy = blockedBy.slice(0, 2).map((b) => b.targetKey || b.targetId).filter(Boolean);
    const parts: string[] = [];
    if (topBlocks.length) parts.push(`Blocks: ${topBlocks.join(', ')}`);
    if (topBlockedBy.length) parts.push(`Blocked by: ${topBlockedBy.join(', ')}`);
    return parts.join(' • ');
  }, [item.linkSummary]);
  
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

      <div className="flex flex-wrap items-center gap-2 mb-3 text-[8px] font-black uppercase tracking-widest">
        {item.jira?.key && (
          <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-600">Jira {item.jira.key}</span>
        )}
        {(item.linkSummary?.blocks?.length || item.linkSummary?.blockedBy?.length) ? (
          <span
            className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 flex items-center gap-1"
            title={dependencyTooltip || undefined}
          >
            <i className="fas fa-link text-[7px]"></i>
            {item.linkSummary?.blocks?.length ? `B:${item.linkSummary.blocks.length}` : ''}
            {item.linkSummary?.blockedBy?.length ? ` • BB:${item.linkSummary.blockedBy.length}` : ''}
          </span>
        ) : null}
        {item.sprintId && (
          <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">Sprint</span>
        )}
        {item.risk?.severity && ['high', 'critical'].includes(String(item.risk.severity).toLowerCase()) && (
          <span className="px-1.5 py-0.5 rounded bg-rose-50 text-rose-600">Risk {String(item.risk.severity).toUpperCase()}</span>
        )}
        {(item.watcherUserIds?.length || item.watchers?.length) ? (
          <span className="px-1.5 py-0.5 rounded bg-slate-50 text-slate-400">
            <i className="fas fa-eye text-[7px]"></i> {item.watcherUserIds?.length || item.watchers?.length}
          </span>
        ) : null}
      </div>
      {(() => {
        const summaryCount = (item.linkSummary?.blocks?.length || 0)
          + (item.linkSummary?.blockedBy?.length || 0)
          + (item.linkSummary?.duplicates?.length || 0)
          + (item.linkSummary?.duplicatedBy?.length || 0)
          + (item.linkSummary?.relatesTo?.length || 0);
        return (item.links && item.links.length > 0) || summaryCount > 0;
      })() && (
        <div className="flex items-center gap-1 flex-wrap mb-3">
          {Array.from(new Set([
            ...(item.links || []).map(l => l.type),
            ...((item.linkSummary?.blocks || []).map(() => 'BLOCKS')),
            ...((item.linkSummary?.blockedBy || []).map(() => 'BLOCKED_BY')),
            ...((item.linkSummary?.duplicates || []).map(() => 'DUPLICATES')),
            ...((item.linkSummary?.duplicatedBy || []).map(() => 'DUPLICATED_BY')),
            ...((item.linkSummary?.relatesTo || []).map(() => 'RELATES_TO'))
          ].filter(Boolean))).slice(0, 3).map(t => (
            <span key={t} className="text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded border bg-slate-50 text-slate-500 border-slate-100">
              {t.replace(/_/g, ' ')}
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between mt-auto pt-3 border-t border-slate-50">
        <div className="flex items-center gap-2">
           {item.storyPoints !== undefined && item.storyPoints !== null && (
             <div className="relative">
               <button
                 onClick={(e) => {
                   if (!enableInlinePointsEdit) return;
                   e.stopPropagation();
                   setIsEditingPoints((prev) => !prev);
                   setPointsError(null);
                 }}
                 className={`w-6 h-6 bg-slate-100 rounded-full flex items-center justify-center text-[10px] font-bold text-slate-500 ${enableInlinePointsEdit ? 'hover:bg-slate-200' : ''}`}
                 title={enableInlinePointsEdit ? 'Edit story points' : undefined}
               >
                 {item.storyPoints}
               </button>
               {isEditingPoints && enableInlinePointsEdit && (
                 <div className="absolute left-0 top-full mt-2 w-36 bg-white border border-slate-200 shadow-xl rounded-xl p-2 z-40">
                   <div className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Story Points</div>
                   <input
                     type="number"
                     value={pointsValue}
                     onClick={(e) => e.stopPropagation()}
                     onChange={(e) => {
                       const value = e.target.value === '' ? '' : Number(e.target.value);
                       setPointsValue(Number.isNaN(value) ? '' : value);
                     }}
                     className="w-full px-2 py-1 text-xs border border-slate-200 rounded-lg"
                     min={0}
                   />
                   {pointsError && <div className="text-[9px] text-rose-600 mt-1">{pointsError}</div>}
                   <div className="flex items-center justify-end gap-2 mt-2">
                     <button
                       onClick={(e) => {
                         e.stopPropagation();
                         setIsEditingPoints(false);
                         setPointsError(null);
                       }}
                       className="text-[9px] font-black uppercase tracking-widest text-slate-400"
                     >
                       Cancel
                     </button>
                     <button
                       onClick={async (e) => {
                         e.stopPropagation();
                         const numeric = typeof pointsValue === 'number' ? pointsValue : 0;
                         if (numeric < 0) {
                           setPointsError('Must be >= 0');
                           return;
                         }
                         const previous = item.storyPoints;
                         onItemUpdated?.(String(item._id || item.id), { storyPoints: numeric });
                         try {
                           const res = await fetch(`/api/work-items/${item._id || item.id}`, {
                             method: 'PATCH',
                             headers: { 'Content-Type': 'application/json' },
                             body: JSON.stringify({ storyPoints: numeric })
                           });
                           if (!res.ok) {
                             const err = await res.json().catch(() => ({}));
                             onItemUpdated?.(String(item._id || item.id), { storyPoints: previous as any });
                             setPointsError(err.error || 'Update failed');
                             return;
                           }
                           setIsEditingPoints(false);
                           setPointsError(null);
                         } catch (err: any) {
                           onItemUpdated?.(String(item._id || item.id), { storyPoints: previous as any });
                           setPointsError(err?.message || 'Update failed');
                         }
                       }}
                       className="text-[9px] font-black uppercase tracking-widest text-blue-600"
                     >
                       Save
                     </button>
                   </div>
                 </div>
               )}
             </div>
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
