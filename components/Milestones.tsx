
import React, { useState, useEffect, useMemo } from 'react';
import { Milestone, MilestoneStatus, Application, Bundle, WorkItem, WorkItemStatus } from '../types';

interface MilestonesProps {
  applications: Application[];
  bundles: Bundle[];
  activeBundleId?: string;
  activeAppId?: string;
}

const Milestones: React.FC<MilestonesProps> = ({ applications = [], bundles = [], activeBundleId = 'all', activeAppId = 'all' }) => {
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [workItems, setWorkItems] = useState<WorkItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMilestone, setEditingMilestone] = useState<Partial<Milestone> | null>(null);

  const fetchData = async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (activeBundleId !== 'all') params.set('bundleId', activeBundleId);
    if (activeAppId !== 'all') params.set('applicationId', activeAppId);
    
    try {
      const [mRes, wRes] = await Promise.all([
        fetch(`/api/milestones?${params.toString()}`),
        fetch(`/api/work-items?${params.toString()}`)
      ]);
      setMilestones(await mRes.json());
      setWorkItems(await wRes.json());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [activeBundleId, activeAppId]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch('/api/milestones', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editingMilestone)
    });
    setIsModalOpen(false);
    fetchData();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Remove milestone? Linked work items will be unassigned.")) return;
    await fetch(`/api/milestones/${id}`, { method: 'DELETE' });
    fetchData();
  };

  const getStatusColor = (status: MilestoneStatus) => {
    switch (status) {
      case MilestoneStatus.RELEASED: return 'bg-emerald-500';
      case MilestoneStatus.ACTIVE: return 'bg-blue-500';
      case MilestoneStatus.DELAYED: return 'bg-red-500';
      case MilestoneStatus.CANCELLED: return 'bg-slate-400';
      default: return 'bg-slate-200';
    }
  };

  const getMilestoneMetrics = (msId: string) => {
    const msItems = workItems.filter(i => i.milestoneIds?.includes(msId));
    const totalPoints = msItems.reduce((acc, curr) => acc + (curr.storyPoints || 0), 0);
    const donePoints = msItems.filter(i => i.status === WorkItemStatus.DONE).reduce((acc, curr) => acc + (curr.storyPoints || 0), 0);
    return { totalPoints, donePoints, count: msItems.length };
  };

  return (
    <div className="space-y-10 animate-fadeIn bg-white rounded-[3rem] border border-slate-200 p-10 shadow-2xl">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tighter">Release Governance</h1>
          <p className="text-slate-500 font-medium text-lg">Define and schedule enterprise delivery milestones.</p>
        </div>
        <button 
          onClick={() => { 
            setEditingMilestone({ 
              status: MilestoneStatus.PLANNED, 
              startDate: new Date().toISOString().split('T')[0], 
              endDate: new Date().toISOString().split('T')[0],
              bundleId: activeBundleId !== 'all' ? activeBundleId : undefined,
              applicationId: activeAppId !== 'all' ? activeAppId : undefined
            }); 
            setIsModalOpen(true); 
          }}
          className="px-8 py-4 bg-slate-900 text-white text-[10px] font-black rounded-2xl shadow-xl hover:bg-blue-600 transition-all uppercase tracking-widest"
        >
          + Provision Milestone
        </button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {loading ? (
          [...Array(3)].map((_, i) => <div key={i} className="h-80 bg-slate-100 rounded-[2.5rem] animate-pulse"></div>)
        ) : milestones.length === 0 ? (
          <div className="col-span-full py-32 text-center bg-slate-50/50 border-2 border-dashed border-slate-100 rounded-[3rem]">
            <i className="fas fa-flag-checkered text-5xl mb-6 text-slate-200"></i>
            <p className="text-sm font-black text-slate-400 uppercase tracking-widest">No Milestones established in this scope</p>
          </div>
        ) : milestones.map((ms) => {
          const metrics = getMilestoneMetrics(ms._id!);
          const utilization = ms.targetCapacity ? Math.round((metrics.totalPoints / ms.targetCapacity) * 100) : 0;
          const isOverCapacity = utilization > 100;

          return (
            <div key={ms._id} className="bg-white border border-slate-200 rounded-[2.5rem] p-10 shadow-sm hover:shadow-2xl transition-all group relative overflow-hidden flex flex-col">
              <div className="absolute top-0 right-0 w-32 h-32 bg-slate-50 rounded-full -mr-16 -mt-16 group-hover:scale-110 transition-transform"></div>
              
              <div className="flex justify-between items-start mb-6 relative z-10">
                <div className={`w-14 h-14 rounded-2xl ${getStatusColor(ms.status)} text-white flex items-center justify-center shadow-lg shadow-black/5`}>
                  <i className="fas fa-flag-checkered text-xl"></i>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => { setEditingMilestone(ms); setIsModalOpen(true); }} className="w-9 h-9 rounded-xl bg-slate-50 text-slate-400 hover:text-blue-600 flex items-center justify-center transition-all border border-slate-100 hover:bg-white hover:shadow-md" title="Edit Milestone"><i className="fas fa-pen text-xs"></i></button>
                  <button onClick={() => handleDelete(ms._id!)} className="w-9 h-9 rounded-xl bg-slate-50 text-slate-400 hover:text-red-500 flex items-center justify-center transition-all border border-slate-100 hover:bg-white hover:shadow-md" title="Delete Milestone"><i className="fas fa-trash text-xs"></i></button>
                </div>
              </div>

              <div className="space-y-2 mb-6 relative z-10">
                <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border border-slate-100 bg-slate-50 text-slate-500`}>
                  {ms.status}
                </span>
                <h3 className="text-2xl font-black text-slate-800 tracking-tight group-hover:text-blue-600 transition-colors">{ms.name}</h3>
                <p className="text-sm font-medium text-slate-400 line-clamp-2 min-h-[40px]">{ms.goal || 'No strategic goal defined for this cycle.'}</p>
              </div>

              <div className="space-y-4 mb-8 pt-6 border-t border-slate-50 relative z-10 flex-1">
                <div className="space-y-1.5">
                   <div className="flex justify-between items-end">
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Utilization ({utilization}%)</span>
                      <span className={`text-[10px] font-black ${isOverCapacity ? 'text-red-500 animate-pulse' : 'text-slate-600'}`}>
                        {metrics.totalPoints} / {ms.targetCapacity || '∞'} pts
                      </span>
                   </div>
                   <div className="h-2 bg-slate-100 rounded-full overflow-hidden flex">
                      <div className={`h-full transition-all duration-1000 ${isOverCapacity ? 'bg-red-500' : 'bg-blue-600'}`} style={{ width: `${Math.min(utilization, 100)}%` }} />
                   </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                    <span className="text-[8px] font-black text-slate-300 uppercase block mb-1">Artifacts</span>
                    <span className="text-sm font-black text-slate-700">{metrics.count}</span>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                    <span className="text-[8px] font-black text-slate-300 uppercase block mb-1">Velocity</span>
                    <span className="text-sm font-black text-emerald-600">{metrics.donePoints} <span className="text-[10px] text-slate-400">pts</span></span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-6 border-t border-slate-50 relative z-10 shrink-0">
                <div>
                  <span className="text-[8px] font-black text-slate-300 uppercase tracking-widest">Delivery Window</span>
                  <p className="text-[10px] font-bold text-slate-600">{new Date(ms.startDate).toLocaleDateString()} — {new Date(ms.endDate).toLocaleDateString()}</p>
                </div>
                <div className="text-right">
                  <span className="text-[8px] font-black text-slate-300 uppercase tracking-widest">Context Scope</span>
                  <p className="text-[9px] font-bold text-blue-500 truncate uppercase">
                    {ms.applicationId ? applications.find(a => (a._id || a.id) === ms.applicationId)?.name : 
                     ms.bundleId ? bundles.find(b => (b._id || b.id) === ms.bundleId)?.name : 'Enterprise Cluster'}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-md z-[250] flex items-center justify-center p-6">
          <div className="bg-white rounded-[3rem] w-full max-w-xl p-12 shadow-2xl animate-fadeIn border border-slate-100 overflow-y-auto max-h-[90vh] custom-scrollbar">
            <header className="mb-10">
              <h3 className="text-3xl font-black text-slate-900 tracking-tight">Configure Milestone</h3>
              <p className="text-slate-400 text-sm font-medium mt-1">Registry cycle parameters for delivery planning.</p>
            </header>

            <form onSubmit={handleSave} className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Release Identity</label>
                <input required value={editingMilestone?.name || ''} onChange={(e) => setEditingMilestone({...editingMilestone, name: e.target.value})} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 text-slate-700 font-bold outline-none focus:border-blue-500 transition-all shadow-sm" placeholder="e.g. 2026 Q1 Infrastructure Modernization" />
              </div>
              
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Bundle Mapping</label>
                  <select value={editingMilestone?.bundleId || ''} onChange={(e) => setEditingMilestone({...editingMilestone, bundleId: e.target.value || undefined, applicationId: undefined})} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 text-slate-700 font-bold outline-none focus:border-blue-500">
                    <option value="">Cross-Bundle / Global</option>
                    {bundles.map(b => <option key={b._id} value={b._id}>{b.name}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">App Context</label>
                  <select value={editingMilestone?.applicationId || ''} onChange={(e) => setEditingMilestone({...editingMilestone, applicationId: e.target.value || undefined})} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 text-slate-700 font-bold outline-none focus:border-blue-500">
                    <option value="">General Bundle Scope</option>
                    {applications.filter(a => !editingMilestone?.bundleId || a.bundleId === editingMilestone.bundleId).map(a => <option key={a._id} value={a._id}>{a.name}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Window Open</label>
                  <input type="date" required value={editingMilestone?.startDate?.split('T')[0] || ''} onChange={(e) => setEditingMilestone({...editingMilestone, startDate: e.target.value})} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 text-slate-700 font-bold outline-none focus:border-blue-500" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Window Close</label>
                  <input type="date" required value={editingMilestone?.endDate?.split('T')[0] || ''} onChange={(e) => setEditingMilestone({...editingMilestone, endDate: e.target.value})} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 text-slate-700 font-bold outline-none focus:border-blue-500" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Registry Status</label>
                  <select value={editingMilestone?.status} onChange={(e) => setEditingMilestone({...editingMilestone, status: e.target.value as any})} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 text-slate-700 font-bold outline-none focus:border-blue-500">
                    {Object.values(MilestoneStatus).map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Capacity Budget (Points)</label>
                  <input type="number" value={editingMilestone?.targetCapacity || ''} onChange={(e) => setEditingMilestone({...editingMilestone, targetCapacity: parseInt(e.target.value)})} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 text-slate-700 font-bold outline-none focus:border-blue-500" placeholder="0" />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Strategic Objective</label>
                <textarea value={editingMilestone?.goal || ''} onChange={(e) => setEditingMilestone({...editingMilestone, goal: e.target.value})} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 text-slate-700 font-medium h-24 outline-none focus:border-blue-500" placeholder="Define the core deliverable or business outcome..." />
              </div>

              <div className="flex gap-4 pt-10 border-t border-slate-50">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-900 transition-colors">Discard</button>
                <button type="submit" className="flex-[2] py-4 bg-slate-900 text-white text-[10px] font-black rounded-2xl shadow-2xl hover:bg-blue-600 transition-all uppercase tracking-widest">Commit Registry Entry</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Milestones;
