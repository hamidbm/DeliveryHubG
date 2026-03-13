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
};

const ORDER: EntityType[] = ['workitem', 'milestone', 'review', 'application', 'bundle'];

const RelatedEntitiesSection: React.FC<Props> = ({ title = 'Related Entities', groups }) => {
  const nonEmpty = groups.filter((group) => Array.isArray(group.entities) && group.entities.length > 0);
  if (!nonEmpty.length) return null;

  const ordered = nonEmpty
    .slice()
    .sort((a, b) => ORDER.indexOf(a.type) - ORDER.indexOf(b.type));

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
