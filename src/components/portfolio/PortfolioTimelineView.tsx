import React, { useMemo } from 'react';
import type { PortfolioTimelineRow } from './portfolioViewModels';

const toTime = (value?: string) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.getTime();
};

const formatDate = (value?: string) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toISOString().slice(0, 10);
};

const riskColor = (risk?: string) => {
  if (risk === 'HIGH') return 'bg-rose-500';
  if (risk === 'MEDIUM') return 'bg-amber-400';
  return 'bg-emerald-400';
};

const PortfolioTimelineView: React.FC<{ rows: PortfolioTimelineRow[] }> = ({ rows }) => {
  const bounds = useMemo(() => {
    let min = Infinity;
    let max = -Infinity;
    rows.forEach((row) => {
      row.milestones.forEach((ms) => {
        const start = toTime(ms.startDate);
        const end = toTime(ms.endDate);
        if (start != null) min = Math.min(min, start);
        if (end != null) max = Math.max(max, end);
      });
    });
    if (!Number.isFinite(min) || !Number.isFinite(max) || min === max) return null;
    return { min, max };
  }, [rows]);

  if (!rows.length) return <div className="text-sm text-slate-500">No plans selected.</div>;
  if (!bounds) return <div className="text-sm text-slate-500">Timeline data is not available.</div>;

  const span = bounds.max - bounds.min;

  return (
    <div className="space-y-6">
      {rows.map((row) => (
        <div key={row.planId} className="space-y-2">
          <div className="text-sm font-semibold text-slate-800">{row.planName}</div>
          <div className="relative h-12 rounded-xl bg-slate-50 border border-slate-100 overflow-hidden">
            {row.milestones.map((ms) => {
              const start = toTime(ms.startDate);
              const end = toTime(ms.endDate);
              if (start == null || end == null || end <= start) return null;
              const left = ((start - bounds.min) / span) * 100;
              const width = Math.max(2, ((end - start) / span) * 100);
              return (
                <div
                  key={ms.id}
                  className={`absolute top-2 h-8 rounded-lg ${riskColor(ms.riskLevel)} text-white text-[10px] font-bold px-2 flex items-center`}
                  style={{ left: `${left}%`, width: `${width}%` }}
                  title={`${ms.name} (${formatDate(ms.startDate)} → ${formatDate(ms.endDate)})`}
                >
                  <span className="truncate">{ms.name}</span>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};

export default PortfolioTimelineView;
