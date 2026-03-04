import React, { useEffect, useState } from 'react';
import { WorkItem, Bundle, Application } from '../types';
import WorkItemBulkFixModal from './WorkItemBulkFixModal';

interface WorkItemsSprintsViewProps {
  selBundleId: string;
  selAppId: string;
  selMilestone: string;
  searchQuery: string;
  bundles: Bundle[];
  applications: Application[];
}

type SprintRollup = {
  sprintId: string;
  name: string;
  startDate: string;
  endDate: string;
  status: string;
  policy?: {
    strategy: 'global' | 'bundle' | 'strictest';
    globalVersion: number;
    bundleVersions?: Array<{ bundleId: string; version: number }>;
  };
  scope: { items: number; open: number; done: number; blockedDerived: number };
  capacity: { targetPoints?: number; committedPoints: number; completedPoints: number; remainingPoints: number; utilization: number | null; isOverCapacity: boolean };
  risks: { highCritical: number };
  warnings?: { missingStoryPoints?: number };
  dataQuality?: { score: number; issues: Array<{ key: string; count: number; detail: string }> };
};

const WorkItemsSprintsView: React.FC<WorkItemsSprintsViewProps> = ({ selBundleId, selMilestone }) => {
  const [rollups, setRollups] = useState<SprintRollup[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<{ title: string; items: WorkItem[] } | null>(null);
  const [canManage, setCanManage] = useState(false);
  const [closePrompt, setClosePrompt] = useState<{ sprint: SprintRollup; readiness: any } | null>(null);
  const [overrideReason, setOverrideReason] = useState('');
  const [bulkFixIssue, setBulkFixIssue] = useState<{ sprintId: string; issue: 'missingStoryPoints' | 'missingDueAt' | 'missingRiskSeverity' } | null>(null);

  const fetchRollups = async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (selBundleId && selBundleId !== 'all') params.set('bundleId', selBundleId);
    if (selMilestone && selMilestone !== 'all') params.set('milestoneId', selMilestone);
    const res = await fetch(`/api/sprints/rollups?${params.toString()}`);
    const data = await res.json();
    setRollups(Array.isArray(data) ? data : []);
    setLoading(false);
  };

  useEffect(() => { fetchRollups(); }, [selBundleId, selMilestone]);

  useEffect(() => {
    const loadAuth = async () => {
      try {
        const [meRes, adminRes] = await Promise.all([fetch('/api/auth/me'), fetch('/api/admin/check')]);
        const adminData = await adminRes.json();
        setCanManage(Boolean(adminData?.isAdmin || adminData?.isCmo));
      } catch {
        setCanManage(false);
      }
    };
    loadAuth();
  }, []);

  const openSprint = async (sprint: SprintRollup) => {
    const params = new URLSearchParams();
    params.set('sprintId', sprint.sprintId);
    if (selMilestone && selMilestone !== 'all') params.set('milestoneId', selMilestone);
    const res = await fetch(`/api/work-items?${params.toString()}`);
    const items = await res.json();
    setModal({ title: sprint.name || sprint.sprintId, items: Array.isArray(items) ? items : [] });
  };

  const updateSprintStatus = async (sprint: SprintRollup, status: string, allowOverride?: boolean) => {
    const res = await fetch(`/api/sprints/${encodeURIComponent(sprint.sprintId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, allowOverride: !!allowOverride, overrideReason })
    });
    if (res.status === 409) {
      const data = await res.json();
      setClosePrompt({ sprint, readiness: data?.readiness || null });
      return;
    }
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data?.error || 'Unable to update sprint.');
      return;
    }
    setClosePrompt(null);
    setOverrideReason('');
    fetchRollups();
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return 'bg-emerald-50 text-emerald-700';
      case 'CLOSED':
        return 'bg-slate-100 text-slate-500';
      case 'ARCHIVED':
        return 'bg-slate-50 text-slate-400';
      default:
        return 'bg-amber-50 text-amber-700';
    }
  };

  const getReadinessBand = (band: string) => {
    switch (band) {
      case 'high':
        return 'bg-emerald-50 text-emerald-700';
      case 'medium':
        return 'bg-amber-50 text-amber-700';
      case 'low':
        return 'bg-rose-50 text-rose-700';
      default:
        return 'bg-slate-100 text-slate-500';
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-[3rem] p-8 shadow-2xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Sprint Execution</div>
          <h3 className="text-2xl font-black text-slate-900">Sprint Rollups</h3>
        </div>
        <button
          onClick={fetchRollups}
          className="px-3 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50"
        >
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="text-sm text-slate-400">Loading sprints…</div>
      ) : rollups.length ? (
        <div className="space-y-4">
          {rollups.map((sprint) => (
            <div key={sprint.sprintId} className="border border-slate-100 rounded-2xl p-5 hover:shadow-sm transition-all">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-slate-800">{sprint.name}</div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">{sprint.startDate} → {sprint.endDate}</div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`px-2 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${getStatusBadge(String(sprint.status || 'DRAFT').toUpperCase())}`}>
                    {String(sprint.status || 'DRAFT').toUpperCase()}
                  </span>
                  <button
                    onClick={() => openSprint(sprint)}
                    className="px-3 py-2 text-[9px] font-black uppercase tracking-widest rounded-lg bg-slate-900 text-white hover:bg-blue-600"
                  >
                    View Items
                  </button>
                  {canManage && String(sprint.status || 'DRAFT').toUpperCase() === 'DRAFT' && (
                    <button
                      onClick={() => updateSprintStatus(sprint, 'ACTIVE')}
                      className="px-3 py-2 text-[9px] font-black uppercase tracking-widest rounded-lg border border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                    >
                      Start
                    </button>
                  )}
                  {canManage && String(sprint.status || '').toUpperCase() === 'ACTIVE' && (
                    <button
                      onClick={() => updateSprintStatus(sprint, 'CLOSED')}
                      className="px-3 py-2 text-[9px] font-black uppercase tracking-widest rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50"
                    >
                      Close
                    </button>
                  )}
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2 text-[9px] font-black uppercase tracking-widest">
                <span className="px-2 py-1 rounded-full bg-slate-100 text-slate-600">Scope {sprint.scope.done}/{sprint.scope.items}</span>
                <span className="px-2 py-1 rounded-full bg-slate-100 text-slate-600">Blocked {sprint.scope.blockedDerived}</span>
                <span className="px-2 py-1 rounded-full bg-slate-100 text-slate-600">Risks {sprint.risks.highCritical}</span>
                <span className={`px-2 py-1 rounded-full ${sprint.capacity.isOverCapacity ? 'bg-red-50 text-red-600' : 'bg-slate-100 text-slate-600'}`}>
                  Capacity {sprint.capacity.committedPoints}/{sprint.capacity.targetPoints ?? '∞'}
                </span>
                {sprint.warnings?.missingStoryPoints ? (
                  <span className="px-2 py-1 rounded-full bg-amber-50 text-amber-700">Missing SP {sprint.warnings.missingStoryPoints}</span>
                ) : null}
                {sprint.dataQuality && (
                  <span className={`px-2 py-1 rounded-full ${
                    sprint.dataQuality.score < 50 ? 'bg-rose-50 text-rose-700' :
                    sprint.dataQuality.score < 70 ? 'bg-amber-50 text-amber-700' :
                    'bg-emerald-50 text-emerald-700'
                  }`}>
                    Quality {sprint.dataQuality.score}
                  </span>
                )}
              </div>
              {sprint.dataQuality?.issues?.length ? (
                <div className="mt-3 flex flex-wrap gap-2 text-[9px] font-black uppercase tracking-widest text-amber-600">
                  {sprint.dataQuality.issues
                    .filter((issue) => ['missingStoryPoints', 'missingDueAt', 'missingRiskSeverity'].includes(issue.key))
                    .slice(0, 2)
                    .map((issue) => (
                      <button
                        key={issue.key}
                        onClick={() => setBulkFixIssue({ sprintId: sprint.sprintId, issue: issue.key as any })}
                        className="hover:underline"
                      >
                        Fix {issue.detail.toLowerCase()} ({issue.count})
                      </button>
                    ))}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      ) : (
        <div className="text-sm text-slate-400">No sprint rollups available.</div>
      )}

      {modal && (
        <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl p-6 relative">
            <button
              onClick={() => setModal(null)}
              className="absolute top-4 right-4 w-8 h-8 rounded-full border border-slate-200 text-slate-400 hover:text-slate-700"
            >
              <i className="fas fa-times"></i>
            </button>
            <h4 className="text-lg font-black text-slate-900 mb-4">{modal.title}</h4>
            <div className="space-y-2 max-h-[60vh] overflow-y-auto">
              {modal.items.length ? modal.items.map((item) => (
                <div key={String(item._id || item.id)} className="border border-slate-100 rounded-xl p-3">
                  <div className="text-sm font-semibold text-slate-800">{item.key || item.title}</div>
                  <div className="text-[11px] text-slate-400">Status {item.status} • {item.storyPoints || 0} pts</div>
                </div>
              )) : (
                <div className="text-sm text-slate-400">No items.</div>
              )}
            </div>
          </div>
        </div>
      )}

      {closePrompt && (
        <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xl p-6 relative">
            <button
              onClick={() => { setClosePrompt(null); setOverrideReason(''); }}
              className="absolute top-4 right-4 w-8 h-8 rounded-full border border-slate-200 text-slate-400 hover:text-slate-700"
            >
              <i className="fas fa-times"></i>
            </button>
            <h4 className="text-lg font-black text-slate-900">Sprint close blocked</h4>
            <p className="text-sm text-slate-500 mt-1">Resolve blockers or provide an override reason to close anyway.</p>
            <div className="mt-4 flex flex-wrap items-center gap-2 text-[10px] font-black uppercase tracking-widest">
              <span className={`px-2 py-1 rounded-full ${getReadinessBand(closePrompt.readiness?.band)}`}>
                Readiness {closePrompt.readiness?.score ?? '—'}
              </span>
              <span className="px-2 py-1 rounded-full bg-slate-100 text-slate-500">
                Blockers {closePrompt.readiness?.blockers?.length ?? 0}
              </span>
            </div>
            <div className="mt-4 space-y-2">
              {(closePrompt.readiness?.blockers || []).length ? (
                closePrompt.readiness.blockers.map((blocker: any) => (
                  <div key={`${blocker.code}-${blocker.detail}`} className="text-sm text-slate-600 border border-slate-100 rounded-xl px-3 py-2">
                    <span className="font-semibold text-slate-700">{blocker.code}</span> • {blocker.detail}
                  </div>
                ))
              ) : (
                <div className="text-sm text-slate-400">Readiness data unavailable.</div>
              )}
            </div>
            <div className="mt-4">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Override reason</label>
              <textarea
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                className="mt-2 w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-200"
                rows={3}
                placeholder="Explain why closing is acceptable despite blockers."
              />
            </div>
            <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
              <button
                onClick={() => { setClosePrompt(null); setOverrideReason(''); }}
                className="px-3 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={() => updateSprintStatus(closePrompt.sprint, 'CLOSED', true)}
                className="px-3 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-50"
                disabled={!overrideReason.trim()}
              >
                Close anyway
              </button>
            </div>
          </div>
        </div>
      )}

      {bulkFixIssue && (
        <WorkItemBulkFixModal
          sprintId={bulkFixIssue.sprintId}
          issue={bulkFixIssue.issue}
          onClose={() => setBulkFixIssue(null)}
          onUpdated={() => {
            setBulkFixIssue(null);
            fetchRollups();
          }}
        />
      )}
    </div>
  );
};

export default WorkItemsSprintsView;
