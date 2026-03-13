import React from 'react';
import { PortfolioTrendSignal } from '../../types/ai';

const metricLabel: Record<PortfolioTrendSignal['metric'], string> = {
  unassignedWorkItems: 'Unassigned Workload',
  blockedWorkItems: 'Blocked Tasks',
  overdueWorkItems: 'Overdue Work',
  activeWorkItems: 'Active Work',
  criticalApplications: 'Critical Applications',
  overdueMilestones: 'Overdue Milestones'
};

const directionIcon = (direction: PortfolioTrendSignal['direction']) => {
  if (direction === 'rising') return { icon: 'fa-arrow-up', color: 'text-rose-600 bg-rose-50 border-rose-100', label: 'Rising' };
  if (direction === 'falling') return { icon: 'fa-arrow-down', color: 'text-emerald-700 bg-emerald-50 border-emerald-100', label: 'Falling' };
  return { icon: 'fa-arrow-right', color: 'text-slate-600 bg-slate-50 border-slate-100', label: 'Stable' };
};

const deltaText = (value: number) => (value > 0 ? `+${value}` : `${value}`);

const TrendSignalCard = ({ signal }: { signal: PortfolioTrendSignal }) => {
  const direction = directionIcon(signal.direction);
  const metric = metricLabel[signal.metric] || signal.metric;
  const summary = signal.summary
    || (signal.direction === 'stable'
      ? `${metric} remained stable over ${signal.timeframeDays} days.`
      : `${metric} changed by ${deltaText(signal.delta)} over ${signal.timeframeDays} days.`);

  return (
    <article className="border border-slate-200 rounded-lg p-3 bg-slate-50">
      <div className="flex items-center justify-between gap-3">
        <p className="font-semibold text-slate-800 break-words">{metric}</p>
        <span className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border font-bold uppercase ${direction.color}`}>
          <i className={`fas ${direction.icon}`}></i>
          {direction.label}
        </span>
      </div>
      <p className="text-sm text-slate-600 mt-1 break-words">{summary}</p>
      <p className="text-xs text-slate-500 mt-2">Delta: {deltaText(signal.delta)} over {signal.timeframeDays} day{signal.timeframeDays === 1 ? '' : 's'}</p>
    </article>
  );
};

export default TrendSignalCard;
