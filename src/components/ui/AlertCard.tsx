import React from 'react';
import { PortfolioAlert, RelatedEntitiesMeta } from '../../types/ai';
import EntityEvidenceList from './EntityEvidenceList';
import RelatedEntitiesSection from './RelatedEntitiesSection';

type EntityType = 'workitem' | 'application' | 'bundle' | 'milestone' | 'review';

const severityStyle: Record<string, string> = {
  critical: 'bg-rose-100 text-rose-700 border-rose-200',
  high: 'bg-orange-100 text-orange-700 border-orange-200',
  medium: 'bg-amber-100 text-amber-700 border-amber-200',
  low: 'bg-slate-100 text-slate-700 border-slate-200'
};

const groupByType = (alert: PortfolioAlert, relatedEntitiesMeta?: RelatedEntitiesMeta) => {
  const groups: Record<string, Array<{ type: EntityType; id: string; label: string; secondary?: string }>> = {};
  (alert.entities || []).forEach((entity) => {
    const type = entity.type as EntityType;
    if (!groups[type]) groups[type] = [];
    groups[type].push({
      type,
      id: entity.id,
      label: entity.label,
      secondary: entity.secondary || relatedEntitiesMeta?.[type]?.[entity.id]
    });
  });

  return (Object.keys(groups) as EntityType[])
    .map((type) => ({
      type,
      entities: groups[type],
      secondaryMeta: (relatedEntitiesMeta?.[type] || {}) as Record<string, string>
    }))
    .filter((group) => group.entities.length > 0);
};

const AlertCard = ({
  alert,
  relatedEntitiesMeta,
  onSaveInvestigation,
  onWatchAlert
}: {
  alert: PortfolioAlert;
  relatedEntitiesMeta?: RelatedEntitiesMeta;
  onSaveInvestigation?: (alert: PortfolioAlert) => void;
  onWatchAlert?: (alert: PortfolioAlert) => void;
}) => {
  const groups = groupByType(alert, relatedEntitiesMeta);

  return (
    <article className="border border-slate-200 rounded-lg p-3 bg-slate-50 space-y-2">
      <div className="flex items-center justify-between gap-3">
        <p className="font-semibold text-slate-800 break-words">{alert.title}</p>
        <span className={`text-[11px] px-2 py-0.5 rounded-full border uppercase font-bold ${severityStyle[alert.severity] || severityStyle.medium}`}>
          {alert.severity}
        </span>
      </div>
      <p className="text-sm text-slate-600 break-words">{alert.summary}</p>
      <p className="text-xs text-slate-500">Rationale: {alert.rationale}</p>
      <p className="text-xs text-slate-500">Type: {alert.resultOf}</p>
      <EntityEvidenceList evidence={alert.evidence} />
      <RelatedEntitiesSection groups={groups} />
      {(onSaveInvestigation || onWatchAlert) && (
        <div className="pt-1 flex gap-2">
          {onSaveInvestigation && (
            <button
              onClick={() => onSaveInvestigation(alert)}
              className="px-2 py-1 rounded border border-blue-200 bg-blue-50 text-xs font-semibold text-blue-700 hover:bg-blue-100"
            >
              Save as Investigation
            </button>
          )}
          {onWatchAlert && (
            <button
              onClick={() => onWatchAlert(alert)}
              className="px-2 py-1 rounded border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-100"
            >
              Watch this alert
            </button>
          )}
        </div>
      )}
    </article>
  );
};

export default AlertCard;
