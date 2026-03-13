import React, { useMemo } from 'react';
import { EntityReference, EvidenceItem } from '../../types/ai';
import { resolveEntityHref } from '../../services/ai/evidenceEntities';

const typeLabel = (type: EntityReference['type']) => {
  if (type === 'workitem') return 'Work Items';
  if (type === 'application') return 'Applications';
  if (type === 'bundle') return 'Bundles';
  if (type === 'milestone') return 'Milestones';
  return 'Reviews';
};

const EntityEvidenceList: React.FC<{
  evidence?: EvidenceItem[];
  maxRelated?: number;
}> = ({ evidence = [], maxRelated = 20 }) => {
  const grouped = useMemo(() => {
    const byType: Record<string, EntityReference[]> = {};
    const seen = new Set<string>();
    evidence.forEach((item) => {
      (item.entities || []).forEach((entity) => {
        const key = `${entity.type}:${entity.id}`;
        if (seen.has(key)) return;
        seen.add(key);
        const bucket = byType[entity.type] || [];
        if (bucket.length < maxRelated) {
          bucket.push(entity);
        }
        byType[entity.type] = bucket;
      });
    });
    return byType;
  }, [evidence, maxRelated]);

  if (!evidence.length) return null;

  return (
    <div className="mt-2 space-y-2">
      <ul className="list-disc pl-5 text-sm text-slate-600 space-y-1">
        {evidence.map((item, idx) => (
          <li key={`ev-${idx}`}>
            <span className="break-words">{item.text}</span>
            {item.entities?.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-2">
                {item.entities.slice(0, 6).map((entity) => (
                  <a
                    key={`${entity.type}:${entity.id}`}
                    href={resolveEntityHref(entity)}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-blue-200 bg-blue-50 text-[11px] font-semibold text-blue-700 hover:bg-blue-100"
                  >
                    <span>{entity.label}</span>
                    {entity.secondary && <span className="text-blue-500">({entity.secondary})</span>}
                  </a>
                ))}
              </div>
            )}
          </li>
        ))}
      </ul>

      {Object.keys(grouped).length > 0 && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Related Entities</p>
          <div className="space-y-2">
            {Object.entries(grouped).map(([type, entries]) => (
              <div key={type}>
                <p className="text-[11px] font-bold text-slate-500 uppercase">{typeLabel(type as EntityReference['type'])}</p>
                <div className="mt-1 flex flex-wrap gap-2">
                  {entries.map((entity) => (
                    <a
                      key={`${entity.type}:${entity.id}`}
                      href={resolveEntityHref(entity)}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-slate-300 bg-white text-[11px] font-semibold text-slate-700 hover:bg-slate-100"
                    >
                      <span>{entity.label}</span>
                      {entity.secondary && <span className="text-slate-500">({entity.secondary})</span>}
                    </a>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default EntityEvidenceList;
