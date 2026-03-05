
import React, { useState, useEffect, useMemo } from 'react';
import { 
  DndContext, 
  useDraggable, 
  useDroppable, 
  DragEndEvent, 
  PointerSensor, 
  useSensor, 
  useSensors,
  DragOverlay
} from '@dnd-kit/core';
import { WorkItem, WorkItemType, Bundle, Application, WorkItemStatus, Milestone, MilestoneStatus, MilestoneRollup, CriticalPathResult } from '../types';
import WorkItemDetails from './WorkItemDetails';
import WorkItemBulkFixModal from './WorkItemBulkFixModal';
import WorkItemsStaleModal from './WorkItemsStaleModal';
import AssigneeSearch from './AssigneeSearch';
import DependencyGraph from './DependencyGraph';
import ChangeFeed from './ChangeFeed';

interface WorkItemsMilestonePlanningViewProps {
  applications: Application[];
  bundles: Bundle[];
  selBundleId: string;
  selAppId: string;
  searchQuery: string;
}

const getGithubActivity = (item?: WorkItem) => {
  if (!item) return null;
  const prs = item.github?.prs || [];
  if (!prs.length) return 'stale';
  const now = Date.now();
  const active = prs.some((pr) => pr.state === 'open' && now - new Date(pr.updatedAt).getTime() <= 3 * 24 * 60 * 60 * 1000);
  return active ? 'active' : 'stale';
};

const getDaysSince = (value?: string | null) => {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  const delta = Date.now() - parsed.getTime();
  if (delta < 0) return 0;
  return Math.ceil(delta / (24 * 60 * 60 * 1000));
};

const DraggableItem: React.FC<{ item: WorkItem; onClick: () => void }> = ({ item, onClick }) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: (item._id || item.id) as string,
    data: { item }
  });

  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, zIndex: 50 } : undefined;
  const getIcon = (type: WorkItemType) => {
    switch (type) {
      case WorkItemType.EPIC: return 'fa-layer-group text-purple-500';
      case WorkItemType.BUG: return 'fa-bug text-red-500';
      case WorkItemType.RISK: return 'fa-triangle-exclamation text-rose-500';
      case WorkItemType.DEPENDENCY: return 'fa-link text-indigo-500';
      default: return 'fa-file-lines text-blue-500';
    }
  };

  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes} onClick={onClick} className={`bg-white border border-slate-100 p-4 rounded-2xl shadow-sm hover:shadow-md transition-all group cursor-grab active:cursor-grabbing ${isDragging ? 'opacity-30' : ''}`}>
       <div className="flex justify-between items-start mb-2">
          <div className="flex items-center gap-2">
             <i className={`fas ${getIcon(item.type)} text-[10px]`}></i>
             <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">{item.key}</span>
          </div>
          {item.isFlagged && <i className="fas fa-flag text-red-500 text-[8px] animate-pulse"></i>}
       </div>
       <h5 className="text-xs font-bold text-slate-700 leading-tight mb-3 pointer-events-none">{item.title}</h5>
       <div className="flex items-center justify-between">
          <span className="text-[8px] font-black text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">{item.storyPoints || 0} pts</span>
          <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(item.assignedTo || 'U')}&background=random&size=24`} className="w-4 h-4 rounded-full" />
       </div>
    </div>
  );
};

const MilestoneColumn: React.FC<{
  milestone: Milestone;
  items: WorkItem[];
  rollup?: MilestoneRollup;
  burnup?: any;
  canCommit?: boolean;
  onCommit?: (id: string) => void;
  onStatusChange?: (id: string, nextStatus: string) => void;
  onCardClick: (i: WorkItem) => void;
  isWatching?: boolean;
  onToggleWatch?: (id: string) => void;
}> = ({ milestone, items, rollup, burnup, canCommit, onCommit, onStatusChange, onCardClick, isWatching, onToggleWatch }) => {
  const { setNodeRef, isOver } = useDroppable({ id: milestone._id as string });
  const totalPoints = items.reduce((acc, curr) => acc + (curr.storyPoints || 0), 0);
  const progress = items.length > 0 ? Math.round((items.filter(i => i.status === WorkItemStatus.DONE).length / items.length) * 100) : 0;
  const utilization = milestone.targetCapacity ? Math.round((totalPoints / milestone.targetCapacity) * 100) : null;
  const isOverCapacity = utilization && utilization > 100;
  const rollupCapacity = rollup?.capacity;
  const rollupTotals = rollup?.totals;
  const rollupRisks = rollup?.risks;
  const rollupSchedule = rollup?.schedule;
  const forecast = rollup?.forecast;
  const confidenceScore = rollup?.confidence?.score;
  const confidenceBand = rollup?.confidence?.band;
  const highCriticalRisks = rollupRisks ? (rollupRisks.openBySeverity.high + rollupRisks.openBySeverity.critical) : null;
  const statusLabel = milestone.status || MilestoneStatus.PLANNED;
  const isCommitted = String(statusLabel).toUpperCase() === 'COMMITTED';
  const burnupAvg = burnup?.trend?.avgCompletedPerSprint;
  const burnupLast3 = burnup?.trend?.last3Avg;
  const velocityHint = burnupAvg && burnupLast3
    ? (burnupLast3 < burnupAvg * 0.8 ? 'down' : burnupLast3 > burnupAvg * 1.2 ? 'up' : 'flat')
    : null;
  const warningFlags = [
    rollupCapacity?.isOverCapacity ? 'Over Capacity' : null,
    rollup?.confidence?.band === 'low' ? 'Low Confidence' : null,
    rollupTotals && rollupTotals.blockedDerived > 0 ? 'Blocked' : null,
    highCriticalRisks && highCriticalRisks > 0 ? 'Risks' : null,
    rollupSchedule?.isLate ? `Late (${rollupSchedule.slipDays}d)` : null
  ].filter(Boolean) as string[];

  return (
    <div className="w-80 flex flex-col shrink-0">
      <header className={`mb-6 p-4 rounded-[2rem] transition-all ${isOverCapacity ? 'bg-red-50 border-red-100' : 'bg-transparent'}`}>
        <div className="flex items-center gap-3 mb-4">
           <span className={`w-8 h-8 rounded-xl flex items-center justify-center text-[10px] font-black ${isOver ? 'bg-blue-600 text-white animate-pulse' : 'bg-slate-900 text-white'}`}><i className="fas fa-flag-checkered"></i></span>
           <div className="flex-1 min-w-0">
             <h4 className="text-sm font-black uppercase tracking-tight truncate">{milestone.name}</h4>
             <div className="flex items-center gap-2">
               <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">{new Date(milestone.startDate).toLocaleDateString()} — {new Date(milestone.endDate).toLocaleDateString()}</span>
               <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${isCommitted ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                 {statusLabel}
               </span>
             </div>
           </div>
            {onToggleWatch && (
              <button
                onClick={() => onToggleWatch(String(milestone._id || milestone.id))}
                className={`px-2.5 py-1 text-[8px] font-black uppercase rounded-full border transition-all ${
                  isWatching ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-white border-slate-200 text-slate-500'
                }`}
              >
                {isWatching ? 'Watching' : 'Watch'}
              </button>
            )}
            {!isCommitted && onCommit && (
              <button
                onClick={() => onCommit(String(milestone._id || milestone.id))}
                disabled={!canCommit}
                className={`px-3 py-1 text-[8px] font-black uppercase rounded-full transition-all ${
                  canCommit ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                }`}
                title={canCommit ? 'Commit milestone scope' : 'Requires Admin/CMO'}
              >
                Commit
              </button>
            )}
            {isCommitted && onStatusChange && (
              <button
                onClick={() => onStatusChange(String(milestone._id || milestone.id), 'IN_PROGRESS')}
                disabled={!canCommit}
                className={`px-3 py-1 text-[8px] font-black uppercase rounded-full transition-all ${
                  canCommit ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                }`}
                title={canCommit ? 'Start milestone' : 'Requires Admin/CMO'}
              >
                Start
              </button>
            )}
            {String(statusLabel).toUpperCase() === 'IN_PROGRESS' && onStatusChange && (
              <button
                onClick={() => onStatusChange(String(milestone._id || milestone.id), 'DONE')}
                disabled={!canCommit}
                className={`px-3 py-1 text-[8px] font-black uppercase rounded-full transition-all ${
                  canCommit ? 'bg-indigo-600 text-white hover:bg-indigo-700' : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                }`}
                title={canCommit ? 'Complete milestone' : 'Requires Admin/CMO'}
              >
                Done
              </button>
            )}
         </div>
         <div className="space-y-1.5 px-1">
            <div className="flex justify-between text-[8px] font-black uppercase tracking-widest">
               <span className={isOverCapacity ? 'text-red-500' : 'text-slate-400'}>Utilization {utilization ? `(${utilization}%)` : ''}</span>
               <span className={isOverCapacity ? 'text-red-600' : 'text-slate-600'}>{totalPoints} / {milestone.targetCapacity || '∞'} pts</span>
            </div>
            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden flex"><div className={`h-full transition-all duration-700 ${isOverCapacity ? 'bg-red-500' : 'bg-blue-600'}`} style={{ width: `${Math.min(utilization || 0, 100)}%` }} /></div>
         </div>
         {rollup && (
           <div className="mt-4 flex flex-wrap gap-2">
             <span className="px-2 py-1 rounded-full text-[8px] font-black uppercase tracking-widest bg-slate-100 text-slate-600">
               Confidence {confidenceScore ?? '—'} {confidenceBand ? `(${confidenceBand})` : ''}
             </span>
             <span className="px-2 py-1 rounded-full text-[8px] font-black uppercase tracking-widest bg-slate-100 text-slate-600">
               Capacity {rollupCapacity?.targetCapacity ? `${rollupCapacity.committedPoints}/${rollupCapacity.targetCapacity} (${Math.round((rollupCapacity.capacityUtilization || 0) * 100)}%)` : `${rollupCapacity?.committedPoints ?? 0} pts`}
             </span>
             <span className="px-2 py-1 rounded-full text-[8px] font-black uppercase tracking-widest bg-slate-100 text-slate-600">
               Blocked {rollupTotals?.blockedDerived ?? 0}
             </span>
             <span className="px-2 py-1 rounded-full text-[8px] font-black uppercase tracking-widest bg-slate-100 text-slate-600">
               Overdue {rollupTotals?.overdueOpen ?? 0}
             </span>
            <span className="px-2 py-1 rounded-full text-[8px] font-black uppercase tracking-widest bg-slate-100 text-slate-600">
              Risk {highCriticalRisks ?? 0}
            </span>
            {forecast?.estimatedCompletionDate && (
              <span className={`px-2 py-1 rounded-full text-[8px] font-black uppercase tracking-widest ${
                forecast.band === 'on-track' ? 'bg-emerald-50 text-emerald-700' :
                forecast.band === 'at-risk' ? 'bg-amber-50 text-amber-700' :
                'bg-red-50 text-red-600'
              }`}>
                ETA {new Date(forecast.estimatedCompletionDate).toLocaleDateString()} {forecast.varianceDays ? `${forecast.varianceDays > 0 ? '+' : ''}${forecast.varianceDays}d` : ''}
              </span>
            )}
            {forecast?.monteCarlo?.p80 && (
              <span
                className="px-2 py-1 rounded-full text-[8px] font-black uppercase tracking-widest bg-slate-900 text-white"
                title={`P50 ${new Date(forecast.monteCarlo.p50).toLocaleDateString()} • P80 ${new Date(forecast.monteCarlo.p80).toLocaleDateString()} • P90 ${new Date(forecast.monteCarlo.p90).toLocaleDateString()} • Hit ${Math.round((forecast.monteCarlo.hitProbability || 0) * 100)}%`}
              >
                P80 {new Date(forecast.monteCarlo.p80).toLocaleDateString()} ({Math.round((forecast.monteCarlo.hitProbability || 0) * 100)}%)
              </span>
            )}
            {velocityHint && (
              <span className={`px-2 py-1 rounded-full text-[8px] font-black uppercase tracking-widest ${
                velocityHint === 'up' ? 'bg-emerald-50 text-emerald-700' :
                velocityHint === 'down' ? 'bg-amber-50 text-amber-700' :
                'bg-slate-100 text-slate-500'
              }`}>
                Velocity {velocityHint === 'up' ? 'Up' : velocityHint === 'down' ? 'Down' : 'Flat'}
              </span>
            )}
            {rollupSchedule?.isLate && (
              <span className="px-2 py-1 rounded-full text-[8px] font-black uppercase tracking-widest bg-red-50 text-red-600">
                Late {rollupSchedule.slipDays}d
              </span>
            )}
           </div>
         )}
         {warningFlags.length > 0 && (
           <div className="mt-2 flex flex-wrap gap-2">
             {warningFlags.map(flag => (
               <span key={flag} className="px-2 py-1 rounded-full text-[8px] font-black uppercase tracking-widest bg-amber-50 text-amber-700">
                 {flag}
               </span>
             ))}
           </div>
         )}
      </header>
      <div ref={setNodeRef} className={`flex-1 rounded-[2.5rem] p-4 space-y-3 overflow-y-auto custom-scrollbar border transition-all ${isOver ? 'bg-blue-50/50 border-dashed border-blue-200 shadow-inner' : 'bg-slate-50/50 border-slate-100'}`}>
         {items.map(item => <DraggableItem key={(item._id || item.id) as string} item={item} onClick={() => onCardClick(item)} />)}
      </div>
    </div>
  );
};

const WorkItemsMilestonePlanningView: React.FC<WorkItemsMilestonePlanningViewProps> = ({ selBundleId, selAppId, searchQuery, bundles, applications }) => {
  const [items, setItems] = useState<WorkItem[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [rollups, setRollups] = useState<Record<string, MilestoneRollup>>({});
  const [loading, setLoading] = useState(true);
  const [activeItem, setActiveItem] = useState<WorkItem | null>(null);
  const [draggedItem, setDraggedItem] = useState<WorkItem | null>(null);
  const [currentUser, setCurrentUser] = useState<any | null>(null);
  const [commitError, setCommitError] = useState<string | null>(null);
  const [commitReviewModal, setCommitReviewModal] = useState<{
    milestoneId: string;
    review: any;
  } | null>(null);
  const [commitOverrideReason, setCommitOverrideReason] = useState('');
  const [commitDrift, setCommitDrift] = useState<any | null>(null);
  const [commitDriftLoading, setCommitDriftLoading] = useState(false);
  const [baselineDelta, setBaselineDelta] = useState<any | null>(null);
  const [baselineDeltaLoading, setBaselineDeltaLoading] = useState(false);
  const [briefWeek, setBriefWeek] = useState('');
  const [brief, setBrief] = useState<any | null>(null);
  const [briefLoading, setBriefLoading] = useState(false);
  const [briefError, setBriefError] = useState<string | null>(null);
  const [readinessPrompt, setReadinessPrompt] = useState<{
    milestoneId: string;
    nextStatus: string;
    readiness: any;
  } | null>(null);
  const [overrideReason, setOverrideReason] = useState('');
  const [overrideRequest, setOverrideRequest] = useState<{
    itemId: string;
    milestoneIds: string[];
    details?: any;
  } | null>(null);
  const [milestoneWatchers, setMilestoneWatchers] = useState<Record<string, boolean>>({});
  const [watchMessage, setWatchMessage] = useState<string | null>(null);
  const [sprintRollups, setSprintRollups] = useState<any[]>([]);
  const [sprintMilestoneId, setSprintMilestoneId] = useState<string>('all');
  const [burnupByMilestone, setBurnupByMilestone] = useState<Record<string, any>>({});
  const [scopeRequests, setScopeRequests] = useState<any[]>([]);
  const [scopeRequestPrompt, setScopeRequestPrompt] = useState<{
    milestoneId: string;
    action: 'ADD_ITEMS' | 'REMOVE_ITEMS';
    workItemIds: string[];
  } | null>(null);
  const [scopeDecisionPrompt, setScopeDecisionPrompt] = useState<{ request: any; decision: 'APPROVE' | 'REJECT' | 'CANCEL' } | null>(null);
  const [decisionReason, setDecisionReason] = useState('');
  const [intelModal, setIntelModal] = useState<{ title: string; items: any[] } | null>(null);
  const [staleModal, setStaleModal] = useState<{ milestoneId?: string; sprintId?: string } | null>(null);
  const [bulkFixIssue, setBulkFixIssue] = useState<'missingStoryPoints' | 'missingDueAt' | 'missingRiskSeverity' | null>(null);
  const [ownerPickerOpen, setOwnerPickerOpen] = useState(false);
  const [ownerSuggestions, setOwnerSuggestions] = useState<any[]>([]);
  const [ownerQuery, setOwnerQuery] = useState('');
  const [ownerResults, setOwnerResults] = useState<any[]>([]);
  const [ownerLoading, setOwnerLoading] = useState(false);
  const [ownerSaving, setOwnerSaving] = useState(false);
  const [ownerSuggestionCache, setOwnerSuggestionCache] = useState<Record<string, any[]>>({});
  const [bulkFixItemIds, setBulkFixItemIds] = useState<string[] | null>(null);
  const [criticalPath, setCriticalPath] = useState<CriticalPathResult | null>(null);
  const [criticalLoading, setCriticalLoading] = useState(false);
  const [criticalError, setCriticalError] = useState<string | null>(null);
  const [includeExternalCritical, setIncludeExternalCritical] = useState<boolean | null>(null);
  const [criticalActionMessage, setCriticalActionMessage] = useState<string | null>(null);
  const [estimateDrafts, setEstimateDrafts] = useState<Record<string, number | ''>>({});
  const [showCriticalGraph, setShowCriticalGraph] = useState(false);
  const [graphMode, setGraphMode] = useState<'critical' | 'critical+near' | 'full'>('critical');
  const [graphCache, setGraphCache] = useState<Record<string, any>>({});
  const [graphLoading, setGraphLoading] = useState(false);
  const [graphError, setGraphError] = useState<string | null>(null);
  const { setNodeRef: setBacklogRef, isOver: isOverBacklog } = useDroppable({ id: 'backlog' });

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const fetchData = async () => {
    const params = new URLSearchParams({ bundleId: selBundleId, applicationId: selAppId, q: searchQuery });
    const [iRes, mRes] = await Promise.all([fetch(`/api/work-items?${params.toString()}`), fetch(`/api/milestones?${params.toString()}`)]);
    setItems(await iRes.json());
    setMilestones(await mRes.json());
    setLoading(false);
  };

  const loadWatchers = async () => {
    try {
      const res = await fetch('/api/watchers?scopeType=MILESTONE');
      if (!res.ok) return;
      const data = await res.json();
      const map: Record<string, boolean> = {};
      (data?.items || []).forEach((w: any) => { map[String(w.scopeId)] = true; });
      setMilestoneWatchers(map);
    } catch {}
  };

  useEffect(() => { fetchData(); loadWatchers(); }, [selBundleId, selAppId, searchQuery]);

  const toggleMilestoneWatch = async (milestoneId: string) => {
    try {
      const isWatching = Boolean(milestoneWatchers[milestoneId]);
      const res = await fetch('/api/watchers', {
        method: isWatching ? 'DELETE' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scopeType: 'MILESTONE', scopeId: milestoneId })
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setWatchMessage(data?.error || 'Failed to update watch');
        return;
      }
      setMilestoneWatchers((prev) => ({ ...prev, [milestoneId]: !isWatching }));
      setWatchMessage(isWatching ? 'Milestone un-watched.' : 'Milestone watched.');
      setTimeout(() => setWatchMessage(null), 2000);
    } catch (err: any) {
      setWatchMessage(err?.message || 'Failed to update watch');
    }
  };

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((data) => setCurrentUser(data?.user || null))
      .catch(() => setCurrentUser(null));
  }, []);

  useEffect(() => {
    const loadRollups = async () => {
      if (milestones.length === 0) {
        setRollups({});
        return;
      }
      const ids = milestones.map(m => String(m._id || m.id || m.name)).filter(Boolean);
      if (ids.length === 0) return;
      try {
        const res = await fetch(`/api/milestones/rollups?milestoneIds=${encodeURIComponent(ids.join(','))}`);
        if (!res.ok) return;
        const data = await res.json();
        const next: Record<string, MilestoneRollup> = {};
        (data || []).forEach((r: MilestoneRollup) => {
          next[r.milestoneId] = r;
        });
        setRollups(next);
      } catch {
        setRollups({});
      }
    };
    loadRollups();
  }, [milestones]);

  useEffect(() => {
    if (milestones.length && sprintMilestoneId === 'all') {
      const first = String(milestones[0]._id || milestones[0].id || milestones[0].name);
      setSprintMilestoneId(first);
    }
  }, [milestones, sprintMilestoneId]);

  const activeMilestone = useMemo(() => {
    return milestones.find((m) => {
      const key = String(m._id || m.id || m.name || '');
      return key === String(sprintMilestoneId);
    }) || null;
  }, [milestones, sprintMilestoneId]);

  useEffect(() => {
    if (!sprintMilestoneId || sprintMilestoneId === 'all') return;
    const loadSuggestions = async () => {
      try {
        const res = await fetch(`/api/milestones/${encodeURIComponent(sprintMilestoneId)}/owner-suggestions`);
        const data = await res.json();
        setOwnerSuggestions(Array.isArray(data?.candidates) ? data.candidates : []);
      } catch {
        setOwnerSuggestions([]);
      }
    };
    loadSuggestions();
  }, [sprintMilestoneId]);

  useEffect(() => {
    if (!ownerQuery || ownerQuery.length < 2) {
      setOwnerResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setOwnerLoading(true);
      try {
        const res = await fetch(`/api/users/search?q=${encodeURIComponent(ownerQuery)}`);
        const data = await res.json();
        setOwnerResults(Array.isArray(data) ? data : []);
      } catch {
        setOwnerResults([]);
      } finally {
        setOwnerLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [ownerQuery]);

  const updateMilestoneOwner = async (user: any) => {
    if (!activeMilestone) return;
    setOwnerSaving(true);
    try {
      const res = await fetch(`/api/milestones/${encodeURIComponent(String(activeMilestone._id || activeMilestone.id || activeMilestone.name))}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ownerUserId: String(user._id || user.id || user.userId || ''), ownerEmail: user.email })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error || 'Failed to update owner');
        return;
      }
      const ownerUserId = String(user._id || user.id || user.userId || '');
      setMilestones((prev) => prev.map((m) => {
        const key = String(m._id || m.id || m.name || '');
        if (key !== String(activeMilestone._id || activeMilestone.id || activeMilestone.name || '')) return m;
        return { ...m, ownerUserId, ownerEmail: user.email || m.ownerEmail };
      }));
      setOwnerPickerOpen(false);
      setOwnerQuery('');
      setOwnerResults([]);
    } finally {
      setOwnerSaving(false);
    }
  };

  useEffect(() => {
    if (sprintMilestoneId && sprintMilestoneId !== 'all') {
      fetchCriticalPath(sprintMilestoneId, includeExternalCritical);
      if (showCriticalGraph) {
        fetchGraph(sprintMilestoneId, includeExternalCritical);
      }
    }
  }, [sprintMilestoneId, includeExternalCritical, showCriticalGraph]);

  useEffect(() => {
    const actions = criticalPath?.topActions || [];
    actions.forEach((action: any) => {
      if (action.type !== 'ASSIGN') return;
      const item = items.find((i) => String(i._id || i.id) === String(action.itemId));
      if (!item || item.assignedTo) return;
      const key = String(action.itemId);
      if (ownerSuggestionCache[key]) return;
      fetch(`/api/work-items/${encodeURIComponent(key)}/owner-suggestions`)
        .then((res) => res.json())
        .then((data) => {
          setOwnerSuggestionCache((prev) => ({
            ...prev,
            [key]: Array.isArray(data?.candidates) ? data.candidates : []
          }));
        })
        .catch(() => {
          setOwnerSuggestionCache((prev) => ({ ...prev, [key]: [] }));
        });
    });
  }, [criticalPath, items, ownerSuggestionCache]);

  useEffect(() => {
    if (!criticalActionMessage) return;
    const t = setTimeout(() => setCriticalActionMessage(null), 2500);
    return () => clearTimeout(t);
  }, [criticalActionMessage]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const milestoneId = params.get('milestoneId');
    const showGraph = params.get('showGraph');
    if (milestoneId) {
      setSprintMilestoneId(milestoneId);
    }
    if (showGraph === '1') {
      setShowCriticalGraph(true);
    }
  }, []);

  useEffect(() => {
    const loadSprintRollups = async () => {
      if (!sprintMilestoneId || sprintMilestoneId === 'all') {
        setSprintRollups([]);
        return;
      }
      const params = new URLSearchParams();
      params.set('milestoneId', sprintMilestoneId);
      if (selBundleId && selBundleId !== 'all') params.set('bundleId', selBundleId);
      const res = await fetch(`/api/sprints/rollups?${params.toString()}`);
      if (!res.ok) {
        setSprintRollups([]);
        return;
      }
      const data = await res.json();
      setSprintRollups(Array.isArray(data) ? data : []);
    };
    loadSprintRollups();
  }, [sprintMilestoneId, selBundleId]);

  const refreshSprintRollups = async (milestoneId: string) => {
    if (!milestoneId || milestoneId === 'all') return;
    const params = new URLSearchParams();
    params.set('milestoneId', milestoneId);
    if (selBundleId && selBundleId !== 'all') params.set('bundleId', selBundleId);
    const res = await fetch(`/api/sprints/rollups?${params.toString()}`);
    if (!res.ok) return;
    const data = await res.json();
    setSprintRollups(Array.isArray(data) ? data : []);
  };

  useEffect(() => {
    const loadBurnup = async () => {
      if (!sprintMilestoneId || sprintMilestoneId === 'all') return;
      const params = new URLSearchParams();
      if (selBundleId && selBundleId !== 'all') params.set('bundleId', selBundleId);
      const res = await fetch(`/api/milestones/${encodeURIComponent(sprintMilestoneId)}/burnup?${params.toString()}`);
      if (!res.ok) return;
      const data = await res.json();
      setBurnupByMilestone(prev => ({ ...prev, [sprintMilestoneId]: data }));
    };
    loadBurnup();
  }, [sprintMilestoneId, selBundleId]);

  const refreshBurnup = async (milestoneId: string) => {
    if (!milestoneId || milestoneId === 'all') return;
    const params = new URLSearchParams();
    if (selBundleId && selBundleId !== 'all') params.set('bundleId', selBundleId);
    const res = await fetch(`/api/milestones/${encodeURIComponent(milestoneId)}/burnup?${params.toString()}`);
    if (!res.ok) return;
    const data = await res.json();
    setBurnupByMilestone(prev => ({ ...prev, [milestoneId]: data }));
  };

  useEffect(() => {
    const loadScopeRequests = async () => {
      if (!sprintMilestoneId || sprintMilestoneId === 'all') {
        setScopeRequests([]);
        return;
      }
      const res = await fetch(`/api/milestones/${encodeURIComponent(sprintMilestoneId)}/scope-requests`);
      if (!res.ok) {
        setScopeRequests([]);
        return;
      }
      const data = await res.json();
      setScopeRequests(Array.isArray(data?.items) ? data.items : []);
    };
    loadScopeRequests();
  }, [sprintMilestoneId]);

  useEffect(() => {
    const loadDrift = async () => {
      if (!sprintMilestoneId || sprintMilestoneId === 'all') {
        setCommitDrift(null);
        return;
      }
      setCommitDriftLoading(true);
      try {
        const res = await fetch(`/api/milestones/${encodeURIComponent(sprintMilestoneId)}/commit-drift`);
        if (!res.ok) {
          setCommitDrift(null);
          return;
        }
        const data = await res.json();
        if (data?.enabled) {
          setCommitDrift(data.drift || null);
        } else {
          setCommitDrift(null);
        }
      } catch {
        setCommitDrift(null);
      } finally {
        setCommitDriftLoading(false);
      }
    };
    loadDrift();
  }, [sprintMilestoneId]);

  useEffect(() => {
    const loadBaselineDelta = async () => {
      if (!sprintMilestoneId || sprintMilestoneId === 'all') {
        setBaselineDelta(null);
        return;
      }
      setBaselineDeltaLoading(true);
      try {
        const res = await fetch(`/api/milestones/${encodeURIComponent(sprintMilestoneId)}/baseline/delta`);
        if (!res.ok) {
          setBaselineDelta(null);
          return;
        }
        const data = await res.json();
        setBaselineDelta(data?.delta || null);
      } catch {
        setBaselineDelta(null);
      } finally {
        setBaselineDeltaLoading(false);
      }
    };
    loadBaselineDelta();
  }, [sprintMilestoneId]);

  const getWeekKey = (date: Date) => {
    const target = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNr = (target.getUTCDay() + 6) % 7;
    target.setUTCDate(target.getUTCDate() - dayNr + 3);
    const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
    const diff = target.getTime() - firstThursday.getTime();
    const week = 1 + Math.round(diff / (7 * 24 * 60 * 60 * 1000));
    const year = target.getUTCFullYear();
    return `${year}-W${String(week).padStart(2, '0')}`;
  };

  const briefWeekOptions = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 4 }).map((_, idx) => {
      const date = new Date(now.getTime() - idx * 7 * 24 * 60 * 60 * 1000);
      return getWeekKey(date);
    });
  }, []);

  useEffect(() => {
    if (!briefWeek && briefWeekOptions.length) setBriefWeek(briefWeekOptions[0]);
  }, [briefWeek, briefWeekOptions]);

  useEffect(() => {
    const loadBrief = async () => {
      if (!sprintMilestoneId || sprintMilestoneId === 'all' || !briefWeek) {
        setBrief(null);
        return;
      }
      setBriefLoading(true);
      setBriefError(null);
      try {
        const res = await fetch(`/api/briefs/weekly?scopeType=MILESTONE&scopeId=${encodeURIComponent(sprintMilestoneId)}&weekKey=${encodeURIComponent(briefWeek)}`);
        if (!res.ok) {
          setBriefError('Failed to load brief.');
          setBrief(null);
          return;
        }
        const data = await res.json();
        setBrief(data?.brief || null);
      } catch {
        setBriefError('Failed to load brief.');
        setBrief(null);
      } finally {
        setBriefLoading(false);
      }
    };
    loadBrief();
  }, [sprintMilestoneId, briefWeek]);

  const isPrivilegedRole = (role?: string) => {
    const roleName = String(role || '');
    if (!roleName) return false;
    if (roleName.toLowerCase().includes('admin')) return true;
    if (roleName.toLowerCase().includes('cmo')) return true;
    const privileged = new Set(['CMO Architect', 'CMO Member', 'SVP Architect', 'Director', 'VP', 'CIO']);
    return privileged.has(roleName);
  };

  const isAdminCmoRole = (role?: string) => {
    const roleName = String(role || '');
    if (!roleName) return false;
    const lower = roleName.toLowerCase();
    if (lower.includes('admin')) return true;
    if (lower.includes('cmo')) return true;
    return false;
  };

  const openCommitReview = async (milestoneId: string) => {
    try {
      const reviewRes = await fetch(`/api/milestones/${encodeURIComponent(milestoneId)}/commit-review`);
      if (!reviewRes.ok) return false;
      const data = await reviewRes.json();
      if (data?.enabled) {
        setCommitReviewModal({ milestoneId, review: data.review });
        return true;
      }
    } catch {}
    return false;
  };

  const handleCommitMilestone = async (milestoneId: string) => {
    setCommitError(null);
    try {
      const opened = await openCommitReview(milestoneId);
      if (opened) return;
    } catch {}

    const res = await fetch(`/api/milestones/${milestoneId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'COMMITTED' })
    });
    if (res.ok) {
      await fetchData();
      return;
    }
    const err = await res.json().catch(() => ({}));
    if (err?.error === 'COMMIT_REVIEW_REQUIRED' && err?.review) {
      setCommitReviewModal({ milestoneId, review: err.review });
      return;
    }
    setCommitError(err.error || 'Unable to commit milestone.');
    alert(err.error || 'Unable to commit milestone.');
  };

  const handleMilestoneStatus = async (milestoneId: string, nextStatus: string) => {
    setCommitError(null);
    const res = await fetch(`/api/milestones/${milestoneId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: nextStatus })
    });
    if (res.ok) {
      await fetchData();
      return;
    }
    const err = await res.json().catch(() => ({}));
    if (err?.error === 'READINESS_BLOCKED') {
      setReadinessPrompt({ milestoneId, nextStatus, readiness: err.readiness });
      return;
    }
    alert(err.error || 'Unable to update milestone status.');
  };

  const handleReadinessOverride = async () => {
    if (!readinessPrompt) return;
    const res = await fetch(`/api/milestones/${readinessPrompt.milestoneId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: readinessPrompt.nextStatus,
        allowOverride: true,
        overrideReason: overrideReason.trim()
      })
    });
    if (res.ok) {
      setReadinessPrompt(null);
      setOverrideReason('');
      await fetchData();
      return;
    }
    const err = await res.json().catch(() => ({}));
    alert(err.error || 'Override failed.');
  };

  const submitCommitReview = async (decision: 'COMMIT' | 'OVERRIDE') => {
    if (!commitReviewModal) return;
    const res = await fetch(`/api/milestones/${encodeURIComponent(commitReviewModal.milestoneId)}/commit-review/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        decision,
        overrideReason: decision === 'OVERRIDE' ? commitOverrideReason.trim() : undefined
      })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      if (err?.review) {
        setCommitReviewModal({ milestoneId: commitReviewModal.milestoneId, review: err.review });
        return;
      }
      alert(err?.error || 'Commit review failed.');
      return;
    }
    setCommitReviewModal(null);
    setCommitOverrideReason('');
    await fetchData();
  };

  const submitScopeRequest = async () => {
    if (!scopeRequestPrompt) return;
    const { milestoneId, action, workItemIds } = scopeRequestPrompt;
    const res = await fetch(`/api/milestones/${encodeURIComponent(milestoneId)}/scope-requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, workItemIds })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(err.error || 'Failed to create scope request.');
      return;
    }
    setScopeRequestPrompt(null);
    setDecisionReason('');
    const data = await res.json().catch(() => ({}));
    if (data?.request) {
      setScopeRequests(prev => [data.request, ...prev]);
    }
  };

  const decideScopeRequest = async () => {
    if (!scopeDecisionPrompt) return;
    const { request, decision } = scopeDecisionPrompt;
    const res = await fetch(`/api/milestones/${encodeURIComponent(request.milestoneId)}/scope-requests/${encodeURIComponent(request._id)}/decide`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ decision, reason: decisionReason.trim() || undefined })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(err.error || 'Failed to update request.');
      return;
    }
    const data = await res.json().catch(() => ({}));
    if (data?.request) {
      setScopeRequests(prev => prev.map((r) => String(r._id) === String(data.request._id) ? data.request : r));
    }
    setScopeDecisionPrompt(null);
    setDecisionReason('');
    await fetchData();
    await refreshBurnup(sprintMilestoneId);
    await refreshSprintRollups(sprintMilestoneId);
  };

  const openIntelList = async (milestoneId: string, type: 'blockers' | 'risks' | 'cross') => {
    try {
      const res = await fetch(`/api/work-items/roadmap-intel/lists?milestoneId=${encodeURIComponent(milestoneId)}`);
      if (!res.ok) return;
      const data = await res.json();
      const lists = data?.lists || {};
      if (type === 'blockers') {
        setIntelModal({ title: 'Open Blockers', items: lists.topBlockers || [] });
      }
      if (type === 'risks') {
        setIntelModal({ title: 'High Risks', items: lists.highRisks || [] });
      }
      if (type === 'cross') {
        setIntelModal({ title: 'Cross-Milestone Dependencies', items: lists.crossMilestoneBlocks || [] });
      }
    } catch {}
  };

  const fetchCriticalPath = async (milestoneId: string, includeExternal = includeExternalCritical) => {
    if (!milestoneId || milestoneId === 'all') return;
    setCriticalLoading(true);
    setCriticalError(null);
    try {
      const params = new URLSearchParams();
      if (includeExternal === true) {
        params.set('includeExternal', 'true');
        params.set('maxExternalDepth', '3');
      }
      const res = await fetch(`/api/milestones/${milestoneId}/critical-path${params.toString() ? `?${params.toString()}` : ''}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setCriticalError(err.error || 'Failed to load critical path.');
        setCriticalPath(null);
        return;
      }
      const data = await res.json();
      setCriticalPath(data);
      if (includeExternalCritical === null) {
        const externalCount = data?.nodesByScope?.external || data?.external?.includedNodes || 0;
        if (externalCount > 0) setIncludeExternalCritical(true);
      }
    } catch (err: any) {
      setCriticalError(err?.message || 'Failed to load critical path.');
      setCriticalPath(null);
    } finally {
      setCriticalLoading(false);
    }
  };

  const handleAssignFromCritical = async (itemId: string, name: string) => {
    try {
      const res = await fetch(`/api/work-items/${itemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assignedTo: name,
          criticalPathAction: { type: 'ASSIGN', milestoneId: sprintMilestoneId }
        })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setCriticalActionMessage(err.error || 'Failed to assign.');
        return;
      }
      setItems((prev) => prev.map((i) => String(i._id || i.id) === itemId ? { ...i, assignedTo: name } : i));
      setCriticalActionMessage(`Assigned ${name}.`);
      fetchCriticalPath(sprintMilestoneId, includeExternalCritical);
    } catch (err: any) {
      setCriticalActionMessage(err?.message || 'Failed to assign.');
    }
  };

  const handleSetEstimateFromCritical = async (itemId: string, value: number) => {
    try {
      const res = await fetch(`/api/work-items/${itemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storyPoints: value,
          criticalPathAction: { type: 'SET_ESTIMATE', milestoneId: sprintMilestoneId }
        })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setCriticalActionMessage(err.error || 'Failed to set estimate.');
        return;
      }
      setItems((prev) => prev.map((i) => String(i._id || i.id) === itemId ? { ...i, storyPoints: value } : i));
      setCriticalActionMessage('Estimate updated.');
      fetchCriticalPath(sprintMilestoneId, includeExternalCritical);
    } catch (err: any) {
      setCriticalActionMessage(err?.message || 'Failed to set estimate.');
    }
  };

  const handleRequestEstimate = async (itemId: string, reason: string) => {
    try {
      const res = await fetch(`/api/work-items/${itemId}/actions/request-estimate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ milestoneId: sprintMilestoneId, reason })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setCriticalActionMessage(err.error || 'Failed to request estimate.');
        return;
      }
      setCriticalActionMessage('Estimate request sent.');
    } catch (err: any) {
      setCriticalActionMessage(err?.message || 'Failed to request estimate.');
    }
  };

  const handleNotifyOwner = async (itemId: string, reason: string) => {
    try {
      const res = await fetch(`/api/work-items/${itemId}/actions/notify-owner`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ milestoneId: sprintMilestoneId, reason })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setCriticalActionMessage(err.error || 'Failed to notify owners.');
        return;
      }
      setCriticalActionMessage('Escalation sent.');
    } catch (err: any) {
      setCriticalActionMessage(err?.message || 'Failed to notify owners.');
    }
  };

  const fetchGraph = async (milestoneId: string, includeExternal = includeExternalCritical) => {
    if (!milestoneId || milestoneId === 'all') return;
    const key = `${milestoneId}:${includeExternal ? '1' : '0'}`;
    if (graphCache[key]) return;
    setGraphLoading(true);
    setGraphError(null);
    try {
      const params = new URLSearchParams();
      if (includeExternal === true) {
        params.set('includeExternal', 'true');
        params.set('maxExternalDepth', '3');
      }
      params.set('includeGraph', 'true');
      const res = await fetch(`/api/milestones/${milestoneId}/critical-path?${params.toString()}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setGraphError(err.error || 'Failed to load graph.');
        return;
      }
      const data = await res.json();
      setGraphCache((prev) => ({ ...prev, [key]: data }));
    } catch (err: any) {
      setGraphError(err?.message || 'Failed to load graph.');
    } finally {
      setGraphLoading(false);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setDraggedItem(null);
    if (!over) return;
    const itemId = active.id as string;
    const targetId = over.id as string;
    const milestoneIds = targetId === 'backlog' ? [] : [targetId];
    setItems(prev => prev.map(i => (i._id || i.id) === itemId ? { ...i, milestoneIds } : i));
    const res = await fetch(`/api/work-items/${itemId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ milestoneIds }) });
    if (res.ok) return;

    const err = await res.json().catch(() => ({}));
    if (err?.error === 'OVER_CAPACITY') {
      const canOverride = isPrivilegedRole(currentUser?.role);
      if (canOverride) {
        setOverrideRequest({ itemId, milestoneIds, details: err.details });
      } else {
        alert(err.message || 'Milestone capacity exceeded.');
      }
      await fetchData();
      return;
    }
    if (err?.error === 'MISSING_ESTIMATE') {
      alert('Story points are required for COMMITTED milestones.');
      const found = items.find(i => (i._id || i.id) === itemId) || null;
      if (found) setActiveItem(found);
      await fetchData();
      return;
    }
    if (err?.error === 'COMMITTED_SCOPE_REQUIRES_APPROVAL') {
      const action = targetId === 'backlog' ? 'REMOVE_ITEMS' : 'ADD_ITEMS';
      setScopeRequestPrompt({
        milestoneId: String(err?.milestoneId || targetId),
        action,
        workItemIds: [String(itemId)]
      });
      await fetchData();
      return;
    }
    alert(err.message || err.error || 'Failed to update milestone assignment.');
    await fetchData();
  };

  const handleOverrideAssign = async () => {
    if (!overrideRequest) return;
    const { itemId, milestoneIds } = overrideRequest;
    const res = await fetch(`/api/work-items/${itemId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ milestoneIds, allowOverCapacity: true })
    });
    setOverrideRequest(null);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(err.message || err.error || 'Override failed.');
      await fetchData();
      return;
    }
    await fetchData();
  };

  const loadPerEngineer = useMemo(() => {
    const load: Record<string, number> = {};
    items.forEach(i => {
      if (i.assignedTo && i.status !== WorkItemStatus.DONE) {
        load[i.assignedTo] = (load[i.assignedTo] || 0) + (i.storyPoints || 0);
      }
    });
    return Object.entries(load).sort((a, b) => b[1] - a[1]);
  }, [items]);

  const activeRollup = sprintMilestoneId !== 'all' ? rollups[sprintMilestoneId] : null;
  const staleness = (activeRollup?.staleness || {}) as {
    staleCount?: number;
    criticalStaleCount?: number;
    blockedStaleCount?: number;
    unassignedStaleCount?: number;
    githubStaleCount?: number;
  };
  const staleTotal = staleness.staleCount || 0;
  const criticalStale = staleness.criticalStaleCount || 0;
  const driftBand = commitDrift?.driftBand || 'NONE';

  return (
    <DndContext sensors={sensors} onDragStart={(e) => setDraggedItem(e.active.data.current?.item)} onDragEnd={handleDragEnd}>
      <div className="flex h-[800px] bg-white rounded-[3rem] border border-slate-200 shadow-2xl overflow-hidden animate-fadeIn relative">
        {watchMessage && (
          <div className="absolute top-4 right-6 text-[10px] font-black uppercase tracking-widest text-slate-400">{watchMessage}</div>
        )}
        <aside className="w-[380px] border-r border-slate-100 flex flex-col shrink-0">
          <div className="p-8 border-b border-slate-100 bg-slate-50/50">
             <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Execution Backlog</h3>
             <p className="text-xs font-bold text-slate-500">{items.filter(i => !i.milestoneIds?.length).length} unscheduled artifacts</p>
          </div>
          <div
            ref={setBacklogRef}
            className={`flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar transition-all ${isOverBacklog ? 'bg-blue-50/50 border-2 border-dashed border-blue-200' : 'bg-slate-50/20'}`}
          >
             {items.filter(i => !i.milestoneIds?.length).map(item => <DraggableItem key={(item._id || item.id) as string} item={item} onClick={() => setActiveItem(item)} />)}
          </div>
          <div className="p-6 border-t border-slate-100 bg-white">
             <h4 className="text-[9px] font-black text-slate-300 uppercase tracking-widest mb-4">Engineer Load Intelligence</h4>
             <div className="space-y-4 max-h-48 overflow-y-auto custom-scrollbar pr-2">
                {loadPerEngineer.map(([name, points]) => (
                  <div key={name} className="flex flex-col gap-1.5">
                     <div className="flex justify-between items-center text-[10px] font-bold">
                        <span className="text-slate-600 truncate mr-2">{name}</span>
                        <span className={points > 8 ? 'text-red-500 font-black' : 'text-slate-400'}>{points} pts</span>
                     </div>
                     <div className="h-1 bg-slate-100 rounded-full overflow-hidden"><div className={`h-full transition-all duration-700 ${points > 8 ? 'bg-red-500' : 'bg-emerald-500'}`} style={{ width: `${Math.min((points / 8) * 100, 100)}%` }} /></div>
                  </div>
                ))}
             </div>
          </div>
        </aside>

        <main className="flex-1 p-10 bg-white flex flex-col gap-6 custom-scrollbar overflow-hidden">
           <div className="border border-slate-100 rounded-2xl p-4 bg-slate-50/60">
             <div className="flex flex-wrap items-center justify-between gap-3">
               <div>
                 <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Milestone Summary</div>
                 <div className="text-xs text-slate-500">Execution health, burn-up trend, and scope governance.</div>
                 <div className="mt-2 flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-slate-500">
                   <span>Owner</span>
                   {activeMilestone?.ownerEmail || activeMilestone?.ownerUserId ? (
                     <span className="px-2 py-1 rounded-full bg-slate-100 text-slate-600">
                       {activeMilestone.ownerEmail || activeMilestone.ownerUserId}
                     </span>
                   ) : (
                     <span className="px-2 py-1 rounded-full bg-amber-50 text-amber-700">Unassigned</span>
                   )}
                   <button
                     onClick={() => setOwnerPickerOpen((prev) => !prev)}
                     className="text-blue-600 hover:underline"
                   >
                     {activeMilestone?.ownerEmail || activeMilestone?.ownerUserId ? 'Change' : 'Set owner'}
                   </button>
                 </div>
               </div>
               <div className="flex flex-wrap gap-2 text-[9px] font-black uppercase tracking-widest">
                 {rollups[sprintMilestoneId]?.forecast?.estimatedCompletionDate && (
                   <span className={`px-2 py-1 rounded-full ${
                     rollups[sprintMilestoneId]?.forecast?.band === 'on-track' ? 'bg-emerald-50 text-emerald-700' :
                     rollups[sprintMilestoneId]?.forecast?.band === 'at-risk' ? 'bg-amber-50 text-amber-700' :
                     'bg-red-50 text-red-600'
                   }`}>
                     ETA {new Date(rollups[sprintMilestoneId].forecast.estimatedCompletionDate).toLocaleDateString()}
                   </span>
                 )}
                 {rollups[sprintMilestoneId]?.forecast?.monteCarlo?.p80 && (
                   <span
                     className="px-2 py-1 rounded-full bg-slate-900 text-white"
                     title={`P50 ${new Date(rollups[sprintMilestoneId].forecast.monteCarlo.p50).toLocaleDateString()} • P80 ${new Date(rollups[sprintMilestoneId].forecast.monteCarlo.p80).toLocaleDateString()} • P90 ${new Date(rollups[sprintMilestoneId].forecast.monteCarlo.p90).toLocaleDateString()} • Hit ${Math.round((rollups[sprintMilestoneId].forecast.monteCarlo.hitProbability || 0) * 100)}%`}
                   >
                     P80 {new Date(rollups[sprintMilestoneId].forecast.monteCarlo.p80).toLocaleDateString()} ({Math.round((rollups[sprintMilestoneId].forecast.monteCarlo.hitProbability || 0) * 100)}%)
                   </span>
                 )}
                 <span className="px-2 py-1 rounded-full bg-slate-100 text-slate-600">
                   Capacity {rollups[sprintMilestoneId]?.capacity?.committedPoints ?? 0}/{rollups[sprintMilestoneId]?.capacity?.targetCapacity ?? '∞'}
                 </span>
                 {burnupByMilestone[sprintMilestoneId]?.trend && (
                   <span className="px-2 py-1 rounded-full bg-slate-100 text-slate-600">
                     Burn-up {burnupByMilestone[sprintMilestoneId].trend.acceleration} • {burnupByMilestone[sprintMilestoneId].trend.last3Avg ?? '—'} pts
                   </span>
                 )}
                 {burnupByMilestone[sprintMilestoneId]?.trend?.avgCompletedPerSprint !== undefined && (
                   <span className="px-2 py-1 rounded-full bg-slate-100 text-slate-600">
                     Velocity {burnupByMilestone[sprintMilestoneId].trend.avgCompletedPerSprint} pts/sprint
                   </span>
                 )}
                <span className="px-2 py-1 rounded-full bg-slate-100 text-slate-600">
                  Scope requests {scopeRequests.filter((r) => r.status === 'PENDING').length}
                </span>
                <button
                  onClick={() => sprintMilestoneId !== 'all' && setStaleModal({ milestoneId: sprintMilestoneId })}
                  className={`px-2 py-1 rounded-full ${
                    criticalStale > 0 ? 'bg-rose-50 text-rose-700' :
                    staleTotal > 0 ? 'bg-amber-50 text-amber-700' :
                    'bg-slate-100 text-slate-400'
                  }`}
                >
                  Stale {staleTotal}
                  {criticalStale > 0 ? ` • Critical ${criticalStale}` : ''}
                </button>
                {rollups[sprintMilestoneId]?.dataQuality && (
                  <span className={`px-2 py-1 rounded-full ${
                    rollups[sprintMilestoneId].dataQuality.score < 50 ? 'bg-rose-50 text-rose-700' :
                     rollups[sprintMilestoneId].dataQuality.score < 70 ? 'bg-amber-50 text-amber-700' :
                     'bg-emerald-50 text-emerald-700'
                   }`}>
                     Data quality {rollups[sprintMilestoneId].dataQuality.score}
                   </span>
                 )}
               </div>
             </div>
             {ownerPickerOpen && (
               <div className="mt-4 p-4 bg-white border border-slate-100 rounded-2xl">
                 <div className="flex items-center justify-between">
                   <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Set Milestone Owner</div>
                   {ownerSaving && <div className="text-[9px] font-black uppercase tracking-widest text-slate-400">Saving…</div>}
                 </div>
                 {ownerSuggestions.length > 0 && (
                   <div className="mt-3 flex flex-wrap gap-2 text-[9px] font-black uppercase tracking-widest">
                     {ownerSuggestions.slice(0, 4).map((s) => (
                       <button
                         key={s.userId}
                         onClick={() => updateMilestoneOwner({ _id: s.userId, email: s.email })}
                         className="px-2 py-1 rounded-full bg-slate-100 text-slate-600"
                       >
                         {s.email || s.userId} • {s.reason}
                       </button>
                     ))}
                   </div>
                 )}
                 <div className="mt-3">
                   <div className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2">Search users</div>
                   <div className="flex items-center gap-2">
                     <input
                       value={ownerQuery}
                       onChange={(e) => setOwnerQuery(e.target.value)}
                       placeholder="Type a name..."
                       className="flex-1 px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold"
                     />
                     {ownerLoading && <span className="text-[9px] text-slate-400">Searching…</span>}
                   </div>
                   {ownerResults.length > 0 && (
                     <div className="mt-2 max-h-40 overflow-y-auto border border-slate-100 rounded-xl">
                       {ownerResults.map((user) => (
                         <button
                           key={user._id || user.id}
                           onClick={() => updateMilestoneOwner(user)}
                           className="w-full text-left px-3 py-2 text-xs hover:bg-slate-50"
                         >
                           <div className="font-bold text-slate-700">{user.name}</div>
                           <div className="text-[10px] text-slate-400">{user.email || user.role || 'User'}</div>
                         </button>
                       ))}
                     </div>
                   )}
                 </div>
               </div>
             )}
            <div className="mt-4 flex flex-wrap gap-3 text-[9px] font-black uppercase tracking-widest text-blue-600">
              <button onClick={() => openIntelList(sprintMilestoneId, 'blockers')} className="hover:underline">Open blockers</button>
              <button onClick={() => openIntelList(sprintMilestoneId, 'risks')} className="hover:underline">High risks</button>
              <button onClick={() => openIntelList(sprintMilestoneId, 'cross')} className="hover:underline">Cross-milestone deps</button>
              <button
                onClick={() => sprintMilestoneId !== 'all' && setStaleModal({ milestoneId: sprintMilestoneId })}
                className="hover:underline"
              >
                View stale items
              </button>
              {rollups[sprintMilestoneId]?.dataQuality?.issues?.length ? (
                rollups[sprintMilestoneId].dataQuality.issues
                  .filter((issue: any) => ['missingStoryPoints', 'missingDueAt', 'missingRiskSeverity'].includes(issue.key))
                   .slice(0, 3)
                   .map((issue: any) => (
                     <button
                       key={issue.key}
                       onClick={() => { setBulkFixItemIds(null); setBulkFixIssue(issue.key); }}
                       className="hover:underline text-amber-600"
                     >
                       Fix {issue.detail.toLowerCase()} ({issue.count})
                     </button>
                   ))
               ) : null}
             </div>
           </div>
           <div className="border border-slate-100 rounded-2xl p-4 bg-white">
             <div className="flex items-center justify-between gap-3">
               <div>
                 <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Critical Path</div>
                 <div className="text-xs text-slate-500">Dependency-driven chain impacting the milestone ETA.</div>
               </div>
               {criticalPath?.criticalPath?.nodes?.length ? (
                 <div className="text-[9px] font-black uppercase tracking-widest text-slate-500">
                   {criticalPath.criticalPath.remainingPoints} pts • {criticalPath.criticalPath.nodes.length} items
                 </div>
               ) : null}
             </div>
               <div className="mt-3 flex items-center gap-3 text-[9px] font-black uppercase tracking-widest text-slate-500">
               <label className="flex items-center gap-2">
                 <input
                   type="checkbox"
                   checked={!!includeExternalCritical}
                   onChange={(e) => setIncludeExternalCritical(e.target.checked)}
                 />
                 Include external blockers
               </label>
               <button
                 onClick={() => {
                   const next = !showCriticalGraph;
                   setShowCriticalGraph(next);
                   if (next) {
                     fetchGraph(sprintMilestoneId, includeExternalCritical);
                   }
                 }}
                 className="px-3 py-1 rounded-full border border-slate-200 text-slate-600 text-[9px] font-black uppercase tracking-widest"
               >
                 {showCriticalGraph ? 'Hide graph' : 'View graph'}
               </button>
               {includeExternalCritical && criticalPath?.external?.includedNodes ? (
                 <span className="px-2 py-1 rounded-full bg-slate-100 text-slate-600">
                   External {criticalPath.external.includedNodes}
                 </span>
               ) : null}
             </div>

             {criticalLoading ? (
               <div className="mt-3 text-xs text-slate-400">Loading critical path…</div>
             ) : criticalError ? (
               <div className="mt-3 text-xs text-rose-600">
                 {criticalError}
                 <button onClick={() => fetchCriticalPath(sprintMilestoneId)} className="ml-2 underline">Retry</button>
               </div>
             ) : (
               <>
               {criticalPath?.cycleDetected && (
                 <div className="mt-3 text-[10px] font-black uppercase tracking-widest text-rose-600">
                   Dependency cycle detected
                 </div>
               )}
               {showCriticalGraph && (
                 <div className="mt-4 space-y-3">
                   <div className="flex items-center gap-3">
                     <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Graph mode</span>
                     {(['critical', 'critical+near', 'full'] as const).map((mode) => (
                       <button
                         key={mode}
                         onClick={() => setGraphMode(mode)}
                         className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${
                           graphMode === mode ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'
                         }`}
                       >
                         {mode}
                       </button>
                     ))}
                   </div>
                   {graphLoading ? (
                     <div className="text-xs text-slate-400">Loading graph…</div>
                   ) : graphError ? (
                     <div className="text-xs text-rose-600">{graphError}</div>
                   ) : (
                     <DependencyGraph
                       nodes={(graphCache[`${sprintMilestoneId}:${includeExternalCritical ? '1' : '0'}`]?.nodes || [])}
                       edges={(graphCache[`${sprintMilestoneId}:${includeExternalCritical ? '1' : '0'}`]?.edges || [])}
                       mode={graphMode}
                       cycleDetected={criticalPath?.cycleDetected}
                       onNodeClick={(id) => {
                         const item = items.find((i) => String(i._id || i.id) === String(id));
                         if (item) setActiveItem(item);
                       }}
                     />
                   )}
                 </div>
               )}
                 <div className="mt-3 grid grid-cols-1 lg:grid-cols-2 gap-4">
                   <div>
                     <div className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2">Critical Chain</div>
                     {criticalPath?.criticalPath?.nodes?.length ? (
                       <div className="space-y-2">
                         {criticalPath.criticalPath.nodes.map((node) => {
                           const item = items.find((i) => String(i._id || i.id) === String(node.id));
                           const blocked = item?.isBlocked || item?.status === WorkItemStatus.BLOCKED;
                           const isExternal = node.scope === 'EXTERNAL';
                           const githubActivity = getGithubActivity(item);
                           const daysSinceUpdate = getDaysSince(item?.updatedAt || item?.createdAt || null);
                           return (
                             <button
                               key={node.id}
                               onClick={() => item && setActiveItem(item)}
                               className="w-full text-left border border-slate-100 rounded-xl p-3 hover:bg-slate-50"
                             >
                               <div className="flex items-center justify-between">
                                 <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">{node.key || node.id}</div>
                                 <div className="text-[9px] font-black text-slate-500">{node.remainingPoints} pts</div>
                               </div>
                               <div className="text-xs text-slate-600 mt-1 flex items-center gap-2">
                                 <span className="truncate">{node.title}</span>
                                 {blocked && (
                                   <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 text-[8px] font-black uppercase tracking-widest">Blocked</span>
                                 )}
                                 {typeof daysSinceUpdate === 'number' && (
                                   <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[8px] font-black uppercase tracking-widest">
                                     Updated {daysSinceUpdate}d
                                   </span>
                                 )}
                                 {isExternal && (
                                   <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 text-[8px] font-black uppercase tracking-widest">External</span>
                                 )}
                                 {githubActivity && (
                                   <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest ${
                                     githubActivity === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'
                                   }`}>
                                     {githubActivity === 'active' ? 'Active' : 'Stale'}
                                   </span>
                                 )}
                               </div>
                               {isExternal && (
                                 <div className="mt-2 flex flex-wrap gap-2 text-[9px] font-black uppercase tracking-widest">
                                   {node.bundleId && (
                                     <button
                                       onClick={(e) => { e.stopPropagation(); window.location.assign(`/program?bundleId=${encodeURIComponent(node.bundleId)}`); }}
                                       className="px-2 py-1 rounded-full bg-slate-100 text-slate-500"
                                     >
                                       Open bundle
                                     </button>
                                   )}
                                   {node.milestoneIds?.length ? (
                                     <button
                                       onClick={(e) => { e.stopPropagation(); window.location.assign(`/work-items?view=milestone-plan&milestoneId=${encodeURIComponent(node.milestoneIds[0])}`); }}
                                       className="px-2 py-1 rounded-full bg-slate-100 text-slate-500"
                                     >
                                       Open milestone
                                     </button>
                                   ) : null}
                                   {node.bundleId && (
                                     <button
                                       onClick={(e) => { e.stopPropagation(); window.location.assign(`/program?bundleId=${encodeURIComponent(node.bundleId)}`); }}
                                       className="px-2 py-1 rounded-full bg-blue-50 text-blue-700"
                                     >
                                       Open program
                                     </button>
                                   )}
                                 </div>
                               )}
                             </button>
                           );
                         })}
                       </div>
                     ) : (
                       <div className="text-xs text-slate-400">No critical path data available.</div>
                     )}
                   </div>
                  <div>
                    <div className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2">Top Actions</div>
                    {criticalActionMessage && (
                      <div className="mb-2 text-[10px] font-semibold text-emerald-600">{criticalActionMessage}</div>
                    )}
                    {criticalPath?.topActions?.length ? (
                      <div className="space-y-2">
                        {criticalPath.topActions.map((action, idx) => {
                          const item = items.find((i) => String(i._id || i.id) === String(action.itemId));
                          const estimateValue = estimateDrafts[action.itemId] ?? '';
                          const canNotify = isAdminCmoRole(currentUser?.role);
                          return (
                            <div key={`${action.type}-${action.itemId}-${idx}`} className="border border-slate-100 rounded-xl p-3">
                              <div className="flex items-center justify-between gap-2">
                                <div className="text-[9px] font-black uppercase tracking-widest text-slate-500">{action.type}</div>
                                <div className="text-[9px] font-black text-slate-400">{action.key}</div>
                              </div>
                              <div className="text-xs text-slate-600 mt-1">{action.reason}</div>
                              <div className="mt-2 flex flex-wrap gap-2">
                                {item && (
                                  <button
                                    onClick={() => setActiveItem(item)}
                                    className="px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest bg-slate-100 text-slate-600"
                                  >
                                    Open item
                                  </button>
                                )}
                                {action.type === 'UNBLOCK' && (
                                  <button
                                    onClick={() => openIntelList(sprintMilestoneId, 'blockers')}
                                    className="px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest bg-amber-50 text-amber-700"
                                  >
                                    View blockers
                                  </button>
                                )}
                                {action.type === 'SET_ESTIMATE' && (
                                  <div className="flex items-center gap-2">
                                    <input
                                      type="number"
                                      value={estimateValue}
                                      onChange={(e) => {
                                        const value = e.target.value === '' ? '' : Number(e.target.value);
                                        setEstimateDrafts((prev) => ({ ...prev, [action.itemId]: Number.isNaN(value) ? '' : value }));
                                      }}
                                      className="w-20 px-2 py-1 rounded-lg border border-slate-200 text-xs"
                                      min={0}
                                    />
                                    <button
                                      onClick={() => {
                                        const numeric = typeof estimateValue === 'number' ? estimateValue : 0;
                                        handleSetEstimateFromCritical(action.itemId, numeric);
                                      }}
                                      className="px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest bg-blue-50 text-blue-700"
                                    >
                                      Set estimate
                                    </button>
                                  </div>
                                )}
                                {action.type === 'REQUEST_ESTIMATE' && (
                                  <button
                                    onClick={() => handleRequestEstimate(action.itemId, action.reason)}
                                    className="px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest bg-indigo-50 text-indigo-700"
                                  >
                                    Request estimate
                                  </button>
                                )}
                                {action.type === 'ASSIGN' && (
                                  <div className="min-w-[220px] space-y-2">
                                    {!item?.assignedTo && ownerSuggestionCache[String(action.itemId)]?.length ? (
                                      <div className="flex flex-wrap gap-2">
                                        {ownerSuggestionCache[String(action.itemId)].slice(0, 3).map((s: any) => (
                                          <button
                                            key={s.userId}
                                            onClick={() => handleAssignFromCritical(action.itemId, s.email || s.userId)}
                                            className="px-2 py-1 rounded-full text-[9px] font-black uppercase tracking-widest bg-emerald-50 text-emerald-700"
                                          >
                                            {s.email || s.userId}
                                          </button>
                                        ))}
                                      </div>
                                    ) : null}
                                    <AssigneeSearch currentAssignee={item?.assignedTo} onSelect={(name) => handleAssignFromCritical(action.itemId, name)} />
                                  </div>
                                )}
                                {action.type === 'NOTIFY_OWNER' && (
                                  <button
                                    onClick={() => handleNotifyOwner(action.itemId, action.reason)}
                                    disabled={!canNotify}
                                    className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${
                                      canNotify ? 'bg-rose-50 text-rose-700' : 'bg-slate-100 text-slate-400'
                                    }`}
                                    title={canNotify ? 'Notify bundle owners/watchers' : 'Admin/CMO only'}
                                  >
                                    Notify owners
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                     ) : (
                       <div className="text-xs text-slate-400">No critical actions to recommend.</div>
                     )}
                   </div>
                 </div>
               </>
             )}
           </div>
           <div className="border border-slate-100 rounded-2xl p-4 bg-white">
             <ChangeFeed
               scopeType="MILESTONE"
               scopeId={sprintMilestoneId && sprintMilestoneId !== 'all' ? sprintMilestoneId : undefined}
               title="Activity"
               limit={20}
             />
           </div>
           <div className="border border-slate-100 rounded-2xl p-4 bg-slate-50/60">
             <div className="flex items-center justify-between gap-3">
               <div>
                 <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Sprint View For Milestone</div>
                 <div className="text-xs text-slate-500">Connect sprint execution to milestone readiness.</div>
               </div>
               <select
                 value={sprintMilestoneId}
                 onChange={(e) => setSprintMilestoneId(e.target.value)}
                 className="px-3 py-2 text-[11px] font-semibold rounded-xl border border-slate-200 text-slate-600"
               >
                 {milestones.map((m) => {
                   const key = String(m._id || m.id || m.name);
                   return <option key={key} value={key}>{m.name}</option>;
                 })}
               </select>
             </div>
             <div className="mt-4 flex flex-wrap gap-3">
               {sprintRollups.length ? sprintRollups.map((s) => (
                 <div key={s.sprintId} className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-600">
                   {s.name} • {s.capacity?.committedPoints ?? 0}/{s.capacity?.targetPoints ?? '∞'} pts • {s.scope?.done ?? 0}/{s.scope?.items ?? 0} done
                 </div>
               )) : (
                 <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">No sprint rollups for this milestone.</div>
               )}
             </div>
           </div>

           <div className="border border-slate-100 rounded-2xl p-4 bg-white">
             <div className="flex items-center justify-between gap-3">
               <div>
                 <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Burn-up</div>
                 <div className="text-xs text-slate-500">Completed points by sprint with trend calibration.</div>
               </div>
               {burnupByMilestone[sprintMilestoneId]?.trend && (
                 <div className="flex flex-wrap gap-2 text-[8px] font-black uppercase tracking-widest">
                   <span className="px-2 py-1 rounded-full bg-slate-100 text-slate-600">
                     Avg {burnupByMilestone[sprintMilestoneId].trend.avgCompletedPerSprint ?? '—'} pts
                   </span>
                   {burnupByMilestone[sprintMilestoneId].trend.last3Avg !== null && (
                     <span className="px-2 py-1 rounded-full bg-slate-100 text-slate-600">
                       Last 3 {burnupByMilestone[sprintMilestoneId].trend.last3Avg} pts
                     </span>
                   )}
                   <span className={`px-2 py-1 rounded-full ${
                     burnupByMilestone[sprintMilestoneId].trend.acceleration === 'improving' ? 'bg-emerald-50 text-emerald-700' :
                     burnupByMilestone[sprintMilestoneId].trend.acceleration === 'worsening' ? 'bg-amber-50 text-amber-700' :
                     'bg-slate-100 text-slate-500'
                   }`}>
                     {burnupByMilestone[sprintMilestoneId].trend.acceleration || 'unknown'}
                   </span>
                 </div>
               )}
             </div>
             <div className="mt-4 overflow-x-auto">
               <table className="w-full text-[11px] text-slate-600">
                 <thead>
                   <tr className="text-[9px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-100">
                     <th className="text-left py-2">Sprint</th>
                     <th className="text-right py-2">Completed</th>
                     <th className="text-right py-2">Cumulative</th>
                     <th className="text-right py-2">Remaining</th>
                   </tr>
                 </thead>
                 <tbody>
                   {burnupByMilestone[sprintMilestoneId]?.sprints?.length ? (
                     burnupByMilestone[sprintMilestoneId].sprints.map((s: any) => (
                       <tr key={s.sprintId} className="border-b border-slate-50">
                         <td className="py-2 font-semibold text-slate-700">{s.name}</td>
                         <td className="py-2 text-right">{s.completedPoints ?? 0}</td>
                         <td className="py-2 text-right">{s.cumulativeCompletedPoints ?? 0}</td>
                         <td className="py-2 text-right">{s.remainingPoints ?? 0}</td>
                       </tr>
                     ))
                   ) : (
                     <tr>
                       <td colSpan={4} className="py-4 text-center text-slate-400">No burn-up data available.</td>
                     </tr>
                   )}
                 </tbody>
               </table>
             </div>
           </div>

           <div className="border border-slate-100 rounded-2xl p-4 bg-white">
             <div className="flex items-center justify-between gap-3">
               <div>
                 <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Scope Requests</div>
                 <div className="text-xs text-slate-500">Changes to COMMITTED milestones require approval.</div>
               </div>
               <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{scopeRequests.length} requests</span>
             </div>
             <div className="mt-4 space-y-3">
               {scopeRequests.length ? scopeRequests.map((req) => {
                 const isRequester = String(req.requestedBy) === String(currentUser?._id || currentUser?.id || currentUser?.userId || '');
                 const canDecide = isAdminCmoRole(currentUser?.role);
                 return (
                   <div key={String(req._id)} className="border border-slate-100 rounded-xl px-3 py-3 text-[11px] text-slate-600">
                     <div className="flex flex-wrap items-center justify-between gap-2">
                       <div className="font-semibold text-slate-700">
                         {req.action === 'ADD_ITEMS' ? 'Add' : 'Remove'} {req.workItemIds?.length || 0} items
                       </div>
                       <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest ${
                         req.status === 'PENDING' ? 'bg-amber-50 text-amber-700' :
                         req.status === 'APPROVED' ? 'bg-emerald-50 text-emerald-700' :
                         req.status === 'REJECTED' ? 'bg-rose-50 text-rose-700' :
                         'bg-slate-100 text-slate-500'
                       }`}>
                         {req.status}
                       </span>
                     </div>
                     <div className="mt-1 text-[10px] text-slate-400">
                       Requested {new Date(req.requestedAt).toLocaleString()}
                       {req.allowOverCapacity ? ' • Over-capacity allowed' : ''}
                     </div>
                     {req.status === 'PENDING' && (
                       <div className="mt-3 flex flex-wrap items-center gap-2">
                         {canDecide && (
                           <>
                             <button
                               onClick={() => { setScopeDecisionPrompt({ request: req, decision: 'APPROVE' }); setDecisionReason(''); }}
                               className="px-3 py-1.5 text-[9px] font-black uppercase tracking-widest rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
                             >
                               Approve
                             </button>
                             <button
                               onClick={() => { setScopeDecisionPrompt({ request: req, decision: 'REJECT' }); setDecisionReason(''); }}
                               className="px-3 py-1.5 text-[9px] font-black uppercase tracking-widest rounded-lg bg-rose-600 text-white hover:bg-rose-700"
                             >
                               Reject
                             </button>
                           </>
                         )}
                         {isRequester && (
                           <button
                             onClick={() => { setScopeDecisionPrompt({ request: req, decision: 'CANCEL' }); setDecisionReason(''); }}
                             className="px-3 py-1.5 text-[9px] font-black uppercase tracking-widest rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50"
                           >
                             Cancel
                           </button>
                 )}
               </div>
             )}
            {commitDriftLoading && (
              <div className="mt-4 p-4 bg-white border border-slate-100 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-400">
                Drift signal loading…
              </div>
            )}
            {!commitDriftLoading && commitDrift && (
              <div className="mt-4 p-4 bg-white border border-slate-100 rounded-2xl">
                <div className="flex items-center justify-between">
                  <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Commitment Drift</div>
                  <span className={`px-2 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${
                    driftBand === 'MAJOR' ? 'bg-rose-50 text-rose-700' :
                    driftBand === 'MINOR' ? 'bg-amber-50 text-amber-700' :
                    'bg-emerald-50 text-emerald-700'
                  }`}>
                    {driftBand}
                  </span>
                </div>
                <div className="mt-1 text-[11px] text-slate-500">
                  Baseline {commitDrift.baselineAt ? new Date(commitDrift.baselineAt).toLocaleDateString() : '—'}
                </div>
                <div className="mt-3 space-y-2">
                  {commitDrift.deltas?.length ? (
                    commitDrift.deltas.map((delta: any) => (
                      <div key={delta.key} className="flex items-start justify-between gap-3 text-[11px]">
                        <div>
                          <div className="font-semibold text-slate-600">{delta.detail}</div>
                          <div className="text-[10px] uppercase tracking-widest text-slate-400">{delta.key}</div>
                        </div>
                        <span className={`px-2 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${
                          delta.severity === 'critical' ? 'bg-rose-50 text-rose-700' :
                          delta.severity === 'warn' ? 'bg-amber-50 text-amber-700' :
                          'bg-slate-100 text-slate-500'
                        }`}>
                          {delta.status}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="text-[11px] text-slate-400">No material drift detected.</div>
                  )}
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => sprintMilestoneId !== 'all' && openCommitReview(sprintMilestoneId)}
                    className="px-3 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg bg-slate-900 text-white hover:bg-blue-600"
                  >
                    Run re-review
                  </button>
                  {commitDrift.recommendedActions?.map((action: any, idx: number) => (
                    <span
                      key={`${action.type}-${idx}`}
                      className="px-2 py-1 rounded-full bg-slate-100 text-[9px] font-black uppercase tracking-widest text-slate-500"
                      title={action.reason}
                    >
                      {action.type}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {baselineDeltaLoading && (
              <div className="mt-4 p-4 bg-white border border-slate-100 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-400">
                Baseline delta loading…
              </div>
            )}
            {!baselineDeltaLoading && baselineDelta && (
              <div className="mt-4 p-4 bg-white border border-slate-100 rounded-2xl">
                <div className="flex items-center justify-between">
                  <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Baseline &amp; Scope Delta</div>
                  <span className="px-2 py-1 rounded-full text-[9px] font-black uppercase tracking-widest bg-slate-100 text-slate-500">
                    {baselineDelta.netScopeDeltaPoints > 0 ? '+' : ''}{baselineDelta.netScopeDeltaPoints} pts
                  </span>
                </div>
                <div className="mt-1 text-[11px] text-slate-500">
                  Baseline {baselineDelta.baselineAt ? new Date(baselineDelta.baselineAt).toLocaleDateString() : '—'}
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-slate-600">
                  <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                    <span>Added</span>
                    <span className="font-semibold">{baselineDelta.added.count} / {baselineDelta.added.points} pts</span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                    <span>Removed</span>
                    <span className="font-semibold">{baselineDelta.removed.count} / {baselineDelta.removed.points} pts</span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                    <span>Estimate delta</span>
                    <span className="font-semibold">{baselineDelta.estimateChanges.count} / {baselineDelta.estimateChanges.pointsDelta} pts</span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                    <span>Open points</span>
                    <span className="font-semibold">{baselineDelta.currentTotals.pointsOpen}</span>
                  </div>
                </div>
                <div className="mt-3 space-y-2">
                  {(baselineDelta.topChanges || []).length ? (
                    baselineDelta.topChanges.map((change: any, idx: number) => (
                      <div key={`${change.type}-${idx}`} className="flex items-center justify-between text-[11px] text-slate-600">
                        <div className="truncate">
                          <span className="font-semibold">{change.type.replace('_', ' ')}</span> {change.key || 'Item'}
                        </div>
                        <span className="text-[10px] uppercase tracking-widest text-slate-400">
                          {change.before !== undefined ? change.before : '—'} → {change.after !== undefined ? change.after : '—'}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="text-[11px] text-slate-400">No scope changes since baseline.</div>
                  )}
                </div>
              </div>
            )}
            <div className="mt-4 p-4 bg-white border border-slate-100 rounded-2xl">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Weekly Brief</div>
                  <div className="text-xs text-slate-500">Milestone-level narrative for leadership.</div>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={briefWeek}
                    onChange={(e) => setBriefWeek(e.target.value)}
                    className="px-3 py-2 text-xs rounded-lg border border-slate-200 bg-white"
                  >
                    {briefWeekOptions.map((wk) => (
                      <option key={wk} value={wk}>{wk}</option>
                    ))}
                  </select>
                  {isAdminCmoRole(currentUser?.role) && (
                    <button
                      onClick={async () => {
                        if (!sprintMilestoneId || sprintMilestoneId === 'all' || !briefWeek) return;
                        setBriefLoading(true);
                        try {
                          const res = await fetch(`/api/briefs/weekly?scopeType=MILESTONE&scopeId=${encodeURIComponent(sprintMilestoneId)}&weekKey=${encodeURIComponent(briefWeek)}&force=true`);
                          const data = await res.json();
                          setBrief(data?.brief || null);
                        } catch {}
                        setBriefLoading(false);
                      }}
                      className="px-3 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg bg-slate-900 text-white hover:bg-blue-600"
                    >
                      Regenerate
                    </button>
                  )}
                </div>
              </div>
              {briefLoading && <div className="text-sm text-slate-400">Generating brief…</div>}
              {briefError && <div className="text-sm text-rose-500">{briefError}</div>}
              {!briefLoading && brief && (
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <span className={`px-2 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${
                      brief.summary?.band === 'RED' ? 'bg-rose-50 text-rose-700' :
                      brief.summary?.band === 'YELLOW' ? 'bg-amber-50 text-amber-700' :
                      'bg-emerald-50 text-emerald-700'
                    }`}>
                      {brief.summary?.band || 'GREEN'}
                    </span>
                    <div className="text-sm font-semibold text-slate-700">{brief.summary?.headline}</div>
                  </div>
                  <ul className="list-disc pl-5 text-sm text-slate-600">
                    {(brief.summary?.bullets || []).map((b: string, idx: number) => (
                      <li key={`${b}-${idx}`}>{b}</li>
                    ))}
                  </ul>
                </div>
              )}
              {!briefLoading && !brief && !briefError && (
                <div className="text-sm text-slate-400">No brief available.</div>
              )}
            </div>
            </div>
                 );
               }) : (
                 <div className="text-[11px] text-slate-400">No scope change requests for this milestone.</div>
               )}
             </div>
           </div>

           <div className="flex-1 overflow-x-auto flex gap-10 custom-scrollbar">
             {milestones.map(m => {
               const milestoneKey = String(m._id || m.id || m.name);
               const milestoneItems = items.filter(i => {
                 const ids = i.milestoneIds || [];
                 const legacy = (i as any).milestoneId;
                 return ids.includes(m._id as any) || ids.includes(milestoneKey) || legacy === milestoneKey;
               });
               return (
                 <MilestoneColumn
                   key={m._id}
                   milestone={m}
                   items={milestoneItems}
                   rollup={rollups[milestoneKey]}
                   burnup={burnupByMilestone[milestoneKey]}
                   canCommit={isPrivilegedRole(currentUser?.role)}
                   onCommit={handleCommitMilestone}
                   onStatusChange={handleMilestoneStatus}
                   onCardClick={setActiveItem}
                   isWatching={Boolean(milestoneWatchers[milestoneKey])}
                   onToggleWatch={toggleMilestoneWatch}
                 />
               );
             })}
             <div className="w-80 shrink-0 border-2 border-dashed border-slate-100 rounded-[2.5rem] flex flex-col items-center justify-center opacity-40 hover:opacity-100 transition-all cursor-pointer"><i className="fas fa-plus mb-2"></i><span className="text-[10px] font-black uppercase tracking-widest">New Cycle</span></div>
           </div>
        </main>

        <DragOverlay>
           {draggedItem && <div className="bg-white border-2 border-blue-500 p-4 rounded-2xl shadow-2xl w-80 opacity-90 rotate-2"><h5 className="text-xs font-bold text-slate-700">{draggedItem.title}</h5></div>}
        </DragOverlay>

        {activeItem && <div className="absolute inset-y-0 right-0 w-[650px] bg-white shadow-2xl border-l border-slate-200 z-50 animate-slideIn"><WorkItemDetails item={activeItem} bundles={bundles} applications={applications} onUpdate={fetchData} onClose={() => setActiveItem(null)} /></div>}

        {overrideRequest && (
          <div className="absolute inset-0 bg-slate-900/30 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl shadow-2xl w-[420px] p-6 space-y-4">
              <h4 className="text-sm font-black uppercase tracking-widest text-slate-600">Over Capacity</h4>
              <div className="text-sm text-slate-600 leading-relaxed">
                Assigning this item exceeds the committed capacity. Current: {overrideRequest.details?.currentCommittedPoints ?? '—'} / {overrideRequest.details?.targetCapacity ?? '—'} pts. Incoming: {overrideRequest.details?.incomingItemPoints ?? '—'} pts.
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={() => setOverrideRequest(null)} className="px-4 py-2 rounded-xl text-[10px] font-black uppercase border border-slate-200 text-slate-500">Cancel</button>
                {isPrivilegedRole(currentUser?.role) && (
                  <button onClick={handleOverrideAssign} className="px-4 py-2 rounded-xl text-[10px] font-black uppercase bg-red-600 text-white">Override & Assign</button>
                )}
              </div>
            </div>
          </div>
        )}

        {readinessPrompt && (
          <div className="absolute inset-0 bg-slate-900/30 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl shadow-2xl w-[480px] p-6 space-y-4">
              <h4 className="text-sm font-black uppercase tracking-widest text-slate-600">Readiness Gates</h4>
              <div className="space-y-2 text-sm text-slate-600">
                {(readinessPrompt.readiness?.blockers || []).map((b: any, idx: number) => (
                  <div key={idx} className="flex items-start gap-2">
                    <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${
                      b.severity === 'block' ? 'bg-red-100 text-red-600' : b.severity === 'warn' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'
                    }`}>{b.severity}</span>
                    <span>{b.detail}</span>
                  </div>
                ))}
              </div>
              {isPrivilegedRole(currentUser?.role) && (
                <div className="space-y-2">
                  <label className="text-[8px] font-black uppercase tracking-widest text-slate-400">Override reason</label>
                  <textarea
                    value={overrideReason}
                    onChange={(e) => setOverrideReason(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl p-2 text-xs"
                    rows={3}
                  />
                </div>
              )}
              <div className="flex justify-end gap-2">
                <button onClick={() => { setReadinessPrompt(null); setOverrideReason(''); }} className="px-4 py-2 rounded-xl text-[10px] font-black uppercase border border-slate-200 text-slate-500">Cancel</button>
                {isPrivilegedRole(currentUser?.role) && (
                  <button
                    onClick={handleReadinessOverride}
                    disabled={!overrideReason.trim()}
                    className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase ${
                      overrideReason.trim() ? 'bg-red-600 text-white' : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    }`}
                  >
                    Override
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {scopeRequestPrompt && (
          <div className="absolute inset-0 bg-slate-900/30 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl shadow-2xl w-[420px] p-6 space-y-4">
              <h4 className="text-sm font-black uppercase tracking-widest text-slate-600">Scope Change Request</h4>
              <div className="text-sm text-slate-600 leading-relaxed">
                This milestone is COMMITTED. Submit a scope change request for approval?
              </div>
              <div className="text-[11px] text-slate-500">
                Action: <span className="font-semibold text-slate-700">{scopeRequestPrompt.action === 'ADD_ITEMS' ? 'Add items' : 'Remove items'}</span><br />
                Items: {scopeRequestPrompt.workItemIds.length}
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={() => setScopeRequestPrompt(null)} className="px-4 py-2 rounded-xl text-[10px] font-black uppercase border border-slate-200 text-slate-500">Cancel</button>
                <button onClick={submitScopeRequest} className="px-4 py-2 rounded-xl text-[10px] font-black uppercase bg-blue-600 text-white">Submit</button>
              </div>
            </div>
          </div>
        )}

        {scopeDecisionPrompt && (
          <div className="absolute inset-0 bg-slate-900/30 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl shadow-2xl w-[420px] p-6 space-y-4">
              <h4 className="text-sm font-black uppercase tracking-widest text-slate-600">
                {scopeDecisionPrompt.decision === 'APPROVE' ? 'Approve Request' : scopeDecisionPrompt.decision === 'REJECT' ? 'Reject Request' : 'Cancel Request'}
              </h4>
              <div className="text-sm text-slate-600 leading-relaxed">
                {scopeDecisionPrompt.decision === 'APPROVE'
                  ? 'Approving will apply the scope change to the committed milestone.'
                  : scopeDecisionPrompt.decision === 'REJECT'
                  ? 'Rejecting will close this request.'
                  : 'Cancel this pending request.'}
              </div>
              <div className="space-y-2">
                <label className="text-[8px] font-black uppercase tracking-widest text-slate-400">Reason (optional)</label>
                <textarea
                  value={decisionReason}
                  onChange={(e) => setDecisionReason(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl p-2 text-xs"
                  rows={3}
                />
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={() => { setScopeDecisionPrompt(null); setDecisionReason(''); }} className="px-4 py-2 rounded-xl text-[10px] font-black uppercase border border-slate-200 text-slate-500">Cancel</button>
                <button
                  onClick={decideScopeRequest}
                  className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase ${
                    scopeDecisionPrompt.decision === 'APPROVE' ? 'bg-emerald-600 text-white' :
                    scopeDecisionPrompt.decision === 'REJECT' ? 'bg-rose-600 text-white' :
                    'bg-slate-900 text-white'
                  }`}
                >
                  Confirm
                </button>
              </div>
            </div>
          </div>
        )}

        {intelModal && (
          <div className="absolute inset-0 bg-slate-900/30 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl shadow-2xl w-[520px] p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-black uppercase tracking-widest text-slate-600">{intelModal.title}</h4>
                <button onClick={() => setIntelModal(null)} className="text-slate-400 hover:text-slate-600"><i className="fas fa-times"></i></button>
              </div>
              <div className="max-h-[320px] overflow-y-auto custom-scrollbar space-y-2 text-sm">
                {(intelModal.items || []).length === 0 && (
                  <div className="text-slate-400 text-xs font-bold uppercase tracking-widest">No items</div>
                )}
                {(intelModal.items || []).map((item: any, idx: number) => (
                  <div key={idx} className="p-3 rounded-xl border border-slate-100 hover:bg-slate-50 cursor-pointer" onClick={() => {
                    if (item.id) {
                      const found = items.find(i => String(i._id || i.id) === String(item.id));
                      if (found) setActiveItem(found);
                      setIntelModal(null);
                    }
                  }}>
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-black text-slate-700">{item.key || item.blockerKey || item.blockedKey || 'Item'}</div>
                      <div className="text-[9px] font-bold text-slate-400 uppercase">{item.status || item.severity || ''}</div>
                    </div>
                    <div className="text-sm text-slate-600">{item.title || item.detail || item.blockerId || item.blockedId}</div>
                    {item.id && item.status && String(item.status).toUpperCase() !== 'DONE' && (
                      <div className="mt-2 flex justify-end">
                        <button
                          onClick={async (e) => {
                            e.stopPropagation();
                            const res = await fetch(`/api/work-items/${item.id}/status`, {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ toStatus: 'DONE', newRank: 0 })
                            });
                            if (!res.ok) {
                              const err = await res.json().catch(() => ({}));
                              alert(err.error || 'Unable to mark done.');
                              return;
                            }
                            await fetchData();
                            await refreshBurnup(sprintMilestoneId);
                            await refreshSprintRollups(sprintMilestoneId);
                            setIntelModal(null);
                          }}
                          className="px-3 py-1 text-[9px] font-black uppercase tracking-widest rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100"
                        >
                          Mark DONE
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {commitReviewModal && (
          <div className="absolute inset-0 bg-slate-900/30 flex items-center justify-center z-50">
            <div className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[9px] font-black uppercase tracking-widest text-slate-400">Commitment Review</div>
                  <h4 className="text-sm font-black uppercase tracking-widest text-slate-600">Commit Gate</h4>
                </div>
                <button onClick={() => { setCommitReviewModal(null); setCommitOverrideReason(''); }} className="text-slate-400 hover:text-slate-600"><i className="fas fa-times"></i></button>
              </div>

              <div className="flex items-center gap-3">
                <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                  commitReviewModal.review?.band === 'GREEN' ? 'bg-emerald-50 text-emerald-700' :
                  commitReviewModal.review?.band === 'YELLOW' ? 'bg-amber-50 text-amber-700' :
                  'bg-rose-50 text-rose-700'
                }`}>
                  {commitReviewModal.review?.band || 'RED'}
                </span>
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Score {commitReviewModal.review?.score ?? 0}</span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-[10px] font-semibold text-slate-600">
                <span className="px-3 py-2 rounded-xl bg-slate-50">P80 {commitReviewModal.review?.snapshot?.monteCarlo?.p80 ? new Date(commitReviewModal.review.snapshot.monteCarlo.p80).toLocaleDateString() : '—'}</span>
                <span className="px-3 py-2 rounded-xl bg-slate-50">Hit {commitReviewModal.review?.snapshot?.monteCarlo?.hitProbability !== undefined ? `${Math.round(commitReviewModal.review.snapshot.monteCarlo.hitProbability * 100)}%` : '—'}</span>
                <span className="px-3 py-2 rounded-xl bg-slate-50">Data quality {commitReviewModal.review?.snapshot?.rollup?.dataQuality?.score ?? '—'}</span>
                <span className="px-3 py-2 rounded-xl bg-slate-50">Capacity over {commitReviewModal.review?.snapshot?.capacitySignal?.overcommitMax ?? '—'} pts</span>
                <span className="px-3 py-2 rounded-xl bg-slate-50">External blockers {commitReviewModal.review?.snapshot?.criticalPath?.externalCount ?? 0}</span>
                <span className="px-3 py-2 rounded-xl bg-slate-50">Critical stale {commitReviewModal.review?.snapshot?.staleness?.criticalStaleCount ?? 0}</span>
              </div>

              <div className="space-y-2 max-h-[260px] overflow-y-auto custom-scrollbar pr-2">
                {(commitReviewModal.review?.checks || []).map((check: any) => (
                  <div key={check.key} className="flex items-center justify-between border border-slate-100 rounded-xl px-4 py-3">
                    <div>
                      <div className="text-xs font-semibold text-slate-700">{check.key}</div>
                      <div className="text-[11px] text-slate-400">{check.detail}</div>
                    </div>
                    <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-full ${
                      check.status === 'PASS' ? 'bg-emerald-50 text-emerald-700' :
                      check.status === 'WARN' ? 'bg-amber-50 text-amber-700' :
                      'bg-rose-50 text-rose-700'
                    }`}>
                      {check.status}
                    </span>
                  </div>
                ))}
              </div>

              {!commitReviewModal.review?.canCommit && isAdminCmoRole(currentUser?.role) && (
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Override Reason</label>
                  <input
                    value={commitOverrideReason}
                    onChange={(e) => setCommitOverrideReason(e.target.value)}
                    className="px-3 py-2 text-sm border border-slate-200 rounded-xl"
                    placeholder="Why are we overriding this commit gate?"
                  />
                </div>
              )}

              <div className="flex items-center justify-end gap-3">
                <button
                  onClick={() => { setCommitReviewModal(null); setCommitOverrideReason(''); }}
                  className="px-4 py-2 text-[10px] font-black uppercase rounded-xl border border-slate-200 text-slate-500"
                >
                  Cancel
                </button>
                {commitReviewModal.review?.canCommit && (
                  <button
                    onClick={() => submitCommitReview('COMMIT')}
                    className="px-4 py-2 text-[10px] font-black uppercase rounded-xl bg-blue-600 text-white"
                  >
                    Commit
                  </button>
                )}
                {!commitReviewModal.review?.canCommit && isAdminCmoRole(currentUser?.role) && (
                  <button
                    onClick={() => submitCommitReview('OVERRIDE')}
                    className="px-4 py-2 text-[10px] font-black uppercase rounded-xl bg-slate-900 text-white"
                  >
                    Override
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
        {staleModal && (
          <WorkItemsStaleModal
            milestoneId={staleModal.milestoneId}
            sprintId={staleModal.sprintId}
            kind="all"
            title="Stale Work Items"
            onClose={() => setStaleModal(null)}
          />
        )}
        {bulkFixIssue && (
          <WorkItemBulkFixModal
            milestoneId={sprintMilestoneId}
            issue={bulkFixIssue}
            itemIds={bulkFixItemIds || undefined}
            onClose={() => { setBulkFixIssue(null); setBulkFixItemIds(null); }}
            onUpdated={async () => {
              await fetchData();
              await refreshBurnup(sprintMilestoneId);
              await refreshSprintRollups(sprintMilestoneId);
            }}
          />
        )}
      </div>
    </DndContext>
  );
};

export default WorkItemsMilestonePlanningView;
