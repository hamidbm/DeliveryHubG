'use client';

import React from 'react';
import { ForecastSignal } from '../../types/ai';
import ForecastSignalCard from './ForecastSignalCard';

type Props = {
  signals: ForecastSignal[];
  loading?: boolean;
  error?: string;
};

const ForecastPanel: React.FC<Props> = ({ signals, loading, error }) => {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-black uppercase tracking-widest text-slate-500">Forecast Signals</p>
        <span className="text-xs text-slate-500">{signals.length} signal{signals.length === 1 ? '' : 's'}</span>
      </div>

      {loading && (
        <div className="text-sm text-slate-500">Loading forecast signals...</div>
      )}

      {!loading && error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>
      )}

      {!loading && !error && signals.length === 0 && (
        <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3 text-sm text-slate-500">
          No forecast signals detected for the current portfolio state.
        </div>
      )}

      {!loading && !error && signals.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {signals.map((signal) => (
            <ForecastSignalCard key={signal.id} signal={signal} />
          ))}
        </div>
      )}
    </section>
  );
};

export default ForecastPanel;
