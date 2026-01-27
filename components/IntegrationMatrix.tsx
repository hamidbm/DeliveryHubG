
import React, { useState, useEffect, useMemo } from 'react';
import { AppInterface, Application } from '../types';

const IntegrationMatrix: React.FC<{ applications: Application[] }> = ({ applications }) => {
  const [interfaces, setInterfaces] = useState<AppInterface[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingInterface, setEditingInterface] = useState<Partial<AppInterface> | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchInterfacesData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/architecture/integrations');
      const data = await res.json();
      setInterfaces(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInterfacesData();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingInterface?.sourceAppId || !editingInterface?.targetAppId) {
      alert("Source and Target nodes are mandatory.");
      return;
    }
    const res = await fetch('/api/architecture/integrations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editingInterface)
    });
    if (res.ok) {
      setIsModalOpen(false);
      fetchInterfacesData();
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Permanently sever this integration link in the registry?")) return;
    await fetch(`/api/architecture/integrations/${id}`, { method: 'DELETE' });
    fetchInterfacesData();
  };

  const filteredInterfaces = useMemo(() => {
    if (!searchQuery.trim()) return interfaces;
    const q = searchQuery.toLowerCase();
    return interfaces.filter(int => {
      const source = applications.find(a => a._id === int.sourceAppId)?.name.toLowerCase() || '';
      const target = applications.find(a => a._id === int.targetAppId)?.name.toLowerCase() || '';
      return source.includes(q) || target.includes(q) || int.type.toLowerCase().includes(q);
    });
  }, [interfaces, applications, searchQuery]);

  const getProtocolIcon = (type: string) => {
    switch (type) {
      case 'REST': return 'fa-globe text-blue-500';
      case 'SOAP': return 'fa-envelope text-indigo-500';
      case 'KAFKA': return 'fa-bolt text-amber-500';
      case 'DB_LINK': return 'fa-database text-emerald-500';
      case 'FILE': return 'fa-file-export text-slate-500';
      default: return 'fa-network-wired text-slate-300';
    }
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h2 className="text-4xl font-black text-slate-900 tracking-tighter uppercase italic">Integration Matrix</h2>
          <p className="text-slate-400 font-medium text-lg">System-to-system interfaces, API contracts, and data lineage.</p>
        </div>
        <div className="flex gap-3">
          <div className="relative">
            <i className="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 text-sm"></i>
            <input 
              type="text" 
              placeholder="Search contracts..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-white border border-slate-200 rounded-2xl pl-12 pr-6 py-3 text-sm font-bold focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none w-64 transition-all"
            />
          </div>
          <button 
            onClick={() => { 
              setEditingInterface({ type: 'REST', dataCriticality: 'MEDIUM', status: 'ACTIVE' }); 
              setIsModalOpen(true); 
            }}
            className="px-8 py-3 bg-slate-900 text-white text-[10px] font-black rounded-2xl shadow-xl hover:bg-blue-600 transition-all uppercase tracking-widest flex items-center gap-2"
          >
            + Map Interface
          </button>
        </div>
      </header>

      <div className="bg-white rounded-[3rem] border border-slate-200 overflow-hidden shadow-sm">
        <table className="w-full text-left">
          <thead className="bg-slate-50 border-b border-slate-100">
            <tr>
              <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Interface Topology</th>
              <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Protocol</th>
              <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Data Tier</th>
              <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Health</th>
              <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {loading ? (
              [1, 2, 3].map(i => (
                <tr key={i} className="animate-pulse">
                  <td colSpan={5} className="px-10 py-8"><div className="h-10 bg-slate-100 rounded-2xl w-full"></div></td>
                </tr>
              ))
            ) : filteredInterfaces.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-10 py-20 text-center">
                   <i className="fas fa-network-wired text-6xl text-slate-100 mb-6"></i>
                   <p className="text-slate-400 font-black uppercase tracking-widest">No active interfaces found</p>
                </td>
              </tr>
            ) : filteredInterfaces.map((int) => {
              const source = applications.find(a => a._id === int.sourceAppId);
              const target = applications.find(a => a._id === int.targetAppId);
              return (
                <tr key={int._id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-10 py-8">
                    <div className="flex items-center gap-6">
                       <div className="flex flex-col min-w-[140px]">
                          <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-1">Source Node</span>
                          <span className="text-sm font-black text-slate-800">{source?.name || 'Unknown'}</span>
                       </div>
                       <div className="w-10 h-[2px] bg-slate-200 relative flex items-center justify-center">
                          <i className="fas fa-chevron-right text-[10px] text-slate-300 absolute -right-1"></i>
                       </div>
                       <div className="flex flex-col min-w-[140px]">
                          <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-1">Target Node</span>
                          <span className="text-sm font-black text-slate-800">{target?.name || 'Unknown'}</span>
                       </div>
                    </div>
                  </td>
                  <td className="px-8 py-8">
                    <div className="flex items-center gap-3">
                       <i className={`fas ${getProtocolIcon(int.type)} text-lg opacity-40`}></i>
                       <span className="px-3 py-1 bg-slate-100 text-slate-600 text-[9px] font-black rounded-lg uppercase tracking-widest border border-slate-200">
                         {int.type}
                       </span>
                    </div>
                  </td>
                  <td className="px-8 py-8">
                    <span className={`px-4 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest border ${
                      int.dataCriticality === 'HIGH' ? 'bg-red-50 text-red-600 border-red-100 shadow-sm' : 
                      int.dataCriticality === 'MEDIUM' ? 'bg-blue-50 text-blue-600 border-blue-100' : 
                      'bg-slate-50 text-slate-500 border-slate-100'
                    }`}>
                      {int.dataCriticality}
                    </span>
                  </td>
                  <td className="px-8 py-8 text-center">
                    <div className="flex flex-col items-center gap-1">
                       <div className={`w-2 h-2 rounded-full ${
                         int.status === 'ACTIVE' ? 'bg-emerald-500 animate-pulse' : 
                         int.status === 'PLANNED' ? 'bg-amber-400' : 'bg-slate-300'
                       }`}></div>
                       <span className="text-[8px] font-black text-slate-400 uppercase tracking-tighter">{int.status}</span>
                    </div>
                  </td>
                  <td className="px-10 py-8 text-right">
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                       <button onClick={() => { setEditingInterface(int); setIsModalOpen(true); }} className="w-9 h-9 rounded-xl bg-white border border-slate-200 text-slate-400 hover:text-blue-600 hover:border-blue-300 transition-all shadow-sm flex items-center justify-center"><i className="fas fa-pen text-xs"></i></button>
                       <button onClick={() => handleDelete(int._id!)} className="w-9 h-9 rounded-xl bg-white border border-slate-200 text-slate-400 hover:text-red-500 hover:border-red-300 transition-all shadow-sm flex items-center justify-center"><i className="fas fa-trash text-xs"></i></button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-md z-[500] flex items-center justify-center p-6">
          <div className="bg-white rounded-[3rem] w-full max-w-2xl p-12 shadow-2xl animate-fadeIn border border-slate-100 relative">
            <button onClick={() => setIsModalOpen(false)} className="absolute top-8 right-8 w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 hover:text-red-500 transition-colors">
              <i className="fas fa-times"></i>
            </button>
            
            <header className="mb-10">
              <h3 className="text-3xl font-black text-slate-900 tracking-tight italic">Interface Configuration</h3>
              <p className="text-slate-400 text-sm font-medium mt-1">Define the logical relationship and technical protocol between nodes.</p>
            </header>

            <form onSubmit={handleSave} className="space-y-8">
              <div className="grid grid-cols-2 gap-8">
                 <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Source (Upstream)</label>
                    <select 
                      required 
                      value={editingInterface?.sourceAppId || ''} 
                      onChange={(e) => setEditingInterface({...editingInterface, sourceAppId: e.target.value})}
                      className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 text-slate-700 font-bold outline-none focus:border-blue-500 transition-all"
                    >
                      <option value="">Select App...</option>
                      {applications.map(a => <option key={a._id} value={a._id}>{a.name}</option>)}
                    </select>
                 </div>
                 <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Target (Downstream)</label>
                    <select 
                      required 
                      value={editingInterface?.targetAppId || ''} 
                      onChange={(e) => setEditingInterface({...editingInterface, targetAppId: e.target.value})}
                      className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 text-slate-700 font-bold outline-none focus:border-emerald-500 transition-all"
                    >
                      <option value="">Select App...</option>
                      {applications.map(a => <option key={a._id} value={a._id}>{a.name}</option>)}
                    </select>
                 </div>
              </div>

              <div className="grid grid-cols-2 gap-8">
                 <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Exchange Protocol</label>
                    <select 
                      value={editingInterface?.type} 
                      onChange={(e) => setEditingInterface({...editingInterface, type: e.target.value as any})}
                      className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 text-slate-700 font-bold outline-none focus:border-blue-500 transition-all"
                    >
                      <option value="REST">REST API</option>
                      <option value="SOAP">SOAP Web Service</option>
                      <option value="KAFKA">Kafka / Event Bus</option>
                      <option value="DB_LINK">Database Link / ETL</option>
                      <option value="FILE">Flat File Exchange</option>
                    </select>
                 </div>
                 <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Data Criticality</label>
                    <select 
                      value={editingInterface?.dataCriticality} 
                      onChange={(e) => setEditingInterface({...editingInterface, dataCriticality: e.target.value as any})}
                      className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 text-slate-700 font-bold outline-none focus:border-blue-500 transition-all"
                    >
                      <option value="LOW">Low Risk (Public/Internal)</option>
                      <option value="MEDIUM">Medium Risk (Business Value)</option>
                      <option value="HIGH">High Risk (PII / Financial)</option>
                    </select>
                 </div>
              </div>

              <div className="space-y-2">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Operational Lifecycle</label>
                 <div className="flex bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
                    {['PLANNED', 'ACTIVE', 'DEPRECATED'].map(st => (
                      <button 
                        key={st}
                        type="button"
                        onClick={() => setEditingInterface({...editingInterface, status: st as any})}
                        className={`flex-1 py-3 text-[10px] font-black uppercase rounded-xl transition-all ${
                          editingInterface?.status === st ? 'bg-white text-blue-600 shadow-md' : 'text-slate-400'
                        }`}
                      >
                        {st}
                      </button>
                    ))}
                 </div>
              </div>

              <footer className="pt-10 flex gap-4">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-900 transition-colors">Discard</button>
                <button type="submit" className="flex-[2] py-4 bg-slate-900 text-white text-[10px] font-black rounded-2xl shadow-2xl hover:bg-blue-600 transition-all uppercase tracking-widest">Commit Interface</button>
              </footer>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default IntegrationMatrix;
