'use client';

import React from 'react';
import { RiskPropagationSignal } from '../../types/ai';
import { resolveEntityHref } from '../../services/ai/evidenceEntities';

type Props = {
  signal: RiskPropagationSignal;
};

const severityStyle = (severity: RiskPropagationSignal['severity']) => {
  if (severity === 'high') return 'bg-rose-50 text-rose-700 border-rose-200';
  if (severity === 'medium') return 'bg-amber-50 text-amber-700 border-amber-200';
  return 'bg-slate-50 text-slate-700 border-slate-200';
};

const PropagationSignalCard: React.FC<Props> = ({ signal }) => {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-semibold text-slate-800 break-words">{signal.title}</p>
        <span className={`text-[10px] font-black uppercase border rounded-full px-2 py-0.5 ${severityStyle(signal.severity)}`}>
          {signal.severity}
        </span>
      </div>

      <p className="text-sm text-slate-700 break-words">{signal.summary}</p>

      {signal.paths?.length > 0 && (
        <div>
          <p className="text-[11px] font-black uppercase tracking-widest text-slate-500 mb-1">Propagation Paths</p>
          <ul className="space-y-1 text-xs text-slate-600 list-disc pl-5">
            {signal.paths.slice(0, 6).map((path, idx) => (
              <li key={`${signal.id}-p-${idx}`} className="break-words">
                {path.from.label} {'->'} {path.to.label} via {path.linkType.replace('_', ' ')}
              </li>
            ))}
          </ul>
        </div>
      )}

      {signal.evidence?.length > 0 && (
        <div>
          <p className="text-[11px] font-black uppercase tracking-widest text-slate-500 mb-1">Evidence</p>
          <ul className="space-y-1 text-xs text-slate-600 list-disc pl-5">
            {signal.evidence.slice(0, 5).map((item, idx) => (
              <li key={`${signal.id}-e-${idx}`} className="break-words">{item.text}</li>
            ))}
          </ul>
        </div>
      )}

      {signal.relatedEntities?.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {signal.relatedEntities.slice(0, 10).map((entity) => (
            <a
              key={`${signal.id}-${entity.type}-${entity.id}`}
              href={resolveEntityHref(entity)}
              className="text-[10px] font-bold uppercase border rounded-full px-2 py-1 bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
            >
              {entity.label}
            </a>
          ))}
        </div>
      )}
    </article>
  );
};

export default PropagationSignalCard;
