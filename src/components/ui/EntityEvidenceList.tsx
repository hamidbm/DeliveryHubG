import React from 'react';
import { EvidenceItem } from '../../types/ai';
import { resolveEntityHref } from '../../services/ai/evidenceEntities';

const EntityEvidenceList: React.FC<{
  evidence?: EvidenceItem[];
}> = ({ evidence = [] }) => {
  if (!evidence.length) return null;

  return (
    <div className="mt-2">
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
    </div>
  );
};

export default EntityEvidenceList;
