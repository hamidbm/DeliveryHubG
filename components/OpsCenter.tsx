
import React, { useState, useEffect } from 'react';
import { Application } from '../types';
import { analyzeOperationsIntelligence } from '../services/geminiService';
import { marked } from 'marked';
import DOMPurify from 'isomorphic-dompurify';

const OpsCenter: React.FC<{ applications: Application[] }> = ({ applications }) => {
  const [insight, setInsight] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const runOpsAnalysis = async () => {
    setLoading(true);
    const result = await analyzeOperationsIntelligence(
      applications.slice(0, 5).map(a => ({ name: a.name, health: a.status.health })),
      [{ cluster: 'K8S-PROD', status: 'Warning', cpu: '92%' }]
    );
    setInsight(result);
    setLoading(false);
  };

  useEffect(() => { runOpsAnalysis(); }, []);

  return (
    <div className="space-y-10 animate-fadeIn">
       <div className="p-10 bg-slate-900 rounded-[3rem] text-white relative overflow-hidden shadow-2xl">
          <div className="relative z-10 space-y-4">
             <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-red-500 animate-ping"></div>
                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-400">Mission Control</span>
             </div>
             <h1 className="text-5xl font-black tracking-tighter">Observability Hub</h1>
             <p className="text-slate-400 font-medium text-xl max-w-2xl">Predictive system health powered by Gemini 3.</p>
          </div>
       </div>

       <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
          <div className="lg:col-span-2 bg-white rounded-[3rem] border border-slate-200 p-10 shadow-sm min-h-[500px]">
             <header className="flex justify-between items-center mb-10">
                <h3 className="text-xl font-black text-slate-800 tracking-tight">AI SRE Insights</h3>
                <button onClick={runOpsAnalysis} className="text-[9px] font-black text-blue-600 uppercase tracking-widest">Refresh Intelligence</button>
             </header>
             <div className="prose prose-slate max-w-none">
                {loading ? <div className="h-4 bg-slate-100 rounded-full w-3/4 animate-pulse"></div> : 
                 <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(marked.parse(insight || '') as string) }} />}
             </div>
          </div>
          <aside className="bg-indigo-600 rounded-[2.5rem] p-8 text-white shadow-xl">
             <h4 className="text-lg font-black tracking-tight mb-4">Incident Plane</h4>
             <p className="text-indigo-100 text-xs font-medium leading-relaxed mb-6">Nexus is monitoring cluster health via Gemini telemetry signatures.</p>
             <button className="w-full py-4 bg-white text-indigo-600 text-[10px] font-black uppercase rounded-2xl">Configure Alerts</button>
          </aside>
       </div>
    </div>
  );
};

export default OpsCenter;
