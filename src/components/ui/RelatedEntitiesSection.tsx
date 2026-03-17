import React from 'react';
import { EntityReference, EntityType } from '../../types/ai';
import EntityGroupPanel from './EntityGroupPanel';

type GroupInput = {
  type: EntityType;
  entities: EntityReference[];
  secondaryMeta?: Record<string, string>;
};

type Props = {
  title?: string;
  groups: GroupInput[];
  compact?: boolean;
};

const ORDER: EntityType[] = ['workitem', 'milestone', 'review', 'application', 'bundle'];

const titleForType = (type: EntityType) => {
  if (type === 'workitem') return 'Work Items';
  if (type === 'milestone') return 'Milestones';
  if (type === 'review') return 'Reviews';
  if (type === 'application') return 'Applications';
  return 'Bundles';
};

const RelatedEntitiesSection: React.FC<Props> = ({ title = 'Related Entities', groups, compact = false }) => {
  const nonEmpty = groups.filter((group) => Array.isArray(group.entities) && group.entities.length > 0);
  if (!nonEmpty.length) return null;

  const ordered = nonEmpty
    .slice()
    .sort((a, b) => ORDER.indexOf(a.type) - ORDER.indexOf(b.type));

  if (compact) {
    return (
      <div className="mt-3 space-y-2">
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{title}</p>
        <div className="flex flex-wrap gap-2">
          {ordered.map((group) => (
            <span
              key={group.type}
              className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-600"
            >
              <span>{titleForType(group.type)}</span>
              <span className="text-slate-400">({group.entities.length})</span>
            </span>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mt-3 space-y-2">
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{title}</p>
      <div className="space-y-2">
        {ordered.map((group) => (
          <EntityGroupPanel
            key={group.type}
            entityType={group.type}
            entities={group.entities}
            secondaryMeta={group.secondaryMeta || {}}
          />
        ))}
      </div>
    </div>
  );
};

export default RelatedEntitiesSection;
