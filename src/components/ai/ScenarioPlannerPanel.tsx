import React from 'react';
import { ScenarioChange, ScenarioDefinition, ScenarioResult } from '../../types/ai';
import ScenarioCard from './ScenarioCard';
import ScenarioResultPanel from './ScenarioResultPanel';

type SaveResponse = { status: 'success' | 'error'; scenarioId?: string; error?: string };
type ListResponse = { status: 'success' | 'error'; scenarios?: ScenarioDefinition[]; error?: string };
type RunResponse = { status: 'success' | 'error'; scenarioResult?: ScenarioResult; error?: string };

const createScenarioId = () => `scenario-${Date.now().toString(36)}`;
const emptyScenario = (): ScenarioDefinition => ({ id: createScenarioId(), description: '', changes: [] });

const parseIds = (csv: string) => csv.split(',').map((item) => item.trim()).filter(Boolean);

const ScenarioPlannerPanel: React.FC = () => {
  const [scenario, setScenario] = React.useState<ScenarioDefinition>(emptyScenario());
  const [savedScenarios, setSavedScenarios] = React.useState<ScenarioDefinition[]>([]);
  const [result, setResult] = React.useState<ScenarioResult | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');

  const [changeType, setChangeType] = React.useState<ScenarioChange['type']>('reassignWorkItems');
  const [workItemIds, setWorkItemIds] = React.useState('');
  const [toOwner, setToOwner] = React.useState('');
  const [milestoneId, setMilestoneId] = React.useState('');
  const [newDate, setNewDate] = React.useState('');
  const [newPriority, setNewPriority] = React.useState('1');
  const [fromBundleId, setFromBundleId] = React.useState('');
  const [toBundleId, setToBundleId] = React.useState('');
  const [shiftCount, setShiftCount] = React.useState('1');

  const refreshScenarios = React.useCallback(async () => {
    try {
      const res = await fetch('/api/ai/scenarios');
      if (!res.ok) return;
      const data = await res.json() as ListResponse;
      if (data.status === 'success' && Array.isArray(data.scenarios)) {
        setSavedScenarios(data.scenarios);
      }
    } catch {
      // Ignore list refresh failures.
    }
  }, []);

  React.useEffect(() => {
    void refreshScenarios();
  }, [refreshScenarios]);

  const addChange = () => {
    const nextChanges = [...scenario.changes];

    if (changeType === 'reassignWorkItems') {
      const ids = parseIds(workItemIds);
      if (!ids.length || !toOwner.trim()) return;
      nextChanges.push({ type: 'reassignWorkItems', workItemIds: ids, toOwner: toOwner.trim() });
    } else if (changeType === 'adjustMilestoneDate') {
      if (!milestoneId.trim() || !newDate.trim()) return;
      nextChanges.push({ type: 'adjustMilestoneDate', milestoneId: milestoneId.trim(), newDate: newDate.trim() });
    } else if (changeType === 'adjustPriority') {
      const ids = parseIds(workItemIds);
      const p = Number(newPriority);
      if (!ids.length || !Number.isFinite(p)) return;
      nextChanges.push({ type: 'adjustPriority', workItemIds: ids, newPriority: p });
    } else {
      const count = Number(shiftCount);
      if (!fromBundleId.trim() || !toBundleId.trim() || !Number.isFinite(count) || count <= 0) return;
      nextChanges.push({
        type: 'bundleResourceShift',
        fromBundleId: fromBundleId.trim(),
        toBundleId: toBundleId.trim(),
        count
      });
    }

    setScenario((prev) => ({ ...prev, changes: nextChanges }));
  };

  const removeChange = (index: number) => {
    setScenario((prev) => ({
      ...prev,
      changes: prev.changes.filter((_, idx) => idx !== index)
    }));
  };

  const saveScenario = async () => {
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/ai/scenarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenario })
      });
      const data = await res.json() as SaveResponse;
      if (!res.ok || data.status !== 'success') {
        setError(data.error || 'Unable to save scenario.');
        return;
      }
      await refreshScenarios();
    } catch {
      setError('Unable to save scenario.');
    } finally {
      setBusy(false);
    }
  };

  const runScenario = async (value: ScenarioDefinition) => {
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/ai/scenario', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenario: value })
      });
      const data = await res.json() as RunResponse;
      if (!res.ok || data.status !== 'success' || !data.scenarioResult) {
        setError(data.error || 'Unable to run scenario.');
        return;
      }
      setResult(data.scenarioResult);
    } catch {
      setError('Unable to run scenario.');
    } finally {
      setBusy(false);
    }
  };

  const deleteScenario = async (value: ScenarioDefinition) => {
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`/api/ai/scenarios/${encodeURIComponent(value.id)}`, { method: 'DELETE' });
      if (!res.ok) {
        setError('Unable to delete scenario.');
        return;
      }
      await refreshScenarios();
    } catch {
      setError('Unable to delete scenario.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <i className="fas fa-flask text-slate-400 text-xs"></i>
          <h3 className="text-sm font-black uppercase tracking-widest text-slate-500">Scenario Planner</h3>
        </div>
        <button
          type="button"
          onClick={() => {
            setScenario(emptyScenario());
            setResult(null);
          }}
          className="px-2 py-1 rounded border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-100"
        >
          New Scenario
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        <input
          value={scenario.id}
          onChange={(event) => setScenario((prev) => ({ ...prev, id: event.target.value }))}
          placeholder="Scenario ID"
          className="px-3 py-2 rounded-lg border border-slate-300 text-sm text-slate-700"
        />
        <input
          value={scenario.description}
          onChange={(event) => setScenario((prev) => ({ ...prev, description: event.target.value }))}
          placeholder="Scenario description"
          className="px-3 py-2 rounded-lg border border-slate-300 text-sm text-slate-700"
        />
      </div>

      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-2">
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Add Change</p>
        <select
          value={changeType}
          onChange={(event) => setChangeType(event.target.value as ScenarioChange['type'])}
          className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm text-slate-700"
        >
          <option value="reassignWorkItems">Reassign Work Items</option>
          <option value="adjustMilestoneDate">Adjust Milestone Date</option>
          <option value="adjustPriority">Adjust Priority</option>
          <option value="bundleResourceShift">Bundle Resource Shift</option>
        </select>

        {(changeType === 'reassignWorkItems' || changeType === 'adjustPriority') && (
          <input
            value={workItemIds}
            onChange={(event) => setWorkItemIds(event.target.value)}
            placeholder="Work item IDs/keys (comma-separated)"
            className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm text-slate-700"
          />
        )}

        {changeType === 'reassignWorkItems' && (
          <input
            value={toOwner}
            onChange={(event) => setToOwner(event.target.value)}
            placeholder="Target owner/team"
            className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm text-slate-700"
          />
        )}

        {changeType === 'adjustMilestoneDate' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <input
              value={milestoneId}
              onChange={(event) => setMilestoneId(event.target.value)}
              placeholder="Milestone ID"
              className="px-3 py-2 rounded-lg border border-slate-300 text-sm text-slate-700"
            />
            <input
              type="date"
              value={newDate}
              onChange={(event) => setNewDate(event.target.value)}
              className="px-3 py-2 rounded-lg border border-slate-300 text-sm text-slate-700"
            />
          </div>
        )}

        {changeType === 'adjustPriority' && (
          <input
            type="number"
            value={newPriority}
            onChange={(event) => setNewPriority(event.target.value)}
            placeholder="New priority"
            className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm text-slate-700"
          />
        )}

        {changeType === 'bundleResourceShift' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <input
              value={fromBundleId}
              onChange={(event) => setFromBundleId(event.target.value)}
              placeholder="From bundle ID"
              className="px-3 py-2 rounded-lg border border-slate-300 text-sm text-slate-700"
            />
            <input
              value={toBundleId}
              onChange={(event) => setToBundleId(event.target.value)}
              placeholder="To bundle ID"
              className="px-3 py-2 rounded-lg border border-slate-300 text-sm text-slate-700"
            />
            <input
              type="number"
              value={shiftCount}
              onChange={(event) => setShiftCount(event.target.value)}
              placeholder="Count"
              className="px-3 py-2 rounded-lg border border-slate-300 text-sm text-slate-700"
            />
          </div>
        )}

        <button
          type="button"
          onClick={addChange}
          className="px-3 py-1.5 rounded border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-100"
        >
          Add Change
        </button>
      </div>

      {scenario.changes.length > 0 && (
        <div className="space-y-2">
          {scenario.changes.map((change, idx) => (
            <div key={`scenario-change-${idx}`} className="rounded-md border border-slate-200 bg-slate-50 p-2 flex items-start justify-between gap-2">
              <p className="text-xs text-slate-700 break-words">{JSON.stringify(change)}</p>
              <button
                type="button"
                onClick={() => removeChange(idx)}
                className="px-2 py-1 rounded border border-rose-200 bg-rose-50 text-xs font-semibold text-rose-700 hover:bg-rose-100"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={saveScenario}
          disabled={busy}
          className="px-3 py-1.5 rounded border border-blue-200 bg-blue-50 text-xs font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-50"
        >
          Save Scenario
        </button>
        <button
          type="button"
          onClick={() => runScenario(scenario)}
          disabled={busy}
          className="px-3 py-1.5 rounded border border-emerald-200 bg-emerald-50 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
        >
          Run Simulation
        </button>
      </div>

      {error && <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>}

      {savedScenarios.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Saved Scenarios</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {savedScenarios.map((item) => (
              <ScenarioCard
                key={item.id}
                scenario={item}
                onRun={runScenario}
                onUse={(value) => setScenario(value)}
                onDelete={deleteScenario}
                busy={busy}
              />
            ))}
          </div>
        </div>
      )}

      <ScenarioResultPanel result={result} />
    </section>
  );
};

export default ScenarioPlannerPanel;
