import React from 'react';
import type { ExplainabilityContent } from '../../types';

const ExplainabilityDrawer: React.FC<{ content: ExplainabilityContent; onClose: () => void }> = ({ content, onClose }) => (
  <>
    <div className="fixed inset-0 bg-black/20 z-40" onClick={onClose}></div>
    <div className="fixed right-0 top-0 h-full w-full max-w-md bg-white z-50 shadow-2xl p-6 overflow-y-auto">
      <div className="flex items-center justify-between">
        <div className="text-lg font-black text-slate-900">{content.title}</div>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl">×</button>
      </div>
      <div className="mt-4 text-sm text-slate-600">{content.shortText}</div>
      {content.detailText && <div className="mt-4 text-sm text-slate-700">{content.detailText}</div>}
      {content.whyItMatters && (
        <div className="mt-4">
          <div className="text-[10px] uppercase tracking-widest text-slate-400 font-black">Why it matters</div>
          <div className="mt-2 text-sm text-slate-700">{content.whyItMatters}</div>
        </div>
      )}
      {content.howToUse && (
        <div className="mt-4">
          <div className="text-[10px] uppercase tracking-widest text-slate-400 font-black">How to use</div>
          <div className="mt-2 text-sm text-slate-700">{content.howToUse}</div>
        </div>
      )}
      {content.actions && content.actions.length > 0 && (
        <div className="mt-4">
          <div className="text-[10px] uppercase tracking-widest text-slate-400 font-black">Actions</div>
          <ul className="mt-2 text-sm text-slate-700 space-y-1">
            {content.actions.map((action) => (
              <li key={action}>{action}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  </>
);

export default ExplainabilityDrawer;
