
import React, { useState, useEffect, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { Application, Bundle, WorkItem, WorkItemStatus } from '../types';

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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      setLoading(true);
      const params = new URLSearchParams({
        bundleId: selBundleId,
        applicationId: selAppId,
        milestoneId: selMilestone,
        q: searchQuery,
        epicId: selEpicId
      });
      if (quickFilter) params.set('quickFilter', quickFilter);

      try {
        const res = await fetch(`/api/work-items?${params.toString()}`);
        setItems(await res.json());
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, [selBundleId, selAppId, selMilestone, selEpicId, searchQuery, quickFilter]);

  const statusData = useMemo(() => {
    const counts: Record<string, number> = {};
    Object.values(WorkItemStatus).forEach(s => counts[s] = 0);
    items.forEach(i => counts[i.status]++);
    return Object.entries(counts).map(([name, value]) => ({ name: name.replace('_', ' '), value }));
  }, [items]);

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#64748b'];

  if (loading) return (
    <div className="h-[600px] flex items-center justify-center bg-white rounded-[3rem] border border-slate-100">
      <i className="fas fa-circle-notch fa-spin text-blue-500 text-2xl"></i>
    </div>
  );

  return (
    <div className="space-y-10 animate-fadeIn p-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
         {/* Summary Cards */}
         <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-4 gap-6">
            <StatCard title="Total Backlog" value={items.length} icon="fa-list-check" color="slate" />
            <StatCard title="In Progress" value={items.filter(i => i.status === WorkItemStatus.IN_PROGRESS).length} icon="fa-spinner" color="blue" />
            <StatCard title="Completed" value={items.filter(i => i.status === WorkItemStatus.DONE).length} icon="fa-check-double" color="emerald" />
            <StatCard title="Blockers" value={items.filter(i => i.status === WorkItemStatus.BLOCKED).length} icon="fa-shield-halved" color="red" />
         </div>

         {/* Charts */}
         <div className="lg:col-span-2 bg-white p-10 rounded-[3rem] border border-slate-200 shadow-sm">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-10">Delivery Velocity by Status</h3>
            <div className="h-80">
               <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={statusData}>
                     <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                     <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 'bold', fill: '#94a3b8' }} />
                     <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 'bold', fill: '#94a3b8' }} />
                     <Tooltip 
                        contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                        itemStyle={{ fontSize: '10px', fontWeight: 'bold' }}
                     />
                     <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                        {statusData.map((entry, index) => (
                           <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                     </Bar>
                  </BarChart>
               </ResponsiveContainer>
            </div>
         </div>

         <div className="bg-white p-10 rounded-[3rem] border border-slate-200 shadow-sm flex flex-col items-center">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-10 w-full text-left">Status Distribution</h3>
            <div className="h-64 w-full relative">
               <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                     <Pie data={statusData} innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                        {statusData.map((entry, index) => (
                           <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                     </Pie>
                     <Tooltip />
                  </PieChart>
               </ResponsiveContainer>
               <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-3xl font-black text-slate-800">{items.length}</span>
                  <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Total</span>
               </div>
            </div>
            <div className="mt-6 grid grid-cols-2 gap-4 w-full">
               {statusData.map((d, i) => (
                 <div key={i} className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }}></div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase">{d.name}</span>
                 </div>
               ))}
            </div>
         </div>
      </div>
    </div>
  );
};

const StatCard = ({ title, value, icon, color }: any) => {
  const themes: any = {
    blue: 'bg-blue-50 text-blue-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    red: 'bg-red-50 text-red-600',
    slate: 'bg-slate-50 text-slate-600',
  };
  return (
    <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 flex flex-col gap-4">
       <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl shadow-sm ${themes[color]}`}>
          <i className={`fas ${icon}`}></i>
       </div>
       <div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{title}</p>
          <p className="text-3xl font-black text-slate-800 tracking-tighter mt-1">{value}</p>
       </div>
    </div>
  );
};

export default WorkItemsAnalyticsView;
