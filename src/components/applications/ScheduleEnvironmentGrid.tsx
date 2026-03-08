import React, { useId, useMemo, useState } from 'react';
import type { PlanningEnvironmentEntry } from '../../types';

export interface ScheduleEnvironmentInheritance {
  startDate?: boolean;
  durationDays?: boolean;
  endDate?: boolean;
  actualStart?: boolean;
  actualEnd?: boolean;
}

interface ScheduleEnvironmentGridProps {
  environments: PlanningEnvironmentEntry[];
  editable?: boolean;
  onFieldChange?: (name: string, field: keyof PlanningEnvironmentEntry, value: string | number | null) => void;
  onAddEnvironment?: (name: string) => void;
  inheritance?: Record<string, ScheduleEnvironmentInheritance>;
  suggestions?: string[];
}

const displayLabel = (name: string) => (name.toUpperCase() === 'PROD' ? 'Prod Deployment' : name.toUpperCase());

const ScheduleEnvironmentGrid: React.FC<ScheduleEnvironmentGridProps> = ({
  environments,
  editable,
  onFieldChange,
  onAddEnvironment,
  inheritance,
  suggestions = []
}) => {
  const [newEnv, setNewEnv] = useState('');
  const normalizedSuggestions = useMemo(() => suggestions.map((s) => s.toUpperCase()), [suggestions]);
  const listId = useId();

  const handleAdd = () => {
    const value = newEnv.trim().toUpperCase();
    if (!value) return;
    onAddEnvironment?.(value);
    setNewEnv('');
  };

  return (
    <div className="space-y-4">
      {editable && (
        <div className="flex flex-wrap items-center gap-2">
          <input
            list={listId}
            value={newEnv}
            onChange={(e) => setNewEnv(e.target.value)}
            placeholder="Add environment"
            className="border border-slate-200 rounded-lg px-3 py-2 text-xs"
          />
          <datalist id={listId}>
            {normalizedSuggestions.map((value) => (
              <option key={value} value={value} />
            ))}
          </datalist>
          <button onClick={handleAdd} className="px-3 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg bg-slate-900 text-white">
            Add Environment
          </button>
        </div>
      )}

      <div className="space-y-4">
        {environments.length === 0 && (
          <div className="text-xs text-slate-400">No environments yet. Add one to start scheduling.</div>
        )}
        {environments.map((env) => {
          const key = String(env.name || '').toUpperCase();
          const inherited = inheritance?.[key] || {};
          return (
            <div key={key} className="border border-slate-200 rounded-xl p-4 space-y-3">
              <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">{displayLabel(key)}</div>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4 text-xs text-slate-600">
                <label className="space-y-1">Start Date
                  {editable ? (
                    <input
                      type="date"
                      value={env.startDate || ''}
                      onChange={(e) => onFieldChange?.(key, 'startDate', e.target.value || null)}
                      className="w-full border border-slate-200 rounded-lg px-2 py-2 text-xs"
                    />
                  ) : (
                    <div className="space-y-1">
                      <div className="text-slate-700">{env.startDate ? new Date(env.startDate).toLocaleDateString() : '—'}</div>
                      {inherited.startDate && <div className="text-[9px] uppercase tracking-widest text-slate-400">inherited</div>}
                    </div>
                  )}
                </label>
                <label className="space-y-1">Duration (days)
                  {editable ? (
                    <input
                      type="number"
                      min={1}
                      value={env.durationDays ?? ''}
                      onChange={(e) => onFieldChange?.(key, 'durationDays', e.target.value ? Number(e.target.value) : null)}
                      className="w-full border border-slate-200 rounded-lg px-2 py-2 text-xs"
                    />
                  ) : (
                    <div className="space-y-1">
                      <div className="text-slate-700">{env.durationDays ?? '—'}</div>
                      {inherited.durationDays && <div className="text-[9px] uppercase tracking-widest text-slate-400">inherited</div>}
                    </div>
                  )}
                </label>
                <label className="space-y-1">End Date
                  {editable ? (
                    <input
                      type="date"
                      value={env.endDate || ''}
                      onChange={(e) => onFieldChange?.(key, 'endDate', e.target.value || null)}
                      className="w-full border border-slate-200 rounded-lg px-2 py-2 text-xs"
                    />
                  ) : (
                    <div className="space-y-1">
                      <div className="text-slate-700">{env.endDate ? new Date(env.endDate).toLocaleDateString() : '—'}</div>
                      {inherited.endDate && <div className="text-[9px] uppercase tracking-widest text-slate-400">inherited</div>}
                    </div>
                  )}
                </label>
                <label className="space-y-1">Actual Start
                  {editable ? (
                    <input
                      type="date"
                      value={env.actualStart || ''}
                      onChange={(e) => onFieldChange?.(key, 'actualStart', e.target.value || null)}
                      className="w-full border border-slate-200 rounded-lg px-2 py-2 text-xs"
                    />
                  ) : (
                    <div className="space-y-1">
                      <div className="text-slate-700">{env.actualStart ? new Date(env.actualStart).toLocaleDateString() : '—'}</div>
                      {inherited.actualStart && <div className="text-[9px] uppercase tracking-widest text-slate-400">inherited</div>}
                    </div>
                  )}
                </label>
                <label className="space-y-1">Actual End
                  {editable ? (
                    <input
                      type="date"
                      value={env.actualEnd || ''}
                      onChange={(e) => onFieldChange?.(key, 'actualEnd', e.target.value || null)}
                      className="w-full border border-slate-200 rounded-lg px-2 py-2 text-xs"
                    />
                  ) : (
                    <div className="space-y-1">
                      <div className="text-slate-700">{env.actualEnd ? new Date(env.actualEnd).toLocaleDateString() : '—'}</div>
                      {inherited.actualEnd && <div className="text-[9px] uppercase tracking-widest text-slate-400">inherited</div>}
                    </div>
                  )}
                </label>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ScheduleEnvironmentGrid;
