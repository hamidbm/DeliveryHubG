import React, { useState, useEffect, useMemo } from 'react';
import { Application } from '../types';
import { analyzeOperationsIntelligence } from '../services/geminiService';
import { marked } from 'marked';
import DOMPurify from 'isomorphic-dompurify';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts';

const OpsCenter: React.FC<{ applications: Application[] }> = ({ applications }) => {
  const [insight, setInsight] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeCluster, setActiveCluster] = useState('K8S-PROD-EAST');
  
  // Simulated Real-time Telemetry
  const [pulseData, setPulseData] = useState<any[]>([]);

  useEffect(() => {
    const generatePulse = () => {
      const data = [];
      for (let i = 0; i < 20; i++) {
        data.push({
          time: i,
          requests: 1500 + Math.random() * 800,
          latency: 45 + Math.random() * 30,
          errors: Math.random() > 0.8 ? 20 + Math.random() * 50 : Math.random() * 5
        });
      }
      setPulseData(data);
    };
    generatePulse();
    const interval = setInterval(generatePulse, 5000);
    return () => clearInterval(interval);
  }, []);

  const runOpsAnalysis = async () => {
    setLoading(true);
    try {
      const result = await analyzeOperationsIntelligence(
        applications.slice(0, 5).map(a => ({ name: a.name, health: a.status.health })),
        [{ cluster: activeCluster, status: 'Warning', cpu: '88%', memory: '74%', egress: '1.2GB/s' }]
      );
      setInsight(result);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { runOpsAnalysis(); }, [activeCluster]);

  const clusterStats = useMemo(() => [
    { name: 'K8S-PROD-EAST', status: 'Warning', nodes: 24, load: 88, color: '#f59e0b' },
    { name: 'K8S-PROD-WEST', status: 'Healthy', nodes: 18, load: 42, color: '#10b981' },
    { name: 'DB-SQL-PRIMARY', status: 'Healthy', nodes: 2, load: 65, color: '#10b981' },
    { name: 'K8S-UAT-EAST', status: 'Critical', nodes: 8, load: 94, color: '#ef4444' },
  ], []);

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Hero Status Banner */}
      <div className="p-10 bg-slate-950 rounded-[3rem] text-white relative overflow-hidden shadow-2xl border border-white/5">
        <div className="absolute top-0 right-0 w-1/2 h-full opacity-20 pointer-events-none">
           <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={pulseData}>
                 <Area type="monotone" dataKey="requests" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.3} />
              </AreaChart>
           </ResponsiveContainer>
        </div>
        
        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-10">
          <div className="space-y-6">
             <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-red-500 animate-ping"></div>
                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-400">Mission Control Terminal</span>
             </div>
             <h1 className="text-6xl font-black tracking-tighter leading-none">Observability Hub</h1>
             <p className="text-slate-400 font-medium text-lg max-w-lg">Predictive anomaly detection and SRE intelligence powered by Gemini 3 Flash.</p>
             <div className="flex items-center gap-4">
                <button className="px-8 py-3 bg-blue-600 text-white text-[10px] font-black uppercase rounded-2xl shadow-xl shadow-blue-600/20 hover:bg-blue-500 transition-all">View Incident Log</button>
                <div className="px-5 py-3 bg-white/5 border border-white/10 rounded-2xl flex items-center gap-3">
                   <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Global Error Rate</span>
                   <span className="text-sm font-black text-red-400">0.04%</span>
                </div>
             </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
             {clusterStats.slice(0, 4).map(c => (
               <button 
                key={c.name}
                onClick={() => setActiveCluster(c.name)}
                className={`p-6 rounded-[2rem] border transition-all text-left group ${activeCluster === c.name ? 'bg-white/10 border-blue-500/50 shadow-2xl' : 'bg-white/5 border-white/5 hover:bg-white/10'}`}
               >
                  <div className="flex justify-between items-start mb-4">
                    <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center border border-white/10 text-slate-400 group-hover:text-white transition-colors">
                       <i className="fas fa-server"></i>
                    </div>
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: c.color }}></div>
                  </div>
                  <h4 className="text-sm font-black text-white mb-1 truncate">{c.name}</h4>
                  <div className="flex justify-between items-end">
                    <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">{c.nodes} Nodes</span>
                    <span className="text-[10px] font-black" style={{ color: c.color }}>{c.load}% LOAD</span>
                  </div>
               </button>
             ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        {/* Live Telemetry Plane */}
        <div className="xl:col-span-2 bg-white rounded-[3rem] border border-slate-200 shadow-sm flex flex-col overflow-hidden">
           <header className="px-10 py-8 border-b border-slate-100 flex items-center justify-between">
              <div>
                 <h3 className="text-xl font-black text-slate-800 tracking-tight">Egress & Latency Plane</h3>
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Real-time cluster pulse: {activeCluster}</p>
              </div>
              <div className="flex items-center gap-2">
                 <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                 <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Requests</span>
                 <div className="w-2 h-2 rounded-full bg-emerald-500 ml-4"></div>
                 <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Latency</span>
              </div>
           </header>
           <div className="flex-1 p-10 h-80">
              <ResponsiveContainer width="100%" height="100%">
                 <AreaChart data={pulseData}>
                    <defs>
                       <linearGradient id="colorRequests" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                       </linearGradient>
                       <linearGradient id="colorLatency" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                       </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="time" hide />
                    <YAxis hide />
                    <Tooltip 
                       contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', fontSize: '10px' }}
                    />
                    <Area type="monotone" dataKey="requests" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorRequests)" />
                    <Area type="monotone" dataKey="latency" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorLatency)" />
                 </AreaChart>
              </ResponsiveContainer>
           </div>
           <div className="bg-slate-50/50 px-10 py-6 border-t border-slate-100 grid grid-cols-4 gap-10">
              <MetricBox label="Egress Bandwidth" value="1.42 GB/s" trend="+5%" status="neutral" />
              <MetricBox label="Error Delta" value="0.002%" trend="-12%" status="healthy" />
              <MetricBox label="Queue Depth" value="142" trend="stable" status="neutral" />
              <MetricBox label="Threat Score" value="Low" trend="stable" status="healthy" />
           </div>
        </div>

        {/* AI Intelligence Assistant */}
        <div className="bg-white rounded-[3rem] border border-slate-200 shadow-sm flex flex-col h-full overflow-hidden">
           <header className="px-10 py-8 border-b border-slate-100 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                 <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/30">
                    <i className="fas fa-brain text-xs"></i>
                 </div>
                 <h3 className="text-sm font-black uppercase tracking-widest">SRE AI Advisor</h3>
              </div>
              <button onClick={runOpsAnalysis} disabled={loading} className="text-[8px] font-black text-blue-400 uppercase tracking-[0.2em] hover:text-white transition-colors">
                 {loading ? <i className="fas fa-circle-notch fa-spin"></i> : 'Regenerate'}
              </button>
           </header>
           <div className="flex-1 p-8 overflow-y-auto custom-scrollbar">
              {loading ? (
                <div className="space-y-6">
                   {[1, 2, 3, 4].map(i => <div key={i} className="h-4 bg-slate-50 rounded-full w-full animate-pulse" style={{ opacity: 1 - i * 0.2 }}></div>)}
                </div>
              ) : insight ? (
                <div className="prose prose-sm prose-slate max-w-none prose-p:text-slate-500 prose-strong:text-slate-800 prose-headings:text-slate-900" 
                     dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(marked.parse(insight) as string) }} />
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center text-slate-300">
                   <i className="fas fa-comment-slash text-4xl mb-4 opacity-10"></i>
                   <p className="text-[10px] font-black uppercase tracking-widest">No Active Alerts</p>
                </div>
              )}
           </div>
           <footer className="p-6 bg-slate-50 border-t border-slate-100">
              <div className="flex items-center gap-3 bg-white border border-slate-200 rounded-xl px-4 py-3 shadow-sm group">
                 <i className="fas fa-search text-[10px] text-slate-300 group-focus-within:text-blue-500"></i>
                 <input type="text" placeholder="Ask AI about metrics..." className="bg-transparent border-none outline-none text-[11px] font-bold text-slate-600 w-full" />
              </div>
           </footer>
        </div>
      </div>
    </div>
  );
};

const MetricBox = ({ label, value, trend, status }: any) => (
  <div className="flex flex-col">
    <span className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">{label}</span>
    <div className="flex items-baseline gap-2">
       <span className="text-sm font-black text-slate-800">{value}</span>
       <span className={`text-[8px] font-bold uppercase ${status === 'healthy' ? 'text-emerald-500' : 'text-slate-400'}`}>{trend}</span>
    </div>
  </div>
);

export default OpsCenter;