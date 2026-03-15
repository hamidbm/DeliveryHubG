import React from 'react';
import { MetricCard as MetricCardModel } from '../../types/dashboard';

type Props = {
  metric: MetricCardModel;
  onClick?: () => void;
};

const statusStyle: Record<MetricCardModel['status'], string> = {
  on_track: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  watch: 'border-amber-200 bg-amber-50 text-amber-700',
  at_risk: 'border-orange-200 bg-orange-50 text-orange-700',
  critical: 'border-rose-200 bg-rose-50 text-rose-700'
};

const MetricCard: React.FC<Props> = ({ metric, onClick }) => (
  <button
    onClick={onClick}
    className="w-full text-left rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:shadow-md transition"
  >
    <div className="flex items-center justify-between">
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{metric.label}</p>
      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${statusStyle[metric.status]}`}>
        {metric.status.replace('_', ' ')}
      </span>
    </div>
    <p className="text-2xl font-black text-slate-900 mt-2">{metric.value}</p>
    <p className="text-xs text-slate-500 mt-1">
      {metric.delta >= 0 ? '+' : ''}{metric.delta} {metric.deltaLabel}
    </p>
  </button>
);

export default MetricCard;
