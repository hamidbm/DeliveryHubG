import React, { useMemo, useState } from 'react';
import { EntityReference, EntityType } from '../../types/ai';
import { resolveEntityHref } from '../../services/ai/evidenceEntities';

type Props = {
  entityType: EntityType;
  entities: EntityReference[];
  secondaryMeta?: Record<string, string>;
};

const groupTitle = (type: EntityType) => {
  if (type === 'workitem') return 'Related Work Items';
  if (type === 'milestone') return 'Related Milestones';
  if (type === 'review') return 'Related Reviews';
  if (type === 'application') return 'Related Applications';
  return 'Related Bundles';
};

const extractDueTs = (meta: string) => {
  const m = meta.match(/due\s+([A-Za-z]{3}\s+\d{1,2}(?:,\s*\d{4})?|\d{4}-\d{2}-\d{2})/i);
  if (!m) return Number.MAX_SAFE_INTEGER;
  const d = new Date(m[1]);
  return Number.isNaN(d.getTime()) ? Number.MAX_SAFE_INTEGER : d.getTime();
};

const scoreFor = (type: EntityType, meta: string) => {
  const lower = meta.toLowerCase();
  let score = 0;
  if (type === 'workitem') {
    if (lower.includes('blocked')) score += 1000;
    if (lower.includes('overdue')) score += 800;
    if (lower.includes('unassigned')) score += 600;
    score -= Math.min(extractDueTs(meta), Number.MAX_SAFE_INTEGER) / 1e10;
  } else if (type === 'milestone') {
    if (lower.includes('overdue')) score += 1000;
    score -= Math.min(extractDueTs(meta), Number.MAX_SAFE_INTEGER) / 1e10;
  } else if (type === 'review') {
    if (lower.includes('overdue')) score += 900;
    if (lower.includes('open')) score += 700;
    score -= Math.min(extractDueTs(meta), Number.MAX_SAFE_INTEGER) / 1e10;
  } else if (type === 'application') {
    if (lower.includes('critical')) score += 900;
    if (lower.includes('warning')) score += 700;
  } else if (type === 'bundle') {
    if (lower.includes('critical')) score += 900;
    const m = lower.match(/(\d+)\s*critical/);
    if (m) score += Number(m[1]) * 20;
  }
  return score;
};

const EntityGroupPanel: React.FC<Props> = ({ entityType, entities, secondaryMeta = {} }) => {
  const [expanded, setExpanded] = useState(false);
  const deduped = useMemo(() => {
    const seen = new Set<string>();
    return entities.filter((entity) => {
      const key = `${entity.type}:${entity.id}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [entities]);

  const sorted = useMemo(() => {
    return deduped
      .slice()
      .sort((a, b) => {
        const aMeta = secondaryMeta[a.id] || a.secondary || '';
        const bMeta = secondaryMeta[b.id] || b.secondary || '';
        return scoreFor(entityType, bMeta) - scoreFor(entityType, aMeta);
      });
  }, [deduped, secondaryMeta, entityType]);

  if (!sorted.length) return null;

  const total = sorted.length;
  const bounded = sorted.slice(0, 50);
  const collapsedLimit = total > 50 ? 15 : 5;
  const visible = expanded ? bounded : bounded.slice(0, collapsedLimit);
  const remaining = Math.max(0, total - collapsedLimit);

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <p className="text-[11px] font-black uppercase tracking-widest text-slate-500 mb-2">
        {groupTitle(entityType)} ({total})
      </p>
      <ul className="space-y-1.5">
        {visible.map((entity) => {
          const meta = secondaryMeta[entity.id] || entity.secondary || '';
          return (
            <li key={`${entity.type}:${entity.id}`} className="text-sm text-slate-700">
              <a href={resolveEntityHref(entity)} className="underline decoration-slate-300 hover:decoration-blue-500 font-semibold">
                {entity.label}
              </a>
              {meta && <span className="text-slate-500"> • {meta}</span>}
            </li>
          );
        })}
      </ul>
      {total > collapsedLimit && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-2 text-xs font-semibold text-blue-700 hover:text-blue-800"
        >
          {expanded ? `Show less` : `View all (${remaining} more)`}
        </button>
      )}
    </div>
  );
};

export default EntityGroupPanel;
