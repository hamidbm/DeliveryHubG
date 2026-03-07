import React from 'react';
import type { SimulationResult } from '../types';

const SimulationResults: React.FC<{ result: SimulationResult }> = ({ result }) => {
  const summary = result.comparison.summary;
  const formatPercent = (value: number | null) => value == null ? '—' : `${Math.round(value * 100)}%`;
  const riskDelta = (baseline: string, scenario: string) => (baseline === scenario ? '—' : `${baseline} → ${scenario}`);
  const dateDeltaDays = (baseline: string, scenario: string) => {
    const base = new Date(baseline);
    const scen = new Date(scenario);
    if (Number.isNaN(base.getTime()) || Number.isNaN(scen.getTime())) return '—';
    const diff = Math.round((scen.getTime() - base.getTime()) / (1000 * 60 * 60 * 24));
    if (diff === 0) return '0 days';
    return `${diff > 0 ? '+' : ''}${diff} days`;
  };

  return (
    <div className="border border-slate-100 rounded-3xl p-6 bg-slate-50/40 space-y-5">
      <div>
        <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Simulation Results</div>
        <div className="text-lg font-semibold text-slate-700">{result.scenario.name}</div>
        {result.scenario.description && (
          <div className="text-sm text-slate-500 mt-1">{result.scenario.description}</div>
        )}
      </div>

      <div className="grid md:grid-cols-4 gap-3 text-sm">
        <div className="bg-white rounded-2xl p-4 border border-slate-100">
          <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Milestones</div>
          <div className="text-xl font-black text-slate-700">{summary.totalMilestones}</div>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-slate-100">
          <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Slipped</div>
          <div className="text-xl font-black text-rose-600">{summary.milestonesSlipped}</div>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-slate-100">
          <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Risk Increases</div>
          <div className="text-xl font-black text-amber-600">{summary.riskIncreaseCount}</div>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-slate-100">
          <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Avg Util Diff</div>
          <div className="text-xl font-black text-slate-700">{summary.averageUtilizationDiff == null ? '—' : `${Math.round(summary.averageUtilizationDiff * 100)}%`}</div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-[10px] uppercase tracking-widest text-slate-400">
              <th className="text-left py-2">Milestone</th>
              <th className="text-left py-2">Baseline End</th>
              <th className="text-left py-2">Scenario End</th>
              <th className="text-left py-2">Baseline Util</th>
              <th className="text-left py-2">Scenario Util</th>
              <th className="text-left py-2">Risk Change</th>
              <th className="text-left py-2">Date Delta</th>
            </tr>
          </thead>
          <tbody>
            {result.comparison.milestoneComparisons.map((row) => (
              <tr key={row.milestoneId} className="border-t border-slate-100">
                <td className="py-2 font-semibold text-slate-700">M{row.milestoneId}</td>
                <td className="py-2 text-slate-500">{row.baselineEndDate.split('T')[0]}</td>
                <td className="py-2 text-slate-500">{row.scenarioEndDate.split('T')[0]}</td>
                <td className="py-2 text-slate-500">{formatPercent(row.baselineCapacityUtilization)}</td>
                <td className="py-2 text-slate-500">{formatPercent(row.scenarioCapacityUtilization)}</td>
                <td className="py-2 text-slate-500">{riskDelta(row.baselineRisk, row.scenarioRisk)}</td>
                <td className="py-2 text-slate-500">{dateDeltaDays(row.baselineEndDate, row.scenarioEndDate)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default SimulationResults;
