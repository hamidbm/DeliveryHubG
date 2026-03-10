import React from 'react';
import type { PlanningEnvironmentEntry } from '../../types';

type EnvironmentBand = {
  name: string;
  start: number;
  end: number;
  left: number;
  width: number;
};

const formatLabel = (name: string) => {
  const upper = String(name || '').toUpperCase();
  if (upper === 'PROD') return 'Prod Deployment';
  return upper;
};

const EnvironmentOverlay: React.FC<{
  environments: PlanningEnvironmentEntry[];
  bounds: { min: number; max: number; span: number };
  width: number;
  goLiveDate?: string | null;
}> = ({ environments, bounds, width, goLiveDate }) => {
  const bands: EnvironmentBand[] = [];
  const ordered = environments
    .filter((env) => env?.startDate)
    .map((env) => ({ ...env, name: String(env.name || '').toUpperCase() }))
    .sort((a, b) => new Date(a.startDate || '').getTime() - new Date(b.startDate || '').getTime());

  ordered.forEach((env, idx) => {
    const start = new Date(env.startDate || '').getTime();
    if (!Number.isFinite(start)) return;
    const next = ordered[idx + 1];
    const end = env.endDate ? new Date(env.endDate).getTime() : (next?.startDate ? new Date(next.startDate).getTime() : bounds.max);
    const safeEnd = Number.isFinite(end) ? end : bounds.max;
    const left = ((start - bounds.min) / bounds.span) * width;
    const widthPx = Math.max(2, ((safeEnd - start) / bounds.span) * width);
    bands.push({ name: env.name, start, end: safeEnd, left, width: widthPx });
  });

  if (!bands.length && !goLiveDate) return null;

  const goLiveTimestamp = goLiveDate ? new Date(goLiveDate).getTime() : null;
  const goLiveLeft = goLiveTimestamp && Number.isFinite(goLiveTimestamp)
    ? ((goLiveTimestamp - bounds.min) / bounds.span) * width
    : null;

  return (
    <div className="relative h-10">
      {bands.map((band, idx) => (
        <div
          key={`${band.name}-${idx}`}
          className="absolute top-0 h-10 rounded-full bg-slate-200/70 border border-slate-300/80 flex items-center px-3 text-[10px] font-black uppercase tracking-widest text-slate-600"
          style={{ left: band.left, width: band.width }}
          title={`${formatLabel(band.name)} (${new Date(band.start).toISOString().split('T')[0]} → ${new Date(band.end).toISOString().split('T')[0]})`}
        >
          {formatLabel(band.name)}
        </div>
      ))}
      {goLiveLeft != null && (
        <div
          className="absolute top-0 bottom-0"
          style={{ left: goLiveLeft }}
          title={`Go-Live / Business Cutover ${goLiveDate ? `(${new Date(goLiveDate).toISOString().split('T')[0]})` : ''}`}
        >
          <div className="w-px h-10 bg-rose-400" />
          <div className="absolute -top-5 left-2 text-[10px] font-black uppercase tracking-widest text-rose-500 whitespace-nowrap">
            Go-Live / Business Cutover
          </div>
        </div>
      )}
    </div>
  );
};

export default EnvironmentOverlay;
