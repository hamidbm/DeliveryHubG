
import React, { useMemo } from 'react';
import { Application, Bundle } from '../types';
import { LineChart, Line, ResponsiveContainer, YAxis } from 'recharts';

interface ApplicationsProps {
  filterBundle: string;
  applications: Application[];
  bundles: Bundle[];
}

const Applications: React.FC<ApplicationsProps> = ({ filterBundle, applications = [], bundles = [] }) => {
  const filteredApps = filterBundle === 'all' 
    ? (applications || []) 
    : (applications || []).filter(app => String(app.bundleId) === String(filterBundle));

  // Simulate Telemetry for Sparklines
  const getMockTelemetry = (app: Application) => {
    return [
      { v: 10 + Math.random() * 20 }, { v: 15 + Math.random() * 20 },
      { v: 25 + Math.random() * 20 }, { v: 20 + Math.random() * 20 },
      { v: 40 + Math.random() * 40 }, { v: 35 + Math.random() * 20 }
    ];
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Application Inventory</h1>
          <p className="text-slate-500">System of record with real-time APM telemetry.</p>
        </div>
        <div className="flex items-center gap-2 text-[10px] font-black text-emerald-500 uppercase tracking-widest bg-emerald-50 px-4 py-2 rounded-xl border border-emerald-100">
           <div className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></div>
           Live Telemetry Connected
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {(filteredApps || []).map(app => {
          const telemetry = getMockTelemetry(app);
          const lastMetric = telemetry[telemetry.length - 1].v;
          const isCritical = lastMetric > 70;

          return (
            <div key={app._id} className={`bg-white border rounded-[2rem] overflow-hidden hover:shadow-2xl transition-all group relative ${isCritical ? 'border-red-200 ring-4 ring-red-500/5' : 'border-slate-200'}`}>
              
              {isCritical && (
                <div className="absolute top-0 left-0 right-0 h-1 bg-red-500 animate-pulse z-20"></div>
              )}

              <div className="p-8 border-b border-slate-50 relative">
                <div className="flex justify-between items-start mb-6">
                  <div className="flex items-center space-x-4">
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl shadow-inner transition-colors ${isCritical ? 'bg-red-50 text-red-500' : 'bg-slate-50 text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-500'}`}>
                      <i className="fas fa-cube"></i>
                    </div>
                    <div>
                      <h3 className="text-lg font-black text-slate-800 group-hover:text-blue-600 transition-colors">{app.name}</h3>
                      <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">{(bundles || []).find(b => String(b._id) === String(app.bundleId))?.name || 'Unassigned'}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest block mb-1">{app.aid}</span>
                    <HealthBadge health={isCritical ? 'Critical' : app.status.health} />
                  </div>
                </div>

                <div className="h-16 w-full mb-6">
                   <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={telemetry}>
                         <YAxis hide domain={[0, 100]} />
                         <Line type="monotone" dataKey="v" stroke={isCritical ? '#ef4444' : '#3b82f6'} strokeWidth={3} dot={false} animationDuration={1000} />
                      </LineChart>
                   </ResponsiveContainer>
                   <div className="flex justify-between mt-1">
                      <span className="text-[8px] font-black text-slate-300 uppercase">Load Pulse (CPU %)</span>
                      <span className={`text-[10px] font-black ${isCritical ? 'text-red-600 animate-pulse' : 'text-slate-500'}`}>{lastMetric.toFixed(0)}%</span>
                   </div>
                </div>
                
                <p className="text-xs text-slate-400 font-medium line-clamp-2 min-h-[32px]">{app.description || 'No system description provided.'}</p>
              </div>
              
              <div className="p-4 bg-slate-50/50 flex justify-around items-center">
                 <button className="flex flex-col items-center gap-1 group/btn">
                    <div className="w-8 h-8 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-400 group-hover/btn:text-blue-600 group-hover/btn:border-blue-200 transition-all shadow-sm">
                       <i className="fas fa-gauge-high text-xs"></i>
                    </div>
                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-tighter">Observability</span>
                 </button>
                 <button className="flex flex-col items-center gap-1 group/btn">
                    <div className="w-8 h-8 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-400 group-hover/btn:text-emerald-600 group-hover/btn:border-emerald-200 transition-all shadow-sm">
                       <i className="fas fa-network-wired text-xs"></i>
                    </div>
                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-tighter">Infra Node</span>
                 </button>
                 <button className="flex flex-col items-center gap-1 group/btn">
                    <div className="w-8 h-8 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-400 group-hover/btn:text-amber-600 group-hover/btn:border-amber-200 transition-all shadow-sm">
                       <i className="fas fa-code-branch text-xs"></i>
                    </div>
                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-tighter">Releases</span>
                 </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const HealthBadge = ({ health }: any) => {
  const styles: any = {
    Healthy: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    Risk: 'bg-amber-50 text-amber-600 border-amber-100',
    Critical: 'bg-red-50 text-red-600 border-red-100',
  };
  return (
    <span className={`px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-widest border ${styles[health]}`}>
      {health}
    </span>
  );
};

export default Applications;
