import React from 'react';
import { ScenarioDefinition } from '../../types/ai';

type Props = {
  scenario: ScenarioDefinition;
  onRun: (scenario: ScenarioDefinition) => void;
  onUse: (scenario: ScenarioDefinition) => void;
  onDelete: (scenario: ScenarioDefinition) => void;
  busy?: boolean;
};

const ScenarioCard: React.FC<Props> = ({ scenario, onRun, onUse, onDelete, busy = false }) => {
  return (
    <article className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <p className="text-sm font-semibold text-slate-800 break-words">{scenario.description}</p>
      <p className="text-xs text-slate-500 mt-1">ID: {scenario.id}</p>
      <p className="text-xs text-slate-500 mt-1">Changes: {scenario.changes.length}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onRun(scenario)}
          disabled={busy}
          className="px-2 py-1 rounded border border-blue-200 bg-blue-50 text-xs font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-50"
        >
          Run
        </button>
        <button
          type="button"
          onClick={() => onUse(scenario)}
          disabled={busy}
          className="px-2 py-1 rounded border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
        >
          Load
        </button>
        <button
          type="button"
          onClick={() => onDelete(scenario)}
          disabled={busy}
          className="px-2 py-1 rounded border border-rose-200 bg-rose-50 text-xs font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-50"
        >
          Delete
        </button>
      </div>
    </article>
  );
};

export default ScenarioCard;
