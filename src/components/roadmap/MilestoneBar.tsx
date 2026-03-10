import React from 'react';
import type { RoadmapMilestoneVM, MilestoneIntelligence } from './roadmapViewModels';
import type { MilestoneForecast, MilestoneProbabilisticForecast } from '../../types';
import MilestoneTooltip from './MilestoneTooltip';
import ForecastBand from './ForecastBand';
import CapacityHeatOverlay from './CapacityHeatOverlay';
import ConfidenceIndicator from './ConfidenceIndicator';

const utilizationGlow = (state?: string | null) => {
  if (state === 'OVERLOADED') return '0 0 12px rgba(244, 63, 94, 0.35)';
  if (state === 'AT_RISK') return '0 0 12px rgba(245, 158, 11, 0.35)';
  if (state === 'HEALTHY') return '0 0 12px rgba(16, 185, 129, 0.35)';
  return '0 0 10px rgba(148, 163, 184, 0.25)';
};

const riskColor = (risk?: string | null) => {
  if (risk === 'HIGH') return 'bg-rose-500';
  if (risk === 'MEDIUM') return 'bg-amber-500';
  if (risk === 'LOW') return 'bg-emerald-500';
  return 'bg-slate-400';
};

const riskIconColor = (risk?: string | null) => {
  if (risk === 'HIGH') return 'text-rose-500';
  if (risk === 'MEDIUM') return 'text-amber-500';
  if (risk === 'LOW') return 'text-emerald-500';
  return 'text-slate-400';
};

const MilestoneBar: React.FC<{
  milestone: RoadmapMilestoneVM;
  intelligence?: MilestoneIntelligence | null;
  forecast?: MilestoneForecast | null;
  probabilistic?: MilestoneProbabilisticForecast | null;
  left: number;
  width: number;
  height: number;
  forecastLeft?: number | null;
  forecastWidth?: number | null;
  showDetails?: boolean;
  onToggleDetails?: () => void;
}> = ({
  milestone,
  intelligence,
  forecast,
  probabilistic,
  left,
  width,
  height,
  forecastLeft,
  forecastWidth,
  showDetails = false,
  onToggleDetails
}) => {
  const title = [
    `Milestone: ${milestone.name}`,
    milestone.startDate && milestone.endDate ? `Window: ${milestone.startDate.split('T')[0]} → ${milestone.endDate.split('T')[0]}` : null,
    intelligence?.riskLevel ? `Risk: ${intelligence.riskLevel}` : null,
    intelligence?.utilizationPercent != null ? `Utilization: ${Math.round(intelligence.utilizationPercent * 100)}%` : null,
    probabilistic ? `P50: ${probabilistic.p50Date.split('T')[0]} | P90: ${probabilistic.p90Date.split('T')[0]}` : null
  ].filter(Boolean).join(' | ');

  return (
    <div className="relative h-full group">
      {forecastLeft != null && forecastWidth != null && (
        <ForecastBand left={forecastLeft} width={forecastWidth} forecast={probabilistic} />
      )}
      <CapacityHeatOverlay left={left} width={width} intelligence={intelligence} />
      <div
        className={`absolute top-0 h-full rounded-full ${riskColor(intelligence?.riskLevel)}`}
        style={{
          left,
          width: Math.max(6, width),
          boxShadow: utilizationGlow(intelligence?.utilizationState)
        }}
        title={title}
      />
      <div className="absolute -top-4 flex items-center gap-2 text-[10px] text-slate-500">
        <span className="font-semibold text-slate-700">{milestone.name}</span>
        {intelligence?.riskLevel ? (
          <i className={`fas fa-exclamation-triangle ${riskIconColor(intelligence?.riskLevel)}`} title={`Risk ${intelligence.riskLevel}`} />
        ) : null}
        {intelligence?.blockedItemCount ? (
          <i className="fas fa-ban text-rose-500" title={`Blocked items ${intelligence.blockedItemCount}`} />
        ) : null}
        {intelligence?.dependencyInbound ? (
          <i className="fas fa-link text-amber-500" title={`Dependency pressure ${intelligence.dependencyInbound}`} />
        ) : null}
        <ConfidenceIndicator
          confidence={intelligence?.confidence}
          onTimeProbability={probabilistic?.onTimeProbability}
          uncertainty={probabilistic?.uncertaintyLevel}
        />
      </div>
      <div className="absolute left-0 bottom-full mb-2 z-30 hidden group-hover:block">
        <MilestoneTooltip milestone={milestone} intelligence={intelligence} probabilistic={probabilistic} />
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleDetails?.();
          }}
          className="mt-2 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-700"
        >
          {showDetails ? 'Less' : 'More'}
        </button>
        {showDetails && (
          <div className="mt-2 w-64 rounded-2xl border border-slate-200 bg-white shadow-xl p-3 text-xs text-slate-600">
            <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Details</div>
            <div className="space-y-1">
              <div>Blocked: {intelligence?.blockedItemCount ?? '—'}</div>
              <div>Dependencies: {intelligence?.dependencyInbound ?? '—'}</div>
              <div>Capacity: {intelligence?.utilizationPercent != null ? `${Math.round(intelligence.utilizationPercent * 100)}%` : '—'}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MilestoneBar;
