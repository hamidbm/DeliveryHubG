
import React, { useState, useEffect, useMemo } from 'react';
import { WorkItem, Application, Bundle, Milestone, WorkItemStatus, WorkItemType } from '../types';
import WorkItemDetails from './WorkItemDetails';

interface WorkItemsRoadmapViewProps {
  applications: Application[];
  bundles: Bundle[];
  selBundleId: string;
  selAppId: string;
  selEpicId: string;
  searchQuery: string;
  quickFilter?: string;
}

const WorkItemsRoadmapView: React.FC<WorkItemsRoadmapViewProps> = ({ 
  applications, bundles, selBundleId, selAppId, selEpicId, searchQuery, quickFilter 
}) => {
  const [items, setItems] = useState<WorkItem[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeItem, setActiveItem] = useState<WorkItem | null>(null);
  const [expandedEpics, setExpandedEpics] = useState<Set<string>>(new Set());
  
  // Adaptive Logic: Simulation Mode
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulatedDelay, setSimulatedDelay] = useState<Record<string, number>>({});

  const fetchData = async () => {
    const params = new URLSearchParams({ 
      bundleId: selBundleId, 
      applicationId: selAppId, 
      q: searchQuery 
    });
    if (selEpicId !== 'all') params.set('epicId', selEpicId);
    if (quickFilter) params.set('quickFilter', quickFilter);

    const [wRes, mRes] = await Promise.all([
      fetch(`/api/work-items?${params.toString()}`),
      fetch(`/api/milestones?${params.toString()}`)
    ]);
    setItems(await wRes.json());
    setMilestones(await mRes.json());
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [selBundleId, selAppId, selEpicId, searchQuery, quickFilter]);

  const timelineMonths = useMemo(() => {
    const today = new Date();
    const months = [];
    for (let i = -2; i < 8; i++) {
      const d = new Date(today.getFullYear(), today.getMonth() + i, 1);
      months.push({
        label: d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
        date: d
      });
    }
    return months;
  }, []);

  const startTimeline = timelineMonths[0].date.getTime();
  const lastMonth = timelineMonths[timelineMonths.length - 1].date;
  const endTimeline = new Date(lastMonth.getFullYear(), lastMonth.getMonth() + 1, 0).getTime();
  const timelineDuration = endTimeline - startTimeline;

  const getPosition = (dateStr: string, delayDays = 0) => {
    const time = new Date(dateStr).getTime() + (delayDays * 24 * 60 * 60 * 1000);
    return Math.max(0, Math.min(100, ((time - startTimeline) / timelineDuration) * 100));
  };

  const epics = useMemo(() => items.filter(i => i.type === WorkItemType.EPIC), [items]);
  const features = useMemo(() => items.filter(i => i.type === WorkItemType.FEATURE), [items]);

  // Risk Propagation Logic: Check if self or any child is blocked or flagged
  const getItemRisk = (item: WorkItem) => {
    const itemId = item._id || item.id;
    const selfFlagged = item.isFlagged || item.status === WorkItemStatus.BLOCKED || item.links?.some(l => l.type === 'IS_BLOCKED_BY');
    
    // Collision Detection Logic in Simulation
    if (isSimulating && simulatedDelay[itemId!]) {
      const start = item.createdAt || new Date().toISOString();
      const end = new Date(new Date(start).getTime() + (60 * 24 * 60 * 60 * 1000) + (simulatedDelay[itemId!] * 24 * 60 * 60 * 1000));
      const collidedMilestone = milestones.find(m => new Date(m.endDate) < end);
      if (collidedMilestone) return 'CRITICAL';
    }

    if (selfFlagged) return 'CRITICAL';

    const childIds = items.filter(i => i.parentId === itemId).map(i => i._id || i.id);
    const hasProblemChild = items.some(i => 
      (i.parentId === itemId || childIds.includes(i.parentId)) && 
      (i.isFlagged || i.status === WorkItemStatus.BLOCKED || i.links?.some(l => l.type === 'IS_BLOCKED_BY'))
    );

    return hasProblemChild ? 'WARNING' : 'HEALTHY';
  };

  const toggleEpic = (id: string) => {
    const next = new Set(expandedEpics);
    next.has(id) ? next.delete(id) : next.add(id);
    setExpandedEpics(next);
  };

  const updateSimulationDelay = (id: string, delay: number) => {
    setSimulatedDelay(prev => {
      const next = { ...prev, [id]: delay };
      // Propagate delay to downstream nodes
      const currentItem = items.find(i => (i._id || i.id) === id);
      if (currentItem && currentItem.links) {
        currentItem.links.filter(l => l.type === 'BLOCKS').forEach(l => {
          next[l.targetId] = delay; // Simplistic propagation
        });
      }
      return next;
    });
  };

  const renderTimelineBar = (item: WorkItem, isFeature = false) => {
    const itemId = item._id || item.id;
    const delay = simulatedDelay[itemId!] || 0;
    const start = item.createdAt || new Date().toISOString();
    const durationDays = isFeature ? 20 : 60;
    
    const left = getPosition(start, delay);
    const right = getPosition(start, delay + durationDays);
    const width = Math.max(right - left, 2);

    if (left >= 100 || right <= 0) return null;

    const risk = getItemRisk(item);

    return (
      <div 
        onClick={() => setActiveItem(item)}
        className={`h-6 rounded-full shadow-lg relative transition-all hover:h-8 flex items-center px-4 cursor-pointer group/bar ${
          risk === 'CRITICAL' ? 'bg-red-500 shadow-red-500/30' :
          item.status === WorkItemStatus.DONE ? 'bg-emerald-500 shadow-emerald-500/20' : 
          item.status === WorkItemStatus.IN_PROGRESS ? 'bg-blue-600 shadow-blue-500/20' : 
          'bg-slate-200'
        } ${isFeature ? 'opacity-80 scale-y-75' : ''} ${delay > 0 ? 'ring-2 ring-amber-400 ring-offset-2' : ''}`}
        style={{ left: `${left}%`, width: `${width}%` }}
      >
        <span className="text-[9px] font-black text-white uppercase tracking-tighter truncate">
          {item.status} {item.storyPoints ? `• ${item.storyPoints} pts` : ''} {delay > 0 ? `(+${delay}d)` : ''}
        </span>
        {(risk === 'WARNING' || risk === 'CRITICAL') && (
           <div className={`absolute -top-1 -right-1 w-4 h-4 rounded-full border-2 border-white flex items-center justify-center text-[8px] text-white animate-bounce shadow-lg ${risk === 'CRITICAL' ? 'bg-red-600' : 'bg-amber-500'}`}>
             <i className="fas fa-exclamation"></i>
           </div>
        )}
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 bg-slate-900 text-white text-[10px] px-3 py-1 rounded-lg opacity-0 group-hover/bar:opacity-100 transition-opacity whitespace-nowrap z-50 pointer-events-none">
          {item.title} ({item.key}) {risk !== 'HEALTHY' ? `[RISK: ${risk}]` : ''}
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white rounded-[3rem] border border-slate-200 shadow-2xl p-10 space-y-10 animate-fadeIn min-h-[800px] overflow-x-hidden relative flex flex-col">
      <header className="flex justify-between items-center border-b border-slate-50 pb-8 shrink-0">
        <div className="flex items-center gap-6">
          <div className={`w-14 h-14 rounded-[1.5rem] flex items-center justify-center text-2xl transition-all ${isSimulating ? 'bg-amber-500 text-white shadow-[0_0_20px_rgba(245,158,11,0.4)] animate-pulse' : 'bg-slate-100 text-slate-400'}`}>
            <i className={`fas ${isSimulating ? 'fa-vial-circle-check' : 'fa-route'}`}></i>
          </div>
          <div>
            <h3 className="text-3xl font-black text-slate-800 tracking-tighter uppercase italic">Adaptive Roadmap</h3>
            <p className="text-slate-400 font-medium text-lg">Real-time downstream impact re-simulation and risk propagation.</p>
          </div>
        </div>
        <div className="flex items-center gap-6">
           <div className={`flex items-center gap-3 px-6 py-3 rounded-2xl border transition-all ${isSimulating ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-100'}`}>
              <span className={`text-[10px] font-black uppercase tracking-widest ${isSimulating ? 'text-amber-600' : 'text-slate-400'}`}>Simulation Engine</span>
              <button onClick={() => { setIsSimulating(!isSimulating); setSimulatedDelay({}); }} className={`w-12 h-6 rounded-full relative transition-all ${isSimulating ? 'bg-amber-500' : 'bg-slate-300'}`}>
                 <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${isSimulating ? 'left-7' : 'left-1'}`}></div>
              </button>
           </div>
           <div className="flex bg-slate-100 p-1 rounded-xl">
              <button className="px-6 py-2 bg-white text-blue-600 text-[9px] font-black uppercase rounded-lg shadow-sm">Monthly</button>
              <button className="px-6 py-2 text-slate-400 text-[9px] font-black uppercase rounded-lg">Quarterly</button>
           </div>
        </div>
      </header>

      <div className="flex-1 overflow-auto custom-scrollbar">
        <div className="relative min-w-[1200px] pb-20">
          <div className="flex pl-80 mb-6 sticky top-0 bg-white z-40">
            {timelineMonths.map((m, idx) => (
              <div key={idx} className="flex-1 text-center py-4 border-l border-slate-50 first:border-l-0">
                <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">{m.label}</span>
              </div>
            ))}
          </div>

          <div className="relative">
            <div className="divide-y divide-slate-50 border-t border-slate-100">
                {epics.map(epic => {
                  const app = applications.find(a => a._id === epic.applicationId);
                  const epicFeatures = features.filter(f => f.parentId === (epic._id || epic.id));
                  const isExpanded = expandedEpics.has(epic._id!);
                  const risk = getItemRisk(epic);

                  return (
                    <React.Fragment key={epic._id}>
                      <div className="flex items-center group py-6 hover:bg-slate-50/40 transition-colors">
                        <div className="w-80 pr-8 shrink-0 flex items-start gap-4">
                          <button onClick={() => toggleEpic(epic._id!)} className={`w-6 h-6 rounded-lg flex items-center justify-center transition-all ${epicFeatures.length > 0 ? 'bg-slate-100 text-slate-400 hover:bg-slate-900 hover:text-white' : 'opacity-0 pointer-events-none'}`}>
                            <i className={`fas ${isExpanded ? 'fa-chevron-down' : 'fa-chevron-right'} text-[8px]`}></i>
                          </button>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                               <span className="text-[9px] font-black text-slate-300 bg-slate-50 px-2 py-0.5 rounded uppercase">{app?.name || 'Shared'}</span>
                               {risk === 'CRITICAL' && <i className="fas fa-hand text-red-500 text-[10px] animate-pulse"></i>}
                            </div>
                            <h4 onClick={() => setActiveItem(epic)} className="text-sm font-black text-slate-800 truncate leading-tight group-hover:text-blue-600 transition-colors cursor-pointer">{epic.title}</h4>
                            {isSimulating && (
                              <input type="range" min="0" max="30" value={simulatedDelay[epic._id!] || 0} onChange={(e) => updateSimulationDelay(epic._id!, parseInt(e.target.value))} className="w-full mt-2 accent-amber-500" />
                            )}
                          </div>
                        </div>
                        <div className="flex-1 h-12 relative flex items-center">
                          {renderTimelineBar(epic)}
                        </div>
                      </div>
                    </React.Fragment>
                  );
                })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WorkItemsRoadmapView;
