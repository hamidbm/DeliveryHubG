import React from 'react';

type EnvironmentRow = {
  name: string;
  startDate?: string | null;
};

interface EnvironmentTimelineInputsProps {
  environments: EnvironmentRow[];
  onChange: (next: EnvironmentRow[]) => void;
  goLiveDate: string;
  onGoLiveChange: (value: string) => void;
}

const formatLabel = (name: string) => {
  const upper = String(name || '').toUpperCase();
  if (upper === 'PROD') return 'Prod Deployment';
  return upper;
};

const EnvironmentTimelineInputs: React.FC<EnvironmentTimelineInputsProps> = ({
  environments,
  onChange,
  goLiveDate,
  onGoLiveChange
}) => {
  const handleDateChange = (index: number, value: string) => {
    const next = environments.map((row, idx) => idx === index ? { ...row, startDate: value || null } : row);
    onChange(next);
  };

  return (
    <div className="space-y-3">
      {environments.length === 0 ? (
        <div className="text-xs text-slate-500">No environments configured for this scope.</div>
      ) : (
        <div className="flex items-end gap-4 overflow-x-auto custom-scrollbar pb-1">
          {environments.map((env, idx) => (
            <label key={`${env.name}-${idx}`} className="space-y-2 min-w-[180px]">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">
                {formatLabel(env.name)}
              </span>
              <input
                type="date"
                value={env.startDate || ''}
                onChange={(e) => handleDateChange(idx, e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold outline-none"
              />
            </label>
          ))}
          <label className="space-y-2 min-w-[220px]">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Go-Live / Business Cutover</span>
            <input
              type="date"
              value={goLiveDate || ''}
              onChange={(e) => onGoLiveChange(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold outline-none"
            />
          </label>
        </div>
      )}
    </div>
  );
};

export default EnvironmentTimelineInputs;
