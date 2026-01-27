
import React, { useState, useMemo } from 'react';
import { Application, TimeModelStatus, Bundle } from '../types';

interface PortfolioStrategyProps {
  applications: Application[];
  bundles?: Bundle[];
  onUpdate?: () => void;
}

const PortfolioStrategy: React.FC<PortfolioStrategyProps> = ({ applications, bundles = [], onUpdate }) => {
  const [selectedApp, setSelectedApp] = useState<Application | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiJustification, setAiJustification] = useState<string | null>(null);
  const [filterBundleId, setFilterBundleId] = useState<string>('all');

  const filteredApps = useMemo(() => {
    if (filterBundleId === 'all') return applications;
    return applications.filter(a => a.bundleId === filterBundleId);
  }, [applications, filterBundleId]);

  const stats = useMemo(() => {
    const total = filteredApps.length;
    const eliminated = filteredApps.filter(a => a.lifecycle?.timeStatus === TimeModelStatus.ELIMINATE).length;
    const critical = filteredApps.filter(a => a.status.health === 'Critical').length;
    return {
      reductionTarget: total > 0 ? Math.round((eliminated / total) * 100) : 0,
      riskConcentration: total > 0 ? Math.round((critical / total) * 100) : 0,
      mappedCount: filteredApps.filter(a => a.lifecycle?.timeStatus).length
    };
  }, [filteredApps]);

  const quadrants = [
    { 
      id: TimeModelStatus.INVEST, 
      label: 'Invest', 
      desc: 'High Value, High Technical Fit',
      color: 'emerald',
      icon: 'fa-arrow-trend-up',
      position: 'top-right'
    },
    { 
      id: TimeModelStatus.MIGRATE, 
      label: 'Migrate', 
      desc: 'High Value, Low Technical Fit',
      color: 'amber',
      icon: 'fa-shuffle',
      position: 'top-left'
    },
    { 
      id: TimeModelStatus.TOLERATE, 
      label: 'Tolerate', 
      desc: 'Low Value, High Technical Fit',
      color: 'blue',
      icon: 'fa-clock',
      position: 'bottom-right'
    },
    { 
      id: TimeModelStatus.ELIMINATE, 
      label: 'Eliminate', 
      desc: 'Low Value, Low Technical Fit',
      color: 'red',
      icon: 'fa-trash-can',
      position: 'bottom-left'
    }
  ];

  const handleUpdateLifecycle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedApp?._id) return;

    setIsUpdating(true);
    try {
      const res = await fetch(`/api/applications/${selectedApp._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lifecycle: selectedApp.lifecycle })
      });
      if (res.ok) {
        setSelectedApp(null);
        setAiJustification(null);
        if (onUpdate) onUpdate();
      }
    } finally {
      setIsUpdating(false);
    }
  };

  const runAiAdvisor = async () => {
    if (!selectedApp) return;
    setIsAiLoading(true);
    setAiJustification(null);
    try {
      const res = await fetch('/api/ai/rationalize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(selectedApp)
      });
      const data = await res.json();
      if (data.recommendation) {
        setSelectedApp({
          ...selectedApp,
          lifecycle: { ...selectedApp.lifecycle!, timeStatus: data.recommendation as TimeModelStatus }
        });
        setAiJustification(data.justification);
      }
    } finally {
      setIsAiLoading(false);
    }
  };

  const getQuadrantApps = (status: TimeModelStatus) => {
    return filteredApps.filter(a => a.lifecycle?.timeStatus === status);
  };

  const unmappedApps = filteredApps.filter(a => !a.lifecycle?.timeStatus);

  return (
    <div className="space-y-10 animate-fadeIn min-h-[800px]">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h2 className="text-4xl font-black text-slate-900 tracking-tighter uppercase italic">Portfolio Rationalization</h2>
          <p className="text-slate-400 font-medium text-lg">The TIME Framework: Managing technology fit vs. business value.</p>
        </div>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-10 bg-white border border-slate-200 px-8 py-3 rounded-[1.5rem] shadow-sm">
             <div className="text-center">
                <span className="text-[8px] font-black text-slate-300 uppercase block mb-0.5">Footprint Reduction</span>
                <span className="text-lg font-black text-red-600">{stats.reductionTarget}%</span>
             </div>
             <div className="text-center">
                <span className="text-[8px] font-black text-slate-300 uppercase block mb-0.5">Risk Concentration</span>
                <span className="text-lg font-black text-amber-500">{stats.riskConcentration}%</span>
             </div>
             <div className="text-center">
                <span className="text-[8px] font-black text-slate-300 uppercase block mb-0.5">Matrix Mapping</span>
                <span className="text-lg font-black text-blue-600">{stats.mappedCount}/{filteredApps.length}</span>
             </div>
          </div>
          <select 
            value={filterBundleId} 
            onChange={(e) => setFilterBundleId(e.target.value)}
            className="bg-white border border-slate-200 rounded-2xl px-6 py-4 text-[10px] font-black uppercase tracking-widest outline-none focus:ring-4 focus:ring-blue-500/10 transition-all shadow-sm h-full"
          >
            <option value="all">Enterprise Portfolio</option>
            {bundles.map(b => <option key={b._id} value={b._id}>{b.name}</option>)}
          </select>
        </div>
      </header>

      {/* 2x2 Matrix */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 relative bg-slate-50/50 p-8 rounded-[3.5rem] border border-slate-100">
        <div className="absolute left-0 top-1/2 -translate-y-1/2 -rotate-90 hidden xl:block z-0">
           <span className="text-[10px] font-black text-slate-300 uppercase tracking-[0.5em]">Business Value →</span>
        </div>
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 hidden xl:block mb-4 z-0">
           <span className="text-[10px] font-black text-slate-300 uppercase tracking-[0.5em]">Technical Fit →</span>
        </div>

        {quadrants.map(q => (
          <div 
            key={q.id} 
            className={`min-h-[400px] bg-white rounded-[2.5rem] border border-slate-200 p-8 flex flex-col shadow-sm hover:shadow-xl transition-all group relative overflow-hidden`}
          >
            <div className={`absolute top-0 right-0 w-32 h-32 bg-${q.color}-500/5 rounded-full -mr-16 -mt-16 group-hover:scale-110 transition-transform duration-700`}></div>
            
            <header className="flex justify-between items-start mb-8 relative z-10">
               <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-2xl bg-${q.color}-50 text-${q.color}-600 flex items-center justify-center text-xl shadow-inner`}>
                    <i className={`fas ${q.icon}`}></i>
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-slate-800 tracking-tight">{q.label}</h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{q.desc}</p>
                  </div>
               </div>
               <span className={`px-4 py-1 rounded-full bg-${q.color}-50 text-${q.color}-600 text-[10px] font-black uppercase tracking-widest`}>
                 {getQuadrantApps(q.id).length} Apps
               </span>
            </header>

            <div className="flex-1 space-y-3 relative z-10 overflow-y-auto max-h-[350px] custom-scrollbar pr-2">
               {getQuadrantApps(q.id).map(app => (
                 <button 
                  key={app._id} 
                  onClick={() => setSelectedApp(app)}
                  className="w-full flex items-center justify-between p-4 bg-slate-50 border border-slate-100 rounded-2xl hover:bg-white hover:shadow-lg hover:border-blue-200 transition-all group/item text-left"
                 >
                    <div className="min-w-0 flex items-center gap-3">
                       <div className={`w-2 h-2 rounded-full shrink-0 ${
                         app.status.health === 'Healthy' ? 'bg-emerald-500' :
                         app.status.health === 'Risk' ? 'bg-amber-500' : 'bg-red-500 animate-pulse'
                       }`}></div>
                       <div className="min-w-0">
                          <p className="text-sm font-black text-slate-700 truncate">{app.name}</p>
                          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{app.aid}</p>
                       </div>
                    </div>
                    <i className="fas fa-arrow-right text-[10px] text-slate-300 group-hover/item:text-blue-500 group-hover/item:translate-x-1 transition-all"></i>
                 </button>
               ))}
               {getQuadrantApps(q.id).length === 0 && (
                 <div className="h-full flex flex-col items-center justify-center py-20 text-slate-200">
                    <i className="fas fa-ghost text-4xl mb-4 opacity-20"></i>
                    <p className="text-[10px] font-black uppercase tracking-widest">No candidates staged</p>
                 </div>
               )}
            </div>
          </div>
        ))}
      </div>

      {/* Unmapped Queue */}
      <section className="bg-white rounded-[3rem] border border-slate-200 p-10 shadow-sm overflow-hidden">
        <header className="flex justify-between items-center mb-8">
           <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-lg shadow-black/10">
                 <i className="fas fa-inbox"></i>
              </div>
              <div>
                <h4 className="text-xl font-black text-slate-800 tracking-tight">Triage Queue</h4>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Applications awaiting lifecycle categorization</p>
              </div>
           </div>
           <span className="px-6 py-2 bg-slate-50 text-slate-500 rounded-full text-[10px] font-black uppercase tracking-widest border border-slate-100">
             {unmappedApps.length} Unmapped Assets
           </span>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
           {unmappedApps.map(app => (
             <button 
              key={app._id} 
              onClick={() => setSelectedApp(app)}
              className="flex items-center gap-4 p-5 bg-slate-50 border border-slate-100 rounded-[2rem] hover:bg-white hover:shadow-xl transition-all group"
             >
                <div className={`w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow-sm border border-slate-100 transition-colors ${
                  app.status.health === 'Healthy' ? 'text-emerald-500' : app.status.health === 'Risk' ? 'text-amber-500' : 'text-red-500'
                }`}>
                   <i className="fas fa-cube text-sm"></i>
                </div>
                <div className="text-left min-w-0">
                   <p className="text-xs font-black text-slate-700 truncate">{app.name}</p>
                   <p className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter">{app.aid}</p>
                </div>
             </button>
           ))}
           {unmappedApps.length === 0 && (
             <div className="col-span-full py-12 text-center text-slate-300 italic text-sm">
                Queue cleared. All assets are mapped to the rationalization matrix.
             </div>
           )}
        </div>
      </section>

      {/* Lifecycle Modal */}
      {selectedApp && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-md z-[500] flex items-center justify-center p-6">
          <div className="bg-white rounded-[3.5rem] w-full max-w-2xl p-12 shadow-2xl animate-fadeIn border border-slate-100 relative max-h-[90vh] overflow-y-auto custom-scrollbar">
            <button 
              onClick={() => { setSelectedApp(null); setAiJustification(null); }} 
              className="absolute top-10 right-10 w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 hover:text-red-500 transition-colors"
            >
              <i className="fas fa-times"></i>
            </button>
            
            <header className="mb-12">
              <div className="flex items-center justify-between mb-4">
                 <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-[1.5rem] bg-blue-600 text-white flex items-center justify-center text-2xl shadow-xl shadow-blue-500/20">
                       <i className="fas fa-rocket"></i>
                    </div>
                    <div>
                       <h3 className="text-3xl font-black text-slate-900 tracking-tight">{selectedApp.name}</h3>
                       <p className="text-[11px] font-black text-blue-500 uppercase tracking-[0.2em]">{selectedApp.aid} • System Node</p>
                    </div>
                 </div>
                 <button 
                  type="button"
                  onClick={runAiAdvisor}
                  disabled={isAiLoading}
                  className="px-6 py-2.5 bg-slate-900 text-white text-[9px] font-black uppercase rounded-xl hover:bg-blue-600 transition-all flex items-center gap-2 shadow-xl"
                 >
                    {isAiLoading ? <i className="fas fa-circle-notch fa-spin"></i> : <i className="fas fa-brain"></i>}
                    Ask Gemini
                 </button>
              </div>

              {aiJustification && (
                <div className="bg-blue-900 p-6 rounded-[2rem] text-blue-50 border border-blue-800 shadow-2xl relative overflow-hidden animate-slideUp mb-8">
                   <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16"></div>
                   <div className="relative z-10">
                      <div className="flex items-center gap-2 mb-2">
                         <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse"></div>
                         <span className="text-[9px] font-black uppercase tracking-widest">AI Rationalization Reason</span>
                      </div>
                      <p className="text-sm font-medium leading-relaxed italic">"{aiJustification}"</p>
                   </div>
                </div>
              )}

              <p className="text-slate-400 text-sm font-medium leading-relaxed">Assign the lifecycle status and strategic intent for this application within the enterprise portfolio.</p>
            </header>

            <form onSubmit={handleUpdateLifecycle} className="space-y-10">
              <section className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Rationalization Strategy (TIME)</label>
                  <div className="grid grid-cols-2 gap-3">
                     {quadrants.map(q => (
                       <button
                         key={q.id}
                         type="button"
                         onClick={() => setSelectedApp({
                           ...selectedApp, 
                           lifecycle: { ...selectedApp.lifecycle!, timeStatus: q.id }
                         })}
                         className={`p-6 rounded-[2rem] border-2 transition-all text-left flex flex-col gap-2 ${
                           selectedApp.lifecycle?.timeStatus === q.id 
                           ? `bg-${q.color}-50 border-${q.color}-200 shadow-lg shadow-${q.color}-500/5` 
                           : 'bg-white border-slate-100 hover:border-slate-200'
                         }`}
                       >
                          <div className="flex items-center justify-between">
                            <span className={`text-xs font-black uppercase tracking-widest ${selectedApp.lifecycle?.timeStatus === q.id ? `text-${q.color}-600` : 'text-slate-400'}`}>{q.label}</span>
                            {selectedApp.lifecycle?.timeStatus === q.id && <i className={`fas fa-check-circle text-${q.color}-600`}></i>}
                          </div>
                          <p className="text-[10px] font-medium text-slate-400 leading-tight">{q.desc}</p>
                       </button>
                     ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-8 pt-6 border-t border-slate-50">
                   <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Business Criticality</label>
                      <select 
                        value={selectedApp.lifecycle?.businessCriticality || 'SUPPORT'}
                        onChange={(e) => setSelectedApp({
                          ...selectedApp,
                          lifecycle: { ...selectedApp.lifecycle!, businessCriticality: e.target.value as any }
                        })}
                        className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 text-sm font-bold text-slate-700 outline-none focus:border-blue-500 transition-all appearance-none"
                      >
                         <option value="MISSION_CRITICAL">Mission Critical</option>
                         <option value="BUSINESS_CRITICAL">Business Business Critical</option>
                         <option value="SUPPORT">Support / Utility</option>
                      </select>
                   </div>
                   <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Planned Sunset</label>
                      <input 
                        type="date"
                        value={selectedApp.lifecycle?.sunsetDate || ''}
                        onChange={(e) => setSelectedApp({
                          ...selectedApp,
                          lifecycle: { ...selectedApp.lifecycle!, sunsetDate: e.target.value }
                        })}
                        className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 text-sm font-bold text-slate-700 outline-none focus:border-blue-500 transition-all"
                      />
                   </div>
                </div>
              </section>

              <footer className="pt-8 flex gap-4">
                <button type="button" onClick={() => { setSelectedApp(null); setAiJustification(null); }} className="flex-1 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-900 transition-colors">Discard changes</button>
                <button 
                  type="submit" 
                  disabled={isUpdating}
                  className="flex-[2] py-5 bg-slate-900 text-white text-[10px] font-black rounded-[1.5rem] shadow-2xl hover:bg-blue-600 transition-all uppercase tracking-widest flex items-center justify-center gap-2"
                >
                  {isUpdating ? <i className="fas fa-circle-notch fa-spin"></i> : <i className="fas fa-shield-halved"></i>}
                  Commit Lifecycle Node
                </button>
              </footer>
            </form>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
        
        .text-emerald-600 { color: #059669; }
        .bg-emerald-50 { background-color: #ecfdf5; }
        .border-emerald-200 { border-color: #a7f3d0; }
        
        .text-amber-600 { color: #d97706; }
        .bg-amber-50 { background-color: #fffbeb; }
        .border-amber-200 { border-color: #fde68a; }
        
        .text-blue-600 { color: #2563eb; }
        .bg-blue-50 { background-color: #eff6ff; }
        .border-blue-200 { border-color: #bfdbfe; }
        
        .text-red-600 { color: #dc2626; }
        .bg-red-50 { background-color: #fef2f2; }
        .border-red-200 { border-color: #fecaca; }
      `}} />
    </div>
  );
};

export default PortfolioStrategy;
