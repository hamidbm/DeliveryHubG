import React, { useEffect, useState } from 'react';
import type { SimulationOverride, SimulationScenario, SimulationResult } from '../types';
import SimulationResults from './SimulationResults';

type PreviewOption = {
  id: string;
  createdAt: string;
  scopeType: string;
  scopeId: string;
  input: any;
  preview: any;
};

const overrideTemplates: Array<{ type: SimulationOverride['type']; label: string }> = [
  { type: 'CAPACITY_SHIFT', label: 'Capacity Shift' },
  { type: 'SCOPE_GROWTH', label: 'Scope Growth' },
  { type: 'DATE_SHIFT', label: 'Date Shift' },
  { type: 'VELOCITY_ADJUSTMENT', label: 'Velocity Adjustment' }
];

const SimulationEditor: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [previews, setPreviews] = useState<PreviewOption[]>([]);
  const [selectedPreviewId, setSelectedPreviewId] = useState('');
  const [scenarioName, setScenarioName] = useState('New Scenario');
  const [scenarioDescription, setScenarioDescription] = useState('');
  const [overrides, setOverrides] = useState<SimulationOverride[]>([]);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/work-items/plan/previews?limit=10');
        if (!res.ok) return;
        const data = await res.json();
        setPreviews(Array.isArray(data) ? data : []);
        if (data?.[0]?.id) setSelectedPreviewId(String(data[0].id));
      } catch {}
    };
    load();
  }, []);

  const addOverride = (type: SimulationOverride['type']) => {
    setOverrides((prev) => [...prev, { type, params: {} }]);
  };

  const updateOverride = (index: number, patch: Partial<SimulationOverride>) => {
    setOverrides((prev) => prev.map((o, i) => (i === index ? { ...o, ...patch } : o)));
  };

  const updateOverrideParam = (index: number, key: string, value: any) => {
    setOverrides((prev) => prev.map((o, i) => (i === index ? { ...o, params: { ...o.params, [key]: value } } : o)));
  };

  const removeOverride = (index: number) => {
    setOverrides((prev) => prev.filter((_, i) => i !== index));
  };

  const runSimulation = async () => {
    const selected = previews.find((p) => p.id === selectedPreviewId);
    if (!selected?.input) {
      setError('Select a baseline plan preview.');
      return;
    }
    setError(null);
    setRunning(true);
    try {
      const scenario: SimulationScenario = {
        name: scenarioName,
        description: scenarioDescription || undefined,
        overrides
      };
      const res = await fetch('/api/work-items/plan/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ baselineInput: selected.input, scenario })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Simulation failed');
      setResult(data);
    } catch (err: any) {
      setError(err?.message || 'Simulation failed');
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[230] flex items-center justify-center p-6">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose}></div>
      <div className="relative bg-white rounded-[2.5rem] w-full max-w-5xl p-10 shadow-2xl max-h-[90vh] overflow-y-auto custom-scrollbar">
        <header className="flex items-start justify-between mb-6">
          <div>
            <h3 className="text-2xl font-black text-slate-900 tracking-tight">Delivery Simulation</h3>
            <p className="text-sm text-slate-500">Run what-if scenarios against an existing plan preview.</p>
          </div>
          <button onClick={onClose} className="w-10 h-10 rounded-full bg-slate-50 text-slate-400 hover:text-red-500 flex items-center justify-center">
            <i className="fas fa-times"></i>
          </button>
        </header>

        {error && (
          <div className="mb-4 p-3 rounded-xl border border-rose-100 bg-rose-50 text-rose-600 text-sm">{error}</div>
        )}

        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Baseline Preview</label>
              <select
                value={selectedPreviewId}
                onChange={(e) => setSelectedPreviewId(e.target.value)}
                className="w-full mt-2 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-xs font-bold"
              >
                {previews.map((preview) => (
                  <option key={preview.id} value={preview.id}>
                    {preview.scopeType} {preview.scopeId} • {new Date(preview.createdAt).toLocaleString()}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Scenario Name</label>
              <input
                value={scenarioName}
                onChange={(e) => setScenarioName(e.target.value)}
                className="w-full mt-2 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-xs font-bold"
              />
            </div>

            <div>
              <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Description</label>
              <textarea
                value={scenarioDescription}
                onChange={(e) => setScenarioDescription(e.target.value)}
                className="w-full mt-2 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-xs font-medium h-20"
              />
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Overrides</label>
              <div className="flex flex-wrap gap-2">
                {overrideTemplates.map((o) => (
                  <button
                    key={o.type}
                    onClick={() => addOverride(o.type)}
                    className="px-3 py-1 rounded-full bg-slate-100 text-[9px] font-black uppercase tracking-widest text-slate-600 hover:bg-slate-200"
                  >
                    + {o.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-3">
              {overrides.map((override, index) => (
                <div key={`${override.type}-${index}`} className="border border-slate-100 rounded-2xl p-4 bg-slate-50">
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">{override.type}</div>
                    <button onClick={() => removeOverride(index)} className="text-slate-400 hover:text-rose-500 text-xs">Remove</button>
                  </div>
                  {override.type === 'CAPACITY_SHIFT' && (
                    <input
                      type="number"
                      value={override.params.deltaCapacity || ''}
                      onChange={(e) => updateOverrideParam(index, 'deltaCapacity', Number(e.target.value))}
                      placeholder="Delta capacity"
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs"
                    />
                  )}
                  {override.type === 'SCOPE_GROWTH' && (
                    <input
                      type="number"
                      value={override.params.percentIncrease || ''}
                      onChange={(e) => updateOverrideParam(index, 'percentIncrease', Number(e.target.value))}
                      placeholder="Percent increase"
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs"
                    />
                  )}
                  {override.type === 'DATE_SHIFT' && (
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="number"
                        value={override.params.shiftDays || ''}
                        onChange={(e) => updateOverrideParam(index, 'shiftDays', Number(e.target.value))}
                        placeholder="Shift days"
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs"
                      />
                      <input
                        value={override.params.milestoneId || ''}
                        onChange={(e) => updateOverrideParam(index, 'milestoneId', e.target.value)}
                        placeholder="Milestone Id (optional)"
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs"
                      />
                    </div>
                  )}
                  {override.type === 'VELOCITY_ADJUSTMENT' && (
                    <input
                      type="number"
                      value={override.params.deltaVelocity || ''}
                      onChange={(e) => updateOverrideParam(index, 'deltaVelocity', Number(e.target.value))}
                      placeholder="Delta velocity"
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs"
                    />
                  )}
                </div>
              ))}
              {!overrides.length && (
                <div className="text-xs text-slate-400">Add one or more overrides to run a scenario.</div>
              )}
            </div>
          </div>
        </div>

        <footer className="mt-8 flex items-center justify-end gap-4">
          <button onClick={onClose} className="px-4 py-2 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-700">
            Close
          </button>
          <button
            onClick={runSimulation}
            disabled={running}
            className="px-6 py-2 rounded-xl bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest hover:bg-blue-600"
          >
            {running ? 'Running...' : 'Run Simulation'}
          </button>
        </footer>

        {result && (
          <div className="mt-8">
            <SimulationResults result={result} />
          </div>
        )}
      </div>
    </div>
  );
};

export default SimulationEditor;
