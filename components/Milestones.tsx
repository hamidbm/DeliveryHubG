
import React, { useState, useEffect } from 'react';
import { Milestone, MilestoneStatus, Application, Bundle } from '../types';

interface MilestonesProps {
  applications: Application[];
  bundles: Bundle[];
}

const Milestones: React.FC<MilestonesProps> = ({ applications = [], bundles = [] }) => {
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMilestone, setEditingMilestone] = useState<Partial<Milestone> | null>(null);

  const fetchMilestones = async () => {
    setLoading(true);
    const res = await fetch('/api/milestones');
    const data = await res.json();
    setMilestones(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchMilestones();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch('/api/milestones', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editingMilestone)
    });
    setIsModalOpen(false);
    fetchMilestones();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Remove milestone? Linked work items will be unassigned.")) return;
    await fetch(`/api/milestones/${id}`, { method: 'DELETE' });
    fetchMilestones();
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

  return (
    <div className="space-y-10 animate-fadeIn p-6">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tighter">Release Governance</h1>
          <p className="text-slate-500 font-medium text-lg">Define and schedule enterprise delivery milestones (M1–M10).</p>
        </div>
        <button 
          onClick={() => { setEditingMilestone({ status: MilestoneStatus.PLANNED, startDate: new Date().toISOString().split('T')[0], endDate: new Date().toISOString().split('T')[0] }); setIsModalOpen(true); }}
          className="px-8 py-4 bg-slate-900 text-white text-[10px] font-black rounded-2xl shadow-xl hover:bg-blue-600 transition-all uppercase tracking-widest"
        >
          + Provision Milestone
        </button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {loading ? (
          [...Array(3)].map((_, i) => <div key={i} className="h-64 bg-slate-100 rounded-[2.5rem] animate-pulse"></div>)
        ) : milestones.map((ms) => (
          <div key={ms._id} className="bg-white border border-slate-200 rounded-[2.5rem] p-10 shadow-sm hover:shadow-2xl transition-all group relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-slate-50 rounded-full -mr-16 -mt-16 group-hover:scale-110 transition-transform"></div>
            
            <div className="flex justify-between items-start mb-8 relative z-10">
              <div className={`w-14 h-14 rounded-2xl ${getStatusColor(ms.status)} text-white flex items-center justify-center shadow-lg`}>
                <i className="fas fa-flag-checkered text-xl"></i>
              </div>
              <div className="flex gap-2">
                <button onClick={() => { setEditingMilestone(ms); setIsModalOpen(true); }} className="w-8 h-8 rounded-full bg-slate-50 text-slate-400 hover:text-blue-600 flex items-center justify-center transition-all"><i className="fas fa-pen text-xs"></i></button>
                <button onClick={() => handleDelete(ms._id!)} className="w-8 h-8 rounded-full bg-slate-50 text-slate-400 hover:text-red-500 flex items-center justify-center transition-all"><i className="fas fa-trash text-xs"></i></button>
              </div>
            </div>

            <div className="space-y-2 mb-8 relative z-10">
              <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border border-slate-100 bg-slate-50 text-slate-500`}>
                {ms.status}
              </span>
              <h3 className="text-2xl font-black text-slate-800 tracking-tight group-hover:text-blue-600 transition-colors">{ms.name}</h3>
              <p className="text-sm font-medium text-slate-400 line-clamp-2">{ms.goal || 'No strategic goal defined for this cycle.'}</p>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-6 border-t border-slate-50 relative z-10">
              <div>
                <span className="text-[8px] font-black text-slate-300 uppercase tracking-widest">Window</span>
                <p className="text-[10px] font-bold text-slate-600">{new Date(ms.startDate).toLocaleDateString()} — {new Date(ms.endDate).toLocaleDateString()}</p>
              </div>
              <div className="text-right">
                <span className="text-[8px] font-black text-slate-300 uppercase tracking-widest">Capacity</span>
                <p className="text-[10px] font-bold text-slate-600">{ms.targetCapacity || '-'} pts</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-md z-[200] flex items-center justify-center p-6">
          <div className="bg-white rounded-[3rem] w-full max-w-xl p-12 shadow-2xl animate-fadeIn border border-slate-100 overflow-y-auto max-h-[90vh]">
            <h3 className="text-3xl font-black text-slate-900 tracking-tight mb-8">Configure Milestone</h3>
            <form onSubmit={handleSave} className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Release Name</label>
                <input required value={editingMilestone?.name || ''} onChange={(e) => setEditingMilestone({...editingMilestone, name: e.target.value})} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 text-slate-700 font-bold outline-none focus:border-blue-500 transition-all" placeholder="e.g. 2026 Q1 Platform Alpha" />
              </div>
              
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Start Date</label>
                  <input type="date" required value={editingMilestone?.startDate?.split('T')[0] || ''} onChange={(e) => setEditingMilestone({...editingMilestone, startDate: e.target.value})} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 text-slate-700 font-bold" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">End Date</label>
                  <input type="date" required value={editingMilestone?.endDate?.split('T')[0] || ''} onChange={(e) => setEditingMilestone({...editingMilestone, endDate: e.target.value})} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 text-slate-700 font-bold" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Status</label>
                  <select value={editingMilestone?.status} onChange={(e) => setEditingMilestone({...editingMilestone, status: e.target.value as any})} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 text-slate-700 font-bold">
                    {Object.values(MilestoneStatus).map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Target Capacity (Points)</label>
                  <input type="number" value={editingMilestone?.targetCapacity || ''} onChange={(e) => setEditingMilestone({...editingMilestone, targetCapacity: parseInt(e.target.value)})} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 text-slate-700 font-bold" placeholder="0" />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Strategic Goal</label>
                <textarea value={editingMilestone?.goal || ''} onChange={(e) => setEditingMilestone({...editingMilestone, goal: e.target.value})} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 text-slate-700 font-medium h-24" placeholder="Describe the outcome of this milestone..." />
              </div>

              <div className="flex gap-4 pt-8">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-4 text-[10px] font-black text-slate-400 uppercase">Discard</button>
                <button type="submit" className="flex-[2] py-4 bg-slate-900 text-white text-[10px] font-black rounded-2xl shadow-xl hover:bg-blue-600 transition-all uppercase tracking-widest">Commit Milestone</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Milestones;
