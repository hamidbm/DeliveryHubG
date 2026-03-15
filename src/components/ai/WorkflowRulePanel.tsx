import React from 'react';
import { WorkflowRule } from '../../types/ai';

type LoadState = 'idle' | 'loading' | 'ready' | 'error';

const WorkflowRulePanel: React.FC = () => {
  const [state, setState] = React.useState<LoadState>('idle');
  const [rules, setRules] = React.useState<WorkflowRule[]>([]);
  const [error, setError] = React.useState('');
  const [busyRuleId, setBusyRuleId] = React.useState<string | null>(null);
  const [enforcementMessage, setEnforcementMessage] = React.useState('');

  const loadRules = React.useCallback(async () => {
    setState('loading');
    setError('');
    try {
      const res = await fetch('/api/ai/workflow-rules');
      const data = await res.json();
      if (!res.ok || data?.status !== 'success') {
        throw new Error(data?.error || 'Unable to load workflow rules.');
      }
      setRules(Array.isArray(data.rules) ? data.rules : []);
      setState('ready');
    } catch (err: any) {
      setState('error');
      setError(err?.message || 'Unable to load workflow rules.');
    }
  }, []);

  React.useEffect(() => {
    void loadRules();
  }, [loadRules]);

  const toggleRule = async (rule: WorkflowRule, enabled: boolean) => {
    setBusyRuleId(rule.id);
    setError('');
    setEnforcementMessage('');
    try {
      const res = await fetch('/api/ai/workflow-rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ruleId: rule.id, enabled })
      });
      const data = await res.json();
      if (!res.ok || data?.status !== 'success') {
        throw new Error(data?.error || 'Unable to update workflow rule.');
      }
      setRules(Array.isArray(data.rules) ? data.rules : []);
    } catch (err: any) {
      setError(err?.message || 'Unable to update workflow rule.');
    } finally {
      setBusyRuleId(null);
    }
  };

  const runRules = async () => {
    setError('');
    setEnforcementMessage('');
    try {
      const res = await fetch('/api/ai/workflow-rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enforceNow: true })
      });
      const data = await res.json();
      if (!res.ok || data?.status !== 'success') {
        throw new Error(data?.error || 'Unable to run workflow rules.');
      }
      setRules(Array.isArray(data.rules) ? data.rules : []);
      const lines = Array.isArray(data.enforcement)
        ? data.enforcement
            .filter((item: any) => item?.triggered)
            .flatMap((item: any) => (Array.isArray(item.actions) ? item.actions : []))
        : [];
      setEnforcementMessage(lines.length ? lines.join(' ') : 'No active rules were triggered.');
    } catch (err: any) {
      setError(err?.message || 'Unable to run workflow rules.');
    }
  };

  return (
    <section className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <i className="fas fa-diagram-project text-slate-400 text-xs"></i>
          <h3 className="text-sm font-black uppercase tracking-widest text-slate-500">Workflow Rules</h3>
        </div>
        <button
          onClick={runRules}
          disabled={state === 'loading'}
          className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          Run Active Rules
        </button>
      </div>

      {error && <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>}
      {enforcementMessage && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{enforcementMessage}</div>
      )}

      {state === 'loading' && <div className="text-sm text-slate-500">Loading workflow rule suggestions...</div>}

      {rules.map((rule) => (
        <div key={rule.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-900">{rule.description}</p>
              <p className="text-xs text-slate-500 mt-1">Condition: {rule.condition}</p>
              <p className="text-xs text-slate-600 mt-1">{rule.recommendedAction}</p>
            </div>
            <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700">
              <input
                type="checkbox"
                checked={Boolean(rule.enabled)}
                disabled={busyRuleId === rule.id}
                onChange={(event) => {
                  void toggleRule(rule, event.target.checked);
                }}
                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              Enabled
            </label>
          </div>
        </div>
      ))}
    </section>
  );
};

export default WorkflowRulePanel;
