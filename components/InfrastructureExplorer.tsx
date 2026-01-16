
import React, { useState, useEffect } from 'react';
import { InfrastructureNode, Application } from '../types';

const InfrastructureExplorer: React.FC<{ applications: Application[] }> = ({ applications }) => {
  const [nodes, setNodes] = useState<InfrastructureNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeProvider, setActiveProvider] = useState<string>('all');

  useEffect(() => {
    // Simulate real-time infra sync
    const mockNodes: InfrastructureNode[] = [
      { _id: 'n1', name: 'K8S-PROD-EASTUS', type: 'K8S_CLUSTER', provider: 'AZURE', region: 'East US', status: 'HEALTHY', cpuUsage: 45, memUsage: 62, appsCount: 12 },
      { _id: 'n2', name: 'VMSS-UAT-EUROPE', type: 'VM_SCALE_SET', provider: 'AWS', region: 'EU West', status: 'WARNING', cpuUsage: 88, memUsage: 70, appsCount: 5 },
      { _id: 'n3', name: 'LMBDA-W-RETAIL', type: 'SERVERLESS_FUNCTION', provider: 'AWS', region: 'US West', status: 'HEALTHY', cpuUsage: 12, memUsage: 8, appsCount: 32 },
      { _id: 'n4', name: 'ORACLE-LEGACY-P1', type: 'DATABASE_INST', provider: 'ON_PREM', region: 'Local DC', status: 'CRITICAL', cpuUsage: 95, memUsage: 98, appsCount: 1 }
    ];
    setTimeout(() => { setNodes(mockNodes); setLoading(false); }, 800);
  }, []);

  const filteredNodes = activeProvider === 'all' ? nodes : nodes.filter(n => n.provider === activeProvider);

  return (
    <div className="space-y-10 animate-fadeIn bg-white rounded-[3rem] border border-slate-200 p-10 shadow-2xl">
       <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-8">
          <div>
             <h2 className="text-4xl font-black text-slate-900 tracking-tighter italic uppercase">Infrastructure Topology</h2>
             <p className="text-slate-400 font-medium text-lg">Physical and virtual execution nodes across global regions.</p>
          </div>
          <div className="flex bg-slate-50 p-1.5 rounded-2xl border border-slate-100 shadow-inner">
             {['all', 'AZURE', 'AWS', 'GCP', 'ON_PREM'].map(p => (
               <button 
                key={p} 
                onClick={() => setActiveProvider(p)}
                className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                  activeProvider === p ? 'bg-white shadow-lg text-blue-600' : 'text-slate-400 hover:text-slate-600'
                }`}
               >
                 {p}
               </button>
             ))}
          </div>
       </header>

       <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
          {loading ? [...Array(4)].map((_, i) => <div key={i} className="h-80 bg-slate-50 rounded-[2.5rem] animate-pulse"></div>) : 
           filteredNodes.map(node => (
             <div key={node._id} className={`p-8 rounded-[2.5rem] border transition-all hover:shadow-2xl flex flex-col relative overflow-hidden group ${
               node.status === 'HEALTHY' ? 'bg-white border-slate-100' : 
               node.status === 'WARNING' ? 'bg-amber-50 border-amber-200 ring-2 ring-amber-500/5' : 
               'bg-red-50 border-red-200 ring-4 ring-red-500/5'
             }`}>
                {node.status !== 'HEALTHY' && (
                  <div className="absolute top-0 right-0 px-6 py-2 bg-slate-900 text-white text-[8px] font-black uppercase tracking-widest rounded-bl-3xl">
                     <i className="fas fa-biohazard mr-2 text-red-500"></i> {node.status} Node
                  </div>
                )}

                <div className="flex items-center gap-4 mb-8">
                   <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-xl shadow-lg ${
                     node.provider === 'AZURE' ? 'bg-blue-600 text-white' : 
                     node.provider === 'AWS' ? 'bg-orange-500 text-white' : 'bg-slate-900 text-white'
                   }`}>
                      <i className={`fas ${
                        node.type === 'K8S_CLUSTER' ? 'fa-dharmachakra' : 
                        node.type === 'DATABASE_INST' ? 'fa-database' : 'fa-server'
                      }`}></i>
                   </div>
                   <div>
                      <h4 className="text-lg font-black text-slate-800 truncate tracking-tight">{node.name}</h4>
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{node.region}</span>
                   </div>
                </div>

                <div className="space-y-6 flex-1">
                   <div className="space-y-2">
                      <div className="flex justify-between text-[9px] font-black uppercase tracking-widest">
                         <span className="text-slate-400">Compute Load</span>
                         <span className={node.cpuUsage > 80 ? 'text-red-500' : 'text-slate-600'}>{node.cpuUsage}%</span>
                      </div>
                      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                         <div className={`h-full transition-all duration-1000 ${node.cpuUsage > 80 ? 'bg-red-500' : 'bg-blue-600'}`} style={{ width: `${node.cpuUsage}%` }} />
                      </div>
                   </div>
                   <div className="space-y-2">
                      <div className="flex justify-between text-[9px] font-black uppercase tracking-widest">
                         <span className="text-slate-400">Memory Pressure</span>
                         <span className={node.memUsage > 80 ? 'text-red-500' : 'text-slate-600'}>{node.memUsage}%</span>
                      </div>
                      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                         <div className={`h-full transition-all duration-1000 ${node.memUsage > 80 ? 'bg-red-500' : 'bg-emerald-500'}`} style={{ width: `${node.memUsage}%` }} />
                      </div>
                   </div>
                </div>

                <div className="pt-8 mt-8 border-t border-slate-50 flex items-center justify-between">
                   <div className="flex items-center gap-2">
                      <div className="flex -space-x-1.5">
                         {[...Array(3)].map((_, i) => <div key={i} className="w-5 h-5 rounded-full border-2 border-white bg-slate-100" />)}
                      </div>
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">+{node.appsCount} Assets</span>
                   </div>
                   <button className="text-[9px] font-black text-blue-600 hover:underline uppercase tracking-widest">Map Node</button>
                </div>
             </div>
           ))}
       </div>
    </div>
  );
};

export default InfrastructureExplorer;
