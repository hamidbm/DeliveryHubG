
import React from 'react';
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

  const getMockTelemetry = (app: Application) => {
    return [
      { v: 10 + Math.random() * 20 }, { v: 15 + Math.random() * 20 },
      { v: 25 + Math.random() * 20 }, { v: 20 + Math.random() * 20 },
      { v: 40 + Math.random() * 40 }, { v: 35 + Math.random() * 20 }
    ];
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tighter">System Registry</h1>
          <p className="text-slate-500 font-medium">Enterprise assets with real-time APM signatures.</p>
        </div>
        <div className="flex items-center gap-2 text-[10px] font-black text-emerald-500 uppercase tracking-widest bg-emerald-50 px-5 py-3 rounded-2xl border border-emerald-100">
           <div className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></div>
           Gateway Sync: Connected
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {(filteredApps || []).map(app => {
          const telemetry = getMockTelemetry(app);
          const lastMetric = telemetry[telemetry.length - 1].v;
          const isCritical = lastMetric > 70;

          return (
            <div key={app._id} className={`bg-white border rounded-[2.5rem] overflow-hidden hover:shadow-2xl transition-all group relative ${isCritical ? 'border-red-200 ring-4 ring-red-500/5' : 'border-slate-200'}`}>
              <div className="p-8 border-b border-slate-50">
                <div className="flex justify-between items-start mb-6">
                  <div className="flex items-center gap-4">
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl shadow-inner ${isCritical ? 'bg-red-50 text-red-500' : 'bg-slate-50 text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-500'}`}>
                      <i className="fas fa-cube"></i>
                    </div>
                    <div>
                      <h3 className="text-lg font-black text-slate-800 group-hover:text-blue-600 transition-colors">{app.name}</h3>
                      <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">{app.aid}</p>
                    </div>
                  </div>
                  <div className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest border ${isCritical ? 'bg-red-50 text-red-600 border-red-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100'}`}>
                    {isCritical ? 'Critical' : 'Healthy'}
                  </div>
                </div>

                <div className="h-20 w-full mb-6">
                   <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={telemetry}>
                         <YAxis hide domain={[0, 100]} />
                         <Line type="monotone" dataKey="v" stroke={isCritical ? '#ef4444' : '#3b82f6'} strokeWidth={3} dot={false} />
                      </LineChart>
                   </ResponsiveContainer>
                </div>
                
                <p className="text-xs text-slate-400 font-medium line-clamp-2 min-h-[32px]">{app.description}</p>
              </div>
              <div className="p-4 bg-slate-50/50 flex justify-around">
                 <button className="text-[9px] font-black text-slate-400 uppercase hover:text-blue-600 transition-colors">Observability</button>
                 <button className="text-[9px] font-black text-slate-400 uppercase hover:text-emerald-600 transition-colors">Infra Node</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Applications;
