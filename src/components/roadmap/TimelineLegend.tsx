import React, { useState } from 'react';

const TimelineLegend: React.FC = () => {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="w-8 h-8 rounded-full border border-slate-200 text-slate-500 text-xs font-black hover:text-slate-900"
        title="Timeline legend"
      >
        i
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-64 rounded-2xl border border-slate-200 bg-white shadow-xl p-3 text-xs text-slate-600 z-20">
          <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Legend</div>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="w-4 h-2 rounded-full bg-slate-700" />
              <span>Committed bar</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-4 h-2 rounded-full bg-indigo-200/70 border border-indigo-200" />
              <span>Probabilistic band (P50–P90)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-4 h-2 rounded-full bg-slate-100 border border-slate-200" />
              <span>Environment overlay</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-4 h-2 rounded-full bg-emerald-400/60" />
              <span>Capacity heat</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-4 h-[2px] bg-amber-500" />
              <span>Dependency arrow</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TimelineLegend;
