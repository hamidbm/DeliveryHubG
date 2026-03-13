import React from 'react';
import { SavedInvestigation } from '../../types/ai';

const InvestigationPanel: React.FC<{
  items: SavedInvestigation[];
  busyId?: string | null;
  onRun: (item: SavedInvestigation) => void;
  onRefresh: (item: SavedInvestigation) => void;
  onTogglePin: (item: SavedInvestigation) => void;
  onDelete: (item: SavedInvestigation) => void;
}> = ({ items, busyId, onRun, onRefresh, onTogglePin, onDelete }) => {
  return (
    <section className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
      <h3 className="text-sm font-black uppercase tracking-widest text-slate-500 mb-3">Saved Investigations</h3>
      {items.length === 0 && <p className="text-sm text-slate-500">No saved investigations yet.</p>}
      <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
        {items.map((item) => {
          const busy = busyId === item.id;
          return (
            <div key={item.id} className="border border-slate-200 rounded-lg p-3 bg-slate-50">
              <p className="text-sm font-semibold text-slate-800 break-words">{item.question}</p>
              <p className="text-xs text-slate-600 mt-1 line-clamp-2">{item.answer}</p>
              <p className="text-[11px] text-slate-500 mt-1">Updated {new Date(item.updatedAt).toLocaleString()}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button disabled={busy} onClick={() => onRun(item)} className="px-2 py-1 rounded border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60">Run</button>
                <button disabled={busy} onClick={() => onRefresh(item)} className="px-2 py-1 rounded border border-blue-200 bg-blue-50 text-xs font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-60">Refresh</button>
                <button disabled={busy} onClick={() => onTogglePin(item)} className="px-2 py-1 rounded border border-amber-200 bg-amber-50 text-xs font-semibold text-amber-700 hover:bg-amber-100 disabled:opacity-60">{item.pinned ? 'Unpin' : 'Pin'}</button>
                <button disabled={busy} onClick={() => onDelete(item)} className="px-2 py-1 rounded border border-rose-200 bg-rose-50 text-xs font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-60">Delete</button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};

export default InvestigationPanel;
