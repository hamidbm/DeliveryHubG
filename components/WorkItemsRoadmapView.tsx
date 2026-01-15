
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

  const getPosition = (dateStr: string) => {
    const time = new Date(dateStr).getTime();
    return Math.max(0, Math.min(100, ((time - startTimeline) / timelineDuration) * 100));
  };

  const epics = useMemo(() => items.filter(i => i.type === WorkItemType.EPIC), [items]);
  const features = useMemo(() => items.filter(i => i.type === WorkItemType.FEATURE), [items]);
  const stories = useMemo(() => items.filter(i => [WorkItemType.STORY, WorkItemType.BUG, WorkItemType.TASK].includes(i.type)), [items]);

  // Risk Propagation Logic: Check if self or any child is blocked or flagged
  const getItemRisk = (item: WorkItem) => {
    const selfFlagged = item.isFlagged || item.status === WorkItemStatus.BLOCKED || item.links?.some(l => l.type === 'IS_BLOCKED_BY');
    if (selfFlagged) return 'CRITICAL';

    // Check children recursively
    const childIds = items.filter(i => i.parentId === (item._id || item.id)).map(i => i._id || i.id);
    const hasProblemChild = items.some(i => 
      (i.parentId === (item._id || item.id) || childIds.includes(i.parentId)) && 
      (i.isFlagged || i.status === WorkItemStatus.BLOCKED || i.links?.some(l => l.type === 'IS_BLOCKED_BY'))
    );

    return hasProblemChild ? 'WARNING' : 'HEALTHY';
  };

  const toggleEpic = (id: string) => {
    const next = new Set(expandedEpics);
    next.has(id) ? next.delete(id) : next.add(id);
    setExpandedEpics(next);
  };

  const renderTimelineBar = (item: WorkItem, isFeature = false) => {
    const start = item.createdAt || new Date().toISOString();
    const durationDays = isFeature ? 20 : 60;
    const end = new Date(new Date(start).getTime() + (durationDays * 24 * 60 * 60 * 1000)).toISOString();
    
    const left = getPosition(start);
    const right = getPosition(end);
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
        } ${isFeature ? 'opacity-80 scale-y-75' : ''}`}
        style={{ left: `${left}%`, width: `${width}%` }}
      >
        <span className="text-[9px] font-black text-white uppercase tracking-tighter truncate">
          {item.status} {item.storyPoints ? `• ${item.storyPoints} pts` : ''}
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
        <div>
          <h3 className="text-3xl font-black text-slate-800 tracking-tighter uppercase italic">Strategic Delivery Roadmap</h3>
          <p className="text-slate-400 font-medium text-lg">Hierarchical multi-cycle release visualization with risk propagation.</p>
        </div>
        <div className="flex items-center gap-4">
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

          <div className="h-24 relative pl-80 mb-10">
              {milestones.map(m => {
                const left = getPosition(m.startDate);
                const right = getPosition(m.endDate);
                const width = Math.max(right - left, 2);
                if (left >= 100 || right <= 0) return null;
                
                return (
                  <div key={m._id} className="absolute h-16 top-0 bg-indigo-600/10 border-2 border-indigo-500/20 rounded-[1.5rem] p-3 shadow-sm hover:shadow-lg transition-all cursor-pointer group overflow-hidden" style={{ left: `${left}%`, width: `${width}%` }}>
                    <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-lg bg-indigo-600 text-white flex items-center justify-center text-[10px] font-black shrink-0 shadow-lg shadow-indigo-600/20"><i className="fas fa-flag-checkered"></i></span>
                        <div>
                          <p className="text-[10px] font-black text-indigo-700 uppercase tracking-tighter truncate">{m.name}</p>
                          <p className="text-[8px] font-bold text-indigo-400 uppercase tracking-widest truncate">{m.status}</p>
                        </div>
                    </div>
                  </div>
                );
              })}
          </div>

          <div className="relative">
            <div className="divide-y divide-slate-50 border-t border-slate-100">
                {epics.map(epic => {
                  const app = applications.find(a => a._id === epic.applicationId);
                  const epicFeatures = features.filter(f => f.parentId === epic._id || f.parentId === epic.id);
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
                               {risk === 'WARNING' && <i className="fas fa-triangle-exclamation text-amber-500 text-[10px] animate-pulse" title="Child Dependency Blocked/Flagged"></i>}
                               {risk === 'CRITICAL' && <i className="fas fa-hand text-red-500 text-[10px] animate-pulse" title="Self Blocked/Flagged"></i>}
                            </div>
                            <h4 onClick={() => setActiveItem(epic)} className="text-sm font-black text-slate-800 truncate leading-tight group-hover:text-blue-600 transition-colors cursor-pointer">{epic.title}</h4>
                            <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">{epic.key}</span>
                          </div>
                        </div>
                        <div className="flex-1 h-12 relative flex items-center">
                          {renderTimelineBar(epic)}
                        </div>
                      </div>
                      
                      {isExpanded && epicFeatures.map(feat => {
                        const featRisk = getItemRisk(feat);
                        return (
                          <div key={feat._id} className="flex items-center group py-4 hover:bg-blue-50/20 transition-colors bg-slate-50/10">
                            <div className="w-80 pr-8 pl-14 shrink-0 relative">
                               <div className="absolute left-10 top-0 bottom-0 w-[1px] bg-slate-200"></div>
                               <div className="absolute left-10 top-1/2 w-4 h-[1px] bg-slate-200"></div>
                               <div className="flex items-center gap-2">
                                  <h4 onClick={() => setActiveItem(feat)} className="text-xs font-bold text-slate-600 truncate leading-tight group-hover:text-blue-600 transition-colors cursor-pointer">{feat.title}</h4>
                                  {featRisk !== 'HEALTHY' && <i className={`fas fa-circle text-[6px] ${featRisk === 'CRITICAL' ? 'text-red-500' : 'text-amber-500'} animate-pulse`}></i>}
                               </div>
                               <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">{feat.key}</span>
                            </div>
                            <div className="flex-1 h-8 relative flex items-center">
                              {renderTimelineBar(feat, true)}
                            </div>
                          </div>
                        );
                      })}
                    </React.Fragment>
                  );
                })}
            </div>

            <div className="absolute top-0 bottom-0 w-[3px] bg-red-500/40 z-[10]" style={{ left: `calc(320px + ${getPosition(new Date().toISOString())}%)` }}>
                <div className="bg-red-500 text-white text-[8px] font-black px-2 py-1 rounded-full absolute -top-1 -translate-x-1/2 uppercase tracking-widest shadow-lg">TODAY</div>
            </div>

            <div className="absolute top-0 bottom-0 left-80 right-0 pointer-events-none flex">
              {timelineMonths.map((_, i) => (
                <div key={i} className="flex-1 border-l border-slate-50 h-full first:border-l-0"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
      
      <div className="pt-10 flex items-center gap-12 justify-center border-t border-slate-50 shrink-0">
         <LegendItem color="bg-red-500" label="Critical Impediment" />
         <LegendItem color="bg-amber-500" label="Dependency Risk" />
         <LegendItem color="bg-emerald-500" label="Verified Delivery" />
         <LegendItem color="bg-blue-600" label="Active Construction" />
      </div>

      {activeItem && (
        <div className="fixed inset-y-0 right-0 w-[650px] bg-white shadow-[0_0_100px_rgba(0,0,0,0.2)] border-l border-slate-200 z-[100] animate-slideIn">
           <WorkItemDetails item={activeItem} bundles={bundles} applications={applications} onUpdate={fetchData} onClose={() => setActiveItem(null)} />
        </div>
      )}
    </div>
  );
};

const LegendItem = ({ color, label }: any) => (
  <div className="flex items-center gap-3">
    <div className={`w-3 h-3 rounded-full ${color} shadow-sm`}></div>
    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</span>
  </div>
);

export default WorkItemsRoadmapView;
