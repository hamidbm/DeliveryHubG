import React from 'react';

export type TimelineZoomLevel = 'quarter' | 'month' | 'sprint' | 'week';

const zoomOrder: TimelineZoomLevel[] = ['quarter', 'month', 'sprint', 'week'];

const ZoomLabel: Record<TimelineZoomLevel, string> = {
  quarter: 'Quarter',
  month: 'Month',
  sprint: 'Sprint',
  week: 'Week'
};

const TimelineZoomControls: React.FC<{
  zoom: TimelineZoomLevel;
  onChange: (next: TimelineZoomLevel) => void;
}> = ({ zoom, onChange }) => {
  const index = zoomOrder.indexOf(zoom);
  const canZoomOut = index > 0;
  const canZoomIn = index < zoomOrder.length - 1;

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => canZoomOut && onChange(zoomOrder[index - 1])}
        className={`w-8 h-8 rounded-full border text-xs font-black ${canZoomOut ? 'border-slate-200 text-slate-500 hover:text-slate-900' : 'border-slate-100 text-slate-300 cursor-not-allowed'}`}
        title="Zoom out"
      >
        −
      </button>
      <div className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-slate-100 text-slate-600">
        {ZoomLabel[zoom]}
      </div>
      <button
        type="button"
        onClick={() => canZoomIn && onChange(zoomOrder[index + 1])}
        className={`w-8 h-8 rounded-full border text-xs font-black ${canZoomIn ? 'border-slate-200 text-slate-500 hover:text-slate-900' : 'border-slate-100 text-slate-300 cursor-not-allowed'}`}
        title="Zoom in"
      >
        +
      </button>
    </div>
  );
};

export default TimelineZoomControls;
