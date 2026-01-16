
import React, { useState, useEffect } from 'react';
import { AppInterface, Application } from '../types';

const IntegrationMatrix: React.FC<{ applications: Application[] }> = ({ applications }) => {
  const [interfaces, setInterfaces] = useState<AppInterface[]>([]);
  
  useEffect(() => {
    // Mock Data: Core Banking -> Customer DB Rest link
    if (applications.length > 2) {
      setInterfaces([
        { sourceAppId: applications[0]._id!, targetAppId: applications[1]._id!, type: 'REST', dataCriticality: 'HIGH', status: 'ACTIVE' }
      ]);
    }
  }, [applications]);

  return (
    <div className="bg-white rounded-[3rem] border border-slate-200 p-10 space-y-10 shadow-sm animate-fadeIn">
       <header>
          <h2 className="text-4xl font-black text-slate-900 tracking-tighter uppercase italic">Integration Plane</h2>
          <p className="text-slate-400 font-medium text-lg">Mapping data flows and API contracts between assets.</p>
       </header>

       <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left">
             <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                   <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Interface Node</th>
                   <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Direction</th>
                   <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Protocol</th>
                   <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Data Tier</th>
                   <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Status</th>
                </tr>
             </thead>
             <tbody className="divide-y divide-slate-50">
                {interfaces.map((int, i) => (
                  <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                     <td className="px-8 py-6">
                        <div className="flex items-center gap-3">
                           <span className="font-bold text-slate-800">{applications.find(a => a._id === int.sourceAppId)?.name}</span>
                        </div>
                     </td>
                     <td className="px-8 py-6">
                        <div className="flex items-center gap-2 text-blue-500">
                           <i className="fas fa-arrow-right text-[10px]"></i>
                           <span className="text-xs font-bold text-slate-700">{applications.find(a => a._id === int.targetAppId)?.name}</span>
                        </div>
                     </td>
                     <td className="px-8 py-6">
                        <span className="px-3 py-1 bg-slate-100 text-slate-600 text-[9px] font-black rounded-lg uppercase tracking-widest">{int.type}</span>
                     </td>
                     <td className="px-8 py-6">
                        <span className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${int.dataCriticality === 'HIGH' ? 'bg-red-50 text-red-600' : 'bg-slate-50 text-slate-500'}`}>{int.dataCriticality}</span>
                     </td>
                     <td className="px-8 py-6 text-right">
                        <div className="flex items-center justify-end gap-2 text-emerald-500 font-bold text-xs uppercase italic">
                           <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                           {int.status}
                        </div>
                     </td>
                  </tr>
                ))}
             </tbody>
          </table>
       </div>
    </div>
  );
};

export default IntegrationMatrix;
