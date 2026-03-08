import React from 'react';
import type { ExplainabilityContent } from '../../types';

const ExplainabilityPopover: React.FC<{
  content: ExplainabilityContent;
  onClose: () => void;
  onShowMore?: () => void;
}> = ({ content, onClose, onShowMore }) => (
  <div className="absolute z-50 mt-2 right-0 w-72 rounded-2xl border border-slate-200 bg-white shadow-xl p-4 text-xs text-slate-600">
    <div className="flex items-start justify-between gap-2">
      <div className="text-sm font-bold text-slate-900">{content.title}</div>
      <button onClick={onClose} className="text-slate-400 hover:text-slate-600">×</button>
    </div>
    <div className="mt-2 text-slate-600">{content.shortText}</div>
    {content.whyItMatters && (
      <div className="mt-3">
        <div className="text-[10px] uppercase tracking-widest text-slate-400 font-black">Why it matters</div>
        <div className="mt-1">{content.whyItMatters}</div>
      </div>
    )}
    {content.howToUse && (
      <div className="mt-3">
        <div className="text-[10px] uppercase tracking-widest text-slate-400 font-black">How to use</div>
        <div className="mt-1">{content.howToUse}</div>
      </div>
    )}
    {content.detailText && onShowMore && (
      <button onClick={onShowMore} className="mt-3 text-[10px] uppercase tracking-widest font-black text-slate-500 hover:text-slate-900">
        Show more
      </button>
    )}
  </div>
);

export default ExplainabilityPopover;
