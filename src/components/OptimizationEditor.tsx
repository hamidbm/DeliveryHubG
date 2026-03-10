import React, { useEffect, useMemo, useState } from 'react';
import type {
  OptimizationObjectiveWeights,
  PlanOptimizationResult,
  PortfolioPlanSummary
} from '../types';
import ExplainabilityIcon from './explainability/ExplainabilityIcon';

const DEFAULT_WEIGHTS: OptimizationObjectiveWeights = {
  onTime: 0.4,
  riskReduction: 0.3,
  capacityBalance: 0.2,
  slippageMinimization: 0.1
};

const WeightSlider: React.FC<{
  label: string;
  value: number;
  onChange: (value: number) => void;
}> = ({ label, value, onChange }) => (
  <label className="block">
    <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">
      <span>{label}</span>
      <span>{Math.round(value * 100)}%</span>
    </div>
    <input
      type="range"
      min={0}
      max={100}
      value={Math.round(value * 100)}
      onChange={(e) => onChange(Number(e.target.value) / 100)}
      className="w-full accent-blue-600"
    />
  </label>
);

const normalizeWeights = (weights: OptimizationObjectiveWeights): OptimizationObjectiveWeights => {
  const sum = Object.values(weights).reduce((acc, value) => acc + value, 0);
  if (sum <= 0) return { ...DEFAULT_WEIGHTS };
  return {
    onTime: weights.onTime / sum,
    riskReduction: weights.riskReduction / sum,
    capacityBalance: weights.capacityBalance / sum,
    slippageMinimization: weights.slippageMinimization / sum
  };
};

const OptimizationEditor: React.FC<{ onClose: () => void; onApplied?: () => void }> = ({ onClose, onApplied }) => {
  const [plans, setPlans] = useState<PortfolioPlanSummary[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [weights, setWeights] = useState<OptimizationObjectiveWeights>({ ...DEFAULT_WEIGHTS });
  const [noChangeBeforeDate, setNoChangeBeforeDate] = useState('');
  const [environmentBounds, setEnvironmentBounds] = useState(true);
  const [maxVariants, setMaxVariants] = useState(5);
  const [timeoutMs, setTimeoutMs] = useState(3000);
  const [result, setResult] = useState<PlanOptimizationResult | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [acceptedVariantId, setAcceptedVariantId] = useState<string | null>(null);
  const [applyPendingVariantId, setApplyPendingVariantId] = useState<string | null>(null);
  const [applyMessage, setApplyMessage] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/portfolio/plans');
        if (!res.ok) throw new Error('Failed to load plans');
        const data = await res.json();
        const items = Array.isArray(data) ? data : [];
        setPlans(items);
        if (items[0]?.id) setSelectedPlanId(items[0].id);
      } catch (err: any) {
        setError(err?.message || 'Failed to load plans');
      }
    };
    load();
  }, []);

  const runOptimization = async () => {
    if (!selectedPlanId) {
      setError('Select a plan to optimize.');
      return;
    }

    setError(null);
    setApplyMessage(null);
    setRunning(true);
    setAcceptedVariantId(null);

    try {
      const res = await fetch(`/api/optimize/plan/${encodeURIComponent(selectedPlanId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          objectiveWeights: normalizeWeights(weights),
          constraints: {
            noChangeBeforeDate: noChangeBeforeDate || undefined,
            environmentBounds
          },
          options: {
            maxVariants,
            timeoutMs
          }
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Optimization failed');
      setResult(data);
    } catch (err: any) {
      setError(err?.message || 'Optimization failed');
    } finally {
      setRunning(false);
    }
  };

  const applyVariant = async (variantId: string) => {
    if (!selectedPlanId || !result) return;
    setError(null);
    setApplyMessage(null);
    setApplyPendingVariantId(variantId);
    try {
      const res = await fetch(`/api/optimize/plan/${encodeURIComponent(selectedPlanId)}/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          variantId,
          objectiveWeights: normalizeWeights(weights),
          constraints: {
            noChangeBeforeDate: noChangeBeforeDate || undefined,
            environmentBounds
          },
          options: {
            maxVariants,
            timeoutMs
          }
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed to apply variant');
      setAcceptedVariantId(variantId);
      setApplyMessage(`Applied ${variantId} successfully.`);
      if (typeof onApplied === 'function') onApplied();
    } catch (err: any) {
      setError(err?.message || 'Failed to apply variant');
    } finally {
      setApplyPendingVariantId(null);
    }
  };

  const recommendedVariant = useMemo(() => {
    if (!result?.optimizedVariants?.length) return null;
    return result.optimizedVariants.find((variant) => variant.variantId === result.recommendedVariantId) || result.optimizedVariants[0];
  }, [result]);

  return (
    <div className="fixed inset-0 z-[235] flex items-center justify-center p-6">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose}></div>
      <div className="relative bg-white rounded-[2.5rem] w-full max-w-6xl p-10 shadow-2xl max-h-[92vh] overflow-y-auto custom-scrollbar">
        <header className="flex items-start justify-between mb-6">
          <div>
            <h3 className="text-2xl font-black text-slate-900 tracking-tight">Schedule Optimization</h3>
            <p className="text-sm text-slate-500">Generate objective-weighted optimization variants and inspect explainable deltas.</p>
          </div>
          <button onClick={onClose} className="w-10 h-10 rounded-full bg-slate-50 text-slate-400 hover:text-rose-500 flex items-center justify-center">
            <i className="fas fa-times"></i>
          </button>
        </header>

        {error && (
          <div className="mb-4 p-3 rounded-xl border border-rose-100 bg-rose-50 text-rose-600 text-sm">{error}</div>
        )}
        {applyMessage && (
          <div className="mb-4 p-3 rounded-xl border border-emerald-100 bg-emerald-50 text-emerald-700 text-sm">{applyMessage}</div>
        )}

        <div className="grid lg:grid-cols-5 gap-6">
          <section className="lg:col-span-2 space-y-5 border border-slate-100 rounded-2xl p-5 bg-slate-50">
            <div>
              <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Plan</label>
              <select
                value={selectedPlanId}
                onChange={(e) => setSelectedPlanId(e.target.value)}
                className="w-full mt-2 bg-white border border-slate-200 rounded-xl px-4 py-2 text-xs font-bold"
              >
                {plans.map((plan) => (
                  <option key={plan.id} value={plan.id}>
                    {plan.name} • {plan.source}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500">
                Objective Weights <ExplainabilityIcon explainabilityKey="scenario_delta" />
              </div>
              <WeightSlider label="On-Time" value={weights.onTime} onChange={(value) => setWeights((prev) => ({ ...prev, onTime: value }))} />
              <WeightSlider label="Risk Reduction" value={weights.riskReduction} onChange={(value) => setWeights((prev) => ({ ...prev, riskReduction: value }))} />
              <WeightSlider label="Capacity Balance" value={weights.capacityBalance} onChange={(value) => setWeights((prev) => ({ ...prev, capacityBalance: value }))} />
              <WeightSlider label="Slippage Minimization" value={weights.slippageMinimization} onChange={(value) => setWeights((prev) => ({ ...prev, slippageMinimization: value }))} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">No Change Before</span>
                <input
                  type="date"
                  value={noChangeBeforeDate}
                  onChange={(e) => setNoChangeBeforeDate(e.target.value)}
                  className="mt-2 w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs"
                />
              </label>
              <label className="block">
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Max Variants</span>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={maxVariants}
                  onChange={(e) => setMaxVariants(Math.max(1, Math.min(10, Number(e.target.value) || 1)))}
                  className="mt-2 w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs"
                />
              </label>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Timeout (ms)</span>
                <input
                  type="number"
                  min={500}
                  max={15000}
                  step={100}
                  value={timeoutMs}
                  onChange={(e) => setTimeoutMs(Math.max(500, Math.min(15000, Number(e.target.value) || 3000)))}
                  className="mt-2 w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs"
                />
              </label>
              <label className="flex items-center gap-2 mt-7 text-xs font-bold text-slate-600">
                <input
                  type="checkbox"
                  checked={environmentBounds}
                  onChange={(e) => setEnvironmentBounds(e.target.checked)}
                  className="rounded border-slate-300"
                />
                Respect env bounds
              </label>
            </div>

            <button
              onClick={runOptimization}
              disabled={running}
              className="w-full px-6 py-2.5 rounded-xl bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest hover:bg-blue-600 disabled:opacity-60"
            >
              {running ? 'Optimizing...' : 'Run Optimization'}
            </button>
          </section>

          <section className="lg:col-span-3 space-y-5">
            {!result ? (
              <div className="border border-slate-100 rounded-2xl p-8 text-sm text-slate-500 bg-white">
                Run optimization to generate candidate variants.
              </div>
            ) : (
              <>
                <div className="border border-slate-100 rounded-2xl p-5 bg-white">
                  <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">Baseline Summary</div>
                  <div className="grid sm:grid-cols-4 gap-3 text-xs">
                    <div className="rounded-xl border border-slate-100 p-3">
                      <div className="text-slate-400 uppercase text-[9px] font-black">On-Time</div>
                      <div className="text-slate-900 font-black text-lg">{Math.round(result.baselinePlan.summary.onTimeProbability * 100)}%</div>
                    </div>
                    <div className="rounded-xl border border-slate-100 p-3">
                      <div className="text-slate-400 uppercase text-[9px] font-black">Expected Slip</div>
                      <div className="text-slate-900 font-black text-lg">{result.baselinePlan.summary.expectedSlippageDays}d</div>
                    </div>
                    <div className="rounded-xl border border-slate-100 p-3">
                      <div className="text-slate-400 uppercase text-[9px] font-black">Risk</div>
                      <div className="text-slate-900 font-black text-lg">{result.baselinePlan.summary.riskScore}</div>
                    </div>
                    <div className="rounded-xl border border-slate-100 p-3">
                      <div className="text-slate-400 uppercase text-[9px] font-black">Readiness</div>
                      <div className="text-slate-900 font-black text-lg">{result.baselinePlan.summary.readinessScore}</div>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  {(result.optimizedVariants || []).map((variant) => (
                    <article key={variant.variantId} className={`border rounded-2xl p-4 ${recommendedVariant?.variantId === variant.variantId ? 'border-blue-200 bg-blue-50/40' : 'border-slate-100 bg-white'}`}>
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-black text-slate-900">{variant.name}</h4>
                            {recommendedVariant?.variantId === variant.variantId && (
                              <span className="px-2 py-0.5 rounded-full bg-blue-600 text-white text-[9px] font-black uppercase tracking-widest">Recommended</span>
                            )}
                            {acceptedVariantId === variant.variantId && (
                              <span className="px-2 py-0.5 rounded-full bg-emerald-600 text-white text-[9px] font-black uppercase tracking-widest">Accepted</span>
                            )}
                          </div>
                          <p className="text-xs text-slate-500">{variant.description}</p>
                        </div>
                        <div className="text-right">
                          <div className="text-[9px] uppercase tracking-widest text-slate-400 font-black">Score</div>
                          <div className="text-lg font-black text-slate-900">{variant.score}</div>
                        </div>
                      </div>

                      <div className="grid sm:grid-cols-4 gap-2 mt-3 text-xs">
                        <div className="rounded-lg bg-slate-50 px-2 py-2">On-Time: {Math.round(variant.metrics.onTimeProbability * 100)}%</div>
                        <div className="rounded-lg bg-slate-50 px-2 py-2">Slip: {variant.metrics.expectedSlippageDays}d</div>
                        <div className="rounded-lg bg-slate-50 px-2 py-2">Risk: {variant.metrics.riskScore}</div>
                        <div className="rounded-lg bg-slate-50 px-2 py-2">Readiness: {variant.metrics.readinessScore}</div>
                      </div>

                      {!!variant.changes?.length && (
                        <details className="mt-3 text-xs">
                          <summary className="cursor-pointer text-slate-600 font-semibold">{variant.changes.length} change(s)</summary>
                          <div className="mt-2 space-y-1 text-slate-500">
                            {variant.changes.slice(0, 8).map((change, idx) => (
                              <div key={`${variant.variantId}-change-${idx}`}>• {change.milestoneName || change.milestoneId}: {change.category} update</div>
                            ))}
                            {variant.changes.length > 8 && <div>• +{variant.changes.length - 8} more...</div>}
                          </div>
                        </details>
                      )}

                      {!!variant.explanations?.length && (
                        <div className="mt-3 space-y-1 text-xs text-slate-500">
                          {variant.explanations.map((reason, idx) => (
                            <div key={`${variant.variantId}-reason-${idx}`}>• {reason.description}</div>
                          ))}
                        </div>
                      )}

                      <div className="mt-3 flex gap-2">
                        <button
                          onClick={() => applyVariant(variant.variantId)}
                          disabled={!!applyPendingVariantId}
                          className="px-3 py-1.5 rounded-lg bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest hover:bg-blue-600 disabled:opacity-60"
                        >
                          {applyPendingVariantId === variant.variantId ? 'Applying...' : 'Apply Variant'}
                        </button>
                        <button
                          onClick={() => setAcceptedVariantId((prev) => (prev === variant.variantId ? null : prev))}
                          className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-500 text-[10px] font-black uppercase tracking-widest hover:text-slate-800"
                        >
                          Reject
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};

export default OptimizationEditor;
