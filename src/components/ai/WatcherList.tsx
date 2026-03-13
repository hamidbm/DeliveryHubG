import React from 'react';
import { Watcher } from '../../types/ai';

type Props = {
  watchers: Watcher[];
  onToggle: (watcher: Watcher, enabled: boolean) => void;
  onDelete: (watcher: Watcher) => void;
  onCreate: () => void;
};

const WatcherList: React.FC<Props> = ({ watchers, onToggle, onDelete, onCreate }) => {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-3 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-black uppercase tracking-widest text-slate-500">Watchers</p>
        <button onClick={onCreate} className="text-xs font-semibold text-blue-700 hover:text-blue-800">New Watcher</button>
      </div>
      {watchers.length === 0 && (
        <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3 text-sm text-slate-500">
          No watcher subscriptions configured.
        </div>
      )}
      <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
        {watchers.map((watcher) => (
          <article key={watcher.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-slate-800">{watcher.type} • {watcher.targetId}</p>
              <label className="inline-flex items-center gap-1 text-xs text-slate-700">
                <input
                  type="checkbox"
                  checked={watcher.enabled}
                  onChange={(e) => onToggle(watcher, e.target.checked)}
                />
                Enabled
              </label>
            </div>
            <pre className="text-[11px] mt-1 text-slate-600 whitespace-pre-wrap">{JSON.stringify(watcher.condition || {}, null, 2)}</pre>
            <p className="text-[11px] text-slate-500 mt-1">Created: {new Date(watcher.createdAt).toLocaleString()}</p>
            {watcher.lastTriggeredAt && <p className="text-[11px] text-slate-500">Last Triggered: {new Date(watcher.lastTriggeredAt).toLocaleString()}</p>}
            <div className="mt-2">
              <button onClick={() => onDelete(watcher)} className="text-xs font-semibold text-rose-700 hover:text-rose-800">Delete</button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
};

export default WatcherList;
