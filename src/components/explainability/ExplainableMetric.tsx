import React from 'react';
import ExplainabilityIcon from './ExplainabilityIcon';

const ExplainableMetric: React.FC<{
  label: string;
  value: React.ReactNode;
  explainabilityKey: string;
  className?: string;
}> = ({ label, value, explainabilityKey, className }) => (
  <div className={`flex items-center gap-2 ${className || ''}`}>
    <div className="text-[10px] uppercase tracking-widest text-slate-400 font-black flex items-center gap-1">
      {label}
      <ExplainabilityIcon explainabilityKey={explainabilityKey} />
    </div>
    <div className="text-sm font-semibold text-slate-800">{value}</div>
  </div>
);

export default ExplainableMetric;
