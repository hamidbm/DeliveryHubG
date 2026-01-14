
import React, { useState, useEffect } from 'react';
import { WorkItem, Application, Bundle, MilestoneStatus } from '../types';
import { MILESTONES } from '../constants';

interface WorkItemsRoadmapViewProps {
  applications: Application[];
  bundles: Bundle[];
  selBundleId: string;
  selAppId: string;
  selMilestone: string;
  selEpicId: string;
  searchQuery: string;
}

const WorkItemsRoadmapView: React.FC<WorkItemsRoadmapViewProps> = ({ 
  applications, bundles, selBundleId, selAppId, selMilestone, searchQuery 
}) => {
  const [epics, setEpics] = useState<WorkItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchEpics = async () => {
      const params = new URLSearchParams({
        bundleId: selBundleId,
        applicationId: selAppId,
        q: searchQuery,
      });
      const res = await fetch(`/api/work-items?${params.toString()}`);
      const data = await res.json();
      setEpics(data.filter((i: WorkItem) => i.type === 'EPIC'));
      setLoading(false);
    };
    fetchEpics();
  }, [selBundleId, selAppId, searchQuery]);

  // Generate simple month markers for visualization
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  return (
    <div className="bg-white rounded-[3rem] border border-slate-200 shadow-2xl p-10 space-y-10 animate-fadeIn min-h-[700px]">
      <header className="flex justify-between items-center border-b border-slate-50 pb-8">
        <div>
          <h3 className="text-2xl font-black text-slate-800 tracking-tighter uppercase italic">Release Roadmap</h3>
          <p className="text-slate-400 font-medium text-sm">Strategic multi-month execution view.</p>
        </div>
        <div className="flex bg-slate-100 p-1 rounded-xl">
           <button className="px-6 py-2 bg-white text-blue-600 text-[9px] font-black uppercase rounded-lg shadow-sm">Monthly</button>
           <button className="px-6 py-2 text-slate-400 text-[9px] font-black uppercase rounded-lg">Quarterly</button>
        </div>
      </header>

      <div className="relative">
         {/* Timeline Header */}
         <div className="flex pl-60 border-b border-slate-100">
           {months.map(m => (
             <div key={m} className="flex-1 text-center py-4 border-l border-slate-50 first:border-l-0">
               <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">{m}</span>
             </div>
           ))}
         </div>

         {/* Roadmap Rows */}
         <div className="divide-y divide-slate-50">
            {epics.map(epic => {
              const app = applications.find(a => a._id === epic.applicationId);
              return (
                <div key={epic._id} className="flex items-center group py-6 hover:bg-slate-50/30 transition-colors">
                  <div className="w-60 pr-8 shrink-0">
                     <span className="text-[9px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded mb-1 inline-block uppercase">{app?.name || 'Shared'}</span>
                     <h4 className="text-sm font-bold text-slate-800 truncate leading-tight group-hover:text-blue-600 transition-colors">{epic.title}</h4>
                  </div>
                  <div className="flex-1 h-12 relative flex items-center">
                     {/* Simulating Epic Duration */}
                     <div 
                      className={`h-4 rounded-full shadow-sm relative transition-all group-hover:h-6 ${
                        epic.status === 'DONE' ? 'bg-emerald-400 shadow-emerald-500/20' : 
                        epic.status === 'IN_PROGRESS' ? 'bg-blue-400 shadow-blue-500/20' : 
                        'bg-slate-200'
                      }`}
                      style={{ 
                        left: `${Math.random() * 20}%`, 
                        width: `${30 + Math.random() * 40}%` 
                      }}
                     >
                       <div className="absolute inset-0 flex items-center px-4 overflow-hidden">
                          <span className="text-[8px] font-black text-white uppercase tracking-tighter truncate opacity-0 group-hover:opacity-100 transition-opacity">
                            {epic.key}: v1.2 Release Cycle
                          </span>
                       </div>
                     </div>
                  </div>
                </div>
              );
            })}

            {epics.length === 0 && !loading && (
              <div className="py-20 text-center text-slate-300 italic uppercase font-black text-xs tracking-widest">
                 No epics tracked for roadmap in this scope.
              </div>
            )}
         </div>

         {/* Milestone Markers */}
         <div className="absolute top-14 bottom-0 left-60 right-0 pointer-events-none flex">
           {[...Array(12)].map((_, i) => (
             <div key={i} className="flex-1 border-l border-slate-100 h-full first:border-l-0"></div>
           ))}
         </div>

         {/* Current Date Line */}
         <div className="absolute top-0 bottom-0 w-[2px] bg-red-400/30 z-10" style={{ left: 'calc(60px + 35%)' }}>
            <div className="bg-red-400 text-white text-[8px] font-black px-2 py-1 rounded absolute -top-4 -translate-x-1/2 uppercase">TODAY</div>
         </div>
      </div>
      
      <div className="pt-10 flex items-center gap-8 justify-center border-t border-slate-50">
         <LegendItem color="bg-emerald-400" label="Executed / Verified" />
         <LegendItem color="bg-blue-400" label="Active Delivery" />
         <LegendItem color="bg-slate-200" label="Pipeline Planning" />
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
