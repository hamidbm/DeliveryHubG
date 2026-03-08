import React from 'react';

interface ScheduleScopeSelectorProps {
  scope: 'bundle' | 'application';
  bundleName?: string;
  appName?: string;
  onChange: (value: 'bundle' | 'application') => void;
}

const ScheduleScopeSelector: React.FC<ScheduleScopeSelectorProps> = ({ scope, bundleName, appName, onChange }) => (
  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Schedule Scope</span>
    <label className="flex items-center gap-2 cursor-pointer">
      <input
        type="radio"
        name="schedule-scope"
        value="bundle"
        checked={scope === 'bundle'}
        onChange={() => onChange('bundle')}
        className="accent-slate-900"
      />
      <span>Bundle {bundleName ? `(${bundleName})` : ''}</span>
    </label>
    <label className="flex items-center gap-2 cursor-pointer">
      <input
        type="radio"
        name="schedule-scope"
        value="application"
        checked={scope === 'application'}
        onChange={() => onChange('application')}
        className="accent-slate-900"
      />
      <span>Application {appName ? `(${appName})` : ''}</span>
    </label>
  </div>
);

export default ScheduleScopeSelector;
