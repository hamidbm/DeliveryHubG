import React from 'react';
import type { PortfolioHealthRow } from './portfolioViewModels';

const formatPercent = (value: number | null | undefined) => {
  if (value == null) return '—';
  return `${Math.round(value * 100)}%`;
};

const PortfolioHealthSummary: React.FC<{ rows: PortfolioHealthRow[] }> = ({ rows }) => {
  if (!rows.length) return <div className="text-sm text-slate-500">No plans selected.</div>;
  return (
    <div className="overflow-x-auto border border-slate-100 rounded-2xl bg-white">
      <table className="min-w-full text-sm">
        <thead className="bg-slate-50">
          <tr className="text-left text-[10px] uppercase tracking-widest text-slate-400">
            <th className="px-4 py-3 font-black">Plan</th>
            <th className="px-4 py-3 font-black">Milestones</th>
            <th className="px-4 py-3 font-black">High Risk</th>
            <th className="px-4 py-3 font-black">Overloaded</th>
            <th className="px-4 py-3 font-black">Avg Utilization</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.planId} className="border-t border-slate-100">
              <td className="px-4 py-3 font-semibold text-slate-800">{row.planName}</td>
              <td className="px-4 py-3 text-slate-600">{row.milestoneCount}</td>
              <td className="px-4 py-3 text-slate-600">{row.highRisk}</td>
              <td className="px-4 py-3 text-slate-600">{row.overloaded}</td>
              <td className="px-4 py-3 text-slate-600">{formatPercent(row.avgUtilization)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default PortfolioHealthSummary;
