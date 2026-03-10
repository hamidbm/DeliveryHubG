import React from 'react';
import type { MilestoneProbabilisticForecast } from '../../types';

const ForecastBand: React.FC<{
  left: number;
  width: number;
  forecast?: MilestoneProbabilisticForecast | null;
}> = ({ left, width, forecast }) => {
  if (!forecast || width <= 0) return null;
  const title = `P50 ${forecast.p50Date.split('T')[0]} → P90 ${forecast.p90Date.split('T')[0]} • On‑time ${Math.round((forecast.onTimeProbability || 0) * 100)}% • Uncertainty ${forecast.uncertaintyLevel}`;
  return (
    <div
      className="absolute top-0 h-full rounded-full border border-indigo-200/70 bg-indigo-200/40 backdrop-blur-[1px]"
      style={{ left, width: Math.max(6, width) }}
      title={title}
    />
  );
};

export default ForecastBand;
