import { deleteMilestoneRecord, listMilestones } from '../server/db/repositories/milestonesRepo';
import {
  addWorkItemLinkRecord,
  deriveWorkItemLinkSummary,
  detectBlocksCycle,
  fetchWorkItemById,
  fetchWorkItemByKeyOrId,
  removeWorkItemLinkRecord
} from '../server/db/repositories/workItemsRepo';
import { createSimpleWorkPlanFromIntakeRecord } from './workPlanOrchestration';
import { saveWorkItemWithSideEffects, updateWorkItemStatusWithSideEffects } from './workItemOrchestration';
import { emitEvent } from '../shared/events/emitEvent';

const canonicalWorkItemLinkTypes = new Set(['BLOCKS', 'RELATES_TO', 'DUPLICATES']);

export { deriveWorkItemLinkSummary, detectBlocksCycle, fetchWorkItemById, fetchWorkItemByKeyOrId };

export const saveWorkItem = async (item: any, user?: any) => {
  return await saveWorkItemWithSideEffects(item, user, emitEvent);
};

export const updateWorkItemStatus = async (id: string, toStatus: string, newRank: number, user: any) => {
  return await updateWorkItemStatusWithSideEffects(id, toStatus, newRank, user, emitEvent);
};

export const addWorkItemLink = async (sourceId: string, targetId: string, type: string, user?: any) => {
  if (!sourceId || !targetId) throw new Error('Missing link identifiers');
  if (sourceId === targetId) throw new Error('Self link not allowed');
  if (!canonicalWorkItemLinkTypes.has(type)) throw new Error('Invalid link type');
  const userName = user?.name || 'DeliveryHub System';
  return await addWorkItemLinkRecord(sourceId, targetId, type, userName);
};

export const removeWorkItemLink = async (sourceId: string, targetId: string, type: string, user?: any) => {
  if (!sourceId || !targetId) throw new Error('Missing link identifiers');
  if (!canonicalWorkItemLinkTypes.has(type)) throw new Error('Invalid link type');
  const userName = user?.name || 'DeliveryHub System';
  return await removeWorkItemLinkRecord(sourceId, targetId, type, userName);
};

export const createWorkPlanFromIntake = async (input: {
  scopeType: 'bundle' | 'application';
  scopeId: string;
  goLiveDate?: string;
  devStartDate?: string;
  uatStartDate?: string;
  uatEndDate?: string;
  milestoneCount?: number;
  milestoneDurationWeeks?: number;
  sprintDurationWeeks?: number;
  milestoneThemes?: Array<{ milestoneNumber: number; themes: string[] }>;
  actor: { userId?: string; name?: string; displayName?: string; email?: string };
}) => await createSimpleWorkPlanFromIntakeRecord(input);

export const fetchMilestones = async (filters: any) => listMilestones(filters || {});

export const deleteMilestone = async (id: string) => deleteMilestoneRecord(id);
