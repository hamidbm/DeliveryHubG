
import React, { useState, useEffect, useMemo } from 'react';
import { WorkItem, Application, Bundle, Milestone, WorkItemStatus } from '../types';

interface WorkItemsRoadmapViewProps {
  applications: Application[];
  bundles: Bundle[];
  selBundleId: string;
  selAppId: string;
  searchQuery: string;
}

const WorkItemsRoadmapView: React.FC<WorkItemsRoadmapViewProps> = ({ 
  applications, bundles, selBundleId, selAppId, searchQuery 
}) => {
  const [epics, setEpics] = useState<WorkItem[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      const params = new URLSearchParams({ bundleId: selBundleId, applicationId: selAppId, q: searchQuery });
      const [wRes, mRes] = await Promise.all([
        fetch(`/api/work-items?${params.toString()}`),
        fetch(`/api/milestones?${params.toString()}`)
      ]);
      const wData = await wRes.json();
      setEpics(wData.filter((i: WorkItem) => i.type === 'EPIC'));
      setMilestones(await mRes.json());
      setLoading(false);
    };
    fetchData();
  }, [selBundleId, selAppId, searchQuery]);

  const timelineMonths = useMemo(() => {
    const today = new Date();
    const months = [];
    for (let i = -2; i < 10; i++) {
      const d = new Date(today.getFullYear(), today.getMonth() + i, 1);
      months.push({
        label: d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
        date: d
      });
    }
    return months;
  }, []);

  const totalWidth = 100; // Percentage
  const startTimeline = timelineMonths[0].date.getTime();
  const endTimeline = new Date(timelineMonths[timelineMonths.length - 1].date.getFullYear(), timelineMonths[timelineMonths.length - 1].date.getMonth() + 1, 0).getTime();
  const timelineDuration = endTimeline - startTimeline;

  const getPosition = (dateStr: string) => {
    const time = new Date(dateStr).getTime();
    return ((time - startTimeline) / timelineDuration) * 100;
  };

  return (
    <div className="bg-white rounded-[3rem] border border-slate-200 shadow-2xl p-10 space-y-10 animate-fadeIn min-h-[800px] overflow-x-auto">
      <header className="flex justify-between items-center border-b border-slate-50 pb-8 shrink-0">
        <div>
          <h3 className="text-3xl font-black text-slate-800 tracking-tighter uppercase italic">Strategic Delivery Roadmap</h3>
          <p className="text-slate-400 font-medium text-lg">Multi-cycle release visualization for executive alignment.</p>
        </div>
        <div className="flex bg-slate-100 p-1 rounded-xl">
           <button className="px-6 py-2 bg-white text-blue-600 text-[9px] font-black uppercase rounded-lg shadow-sm">Monthly</button>
           <button className="px-6 py-2 text-slate-400 text-[9px] font-black uppercase rounded-lg">Quarterly</button>
        </div>
      </header>

      <div className="relative min-w-[1200px]">
         {/* Timeline Header */}
         <div className="flex pl-64 mb-6 relative">
           {timelineMonths.map((m, idx) => (
             <div key={idx} className="flex-1 text-center py-4 border-l border-slate-50 first:border-l-0">
               <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">{m.label}</span>
             </div>
           ))}
         </div>

         {/* Milestone Track (Top) */}
         <div className="h-20 relative pl-64 mb-10">
            {milestones.map(m => {
              const left = getPosition(m.startDate);
              const right = getPosition(m.endDate);
              const width = Math.max(right - left, 2);
              if (left < 0 || left > 100) return null;
              
              return (
                <div 
                  key={m._id} 
                  className="absolute h-14 top-0 bg-blue-600/10 border-2 border-blue-500/20 rounded-[1.5rem] p-3 shadow-sm hover:shadow-lg transition-all cursor-pointer group overflow-hidden"
                  style={{ left: `${left}%`, width: `${width}%` }}
                >
                   <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-lg bg-blue-600 text-white flex items-center justify-center text-[8px] font-black shrink-0"><i className="fas fa-flag"></i></span>
                      <span className="text-[10px] font-black text-blue-700 uppercase tracking-tighter truncate">{m.name}</span>
                   </div>
                </div>
              );
            })}
         </div>

         {/* Epic Rows */}
         <div className="divide-y divide-slate-50 border-t border-slate-100">
            {epics.map(epic => {
              const app = applications.find(a => a._id === epic.applicationId);
              // Mocking dates for Epics based on their milestone if available, or random spread for visualization
              const epicStart = epic.createdAt || new Date().toISOString();
              const epicEnd = new Date(new Date(epicStart).getTime() + (45 * 24 * 60 * 60 * 1000)).toISOString();
              
              const left = Math.max(0, getPosition(epicStart));
              const width = Math.min(30, 100 - left);

              return (
                <div key={epic._id} className="flex items-center group py-6 hover:bg-slate-50/40 transition-colors">
                  <div className="w-64 pr-8 shrink-0 relative">
                     <span className="text-[9px] font-black text-slate-300 bg-slate-50 px-2 py-0.5 rounded mb-1 inline-block uppercase">{app?.name || 'Shared Platform'}</span>
                     <h4 className="text-sm font-black text-slate-800 truncate leading-tight group-hover:text-blue-600 transition-colors">{epic.title}</h4>
                     <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">{epic.key}</span>
                  </div>
                  <div className="flex-1 h-12 relative flex items-center">
                     <div 
                      className={`h-6 rounded-full shadow-lg relative transition-all group-hover:h-8 flex items-center px-4 ${
                        epic.status === WorkItemStatus.DONE ? 'bg-emerald-500 shadow-emerald-500/20' : 
                        epic.status === WorkItemStatus.IN_PROGRESS ? 'bg-blue-600 shadow-blue-500/20' : 
                        'bg-slate-200'
                      }`}
                      style={{ left: `${left}%`, width: `${width}%` }}
                     >
                        <span className="text-[9px] font-black text-white uppercase tracking-tighter truncate">
                          {epic.status} • {epic.storyPoints || 0} pts
                        </span>
                     </div>
                  </div>
                </div>
              );
            })}

            {epics.length === 0 && !loading && (
              <div className="py-32 text-center text-slate-300 italic uppercase font-black text-sm tracking-widest bg-slate-50/20 rounded-[2rem]">
                 <i className="fas fa-route text-5xl mb-6 opacity-10"></i>
                 <p>No Roadmap Items Tracked in Current Context</p>
              </div>
            )}
         </div>

         {/* Today Line */}
         <div className="absolute top-0 bottom-0 w-[3px] bg-red-500/40 z-[10]" style={{ left: `calc(256px + ${getPosition(new Date().toISOString())}%)` }}>
            <div className="bg-red-500 text-white text-[8px] font-black px-2 py-1 rounded-full absolute -top-1 -translate-x-1/2 uppercase tracking-widest shadow-lg">TODAY</div>
         </div>

         {/* Grid Lines */}
         <div className="absolute top-0 bottom-0 left-64 right-0 pointer-events-none flex">
           {timelineMonths.map((_, i) => (
             <div key={i} className="flex-1 border-l border-slate-50 h-full first:border-l-0"></div>
           ))}
         </div>
      </div>
      
      <div className="pt-10 flex items-center gap-12 justify-center border-t border-slate-50 shrink-0">
         <div className="flex items-center gap-3">
            <div className="w-12 h-4 bg-blue-600/10 border-2 border-blue-500/20 rounded-lg"></div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Milestone Cycle</span>
         </div>
         <LegendItem color="bg-emerald-500" label="Verified Delivery" />
         <LegendItem color="bg-blue-600" label="Active Construction" />
         <LegendItem color="bg-slate-200" label="Planned / Backlog" />
      </div>
    </div>
  );
};

const LegendItem = ({ color, label }: any) => (
  <div className="flex items-center gap-3">
    <div className={`w-3 h-3 rounded-full ${color}`}></div>
    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</span>
  </div>
);

export default WorkItemsRoadmapView;
