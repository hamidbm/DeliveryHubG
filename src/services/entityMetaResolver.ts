import { EntityReference, EvidenceItem, RelatedEntitiesMeta, StructuredPortfolioReport } from '../types/ai';
import { listApplicationHealthCountsByBundleRefs, listApplicationMetaByRefs } from '../server/db/repositories/applicationsRepo';
import { listBundleMetaByRefs } from '../server/db/repositories/bundlesRepo';
import { listMilestoneMetaByRefs } from '../server/db/repositories/milestonesRepo';
import { listReviewMetaByRefs } from '../server/db/repositories/reviewsRepo';
import { listWorkItemMetaByRefs } from '../server/db/repositories/workItemsRepo';

const WORKITEM_GROUP_IDS = new Set(['unassigned', 'blocked', 'overdue', 'in-progress', 'all', 'status-unassigned']);
const MILESTONE_GROUP_IDS = new Set(['all', 'overdue']);
const REVIEW_GROUP_IDS = new Set(['all', 'open', 'overdue']);
const APPLICATION_GROUP_IDS = new Set(['all', 'critical', 'warning']);
const BUNDLE_GROUP_IDS = new Set(['all']);

type GroupedRefs = Record<EntityReference['type'], EntityReference[]>;

const emptyGroupedRefs = (): GroupedRefs => ({
  workitem: [],
  application: [],
  bundle: [],
  milestone: [],
  review: []
});

const dedupeRefs = (refs: EntityReference[]) => {
  const seen = new Set<string>();
  return refs.filter((ref) => {
    const key = `${ref.type}:${ref.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const collectFromEvidence = (evidence: EvidenceItem[] = []) => {
  const grouped = emptyGroupedRefs();
  evidence.forEach((item) => {
    (item.entities || []).forEach((entity) => {
      grouped[entity.type].push(entity);
    });
  });
  (Object.keys(grouped) as Array<keyof GroupedRefs>).forEach((type) => {
    grouped[type] = dedupeRefs(grouped[type]);
  });
  return grouped;
};

const addFromReport = (report?: StructuredPortfolioReport) => {
  const grouped = emptyGroupedRefs();
  if (!report) return grouped;
  const addEvidence = (items: Array<{ evidence?: EvidenceItem[] }>) => {
    items.forEach((item) => {
      (item.evidence || []).forEach((evidenceItem) => {
        (evidenceItem.entities || []).forEach((entity) => {
          grouped[entity.type].push(entity);
        });
      });
    });
  };
  addEvidence(report.topRisks || []);
  addEvidence(report.recommendedActions || []);
  addEvidence(report.concentrationSignals || []);
  (Object.keys(grouped) as Array<keyof GroupedRefs>).forEach((type) => {
    grouped[type] = dedupeRefs(grouped[type]);
  });
  return grouped;
};

const fmtDate = (value?: string | Date | null) => {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

const isOverdue = (date?: string | Date | null, doneLike = false) => {
  if (!date || doneLike) return false;
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return false;
  return d.getTime() < Date.now();
};

const mapLabelFallback = (ref: EntityReference) => ref.secondary || '';
const aliasIds = (...values: any[]) => Array.from(new Set(values.map((v) => String(v || '').trim()).filter(Boolean)));

export const resolveRelatedEntitiesMetaFromRefs = async (groupedRefs: GroupedRefs): Promise<RelatedEntitiesMeta> => {
  const out: RelatedEntitiesMeta = {};

  const setMeta = (type: keyof GroupedRefs, id: string, text: string) => {
    if (!text) return;
    out[type] = out[type] || {};
    out[type]![id] = text;
  };

  groupedRefs.workitem.forEach((ref) => {
    if (WORKITEM_GROUP_IDS.has(ref.id)) setMeta('workitem', ref.id, mapLabelFallback(ref));
  });
  groupedRefs.milestone.forEach((ref) => {
    if (MILESTONE_GROUP_IDS.has(ref.id)) setMeta('milestone', ref.id, mapLabelFallback(ref));
  });
  groupedRefs.review.forEach((ref) => {
    if (REVIEW_GROUP_IDS.has(ref.id)) setMeta('review', ref.id, mapLabelFallback(ref));
  });
  groupedRefs.application.forEach((ref) => {
    if (APPLICATION_GROUP_IDS.has(ref.id)) setMeta('application', ref.id, mapLabelFallback(ref));
  });
  groupedRefs.bundle.forEach((ref) => {
    if (BUNDLE_GROUP_IDS.has(ref.id)) setMeta('bundle', ref.id, mapLabelFallback(ref));
  });

  const workItemIds = groupedRefs.workitem.map((r) => r.id).filter((id) => !WORKITEM_GROUP_IDS.has(id));
  if (workItemIds.length) {
    const rows = await listWorkItemMetaByRefs(workItemIds);
    rows.forEach((row: any) => {
      const ids = aliasIds(row._id, row.id, row.key);
      if (!ids.length) return;
      const status = String(row.status || '').trim();
      const parts: string[] = [];
      if (status) parts.push(status.replaceAll('_', ' '));
      if (row.blocked === true) parts.push('Blocked');
      if (!row.assignedTo) parts.push('Unassigned');
      const due = row.dueAt || row.dueDate;
      if (isOverdue(due, status.toLowerCase() === 'done')) parts.push('Overdue');
      const dueLabel = fmtDate(due);
      if (dueLabel) parts.push(`Due ${dueLabel}`);
      ids.forEach((id) => setMeta('workitem', id, parts.join(' • ')));
    });
  }

  const milestoneIds = groupedRefs.milestone.map((r) => r.id).filter((id) => !MILESTONE_GROUP_IDS.has(id));
  if (milestoneIds.length) {
    const rows = await listMilestoneMetaByRefs(milestoneIds);
    rows.forEach((row: any) => {
      const ids = aliasIds(row._id, row.id, row.name);
      if (!ids.length) return;
      const status = String(row.status || '').toLowerCase();
      const date = row.targetDate || row.endDate || row.dueDate;
      const parts: string[] = [];
      if (status.includes('overdue') || status.includes('late') || isOverdue(date, status === 'done')) parts.push('Overdue');
      const target = fmtDate(date);
      if (target) parts.push(`Target ${target}`);
      if (!parts.length && row.status) parts.push(String(row.status));
      ids.forEach((id) => setMeta('milestone', id, parts.join(' • ')));
    });
  }

  const reviewIds = groupedRefs.review.map((r) => r.id).filter((id) => !REVIEW_GROUP_IDS.has(id));
  if (reviewIds.length) {
    const rows = await listReviewMetaByRefs(reviewIds);
    rows.forEach((row: any) => {
      const ids = aliasIds(row._id, row.id);
      if (!ids.length) return;
      const status = String(row.currentCycleStatus || row.status || '').trim();
      const due = row.currentDueAt || row.currentCycleDueAt;
      const doneLike = status.toLowerCase() === 'closed' || status.toLowerCase() === 'approved';
      const parts: string[] = [];
      if (status) parts.push(status);
      if (isOverdue(due, doneLike)) parts.push('Overdue');
      const dueLabel = fmtDate(due);
      if (dueLabel) parts.push(`Due ${dueLabel}`);
      ids.forEach((id) => setMeta('review', id, parts.join(' • ')));
    });
  }

  const appIds = groupedRefs.application.map((r) => r.id).filter((id) => !APPLICATION_GROUP_IDS.has(id));
  if (appIds.length) {
    const rows = await listApplicationMetaByRefs(appIds);
    rows.forEach((row: any) => {
      const ids = aliasIds(row._id, row.id, row.aid, row.name);
      if (!ids.length) return;
      const health = String(row.health || row.status || '').trim();
      ids.forEach((id) => setMeta('application', id, health ? `Health: ${health}` : ''));
    });
  }

  const bundleIds = groupedRefs.bundle.map((r) => r.id).filter((id) => !BUNDLE_GROUP_IDS.has(id));
  if (bundleIds.length) {
    const rows = await listBundleMetaByRefs(bundleIds);
    const normalizedIds = rows.map((row: any) => String(row._id || row.id || row.key || '')).filter(Boolean);
    const counts = await listApplicationHealthCountsByBundleRefs(normalizedIds);
    const byBundle = new Map<string, { total: number; critical: number }>(
      counts.map((row) => [String(row._id || ''), { total: Number(row.total || 0), critical: Number(row.critical || 0) }] as const)
    );
    rows.forEach((row: any) => {
      const ids = aliasIds(row._id, row.id, row.key);
      if (!ids.length) return;
      const stats = byBundle.get(String(row._id || row.id || row.key || ''));
      if (!stats) return;
      ids.forEach((id) => setMeta('bundle', id, `${stats.total} Apps • ${stats.critical} Critical`));
    });
  }

  return out;
};

export const resolveRelatedEntitiesMetaFromEvidence = async (evidence: EvidenceItem[]) => {
  const grouped = collectFromEvidence(evidence);
  return resolveRelatedEntitiesMetaFromRefs(grouped);
};

export const resolveRelatedEntitiesMetaFromReport = async (report?: StructuredPortfolioReport) => {
  const grouped = addFromReport(report);
  return resolveRelatedEntitiesMetaFromRefs(grouped);
};
