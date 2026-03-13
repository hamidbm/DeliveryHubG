'use client';

import React from 'react';
import { ForecastSignal } from '../../types/ai';
import { resolveEntityHref } from '../../services/ai/evidenceEntities';

type Props = {
  signal: ForecastSignal;
};

const severityStyle = (severity: ForecastSignal['severity']) => {
  if (severity === 'high') return 'bg-rose-50 text-rose-700 border-rose-200';
  if (severity === 'medium') return 'bg-amber-50 text-amber-700 border-amber-200';
  return 'bg-slate-50 text-slate-700 border-slate-200';
};

const ForecastSignalCard: React.FC<Props> = ({ signal }) => {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-800 break-words">{signal.title}</p>
          <p className="text-xs text-slate-500 mt-1 uppercase tracking-widest">{signal.category.replace('_', ' ')}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-[10px] font-black uppercase border rounded-full px-2 py-0.5 ${severityStyle(signal.severity)}`}>{signal.severity}</span>
          <span className="text-[10px] font-black uppercase border rounded-full px-2 py-0.5 bg-blue-50 text-blue-700 border-blue-200">
            {(signal.confidence * 100).toFixed(0)}% conf
          </span>
        </div>
      </div>

      <p className="text-sm text-slate-700 break-words">{signal.summary}</p>

      {signal.evidence?.length > 0 && (
        <div>
          <p className="text-[11px] font-black uppercase tracking-widest text-slate-500 mb-1">Evidence</p>
          <ul className="space-y-1 text-xs text-slate-600 list-disc pl-5">
            {signal.evidence.map((item, idx) => (
              <li key={`${signal.id}-e-${idx}`} className="break-words">{item.text}</li>
            ))}
          </ul>
        </div>
      )}

      {signal.relatedEntities?.length ? (
        <div className="flex flex-wrap gap-2">
          {signal.relatedEntities.slice(0, 8).map((entity) => (
            <a
              key={`${signal.id}-${entity.type}-${entity.id}`}
              href={resolveEntityHref(entity)}
              className="text-[10px] font-bold uppercase border rounded-full px-2 py-1 bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
            >
              {entity.label}
            </a>
          ))}
        </div>
      ) : null}
    </article>
  );
};

export default ForecastSignalCard;
