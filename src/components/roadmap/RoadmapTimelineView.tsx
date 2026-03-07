import React, { useMemo } from 'react';
import { buildTimelineRows, RoadmapMilestoneVM } from './roadmapViewModels';
import type { MilestoneForecast } from '../../types';

const RoadmapTimelineView: React.FC<{
  milestones: RoadmapMilestoneVM[];
  forecastByMilestone?: Record<string, MilestoneForecast>;
}> = ({ milestones, forecastByMilestone = {} }) => {
  const timeline = useMemo(() => buildTimelineRows(milestones), [milestones]);
  const bounds = useMemo(() => {
    let min = Infinity;
    let max = -Infinity;
    milestones.forEach((m) => {
      if (m.startDate) {
        const start = new Date(m.startDate).getTime();
        if (Number.isFinite(start)) min = Math.min(min, start);
      }
      if (m.endDate) {
        const end = new Date(m.endDate).getTime();
        if (Number.isFinite(end)) max = Math.max(max, end);
      }
      const forecast = forecastByMilestone[m.id];
      if (forecast) {
        const best = new Date(forecast.bestCaseDate).getTime();
        const worst = new Date(forecast.worstCaseDate).getTime();
        if (Number.isFinite(best)) min = Math.min(min, best);
        if (Number.isFinite(worst)) max = Math.max(max, worst);
      }
    });
    if (!Number.isFinite(min) || !Number.isFinite(max) || min === max) return null;
    return { min, max, span: max - min };
  }, [milestones, forecastByMilestone]);

  if (!milestones.length) {
    return <div className="text-sm text-slate-400">No milestones available for timeline view.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="text-[11px] text-slate-500">
        Timeline spans {bounds ? new Date(bounds.min).toISOString().split('T')[0] : '—'} → {bounds ? new Date(bounds.max).toISOString().split('T')[0] : '—'}
      </div>
      <div className="relative border border-slate-200 rounded-3xl p-6 bg-slate-50/40 min-h-[260px]">
        <div className="space-y-6">
          {timeline.rows.map((row) => (
            <div key={row.id} className="relative">
              <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">{row.name}</div>
              <div className="relative h-5 bg-slate-100 rounded-full overflow-hidden">
                {bounds && forecastByMilestone[row.id] && (
                  <div
                    className="absolute top-0 h-5 rounded-full bg-slate-300/40"
                    style={{
                      left: `${((new Date(forecastByMilestone[row.id].bestCaseDate).getTime() - bounds.min) / bounds.span) * 100}%`,
                      width: `${Math.max(1, ((new Date(forecastByMilestone[row.id].worstCaseDate).getTime() - new Date(forecastByMilestone[row.id].bestCaseDate).getTime()) / bounds.span) * 100)}%`
                    }}
                    title={`Forecast ${forecastByMilestone[row.id].bestCaseDate.split('T')[0]} → ${forecastByMilestone[row.id].worstCaseDate.split('T')[0]}`}
                  />
                )}
                <div
                  className={`absolute top-0 h-5 rounded-full ${
                    row.intelligence?.readiness === 'NOT_READY' ? 'bg-slate-300' :
                    row.intelligence?.riskLevel === 'HIGH' ? 'bg-rose-500' :
                    row.intelligence?.riskLevel === 'MEDIUM' ? 'bg-amber-500' :
                    'bg-emerald-500'
                  }`}
                  style={{
                    left: bounds && row.startDate ? `${((new Date(row.startDate).getTime() - bounds.min) / bounds.span) * 100}%` : `${row.left}%`,
                    width: bounds && row.startDate && row.endDate
                      ? `${Math.max(1, ((new Date(row.endDate).getTime() - new Date(row.startDate).getTime()) / bounds.span) * 100)}%`
                      : `${row.width}%`
                  }}
                  title={`${row.name} (${row.startDate?.split('T')[0] || '—'} → ${row.endDate?.split('T')[0] || '—'}) • Utilization ${row.intelligence?.utilizationPercent != null ? Math.round(row.intelligence.utilizationPercent * 100) : '—'}% • Risk ${row.intelligence?.riskLevel || '—'}`}
                />
              </div>
              <div className="mt-2 flex items-center gap-3 text-[10px] text-slate-500">
                <span>Readiness {row.intelligence?.readiness || '—'}</span>
                <span>Confidence {row.intelligence?.confidence || '—'}</span>
                <span>Capacity {row.targetCapacity ?? '—'}</span>
                <span>Sprints {row.sprintCount ?? '—'}</span>
                {forecastByMilestone[row.id] && (
                  <span>
                    Forecast {forecastByMilestone[row.id].bestCaseDate.split('T')[0]} – {forecastByMilestone[row.id].worstCaseDate.split('T')[0]}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default RoadmapTimelineView;
