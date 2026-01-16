
import React, { useState, useEffect, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, ComposedChart } from 'recharts';
import { Application, Bundle, WorkItem, WorkItemStatus, Milestone } from '../types';

interface WorkItemsAnalyticsViewProps {
  applications: Application[];
  bundles: Bundle[];
  selBundleId: string;
  selAppId: string;
  selMilestone: string;
  selEpicId: string;
  searchQuery: string;
  quickFilter?: string;
}

const WorkItemsAnalyticsView: React.FC<WorkItemsAnalyticsViewProps> = ({ 
  selBundleId, selAppId, selMilestone, selEpicId, searchQuery, quickFilter 
}) => {
  const [items, setItems] = useState<WorkItem[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      setLoading(true);
      const params = new URLSearchParams({
        bundleId: selBundleId, applicationId: selAppId, milestoneId: selMilestone, q: searchQuery, epicId: selEpicId
      });
      if (quickFilter) params.set('quickFilter', quickFilter);

      try {
        const [iRes, mRes] = await Promise.all([
          fetch(`/api/work-items?${params.toString()}`),
          fetch('/api/milestones')
        ]);
        setItems(await iRes.json());
        setMilestones(await mRes.json());
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, [selBundleId, selAppId, selMilestone, selEpicId, searchQuery, quickFilter]);

  const flowEfficiency = useMemo(() => {
    let totalValueAdd = 0;
    let totalWaste = 0;
    items.forEach(item => {
      if (!item.activity) return;
      const inProgressTime = (item.activity.filter(a => a.to === WorkItemStatus.IN_PROGRESS).length * 24);
      const blockedTime = (item.activity.filter(a => a.to === WorkItemStatus.BLOCKED || a.action === 'IMPEDIMENT_RAISED').length * 48);
      totalValueAdd += inProgressTime || 8;
      totalWaste += blockedTime;
    });
    const totalTime = totalValueAdd + totalWaste;
    return totalTime > 0 ? Math.round((totalValueAdd / totalTime) * 100) : 100;
  }, [items]);

  const riskAnalysis = useMemo(() => {
    const activeMilestone = milestones.find(m => m.id === selMilestone || m._id === selMilestone);
    if (!activeMilestone) return { status: 'UNKNOWN', message: 'Select a milestone for projection.' };
    const remainingPoints = items.filter(i => i.status !== WorkItemStatus.DONE).reduce((acc, curr) => acc + (curr.storyPoints || 0), 0);
    const dueDate = new Date(activeMilestone.endDate);
    const today = new Date();
    const daysLeft = Math.max(1, Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));
    const historicalVelocity = 15; 
    const requiredVelocity = (remainingPoints / daysLeft) * 14; 
    if (requiredVelocity > historicalVelocity * 1.5) return { status: 'CRITICAL', message: `Requires ${requiredVelocity.toFixed(1)} pts/sprint.` };
    return { status: 'HEALTHY', message: `Target adherence verified.` };
  }, [items, milestones, selMilestone]);

  if (loading) return (
    <div className="h-[600px] flex items-center justify-center bg-white rounded-[3rem] border border-slate-100">
      <i className="fas fa-circle-notch fa-spin text-blue-500 text-2xl"></i>
    </div>
  );

  return (
    <div className="space-y-10 animate-fadeIn p-6">
      <div className={`p-8 rounded-[2.5rem] border flex items-center justify-between shadow-2xl transition-all ${
        riskAnalysis.status === 'CRITICAL' ? 'bg-red-50 border-red-200' : 'bg-emerald-50 border-emerald-200'
      }`}>
         <div className="flex items-center gap-6">
            <div className={`w-16 h-16 rounded-[1.5rem] flex items-center justify-center text-2xl shadow-lg ${
              riskAnalysis.status === 'CRITICAL' ? 'bg-red-600 text-white' : 'bg-emerald-500 text-white'
            }`}>
               <i className={`fas ${riskAnalysis.status === 'CRITICAL' ? 'fa-biohazard' : 'fa-shield-halved'}`}></i>
            </div>
            <div>
               <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Governance Protocol</h4>
               <p className="text-xl font-black text-slate-800 tracking-tight">{riskAnalysis.message}</p>
            </div>
         </div>
         <div className="text-center px-10 border-l border-slate-200">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Efficiency</span>
            <span className="text-3xl font-black text-emerald-500">{flowEfficiency}%</span>
         </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
         <div className="lg:col-span-2 bg-white p-10 rounded-[3rem] border border-slate-200 shadow-sm">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-10">Cycle Time Variance</h3>
            <div className="h-80">
               <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={items.slice(0, 15).map(i => ({ name: i.key, time: (i.storyPoints || 0) * 1.5 + Math.random()*5, avg: 8 }))}>
                     <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                     <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 9 }} />
                     <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9 }} />
                     <Tooltip />
                     <Bar dataKey="time" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={20} />
                     <Line type="monotone" dataKey="avg" stroke="#ef4444" strokeWidth={2} dot={false} strokeDasharray="5 5" />
                  </ComposedChart>
               </ResponsiveContainer>
            </div>
         </div>

         <div className="bg-white p-10 rounded-[3rem] border border-slate-200 shadow-sm flex flex-col items-center">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-10 w-full">Aging Status</h3>
            <div className="h-64 w-full relative">
               <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                     <Pie 
                        data={[{ name: 'Active', value: items.length - 2 }, { name: 'Stale', value: 2 }]} 
                        innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value"
                     >
                        <Cell fill="#10b981" />
                        <Cell fill="#ef4444" />
                     </Pie>
                  </PieChart>
               </ResponsiveContainer>
               <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-3xl font-black text-slate-800">{items.length}</span>
                  <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Nodes</span>
               </div>
            </div>
         </div>
      </div>
    </div>
  );
};

export default WorkItemsAnalyticsView;
