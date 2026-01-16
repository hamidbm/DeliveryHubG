
import React, { useState, useEffect } from 'react';
import { Application, InfrastructureNode } from '../types';
import { analyzeOperationsIntelligence } from '../services/geminiService';
import { marked } from 'marked';
import DOMPurify from 'isomorphic-dompurify';

const OpsCenter: React.FC<{ applications: Application[] }> = ({ applications }) => {
  const [insight, setInsight] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeAlerts, setActiveAlerts] = useState<number>(3);

  const runOpsAnalysis = async () => {
    setLoading(true);
    // Simulate real-time data feeding to Gemini
    const result = await analyzeOperationsIntelligence(
      applications.slice(0, 5).map(a => ({ name: a.name, health: a.status.health })),
      [{ cluster: 'K8S-PROD', region: 'East US', status: 'Warning', cpu: '92%' }]
    );
    setInsight(result);
    setLoading(false);
  };

  useEffect(() => { runOpsAnalysis(); }, []);

  return (
    <div className="space-y-10 animate-fadeIn">
       <div className="p-10 bg-slate-900 rounded-[3rem] text-white flex flex-col lg:flex-row items-center justify-between gap-10 relative overflow-hidden shadow-2xl">
          <div className="absolute top-0 right-0 w-80 h-80 bg-blue-500/10 rounded-full -mr-40 -mt-40 blur-3xl"></div>
          <div className="relative z-10 space-y-4">
             <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-red-500 animate-ping"></div>
                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-400">Mission Control Active</span>
             </div>
             <h1 className="text-5xl font-black tracking-tighter">Observability Hub</h1>
             <p className="text-slate-400 font-medium text-xl max-w-2xl">Predictive system health and enterprise performance intelligence powered by Gemini 3.</p>
          </div>
          <div className="grid grid-cols-2 gap-4 shrink-0 relative z-10">
             <div className="bg-white/5 border border-white/10 p-6 rounded-[2rem] text-center">
                <span className="text-3xl font-black text-white">{activeAlerts}</span>
                <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mt-1">Active Anomalies</p>
             </div>
             <div className="bg-emerald-500/10 border border-emerald-500/20 p-6 rounded-[2rem] text-center">
                <span className="text-3xl font-black text-emerald-400">99.8%</span>
                <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mt-1">SLA Adherence</p>
             </div>
          </div>
       </div>

       <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
          <div className="lg:col-span-2 space-y-10">
             <section className="bg-white rounded-[3rem] border border-slate-200 p-10 shadow-sm min-h-[500px]">
                <header className="flex justify-between items-center mb-10">
                   <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-2xl flex items-center justify-center text-xl"><i className="fas fa-brain"></i></div>
                      <h3 className="text-xl font-black text-slate-800 tracking-tight">AI SRE Insights</h3>
                   </div>
                   <button onClick={runOpsAnalysis} className="text-[9px] font-black text-blue-600 uppercase tracking-widest hover:underline flex items-center gap-2">
                      <i className={`fas ${loading ? 'fa-sync fa-spin' : 'fa-bolt'}`}></i>
                      Rerun Intelligence Log
                   </button>
                </header>
                <div className="prose prose-slate max-w-none">
                   {loading ? (
                     <div className="space-y-6">
                        <div className="h-4 bg-slate-100 rounded-full w-3/4 animate-pulse"></div>
                        <div className="h-4 bg-slate-100 rounded-full w-1/2 animate-pulse"></div>
                        <div className="h-4 bg-slate-100 rounded-full w-2/3 animate-pulse"></div>
                     </div>
                   ) : (
                     <div className="text-slate-600" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(marked.parse(insight || '') as string) }} />
                   )}
                </div>
             </section>
          </div>

          <aside className="space-y-8">
             <div className="bg-white rounded-[2.5rem] border border-slate-200 p-8 shadow-sm">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                   <i className="fas fa-radiation text-red-500"></i> Risk Distribution
                </h4>
                <div className="space-y-4">
                   {[
                     { label: 'Compute Exhaustion', risk: 'HIGH', color: 'text-red-500' },
                     { label: 'Network Latency', risk: 'STABLE', color: 'text-emerald-500' },
                     { label: 'Cloud Cost Bursting', risk: 'MEDIUM', color: 'text-amber-500' }
                   ].map((item, i) => (
                     <div key={i} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
                        <span className="text-xs font-bold text-slate-700">{item.label}</span>
                        <span className={`text-[9px] font-black uppercase ${item.color}`}>{item.risk}</span>
                     </div>
                   ))}
                </div>
             </div>

             <div className="bg-indigo-600 rounded-[2.5rem] p-8 text-white shadow-xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16 group-hover:scale-110 transition-transform"></div>
                <h4 className="text-lg font-black tracking-tight mb-2">Automated Incident Plane</h4>
                <p className="text-indigo-100 text-xs font-medium leading-relaxed mb-6">Connect Nexus directly to PagerDuty or ServiceNow for auto-triage of AI-detected anomalies.</p>
                <button className="w-full py-3 bg-white text-indigo-600 text-[10px] font-black uppercase rounded-xl hover:bg-indigo-50 transition-all">Configure Hand-offs</button>
             </div>
          </aside>
       </div>
    </div>
  );
};

export default OpsCenter;
