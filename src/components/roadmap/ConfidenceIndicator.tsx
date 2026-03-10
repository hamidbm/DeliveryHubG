import React from 'react';

const confidenceStyle = (value?: string | null) => {
  if (value === 'HIGH') return 'bg-emerald-500 text-emerald-50';
  if (value === 'MEDIUM') return 'bg-amber-500 text-amber-50';
  if (value === 'LOW') return 'bg-rose-500 text-rose-50';
  return 'bg-slate-300 text-slate-700';
};

const ConfidenceIndicator: React.FC<{
  confidence?: string | null;
  onTimeProbability?: number | null;
  uncertainty?: string | null;
}> = ({ confidence, onTimeProbability, uncertainty }) => {
  const onTime = onTimeProbability != null ? `${Math.round(onTimeProbability * 100)}%` : '—';
  return (
    <div className="inline-flex items-center gap-2 text-[10px]">
      <span className={`px-2 py-0.5 rounded-full font-black uppercase tracking-widest ${confidenceStyle(confidence)}`}>
        {confidence || 'N/A'}
      </span>
      <span className="text-slate-500">On-Time {onTime}</span>
      {uncertainty ? <span className="text-slate-400">Unc. {uncertainty}</span> : null}
    </div>
  );
};

export default ConfidenceIndicator;
