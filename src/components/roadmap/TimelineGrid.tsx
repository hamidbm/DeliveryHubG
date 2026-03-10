import React from 'react';

type TimelineTick = {
  date: Date;
  label: string;
  left: number;
};

const TimelineGrid: React.FC<{
  width: number;
  height: number;
  ticks: TimelineTick[];
}> = ({ width, height, ticks }) => {
  return (
    <div className="relative" style={{ width, height }}>
      {ticks.map((tick, idx) => (
        <div key={`${tick.label}-${idx}`} className="absolute top-0 bottom-0" style={{ left: tick.left }}>
          <div className="h-full w-px bg-slate-200/70" />
          <div className="absolute -top-5 text-[10px] font-black uppercase tracking-widest text-slate-400 whitespace-nowrap">
            {tick.label}
          </div>
        </div>
      ))}
    </div>
  );
};

export default TimelineGrid;
