import React from 'react';
import type { MilestoneIntelligence } from './roadmapViewModels';

const heatColor = (state?: MilestoneIntelligence['utilizationState'] | null) => {
  if (state === 'OVERLOADED') return 'rgba(244, 63, 94, 0.35)';
  if (state === 'AT_RISK') return 'rgba(245, 158, 11, 0.35)';
  if (state === 'HEALTHY') return 'rgba(16, 185, 129, 0.3)';
  return 'rgba(148, 163, 184, 0.2)';
};

const CapacityHeatOverlay: React.FC<{
  left: number;
  width: number;
  intelligence?: MilestoneIntelligence | null;
}> = ({ left, width, intelligence }) => {
  const color = heatColor(intelligence?.utilizationState);
  return (
    <div
      className="absolute top-0 h-full rounded-full"
      style={{ left, width: Math.max(6, width), boxShadow: `0 0 16px ${color}` }}
      title={intelligence?.utilizationPercent != null ? `Utilization ${Math.round(intelligence.utilizationPercent * 100)}%` : 'Utilization unavailable'}
    />
  );
};

export default CapacityHeatOverlay;
