import React from 'react';
import { EntityReference, EvidenceItem, RelatedEntitiesMeta } from '../../types/ai';
import EntityEvidenceList from '../ui/EntityEvidenceList';
import RelatedEntitiesSection from '../ui/RelatedEntitiesSection';
import StrategicFollowUpChips from './StrategicFollowUpChips';

type Props = {
  answer: string;
  explanation: string;
  evidence: EvidenceItem[];
  relatedEntities: EntityReference[];
  relatedEntitiesMeta?: RelatedEntitiesMeta;
  followUps: string[];
  warning?: string;
  onFollowUp: (question: string) => void;
  busy?: boolean;
};

const buildGroups = (
  entities: EntityReference[],
  meta: RelatedEntitiesMeta = {}
) => {
  const grouped = {
    workitem: [] as EntityReference[],
    milestone: [] as EntityReference[],
    review: [] as EntityReference[],
    application: [] as EntityReference[],
    bundle: [] as EntityReference[]
  };
  const seen = new Set<string>();

  entities.forEach((entity) => {
    const key = `${entity.type}:${entity.id}`;
    if (seen.has(key)) return;
    seen.add(key);
    grouped[entity.type].push(entity);
  });

  return Object.entries(grouped)
    .map(([type, refs]) => ({
      type: type as keyof typeof grouped,
      entities: refs,
      secondaryMeta: (meta as any)?.[type] || {}
    }))
    .filter((group) => group.entities.length > 0);
};

const StrategicAnswerCard: React.FC<Props> = ({
  answer,
  explanation,
  evidence,
  relatedEntities,
  relatedEntitiesMeta,
  followUps,
  warning,
  onFollowUp,
  busy = false
}) => {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-3">
      <p className="text-sm font-semibold text-slate-900 break-words">{answer}</p>
      <p className="text-sm text-slate-700 break-words">{explanation}</p>

      {warning && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          {warning}
        </div>
      )}

      {evidence.length > 0 && (
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Evidence</p>
          <EntityEvidenceList evidence={evidence} />
        </div>
      )}

      {relatedEntities.length > 0 && (
        <RelatedEntitiesSection
          title="Related Entities"
          groups={buildGroups(relatedEntities, relatedEntitiesMeta)}
        />
      )}

      <StrategicFollowUpChips
        followUps={followUps}
        disabled={busy}
        onSelect={onFollowUp}
      />
    </div>
  );
};

export default StrategicAnswerCard;
