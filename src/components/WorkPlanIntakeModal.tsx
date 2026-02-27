import React, { useEffect, useMemo, useState } from 'react';
import { Bundle, Application } from '../types';

interface WorkPlanIntakeModalProps {
  bundles: Bundle[];
  applications: Application[];
  onClose: () => void;
  onSuccess: () => void;
}

const WorkPlanIntakeModal: React.FC<WorkPlanIntakeModalProps> = ({ bundles, applications, onClose, onSuccess }) => {
  const [scopeType, setScopeType] = useState<'bundle' | 'application'>('bundle');
  const [scopeId, setScopeId] = useState<string>('');
  const [goLiveDate, setGoLiveDate] = useState('');
  const [devStartDate, setDevStartDate] = useState('');
  const [uatStartDate, setUatStartDate] = useState('');
  const [uatEndDate, setUatEndDate] = useState('');
  const [milestoneCount, setMilestoneCount] = useState(4);
  const [milestoneDurationWeeks, setMilestoneDurationWeeks] = useState(3);
  const [sprintDurationWeeks, setSprintDurationWeeks] = useState(2);
  const [themes, setThemes] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(false);

  const scopeOptions = useMemo(() => {
    return scopeType === 'bundle' ? bundles : applications;
  }, [scopeType, bundles, applications]);

  useEffect(() => {
    if (scopeOptions.length > 0 && !scopeId) {
      setScopeId(String(scopeOptions[0]._id || scopeOptions[0].id));
    }
  }, [scopeOptions, scopeId]);

  const milestoneRows = Array.from({ length: milestoneCount }, (_, i) => i + 1);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scopeId) return;
    setLoading(true);
    const milestoneThemes = milestoneRows
      .map((n) => ({
        milestoneNumber: n,
        themes: (themes[n] || '').split(',').map(t => t.trim()).filter(Boolean)
      }))
      .filter((m) => m.themes.length > 0);

    const res = await fetch('/api/work-items/plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        scopeType,
        scopeId,
        goLiveDate,
        devStartDate,
        uatStartDate,
        uatEndDate,
        milestoneCount,
        milestoneDurationWeeks,
        sprintDurationWeeks,
        milestoneThemes
      })
    });
    setLoading(false);
    if (res.ok) {
      onSuccess();
    } else {
      const err = await res.json().catch(() => ({}));
      alert(err.error || 'Failed to create plan');
    }
  };

  return (
    <div className="fixed inset-0 z-[220] flex items-center justify-center p-6">
      <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-md" onClick={onClose}></div>
      <div className="bg-white rounded-[3rem] w-full max-w-3xl p-12 shadow-2xl relative animate-fadeIn max-h-[90vh] overflow-y-auto custom-scrollbar">
        <header className="mb-10 flex justify-between items-start">
          <div>
            <h3 className="text-3xl font-black text-slate-900 tracking-tight italic">Create Delivery Plan</h3>
            <p className="text-slate-500 font-medium mt-1">Generate epic, milestones, and stories from minimal inputs.</p>
          </div>
          <button onClick={onClose} className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 hover:text-red-500 transition-colors">
            <i className="fas fa-times"></i>
          </button>
        </header>

        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="grid grid-cols-2 gap-8">
            <div className="space-y-2">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Scope Type</label>
              <select value={scopeType} onChange={(e) => setScopeType(e.target.value as any)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold outline-none">
                <option value="bundle">Bundle</option>
                <option value="application">Application</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Scope</label>
              <select value={scopeId} onChange={(e) => setScopeId(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold outline-none">
                {scopeOptions.map((o: any) => (
                  <option key={o._id || o.id || o.key || o.aid} value={o._id || o.id || o.key || o.aid}>
                    {o.name || o.key || o.aid}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-6">
            <div className="space-y-2">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Go-live Date</label>
              <input type="date" value={goLiveDate} onChange={(e) => setGoLiveDate(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold outline-none" />
            </div>
            <div className="space-y-2">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Dev Start</label>
              <input type="date" value={devStartDate} onChange={(e) => setDevStartDate(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold outline-none" />
            </div>
            <div className="space-y-2">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">UAT Start</label>
              <input type="date" value={uatStartDate} onChange={(e) => setUatStartDate(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold outline-none" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-6">
            <div className="space-y-2">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">UAT End</label>
              <input type="date" value={uatEndDate} onChange={(e) => setUatEndDate(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold outline-none" />
            </div>
            <div className="space-y-2">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Milestones</label>
              <input type="number" min={1} value={milestoneCount} onChange={(e) => setMilestoneCount(Number(e.target.value))} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold outline-none" />
            </div>
            <div className="space-y-2">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Milestone Duration (weeks)</label>
              <input type="number" min={1} value={milestoneDurationWeeks} onChange={(e) => setMilestoneDurationWeeks(Number(e.target.value))} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold outline-none" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Sprint Duration (weeks)</label>
              <input type="number" min={1} value={sprintDurationWeeks} onChange={(e) => setSprintDurationWeeks(Number(e.target.value))} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold outline-none" />
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Milestone Themes (optional)</h4>
            <div className="grid grid-cols-2 gap-4">
              {milestoneRows.map((n) => (
                <div key={n} className="space-y-2">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Milestone {n} themes</label>
                  <input
                    value={themes[n] || ''}
                    onChange={(e) => setThemes(prev => ({ ...prev, [n]: e.target.value }))}
                    placeholder="Comma-separated"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold outline-none"
                  />
                </div>
              ))}
            </div>
          </div>

          <footer className="pt-10 flex gap-4">
            <button type="button" onClick={onClose} className="flex-1 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-800 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="flex-[2] py-4 bg-slate-900 text-white text-[10px] font-black rounded-2xl shadow-2xl hover:bg-blue-600 transition-all uppercase tracking-widest flex items-center justify-center gap-2">
              {loading ? <i className="fas fa-circle-notch fa-spin"></i> : <i className="fas fa-sitemap"></i>}
              Create Plan
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
};

export default WorkPlanIntakeModal;
