import React from 'react';
import { ActionPlan, TaskSuggestion } from '../../types/ai';
import TaskSuggestionCard from './TaskSuggestionCard';

type Props = {
  embeddedPlan?: ActionPlan;
};

type LoadState = 'idle' | 'loading' | 'ready' | 'error';

const priorityOrder: Record<string, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1
};

const ActionPlanPanel: React.FC<Props> = ({ embeddedPlan }) => {
  const [state, setState] = React.useState<LoadState>('idle');
  const [error, setError] = React.useState('');
  const [plan, setPlan] = React.useState<ActionPlan | null>(embeddedPlan || null);
  const [selectedTaskIds, setSelectedTaskIds] = React.useState<Set<string>>(new Set());
  const [creating, setCreating] = React.useState(false);
  const [createdTaskCount, setCreatedTaskCount] = React.useState<number | null>(null);

  const hydrateSelection = React.useCallback((nextPlan: ActionPlan) => {
    setSelectedTaskIds(new Set((nextPlan.suggestTasks || []).slice(0, 3).map((item) => item.id)));
  }, []);

  React.useEffect(() => {
    if (embeddedPlan) {
      setPlan(embeddedPlan);
      hydrateSelection(embeddedPlan);
      setState('ready');
      return;
    }

    const load = async () => {
      setState('loading');
      setError('');
      try {
        const res = await fetch('/api/ai/action-plan');
        const data = await res.json();
        if (!res.ok || data?.status !== 'success' || !data?.actionPlan) {
          throw new Error(data?.error || 'Unable to load action plan.');
        }
        setPlan(data.actionPlan);
        hydrateSelection(data.actionPlan);
        setState('ready');
      } catch (err: any) {
        setState('error');
        setError(err?.message || 'Unable to load action plan.');
      }
    };

    void load();
  }, [embeddedPlan, hydrateSelection]);

  const refresh = async () => {
    setState('loading');
    setError('');
    setCreatedTaskCount(null);
    try {
      const res = await fetch('/api/ai/action-plan', { method: 'POST' });
      const data = await res.json();
      if (!res.ok || data?.status !== 'success' || !data?.actionPlan) {
        throw new Error(data?.error || 'Unable to refresh action plan.');
      }
      setPlan(data.actionPlan);
      hydrateSelection(data.actionPlan);
      setState('ready');
    } catch (err: any) {
      setState('error');
      setError(err?.message || 'Unable to refresh action plan.');
    }
  };

  const toggleSelect = (id: string, checked: boolean) => {
    setSelectedTaskIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const createTasks = async (items: TaskSuggestion[]) => {
    if (!items.length) return;
    setCreating(true);
    setCreatedTaskCount(null);
    setError('');
    try {
      const payload = {
        tasks: items.map((item) => ({
          title: item.title,
          description: item.description,
          priority: item.priority,
          linkedEntity: item.relatedEntities[0],
          relatedEntities: item.relatedEntities
        }))
      };
      const res = await fetch('/api/ai/tasks/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok || data?.status !== 'success') {
        throw new Error(data?.error || 'Unable to create tasks.');
      }
      const count = Array.isArray(data.createdTaskIds) ? data.createdTaskIds.length : 0;
      setCreatedTaskCount(count);
    } catch (err: any) {
      setError(err?.message || 'Unable to create tasks.');
    } finally {
      setCreating(false);
    }
  };

  const selectedTasks = React.useMemo(() => {
    const all = plan?.suggestTasks || [];
    return all.filter((item) => selectedTaskIds.has(item.id));
  }, [plan, selectedTaskIds]);

  const steps = (plan?.steps || [])
    .slice()
    .sort((a, b) => (priorityOrder[b.priority] || 0) - (priorityOrder[a.priority] || 0));

  return (
    <section className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <i className="fas fa-list-check text-slate-400 text-xs"></i>
          <h3 className="text-sm font-black uppercase tracking-widest text-slate-500">Action Plan</h3>
        </div>
        <button
          onClick={refresh}
          disabled={state === 'loading'}
          className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          {state === 'loading' ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>
      )}

      {state === 'loading' && (
        <div className="text-sm text-slate-500">Building prioritized execution actions...</div>
      )}

      {plan && (
        <div className="space-y-3">
          <p className="text-sm text-slate-700">{plan.summary}</p>

          <div className="space-y-2">
            {steps.map((step, index) => (
              <div key={step.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-900">{index + 1}. {step.description}</p>
                  <span className="text-[10px] px-2 py-0.5 rounded-full border bg-slate-100 text-slate-700 border-slate-200 uppercase font-bold">
                    {step.priority}
                  </span>
                </div>
                {step.evidence?.length > 0 && (
                  <ul className="mt-2 text-xs text-slate-600 list-disc pl-4 space-y-1">
                    {step.evidence.slice(0, 3).map((item, idx) => (
                      <li key={`${step.id}-e-${idx}`}>{item.text}</li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>

          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-black uppercase tracking-widest text-slate-400">Task Suggestions</p>
              <button
                onClick={() => createTasks(selectedTasks)}
                disabled={creating || selectedTasks.length === 0}
                className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 disabled:opacity-50"
              >
                {creating ? 'Creating Tasks...' : `Create Selected (${selectedTasks.length})`}
              </button>
            </div>

            {createdTaskCount !== null && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                Created {createdTaskCount} task{createdTaskCount === 1 ? '' : 's'}.
              </div>
            )}

            {(plan.suggestTasks || []).map((item) => (
              <TaskSuggestionCard
                key={item.id}
                suggestion={item}
                selected={selectedTaskIds.has(item.id)}
                disabled={creating}
                creating={creating}
                onSelect={toggleSelect}
                onCreate={(task) => createTasks([task])}
              />
            ))}

            {(plan.suggestTasks || []).length === 0 && (
              <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3 text-sm text-slate-500">
                No task suggestions available for current signals.
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
};

export default ActionPlanPanel;
