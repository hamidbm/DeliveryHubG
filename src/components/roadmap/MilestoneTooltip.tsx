import React from 'react';
import type { RoadmapMilestoneVM, MilestoneIntelligence } from './roadmapViewModels';
import type { MilestoneProbabilisticForecast } from '../../types';

const formatDate = (value?: string) => value ? value.split('T')[0] : '—';

const MilestoneTooltip: React.FC<{
  milestone: RoadmapMilestoneVM;
  intelligence?: MilestoneIntelligence | null;
  probabilistic?: MilestoneProbabilisticForecast | null;
}> = ({ milestone, intelligence, probabilistic }) => {
  const bundleText = milestone.bundleLabel || milestone.bundleId || '';
  const applicationText = milestone.applicationLabel || milestone.applicationId || '';

  return (
    <div className="w-64 rounded-2xl border border-slate-200 bg-white shadow-xl p-3 text-xs text-slate-600">
      <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Milestone</div>
      <div className="text-sm font-semibold text-slate-800">{milestone.name}</div>
      <div className="mt-2 space-y-1">
        {bundleText ? <div>Bundle: {bundleText}</div> : null}
        {applicationText ? <div>Application: {applicationText}</div> : null}
        <div>Planned: {formatDate(milestone.startDate)} → {formatDate(milestone.endDate)}</div>
        {probabilistic && (
          <>
            <div>P50: {formatDate(probabilistic.p50Date)}</div>
            <div>P90: {formatDate(probabilistic.p90Date)}</div>
            <div>On‑Time: {Math.round((probabilistic.onTimeProbability || 0) * 100)}%</div>
          </>
        )}
        {intelligence && (
          <>
            <div>Confidence: {intelligence.confidence}</div>
            <div>Risk: {intelligence.riskLevel}</div>
          </>
        )}
      </div>
    </div>
  );
};

export default MilestoneTooltip;
