import React, { useMemo } from 'react';
import { buildSwimlaneRows, RoadmapMilestoneVM } from './roadmapViewModels';
import type { MilestoneForecast } from '../../types';

const RoadmapSwimlaneView: React.FC<{
  milestones: RoadmapMilestoneVM[];
  forecastByMilestone?: Record<string, MilestoneForecast>;
}> = ({ milestones, forecastByMilestone = {} }) => {
  const rows = useMemo(() => buildSwimlaneRows(milestones), [milestones]);

  if (!milestones.length) {
    return <div className="text-sm text-slate-400">No milestones available for swimlane view.</div>;
  }

  return (
    <div className="space-y-5">
      {rows.map((row) => (
        <div key={row.id} className="border border-slate-200 rounded-3xl p-5 bg-white">
          <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-4">{row.label}</div>
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
            {row.milestones.map((milestone) => (
              <div
                key={milestone.id}
                className={`border border-slate-100 rounded-2xl p-4 ${
                  milestone.intelligence?.readiness === 'NOT_READY' ? 'bg-slate-100' :
                  milestone.intelligence?.riskLevel === 'HIGH' ? 'bg-rose-50' :
                  milestone.intelligence?.riskLevel === 'MEDIUM' ? 'bg-amber-50' :
                  'bg-emerald-50'
                }`}
              >
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">{milestone.name}</div>
                <div className="text-xs text-slate-600 mt-1">
                  {milestone.startDate?.split('T')[0] || '—'} → {milestone.endDate?.split('T')[0] || '—'}
                </div>
                <div className="mt-3 flex flex-wrap gap-2 text-[9px] font-black uppercase tracking-widest">
                  <span className={`px-2 py-1 rounded-full ${
                    milestone.intelligence?.readiness === 'READY' ? 'bg-emerald-100 text-emerald-700' :
                    milestone.intelligence?.readiness === 'PARTIAL' ? 'bg-amber-100 text-amber-700' :
                    'bg-slate-200 text-slate-600'
                  }`}>
                    Readiness {milestone.intelligence?.readiness || '—'}
                  </span>
                  <span className="px-2 py-1 rounded-full bg-slate-100 text-slate-600">
                    Capacity {milestone.targetCapacity ?? '—'} • {milestone.intelligence?.utilizationPercent != null ? `${Math.round(milestone.intelligence.utilizationPercent * 100)}%` : '—'}
                  </span>
                  <span className="px-2 py-1 rounded-full bg-slate-100 text-slate-600">
                    Sprints {milestone.sprintCount ?? '—'}
                  </span>
                  <span className="px-2 py-1 rounded-full bg-slate-100 text-slate-600">
                    Risk {milestone.intelligence?.riskLevel || '—'}
                  </span>
                  <span className="px-2 py-1 rounded-full bg-slate-100 text-slate-600">
                    Blocked {milestone.intelligence?.blockedItemCount ?? 0}
                  </span>
                  {forecastByMilestone[milestone.id] && (
                    <span className="px-2 py-1 rounded-full bg-slate-100 text-slate-600">
                      Forecast {forecastByMilestone[milestone.id].bestCaseDate.split('T')[0]} – {forecastByMilestone[milestone.id].worstCaseDate.split('T')[0]}
                    </span>
                  )}
                  {forecastByMilestone[milestone.id] && (
                    <span className="px-2 py-1 rounded-full bg-slate-100 text-slate-600">
                      Confidence {forecastByMilestone[milestone.id].forecastConfidence} • Slip {forecastByMilestone[milestone.id].slipRisk}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

export default RoadmapSwimlaneView;
