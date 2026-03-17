import type { WorkItem } from '../types';
import { insertClassicNotification } from '../server/db/repositories/notificationPlatformRepo';
import { saveWorkItemRecord, updateWorkItemStatusRecord } from '../server/db/repositories/workItemsRepo';

type WorkItemActor = {
  userId: string;
  displayName: string;
  email?: string;
};

const buildActor = (user?: any): WorkItemActor => {
  const userName = user?.name || 'Nexus System';
  return {
    userId: String(user?.id || user?.userId || user?.email || userName),
    displayName: String(user?.name || user?.displayName || userName),
    email: user?.email ? String(user.email) : undefined
  };
};

const createLegacyNotification = async (doc: Record<string, unknown>) => {
  await insertClassicNotification(doc);
};

export const saveWorkItemWithSideEffects = async (
  item: Partial<WorkItem>,
  user: any,
  emitEventFn: (event: any) => Promise<any>
) => {
  const userName = user?.name || 'Nexus System';
  const actor = buildActor(user);
  const outcome = await saveWorkItemRecord(item as Record<string, unknown>, userName);

  if (outcome.mode === 'update') {
    for (const act of outcome.activities) {
      if (act.field === 'isFlagged' && act.to === true) {
        await createLegacyNotification({
          recipient: outcome.existing.assignedTo || 'Unassigned',
          sender: userName,
          type: 'IMPEDIMENT',
          message: `Impediment raised on ${outcome.existing.key}: ${outcome.existing.title}`,
          link: `/work-items?view=tree&pageId=${outcome.existing._id}`,
          read: false,
          createdAt: outcome.now
        });
      }
      if (act.field === 'assignedTo' && act.to) {
        await createLegacyNotification({
          recipient: act.to,
          sender: userName,
          type: 'ASSIGNMENT',
          message: `You have been assigned to artifact ${outcome.existing.key}`,
          link: `/work-items?view=tree&pageId=${outcome.existing._id}`,
          read: false,
          createdAt: outcome.now
        });
      }
      try {
        const type =
          act.action === 'CHANGED_STATUS' ? 'workitems.item.statuschanged' :
          act.action === 'IMPEDIMENT_RAISED' ? 'workitems.item.impedimentraised' :
          act.action === 'IMPEDIMENT_CLEARED' ? 'workitems.item.impedimentcleared' :
          act.action === 'WORK_LOGGED' ? 'workitems.item.worklogged' :
          act.action === 'AI_REFINEMENT_COMMITTED' ? 'workitems.item.airefinement' :
          act.action === 'CHECKLIST_UPDATED' ? 'workitems.item.checklistupdated' :
          'workitems.item.updated';
        await emitEventFn({
          ts: outcome.now,
          type,
          actor,
          resource: { type: 'workitems.item', id: String(outcome.existing._id || outcome.existing.id || item._id), title: outcome.existing.title },
          context: { bundleId: outcome.existing.bundleId, appId: outcome.existing.applicationId },
          payload: { field: act.field, from: act.from, to: act.to }
        });
      } catch {}
    }
    return outcome.result;
  }

  try {
    await emitEventFn({
      ts: outcome.now,
      type: 'workitems.item.created',
      actor,
      resource: { type: 'workitems.item', id: String(outcome.result.insertedId), title: outcome.newItem.title },
      context: { bundleId: outcome.newItem.bundleId, appId: outcome.newItem.applicationId }
    });
  } catch {}
  return outcome.result;
};

export const updateWorkItemStatusWithSideEffects = async (
  id: string,
  toStatus: string,
  newRank: number,
  user: any,
  emitEventFn: (event: any) => Promise<any>
) => {
  const actor = buildActor(user);
  const userName = user?.name || 'Nexus System';
  const outcome = await updateWorkItemStatusRecord(id, toStatus, newRank, userName);
  if (!outcome) return null;

  try {
    await emitEventFn({
      ts: outcome.now,
      type: 'workitems.item.statuschanged',
      actor,
      resource: { type: 'workitems.item', id: String(outcome.existing._id || outcome.existing.id || id), title: outcome.existing.title },
      context: { bundleId: outcome.existing.bundleId, appId: outcome.existing.applicationId },
      payload: { from: outcome.existing.status, to: toStatus }
    });
  } catch {}

  return outcome.result;
};
