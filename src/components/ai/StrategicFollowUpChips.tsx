import React from 'react';

type Props = {
  followUps: string[];
  disabled?: boolean;
  onSelect: (question: string) => void;
};

const StrategicFollowUpChips: React.FC<Props> = ({ followUps, disabled = false, onSelect }) => {
  if (!followUps.length) return null;

  return (
    <div>
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Follow-ups</p>
      <div className="flex flex-wrap gap-2">
        {followUps.map((item, idx) => (
          <button
            key={`strategic-follow-up-${idx}`}
            type="button"
            onClick={() => onSelect(item)}
            disabled={disabled}
            className="px-3 py-1 rounded-full border border-blue-200 bg-blue-50 text-xs font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-50"
          >
            {item}
          </button>
        ))}
      </div>
    </div>
  );
};

export default StrategicFollowUpChips;
