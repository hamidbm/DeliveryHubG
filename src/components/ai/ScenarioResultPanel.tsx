import React from 'react';
import { ScenarioResult } from '../../types/ai';

const deltaClass = (value: number) => {
  if (value > 0) return 'text-emerald-700';
  if (value < 0) return 'text-rose-700';
  return 'text-slate-600';
};

const arrow = (value: number) => {
  if (value > 0) return '↑';
  if (value < 0) return '↓';
  return '→';
};

const ScenarioResultPanel: React.FC<{ result: ScenarioResult | null }> = ({ result }) => {
  if (!result) return null;

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-3">
      <div>
        <p className="text-sm font-semibold text-slate-800 break-words">{result.description}</p>
        <p className="text-xs text-slate-500 mt-1">Scenario ID: {result.scenarioId}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        <div className="rounded-md border border-slate-200 bg-white p-2">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Health Score</p>
          <p className="text-lg font-bold text-slate-800">{result.healthScore.overall}</p>
        </div>
        <div className="rounded-md border border-slate-200 bg-white p-2">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Forecast / Propagation</p>
          <p className="text-sm text-slate-700">{result.forecastSignals.length} forecast signals</p>
          <p className="text-sm text-slate-700">{result.riskPropagationSignals.length} propagation signals</p>
        </div>
      </div>

      <div>
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Delta Metrics</p>
        <div className="rounded-md border border-slate-200 bg-white overflow-hidden">
          <table className="w-full text-xs">
            <tbody>
              {Object.entries(result.metricDeltas || {}).map(([metric, value]) => (
                <tr key={metric} className="border-b border-slate-100 last:border-b-0">
                  <td className="px-2 py-1.5 text-slate-600">{metric}</td>
                  <td className={`px-2 py-1.5 text-right font-semibold ${deltaClass(value)}`}>{arrow(value)} {value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Recommendations</p>
        <ul className="space-y-1 text-sm text-slate-700 list-disc pl-5">
          {(result.recommendations || []).map((item, idx) => (
            <li key={`scenario-rec-${idx}`} className="break-words">{item}</li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default ScenarioResultPanel;
