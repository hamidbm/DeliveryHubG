import React, { useEffect, useState } from 'react';

type StaleKind = 'all' | 'critical' | 'blocked' | 'unassigned' | 'github';

type StaleItem = {
  id: string;
  key?: string;
  title?: string;
  status?: string;
  assignee?: string | null;
  updatedAt?: string | null;
  daysStale?: number | null;
  reason?: string;
  github?: {
    hasOpenPr?: boolean;
    prNumber?: number;
    prTitle?: string;
    prUpdatedAt?: string;
    daysSinceUpdate?: number | null;
  };
};

interface WorkItemsStaleModalProps {
  milestoneId?: string;
  sprintId?: string;
  bundleId?: string;
  kind?: StaleKind;
  title?: string;
  onClose: () => void;
}

const WorkItemsStaleModal: React.FC<WorkItemsStaleModalProps> = ({
  milestoneId,
  sprintId,
  bundleId,
  kind = 'all',
  title = 'Stale Work Items',
  onClose
}) => {
  const [items, setItems] = useState<StaleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [nudgingId, setNudgingId] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        params.set('kind', kind);
        if (milestoneId) params.set('milestoneId', milestoneId);
        if (sprintId) params.set('sprintId', sprintId);
        if (bundleId) params.set('bundleId', bundleId);
        const res = await fetch(`/api/work-items/stale?${params.toString()}`);
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          setError(err.error || 'Failed to load stale items.');
          return;
        }
        const data = await res.json();
        setItems(Array.isArray(data?.items) ? data.items : []);
      } catch (err: any) {
        setError(err?.message || 'Failed to load stale items.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [milestoneId, sprintId, bundleId, kind]);

  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(null), 2000);
    return () => clearTimeout(t);
  }, [message]);

  const handleNudge = async (item: StaleItem) => {
    if (!item?.id) return;
    setNudgingId(item.id);
    setError(null);
    try {
      const res = await fetch('/api/work-items/stale', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workItemId: item.id, reason: item.reason || 'Stale work item', kind })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setError(err.error || 'Nudge failed.');
        return;
      }
      setMessage('Nudge sent.');
    } catch (err: any) {
      setError(err?.message || 'Nudge failed.');
    } finally {
      setNudgingId(null);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/30 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-2xl w-[760px] max-h-[80vh] p-6 flex flex-col">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-black uppercase tracking-widest text-slate-600">{title}</h4>
            <div className="text-xs text-slate-500">{items.length} items</div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <i className="fas fa-times"></i>
          </button>
        </div>

        {loading ? (
          <div className="mt-4 text-sm text-slate-400">Loading stale items…</div>
        ) : error ? (
          <div className="mt-4 text-sm text-rose-600">{error}</div>
        ) : (
          <div className="mt-4 space-y-3 overflow-y-auto pr-2">
            {items.length === 0 && (
              <div className="text-sm text-slate-400">No stale items found.</div>
            )}
            {items.map((item) => {
              const githubSummary = item.github?.hasOpenPr
                ? `PR #${item.github?.prNumber || '—'} • ${item.github?.daysSinceUpdate ?? '—'}d`
                : (item.github?.daysSinceUpdate ? `No PR • ${item.github?.daysSinceUpdate}d` : null);
              return (
                <div key={item.id} className="border border-slate-100 rounded-xl p-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                        {item.key || item.id} • {item.status || '—'}
                      </div>
                      <div className="text-sm text-slate-700 truncate">{item.title || 'Untitled'}</div>
                      <div className="mt-1 flex flex-wrap gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                        {item.reason && (
                          <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">{item.reason}</span>
                        )}
                        {typeof item.daysStale === 'number' && (
                          <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">{item.daysStale}d stale</span>
                        )}
                        {item.assignee && (
                          <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">Assignee {item.assignee}</span>
                        )}
                        {githubSummary && (
                          <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">{githubSummary}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => window.location.assign(`/work-items/${encodeURIComponent(item.id)}`)}
                        className="px-3 py-2 rounded-xl text-[10px] font-black uppercase border border-slate-200 text-slate-500"
                      >
                        Open
                      </button>
                      <button
                        onClick={() => handleNudge(item)}
                        disabled={nudgingId === item.id}
                        className="px-3 py-2 rounded-xl text-[10px] font-black uppercase bg-blue-600 text-white disabled:opacity-60"
                      >
                        Nudge owner
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {message && <div className="mt-3 text-[11px] font-semibold text-emerald-600">{message}</div>}
      </div>
    </div>
  );
};

export default WorkItemsStaleModal;

