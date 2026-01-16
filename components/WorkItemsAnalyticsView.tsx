
import React, { useState, useEffect, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, AreaChart, Area } from 'recharts';
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

  // Logic: Predictive Risk Calculation
  const riskAnalysis = useMemo(() => {
    const activeMilestone = milestones.find(m => m.id === selMilestone || m._id === selMilestone);
    if (!activeMilestone) return { status: 'UNKNOWN', message: 'Select a milestone for projection.' };

    const remainingPoints = items
      .filter(i => i.status !== WorkItemStatus.DONE)
      .reduce((acc, curr) => acc + (curr.storyPoints || 0), 0);
    
    const dueDate = new Date(activeMilestone.endDate);
    const today = new Date();
    const daysLeft = Math.max(1, Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));
    
    const historicalVelocity = 15; // Mock: pts per 2-week sprint
    const requiredVelocity = (remainingPoints / daysLeft) * 14; 
    
    if (requiredVelocity > historicalVelocity * 1.5) {
      return { status: 'CRITICAL', message: `Delivery Gap: Requires ${requiredVelocity.toFixed(1)} pts/sprint. Current capacity is ${historicalVelocity}.` };
    } else if (requiredVelocity > historicalVelocity) {
      return { status: 'AT_RISK', message: `Velocity squeeze detected. Schedule optimization required.` };
    }
    return { status: 'HEALTHY', message: `Target adherence verified at ${historicalVelocity} pts/cycle.` };
  }, [items, milestones, selMilestone]);

  const burnupData = [
    { day: 'Day 1', total: 100, completed: 5, projected: 5 },
    { day: 'Day 5', total: 105, completed: 15, projected: 15 },
    { day: 'Day 10', total: 110, completed: 35, projected: 35 },
    { day: 'Day 15', total: 110, completed: 50, projected: 50 },
    { day: 'Day 20', total: 115, completed: 60, projected: 65 },
    { day: 'Day 25', total: 115, completed: 72, projected: 85 },
    { day: 'Day 30', total: 115, completed: null, projected: 105 },
  ];

  const loadData = useMemo(() => {
    const load: Record<string, { points: number, tasks: number }> = {};
    items.forEach(i => {
      const name = i.assignedTo || 'Unassigned';
      if (!load[name]) load[name] = { points: 0, tasks: 0 };
      load[name].points += i.storyPoints || 0;
      load[name].tasks += 1;
    });
    return Object.entries(load).map(([name, data]) => ({ name, points: data.points, tasks: data.tasks }))
      .sort((a, b) => b.points - a.points)
      .slice(0, 8);
  }, [items]);

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
      {/* Predictive Risk Banner */}
      <div className={`p-8 rounded-[2.5rem] border flex items-center justify-between shadow-2xl transition-all ${
        riskAnalysis.status === 'CRITICAL' ? 'bg-red-50 border-red-200' :
        riskAnalysis.status === 'AT_RISK' ? 'bg-amber-50 border-amber-200' : 'bg-emerald-50 border-emerald-200'
      }`}>
         <div className="flex items-center gap-6">
            <div className={`w-16 h-16 rounded-[1.5rem] flex items-center justify-center text-2xl shadow-lg ${
              riskAnalysis.status === 'CRITICAL' ? 'bg-red-600 text-white' :
              riskAnalysis.status === 'AT_RISK' ? 'bg-amber-500 text-white' : 'bg-emerald-500 text-white'
            }`}>
               <i className={`fas ${riskAnalysis.status === 'CRITICAL' ? 'fa-biohazard' : 'fa-shield-halved'}`}></i>
            </div>
            <div>
               <h4 className={`text-[10px] font-black uppercase tracking-[0.2em] ${
                 riskAnalysis.status === 'CRITICAL' ? 'text-red-600' : 'text-slate-500'
               }`}>Predictive Governance Protocol</h4>
               <p className="text-xl font-black text-slate-800 tracking-tight">{riskAnalysis.message}</p>
            </div>
         </div>
         {riskAnalysis.status !== 'HEALTHY' && (
           <button className="px-6 py-3 bg-slate-900 text-white text-[10px] font-black rounded-xl uppercase tracking-widest hover:bg-blue-600 transition-all shadow-xl">Initiate De-scoping</button>
         )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
         <div className="lg:col-span-3 bg-white p-10 rounded-[3rem] border border-slate-200 shadow-sm">
            <header className="flex justify-between items-center mb-10">
               <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                 <i className="fas fa-chart-line text-blue-600"></i> Capacity vs. Demand Burnup
               </h3>
               <div className="flex gap-4">
                  <LegendItem color="bg-blue-600" label="Planned Scope" />
                  <LegendItem color="bg-emerald-500" label="Actual Progress" />
                  <LegendItem color="bg-amber-400" label="AI Projection" isDashed />
               </div>
            </header>
            <div className="h-64 w-full">
               <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={burnupData}>
                    <defs>
                      <linearGradient id="colorComp" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 'bold' }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 'bold' }} />
                    <Tooltip contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                    <Area type="monotone" dataKey="total" stroke="#3b82f6" fill="transparent" strokeWidth={3} />
                    <Area type="monotone" dataKey="completed" stroke="#10b981" fill="url(#colorComp)" strokeWidth={3} />
                    <Line type="monotone" dataKey="projected" stroke="#f59e0b" strokeDasharray="5 5" dot={false} strokeWidth={2} />
                  </AreaChart>
               </ResponsiveContainer>
            </div>
         </div>

         <div className="lg:col-span-2 bg-white p-10 rounded-[3rem] border border-slate-200 shadow-sm">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-10 flex items-center gap-2">
              <i className="fas fa-users-viewfinder text-blue-500"></i> Resource Equilibrium
            </h3>
            <div className="h-80">
               <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={loadData} layout="vertical">
                     <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                     <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 'bold' }} />
                     <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} width={100} tick={{ fontSize: 10, fontWeight: 'bold' }} />
                     <Tooltip cursor={{ fill: '#f8fafc' }} />
                     <Bar dataKey="points" radius={[0, 6, 6, 0]} name="Load">
                        {loadData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.points > 10 ? '#ef4444' : '#3b82f6'} />
                        ))}
                     </Bar>
                  </BarChart>
               </ResponsiveContainer>
            </div>
         </div>

         <div className="bg-white p-10 rounded-[3rem] border border-slate-200 shadow-sm flex flex-col items-center">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-10 w-full text-left">Topology Mix</h3>
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
                  <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Nodes</span>
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

const LegendItem = ({ color, label, isDashed }: any) => (
  <div className="flex items-center gap-2">
    <div className={`w-3 h-1 ${color} ${isDashed ? 'opacity-50' : ''}`}></div>
    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{label}</span>
  </div>
);

export default WorkItemsAnalyticsView;
