import React from 'react';
import { TaskSuggestion } from '../../types/ai';
import EntityEvidenceList from '../ui/EntityEvidenceList';
import RelatedEntitiesSection from '../ui/RelatedEntitiesSection';

type Props = {
  suggestion: TaskSuggestion;
  selected?: boolean;
  disabled?: boolean;
  creating?: boolean;
  onSelect?: (id: string, selected: boolean) => void;
  onCreate?: (suggestion: TaskSuggestion) => void;
};

const buildGroups = (suggestion: TaskSuggestion) => {
  const groups = {
    workitem: [] as typeof suggestion.relatedEntities,
    milestone: [] as typeof suggestion.relatedEntities,
    review: [] as typeof suggestion.relatedEntities,
    application: [] as typeof suggestion.relatedEntities,
    bundle: [] as typeof suggestion.relatedEntities
  };

  suggestion.relatedEntities.forEach((entity) => {
    groups[entity.type].push(entity);
  });

  return Object.entries(groups)
    .filter(([, entities]) => entities.length > 0)
    .map(([type, entities]) => ({ type: type as keyof typeof groups, entities }));
};

const priorityStyle = (priority: TaskSuggestion['priority']) => {
  if (priority === 'critical') return 'bg-rose-100 text-rose-700 border-rose-200';
  if (priority === 'high') return 'bg-orange-100 text-orange-700 border-orange-200';
  if (priority === 'medium') return 'bg-amber-100 text-amber-700 border-amber-200';
  return 'bg-slate-100 text-slate-700 border-slate-200';
};

const TaskSuggestionCard: React.FC<Props> = ({
  suggestion,
  selected = false,
  disabled = false,
  creating = false,
  onSelect,
  onCreate
}) => (
  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-2">
    <div className="flex items-start gap-2">
      {onSelect && (
        <input
          type="checkbox"
          checked={selected}
          disabled={disabled}
          onChange={(event) => onSelect(suggestion.id, event.target.checked)}
          className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
        />
      )}
      <div className="flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold text-slate-900">{suggestion.title}</p>
          <span className={`text-[10px] px-2 py-0.5 rounded-full border font-bold uppercase ${priorityStyle(suggestion.priority)}`}>
            {suggestion.priority}
          </span>
        </div>
        <p className="text-sm text-slate-600 mt-1">{suggestion.description}</p>
      </div>
    </div>

    {suggestion.evidence?.length > 0 && (
      <div>
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Evidence</p>
        <EntityEvidenceList evidence={suggestion.evidence} />
      </div>
    )}

    {suggestion.relatedEntities?.length > 0 && (
      <RelatedEntitiesSection title="Linked Entities" groups={buildGroups(suggestion)} />
    )}

    {onCreate && (
      <div className="pt-1">
        <button
          onClick={() => onCreate(suggestion)}
          disabled={disabled || creating}
          className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 disabled:opacity-50"
        >
          {creating ? 'Creating...' : 'Create Task'}
        </button>
      </div>
    )}
  </div>
);

export default TaskSuggestionCard;
