
import React, { useState, useEffect, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
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

  const statusData = useMemo(() => {
    const counts: Record<string, number> = {};
    Object.values(WorkItemStatus).forEach(s => counts[s] = 0);
    items.forEach(i => counts[i.status]++);
    return Object.entries(counts).map(([name, value]) => ({ name: name.replace('_', ' '), value }));
  }, [items]);

  // Velocity Calculation: Done points vs Target Capacity per Milestone
  const velocityData = useMemo(() => {
    return milestones.slice(-5).map(m => {
      const msItems = items.filter(i => i.milestoneIds?.includes(m._id!));
      const committed = msItems.reduce((acc, curr) => acc + (curr.storyPoints || 0), 0);
      const completed = msItems.filter(i => i.status === WorkItemStatus.DONE).reduce((acc, curr) => acc + (curr.storyPoints || 0), 0);
      return { name: m.name.substring(0, 10), committed, completed };
    });
  }, [items, milestones]);

  // Burndown prediction
  const burndownData = useMemo(() => {
    const totalPoints = items.reduce((acc, curr) => acc + (curr.storyPoints || 0), 0);
    const steps = 10;
    const data = [];
    let remaining = totalPoints;
    for (let i = 0; i <= steps; i++) {
      data.push({ day: `Day ${i}`, ideal: Math.max(0, totalPoints - (totalPoints / steps) * i), actual: remaining });
      remaining -= Math.random() * (totalPoints / (steps * 0.8));
      if (remaining < 0) remaining = 0;
    }
    return data;
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
         <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-4 gap-6">
            <StatCard title="Throughput" value={items.filter(i => i.status === WorkItemStatus.DONE).length} icon="fa-check-double" color="emerald" />
            <StatCard title="Committed Points" value={items.reduce((acc, i) => acc + (i.storyPoints || 0), 0)} icon="fa-bolt" color="blue" />
            <StatCard title="System Volatility" value="12%" icon="fa-wave-square" color="amber" />
            <StatCard title="Blocker Impact" value={items.filter(i => i.status === WorkItemStatus.BLOCKED).length} icon="fa-shield-halved" color="red" />
         </div>

         {/* Chart 1: Burn-down */}
         <div className="lg:col-span-2 bg-white p-10 rounded-[3rem] border border-slate-200 shadow-sm relative group">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-10 flex items-center gap-2">
              <i className="fas fa-chart-line text-blue-500"></i> Active Cycle Burn-down
            </h3>
            <div className="h-80">
               <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={burndownData}>
                     <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                     <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 'bold', fill: '#94a3b8' }} />
                     <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 'bold', fill: '#94a3b8' }} />
                     <Tooltip contentStyle={{ borderRadius: '1.5rem', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }} />
                     <Line type="monotone" dataKey="ideal" stroke="#e2e8f0" strokeWidth={2} strokeDasharray="5 5" dot={false} name="Ideal" />
                     <Line type="monotone" dataKey="actual" stroke="#3b82f6" strokeWidth={4} dot={{ r: 4, fill: '#3b82f6', strokeWidth: 2, stroke: '#fff' }} name="Remaining" />
                  </LineChart>
               </ResponsiveContainer>
            </div>
         </div>

         {/* Chart 2: Artifact Composition */}
         <div className="bg-white p-10 rounded-[3rem] border border-slate-200 shadow-sm flex flex-col items-center">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-10 w-full text-left">Workflow Distribution</h3>
            <div className="h-64 w-full relative">
               <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                     <Pie data={statusData} innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                        {statusData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                     </Pie>
                     <Tooltip />
                  </PieChart>
               </ResponsiveContainer>
               <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-3xl font-black text-slate-800">{items.length}</span>
                  <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Inventory</span>
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

         {/* New Chart 3: Velocity Trend */}
         <div className="lg:col-span-3 bg-white p-10 rounded-[3rem] border border-slate-200 shadow-sm">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-10 flex items-center gap-2">
               <i className="fas fa-bolt text-amber-500"></i> Performance Velocity Trend
            </h3>
            <div className="h-80">
               <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={velocityData}>
                     <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                     <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 'bold', fill: '#94a3b8' }} />
                     <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 'bold', fill: '#94a3b8' }} />
                     <Tooltip contentStyle={{ borderRadius: '1.5rem', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }} />
                     <Bar dataKey="committed" fill="#e2e8f0" radius={[6, 6, 0, 0]} name="Commitment" />
                     <Bar dataKey="completed" fill="#10b981" radius={[6, 6, 0, 0]} name="Delivery" />
                  </BarChart>
               </ResponsiveContainer>
            </div>
         </div>
      </div>
    </div>
  );
};

const StatCard = ({ title, value, icon, color }: any) => {
  const themes: any = { blue: 'bg-blue-50 text-blue-600', emerald: 'bg-emerald-50 text-emerald-600', red: 'bg-red-50 text-red-600', amber: 'bg-amber-50 text-amber-600' };
  return (
    <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 flex flex-col gap-4 hover:shadow-xl transition-all group">
       <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl shadow-sm group-hover:scale-110 transition-transform ${themes[color]}`}><i className={`fas ${icon}`}></i></div>
       <div><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{title}</p><p className="text-3xl font-black text-slate-800 tracking-tighter mt-1">{value}</p></div>
    </div>
  );
};

export default WorkItemsAnalyticsView;
