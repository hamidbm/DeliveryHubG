
import React, { useState, useEffect } from 'react';
import { InfrastructureNode, Application } from '../types';

const InfrastructureExplorer: React.FC<{ applications: Application[] }> = ({ applications }) => {
  const [nodes, setNodes] = useState<InfrastructureNode[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const mockNodes: InfrastructureNode[] = [
      { _id: 'n1', name: 'K8S-PROD-EAST', type: 'K8S_CLUSTER', provider: 'AZURE', region: 'East US', status: 'HEALTHY', cpuUsage: 45, memUsage: 62, appsCount: 12 },
      { _id: 'n2', name: 'VMSS-UAT-EU', type: 'VM_SCALE_SET', provider: 'AWS', region: 'EU West', status: 'WARNING', cpuUsage: 88, memUsage: 70, appsCount: 5 },
      { _id: 'n3', name: 'DB-LEGACY-01', type: 'DATABASE_INST', provider: 'ON_PREM', region: 'Local DC', status: 'CRITICAL', cpuUsage: 95, memUsage: 98, appsCount: 1 }
    ];
    setTimeout(() => { setNodes(mockNodes); setLoading(false); }, 800);
  }, []);

  return (
    <div className="space-y-10 animate-fadeIn bg-white rounded-[3rem] border border-slate-200 p-10 shadow-2xl">
       <header>
          <h2 className="text-4xl font-black text-slate-900 tracking-tighter uppercase italic">Infrastructure Topology</h2>
          <p className="text-slate-400 font-medium text-lg">Physical and virtual execution nodes across global regions.</p>
       </header>

       <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {loading ? [1, 2, 3].map(i => <div key={i} className="h-64 bg-slate-100 rounded-[2.5rem] animate-pulse"></div>) : 
           nodes.map(node => (
             <div key={node._id} className={`p-8 rounded-[2.5rem] border transition-all hover:shadow-2xl flex flex-col ${
               node.status === 'HEALTHY' ? 'bg-white border-slate-100' : 
               node.status === 'WARNING' ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200'
             }`}>
                <div className="flex items-center gap-4 mb-8">
                   <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-xl shadow-lg ${
                     node.provider === 'AZURE' ? 'bg-blue-600 text-white' : 'bg-slate-900 text-white'
                   }`}>
                      <i className={`fas ${node.type === 'K8S_CLUSTER' ? 'fa-dharmachakra' : 'fa-server'}`}></i>
                   </div>
                   <div>
                      <h4 className="text-lg font-black text-slate-800">{node.name}</h4>
                      <span className="text-[9px] font-black text-slate-400 uppercase">{node.region}</span>
                   </div>
                </div>
                <div className="space-y-6 flex-1">
                   <div className="space-y-2">
                      <div className="flex justify-between text-[9px] font-black uppercase">
                         <span className="text-slate-400">CPU Load</span>
                         <span className={node.cpuUsage > 80 ? 'text-red-500' : 'text-slate-600'}>{node.cpuUsage}%</span>
                      </div>
                      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                         <div className={`h-full transition-all duration-1000 ${node.cpuUsage > 80 ? 'bg-red-500' : 'bg-blue-600'}`} style={{ width: `${node.cpuUsage}%` }} />
                      </div>
                   </div>
                </div>
                <div className="pt-8 mt-8 border-t border-slate-50 flex items-center justify-between">
                   <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">{node.appsCount} Active Assets</span>
                   <button className="text-[9px] font-black text-blue-600 hover:underline uppercase">Map Node</button>
                </div>
             </div>
           ))}
       </div>
    </div>
  );
};

export default InfrastructureExplorer;
