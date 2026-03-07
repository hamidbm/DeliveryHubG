import React, { useMemo } from 'react';
import { buildTimelineRows, RoadmapMilestoneVM } from './roadmapViewModels';

const RoadmapTimelineView: React.FC<{
  milestones: RoadmapMilestoneVM[];
}> = ({ milestones }) => {
  const timeline = useMemo(() => buildTimelineRows(milestones), [milestones]);

  if (!milestones.length) {
    return <div className="text-sm text-slate-400">No milestones available for timeline view.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="text-[11px] text-slate-500">
        Timeline spans {timeline.min ? timeline.min.toISOString().split('T')[0] : '—'} → {timeline.max ? timeline.max.toISOString().split('T')[0] : '—'}
      </div>
      <div className="relative border border-slate-200 rounded-3xl p-6 bg-slate-50/40 min-h-[260px]">
        <div className="space-y-6">
          {timeline.rows.map((row) => (
            <div key={row.id} className="relative">
              <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">{row.name}</div>
              <div className="relative h-5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={`absolute top-0 h-5 rounded-full ${
                    row.intelligence?.readiness === 'NOT_READY' ? 'bg-slate-300' :
                    row.intelligence?.riskLevel === 'HIGH' ? 'bg-rose-500' :
                    row.intelligence?.riskLevel === 'MEDIUM' ? 'bg-amber-500' :
                    'bg-emerald-500'
                  }`}
                  style={{ left: `${row.left}%`, width: `${row.width}%` }}
                  title={`${row.name} (${row.startDate?.split('T')[0] || '—'} → ${row.endDate?.split('T')[0] || '—'}) • Utilization ${row.intelligence?.utilizationPercent != null ? Math.round(row.intelligence.utilizationPercent * 100) : '—'}% • Risk ${row.intelligence?.riskLevel || '—'}`}
                />
              </div>
              <div className="mt-2 flex items-center gap-3 text-[10px] text-slate-500">
                <span>Readiness {row.intelligence?.readiness || '—'}</span>
                <span>Confidence {row.intelligence?.confidence || '—'}</span>
                <span>Capacity {row.targetCapacity ?? '—'}</span>
                <span>Sprints {row.sprintCount ?? '—'}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default RoadmapTimelineView;
