import React from 'react';
import { SavedInvestigation } from '../../types/ai';

const PinnedInsightsPanel: React.FC<{
  items: SavedInvestigation[];
  busyId?: string | null;
  onView: (item: SavedInvestigation) => void;
  onRefresh: (item: SavedInvestigation) => void;
  onUnpin: (item: SavedInvestigation) => void;
}> = ({ items, busyId, onView, onRefresh, onUnpin }) => {
  if (!items.length) return null;
  const visible = items.slice(0, 6);
  return (
    <section className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
      <h3 className="text-sm font-black uppercase tracking-widest text-slate-500 mb-3">Pinned Insights</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {visible.map((item) => {
          const busy = busyId === item.id;
          return (
            <div key={item.id} className="border border-slate-200 rounded-lg p-3 bg-slate-50">
              <p className="text-sm font-semibold text-slate-800 break-words">{item.question}</p>
              <p className="text-xs text-slate-600 mt-1 line-clamp-2">{item.answer}</p>
              <p className="text-[11px] text-slate-500 mt-1">Updated {new Date(item.updatedAt).toLocaleString()}</p>
              <div className="mt-2 flex gap-2">
                <button disabled={busy} onClick={() => onView(item)} className="px-2 py-1 rounded border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60">View full result</button>
                <button disabled={busy} onClick={() => onRefresh(item)} className="px-2 py-1 rounded border border-blue-200 bg-blue-50 text-xs font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-60">Refresh</button>
                <button disabled={busy} onClick={() => onUnpin(item)} className="px-2 py-1 rounded border border-amber-200 bg-amber-50 text-xs font-semibold text-amber-700 hover:bg-amber-100 disabled:opacity-60">Unpin</button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};

export default PinnedInsightsPanel;
