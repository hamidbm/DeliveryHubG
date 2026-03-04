import React, { useEffect, useState } from 'react';
import { WorkItem } from '../types';

type BulkFixIssue = 'missingStoryPoints' | 'missingDueAt' | 'missingRiskSeverity';

interface WorkItemBulkFixModalProps {
  milestoneId?: string;
  sprintId?: string;
  issue: BulkFixIssue;
  itemIds?: string[];
  onClose: () => void;
  onUpdated?: () => void;
}

const issueLabels: Record<BulkFixIssue, string> = {
  missingStoryPoints: 'Missing story points',
  missingDueAt: 'Missing due dates',
  missingRiskSeverity: 'Missing risk severity'
};

const WorkItemBulkFixModal: React.FC<WorkItemBulkFixModalProps> = ({ milestoneId, sprintId, issue, itemIds, onClose, onUpdated }) => {
  const [items, setItems] = useState<WorkItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [storyPoints, setStoryPoints] = useState<number | ''>('');
  const [dueAt, setDueAt] = useState('');
  const [riskSeverity, setRiskSeverity] = useState('medium');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (milestoneId) params.set('milestoneId', milestoneId);
        if (sprintId) params.set('sprintId', sprintId);
        params.set('issue', issue);
        const res = await fetch(`/api/work-items/quality?${params.toString()}`);
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          setError(err.error || 'Failed to load items.');
          return;
        }
        const data = await res.json();
        setItems(Array.isArray(data?.items) ? data.items : []);
      } catch (err: any) {
        setError(err?.message || 'Failed to load items.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [milestoneId, sprintId, issue]);

  const filteredItems = itemIds?.length
    ? items.filter((item) => itemIds.includes(String(item._id || item.id)))
    : items;

  const handleApply = async () => {
    if (!filteredItems.length) {
      onClose();
      return;
    }
    const ids = filteredItems.map((i) => String(i._id || i.id)).filter(Boolean);
    if (!ids.length) {
      onClose();
      return;
    }
    const updates: any = {};
    if (issue === 'missingStoryPoints') {
      const value = typeof storyPoints === 'number' ? storyPoints : 0;
      if (value < 0) {
        setError('Story points must be >= 0.');
        return;
      }
      updates.storyPoints = value;
    }
    if (issue === 'missingDueAt') {
      if (!dueAt) {
        setError('Please select a due date.');
        return;
      }
      updates.dueAt = new Date(dueAt).toISOString();
    }
    if (issue === 'missingRiskSeverity') {
      updates.risk = { severity: riskSeverity };
    }

    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/work-items/bulk', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids, updates })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setError(err.error || 'Bulk update failed.');
        return;
      }
      onUpdated?.();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Bulk update failed.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/30 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-2xl w-[520px] p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-black uppercase tracking-widest text-slate-600">Fix: {issueLabels[issue]}</h4>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><i className="fas fa-times"></i></button>
        </div>

        {loading ? (
          <div className="text-sm text-slate-400">Loading items…</div>
        ) : (
          <>
            <div className="text-sm text-slate-600">
              {filteredItems.length} items need attention.
            </div>
            {issue === 'missingStoryPoints' && (
              <div className="space-y-2">
                <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Story Points</label>
                <input
                  type="number"
                  value={storyPoints}
                  onChange={(e) => setStoryPoints(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm"
                  min={0}
                />
              </div>
            )}
            {issue === 'missingDueAt' && (
              <div className="space-y-2">
                <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Due Date</label>
                <input
                  type="date"
                  value={dueAt}
                  onChange={(e) => setDueAt(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm"
                />
              </div>
            )}
            {issue === 'missingRiskSeverity' && (
              <div className="space-y-2">
                <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Risk Severity</label>
                <select
                  value={riskSeverity}
                  onChange={(e) => setRiskSeverity(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>
            )}
            <div className="max-h-[200px] overflow-y-auto border border-slate-100 rounded-xl p-3 text-xs text-slate-500">
              {filteredItems.map((item) => (
                <div key={String(item._id || item.id)} className="py-1 border-b border-slate-50 last:border-b-0">
                  {item.key} • {item.title}
                </div>
              ))}
            </div>
          </>
        )}

        {error && <div className="text-sm text-rose-600">{error}</div>}

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-[10px] font-black uppercase border border-slate-200 text-slate-500">Cancel</button>
          <button
            onClick={handleApply}
            disabled={loading || saving}
            className="px-4 py-2 rounded-xl text-[10px] font-black uppercase bg-blue-600 text-white disabled:opacity-50"
          >
            Apply Fix
          </button>
        </div>
      </div>
    </div>
  );
};

export default WorkItemBulkFixModal;
