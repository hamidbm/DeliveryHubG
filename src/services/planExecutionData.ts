import { deriveWorkItemLinkSummary, listWorkItemsByAnyRefs } from '../server/db/repositories/workItemsRepo';
import { getWorkDeliveryPlanRunRecord, getWorkPlanPreviewRecord } from '../server/db/repositories/workPlansRepo';
import { listMilestoneRecordsByRefs } from '../server/db/repositories/milestonesRepo';
import { createVisibilityContext } from './visibility';
import type { DeliveryPlanPreview, WorkItem } from '../types';

type PlanIdParsed = { source: 'CREATED_PLAN' | 'PREVIEW'; id: string };

export const parsePlanExecutionId = (value: string): PlanIdParsed | null => {
  if (!value) return null;
  const [prefix, raw] = value.split(':');
  if (!raw) return null;
  if (prefix === 'created') return { source: 'CREATED_PLAN', id: raw };
  if (prefix === 'preview') return { source: 'PREVIEW', id: raw };
  return null;
};

export const getPreviewPlanExecutionData = async (previewId: string) => {
  const preview = await getWorkPlanPreviewRecord(previewId);
  if (!preview) return null;
  const data = preview.preview as DeliveryPlanPreview;
  const milestones = data.milestones.map((m) => ({
    id: String(m.index),
    startDate: m.startDate,
    endDate: m.endDate,
    targetCapacity: m.targetCapacity ?? null
  }));
  const rollups: Record<string, any> = {};
  data.artifacts.forEach((artifact) => {
    const cap = data.milestones.find((m) => m.index === artifact.milestoneIndex);
    const targetCapacity = cap?.targetCapacity ?? null;
    const committedPoints = artifact.storyCount || 0;
    rollups[String(artifact.milestoneIndex)] = {
      capacity: {
        targetCapacity,
        committedPoints,
        capacityUtilization: targetCapacity && targetCapacity > 0 ? committedPoints / targetCapacity : null
      },
      totals: { blockedDerived: 0 },
      confidence: { band: 'medium' }
    };
  });
  return {
    preview,
    run: null,
    milestones,
    visibleMilestones: [] as any[],
    visibleItems: [] as WorkItem[],
    enrichedItems: [] as WorkItem[],
    rollups
  };
};

export const getCreatedPlanExecutionData = async (
  runId: string,
  user: { userId?: string; role?: string } | null
) => {
  const run = await getWorkDeliveryPlanRunRecord(runId);
  if (!run) return null;
  const visibility = createVisibilityContext(user);

  const milestoneRefs = (run.milestoneIds || []).map((id: any) => String(id)).filter(Boolean);
  const milestonesRaw = await listMilestoneRecordsByRefs(milestoneRefs);
  const visibleMilestones: any[] = [];
  for (const milestone of milestonesRaw) {
    const canView = await visibility.canViewBundle(String(milestone.bundleId || ''));
    if (canView) visibleMilestones.push(milestone);
  }

  const milestones = visibleMilestones.map((m: any) => ({
    id: String(m._id || m.id || m.name),
    startDate: m.startDate,
    endDate: m.endDate,
    targetCapacity: typeof m.targetCapacity === 'number' ? m.targetCapacity : null
  }));

  const itemRefs = (run.workItemIds || []).map((id: any) => String(id)).filter(Boolean);
  const items = await listWorkItemsByAnyRefs(itemRefs);
  const visibleItems = await visibility.filterVisibleWorkItems(items as unknown as WorkItem[]);
  const enrichedItems = await deriveWorkItemLinkSummary(visibleItems as WorkItem[]);

  return {
    preview: null,
    run,
    milestones,
    visibleMilestones,
    visibleItems: visibleItems as WorkItem[],
    enrichedItems: enrichedItems as WorkItem[],
    rollups: {} as Record<string, any>
  };
};
