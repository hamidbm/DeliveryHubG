'use client';

import React from 'react';
import { ExecutiveSummary } from '../../types/ai';

type Props = {
  summary: ExecutiveSummary;
};

const healthLabelStyle = (label: ExecutiveSummary['portfolioHealth']['healthLabel']) => {
  if (label === 'healthy') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (label === 'moderate_risk') return 'bg-amber-50 text-amber-700 border-amber-200';
  return 'bg-rose-50 text-rose-700 border-rose-200';
};

const ExecutiveSummaryCard: React.FC<Props> = ({ summary }) => {
  const components = summary.portfolioHealth.components || {};
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 space-y-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-widest text-slate-500">Portfolio Health</p>
          <p className="text-3xl font-black text-slate-900 mt-1">{summary.portfolioHealth.overallScore}/100</p>
        </div>
        <span className={`text-xs font-black uppercase tracking-widest px-3 py-1 rounded-full border ${healthLabelStyle(summary.portfolioHealth.healthLabel)}`}>
          {summary.portfolioHealth.healthLabel.replace('_', ' ')}
        </span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        {Object.entries(components).map(([key, value]) => (
          <div key={key} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{key}</p>
            <p className="text-lg font-bold text-slate-800">{value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl border border-slate-100 p-4">
          <p className="text-xs font-black uppercase tracking-widest text-slate-500 mb-2">Key Observations</p>
          <ul className="space-y-2 text-sm text-slate-700 list-disc pl-5">
            {summary.keyObservations.map((line, idx) => <li key={`${idx}-${line}`}>{line}</li>)}
          </ul>
        </div>
        <div className="rounded-xl border border-slate-100 p-4">
          <p className="text-xs font-black uppercase tracking-widest text-slate-500 mb-2">Strategic Concerns</p>
          <ul className="space-y-2 text-sm text-slate-700 list-disc pl-5">
            {summary.strategicConcerns.map((line, idx) => <li key={`${idx}-${line}`}>{line}</li>)}
          </ul>
        </div>
      </div>

      <div className="rounded-xl border border-slate-100 p-4">
        <p className="text-xs font-black uppercase tracking-widest text-slate-500 mb-2">Recommendations</p>
        <ul className="space-y-2 text-sm text-slate-700 list-disc pl-5">
          {summary.recommendations.map((line, idx) => <li key={`${idx}-${line}`}>{line}</li>)}
        </ul>
      </div>
    </section>
  );
};

export default ExecutiveSummaryCard;
