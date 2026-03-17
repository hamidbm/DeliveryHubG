import { ObjectId } from 'mongodb';
import {
  saveWorkItem,
  addWorkItemLink
} from './workItemsService';
import { emitEvent } from '../shared/events/emitEvent';
import { getServerDb } from '../server/db/client';
import { saveMilestoneRecord as saveMilestone, saveSprintRecord as saveSprint } from '../server/db/repositories/milestonesRepo';
import {
  createRoadmapPhaseRecord,
  createWorkDeliveryPlanRunRecord,
  createWorkPlanPreviewRecord,
  getWorkPlanPreviewRecord
} from '../server/db/repositories/workPlansRepo';
import { findWorkItemRecord } from '../server/db/repositories/workItemsRepo';
import { invalidateWorkItemScope, primeWorkItemScope } from './workItemCache';
import { suggestOwnersForMilestoneScope, suggestOwnersForGeneratedArtifact } from './ownership';
import { buildDeliveryPlanPreview } from './planningEngine';
import { getDependencySkeletonPairs } from './dependencyPlanner';
import { getBundleCapacityForPlanning, resolvePlanScope } from './planScope';
import {
  DeliveryPlanInput,
  DeliveryPlanPreview,
  WorkItemStatus,
  WorkItemType,
  MilestoneStatus
} from '../types';

export const previewDeliveryPlan = async (input: DeliveryPlanInput, user: { userId: string; email?: string }) => {
  const previewId = new ObjectId();
  const scope = await resolvePlanScope(input);
  const { preview } = await buildDeliveryPlanPreview(input, {
    previewId: String(previewId),
    scope,
    getBundleCapacity: getBundleCapacityForPlanning,
    suggestMilestoneOwner: input.suggestMilestoneOwners
      ? async ({ scopeType, scopeId, bundleId }) => {
        const suggestion = await suggestOwnersForMilestoneScope({ scopeType, scopeId, bundleId });
        return suggestion.candidates?.[0] || null;
      }
      : undefined
  });

  const now = new Date();
  const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  await createWorkPlanPreviewRecord({
    _id: previewId,
    createdAt: now.toISOString(),
    createdBy: String(user.userId),
    scopeType: scope.scopeType,
    scopeId: scope.scopeId,
    input,
    preview,
    expiresAt
  });

  await emitEvent({
    ts: now.toISOString(),
    type: 'workitems.plan.previewed',
    actor: { userId: String(user.userId), displayName: user.email || user.userId, email: user.email },
    resource: { type: 'workitems.plan', id: String(previewId), title: `Delivery plan preview ${scope.scopeName}` },
    context: { bundleId: scope.bundleId, appId: scope.applicationId },
    payload: { scopeType: scope.scopeType, scopeId: scope.scopeId }
  });

  return { ...preview, previewId: String(previewId) };
};

export const getPlanPreview = async (previewId: string) => {
  return await getWorkPlanPreviewRecord(previewId);
};

export const createDeliveryPlan = async (previewId: string, user: { userId: string; email?: string }) => {
  const db = await getServerDb();
  const previewDoc = await getWorkPlanPreviewRecord(previewId);
  if (!previewDoc) throw new Error('Preview not found or expired.');

  const input = previewDoc.input as DeliveryPlanInput;
  const preview: DeliveryPlanPreview = previewDoc.preview as DeliveryPlanPreview;
  const scope = await resolvePlanScope(input);
  const runId = new ObjectId();
  const generator = { source: 'DELIVERY_PLAN_GENERATOR' as const, runId: String(runId) };

  const milestoneIdMap = new Map<number, string>();
  for (const ms of preview.milestones) {
    const result = await saveMilestone({
      name: ms.name,
      startDate: ms.startDate,
      endDate: ms.endDate,
      dueDate: ms.endDate,
      status: MilestoneStatus.DRAFT,
      bundleId: scope.bundleId,
      applicationId: scope.applicationId,
      ownerUserId: ms.suggestedOwner?.userId,
      ownerEmail: ms.suggestedOwner?.email,
      targetCapacity: ms.targetCapacity,
      generator
    } as any);
    const insertedId = (result as any)?.insertedId;
    if (insertedId) milestoneIdMap.set(ms.index, String(insertedId));
  }

  const roadmapIds: string[] = [];
  for (const phase of preview.roadmap) {
    const milestoneIds = phase.milestoneIndexes.map((idx) => milestoneIdMap.get(idx)).filter(Boolean);
    const res = await createRoadmapPhaseRecord({
      scopeType: scope.scopeType,
      scopeId: scope.scopeId,
      name: phase.name,
      startDate: phase.startDate,
      endDate: phase.endDate,
      milestoneIds,
      generator,
      createdAt: new Date().toISOString(),
      createdBy: String(user.userId)
    });
    roadmapIds.push(String(res.insertedId));
  }

  const sprintIdMap = new Map<string, string>();
  for (const sprint of preview.sprints) {
    const res = await saveSprint({
      name: sprint.name,
      startDate: sprint.startDate,
      endDate: sprint.endDate,
      status: 'PLANNED',
      bundleId: scope.bundleId,
      applicationId: scope.applicationId,
      generator
    } as any);
    const insertedId = (res as any)?.insertedId;
    if (insertedId) sprintIdMap.set(sprint.name, String(insertedId));
  }

  const workItemIds: string[] = [];
  const ownerSuggestion = input.suggestWorkItemOwners && scope.bundleId
    ? await suggestOwnersForGeneratedArtifact({ bundleId: scope.bundleId })
    : null;
  const ownerCandidate = ownerSuggestion?.candidates?.[0];
  let singleBundleEpicId: string | null = null;

  if (scope.scopeType === 'BUNDLE') {
    const epicTitle = `${scope.scopeName} Epic`;
    const epicRes = await saveWorkItem({
      type: WorkItemType.EPIC,
      title: epicTitle,
      description: '',
      status: WorkItemStatus.TODO,
      priority: 'MEDIUM',
      bundleId: scope.bundleId || '',
      applicationId: scope.applicationId,
      scopeRef: scope.scopeRef,
      scopeDerivation: 'direct',
      generator,
      assignedTo: ownerCandidate?.email || ownerCandidate?.userId,
      assigneeUserIds: ownerCandidate?.userId ? [ownerCandidate.userId] : undefined
    }, { userId: user.userId, email: user.email, name: user.email || user.userId });
    singleBundleEpicId = String((epicRes as any)?.insertedId || (epicRes as any)?._id || '');
    if (singleBundleEpicId) workItemIds.push(singleBundleEpicId);
  }

  for (const msArtifact of preview.artifacts) {
    const milestoneId = milestoneIdMap.get(msArtifact.milestoneIndex);
    if (!milestoneId) continue;
    const sprintsForMilestone = preview.sprints.filter((s) => s.milestoneIndex === msArtifact.milestoneIndex);
    let storyCounter = 0;
    const epicBuckets = scope.scopeType === 'BUNDLE'
      ? [{ name: `${scope.scopeName} Epic`, features: msArtifact.epics.flatMap((epic) => epic.features || []) }]
      : msArtifact.epics;

    for (const epic of epicBuckets) {
      let epicId = singleBundleEpicId || '';
      if (scope.scopeType !== 'BUNDLE') {
        const epicRes = await saveWorkItem({
          type: WorkItemType.EPIC,
          title: epic.name,
          description: '',
          status: WorkItemStatus.TODO,
          priority: 'MEDIUM',
          bundleId: scope.bundleId || '',
          applicationId: scope.applicationId,
          milestoneIds: [milestoneId],
          scopeRef: scope.scopeRef,
          scopeDerivation: 'direct',
          generator,
          assignedTo: ownerCandidate?.email || ownerCandidate?.userId,
          assigneeUserIds: ownerCandidate?.userId ? [ownerCandidate.userId] : undefined
        }, { userId: user.userId, email: user.email, name: user.email || user.userId });
        epicId = String((epicRes as any)?.insertedId || (epicRes as any)?._id || '');
        if (epicId) workItemIds.push(epicId);
      }

      for (const feature of epic.features) {
        const featureRes = await saveWorkItem({
          type: WorkItemType.FEATURE,
          title: feature.name,
          description: '',
          status: WorkItemStatus.TODO,
          priority: 'MEDIUM',
          bundleId: scope.bundleId || '',
          applicationId: scope.applicationId,
          parentId: epicId,
          milestoneIds: [milestoneId],
          scopeRef: scope.scopeRef,
          scopeDerivation: 'direct',
          generator,
          assignedTo: ownerCandidate?.email || ownerCandidate?.userId,
          assigneeUserIds: ownerCandidate?.userId ? [ownerCandidate.userId] : undefined
        }, { userId: user.userId, email: user.email, name: user.email || user.userId });
        const featureId = String((featureRes as any)?.insertedId || (featureRes as any)?._id || '');
        if (featureId) workItemIds.push(featureId);

        for (const story of feature.stories) {
          const sprintName = input.preallocateStoriesToSprints && sprintsForMilestone.length
            ? sprintsForMilestone[storyCounter % sprintsForMilestone.length].name
            : undefined;
          const sprintId = sprintName ? sprintIdMap.get(sprintName) : undefined;
          storyCounter += 1;
          const storyRes = await saveWorkItem({
            type: WorkItemType.STORY,
            title: story.name,
            description: '',
            status: WorkItemStatus.TODO,
            priority: 'MEDIUM',
            bundleId: scope.bundleId || '',
            applicationId: scope.applicationId,
            parentId: featureId,
            milestoneIds: [milestoneId],
            scopeRef: scope.scopeRef,
            scopeDerivation: 'direct',
            generator,
            sprintId
          }, { userId: user.userId, email: user.email, name: user.email || user.userId });
          const storyId = String((storyRes as any)?.insertedId || (storyRes as any)?._id || '');
          if (storyId) workItemIds.push(storyId);

          for (const taskName of story.tasks || []) {
            const taskRes = await saveWorkItem({
              type: WorkItemType.TASK,
              title: taskName,
              description: '',
              status: WorkItemStatus.TODO,
              priority: 'MEDIUM',
              bundleId: scope.bundleId || '',
              applicationId: scope.applicationId,
              parentId: storyId,
              milestoneIds: [milestoneId],
              scopeRef: scope.scopeRef,
              scopeDerivation: 'direct',
              generator,
              sprintId
            }, { userId: user.userId, email: user.email, name: user.email || user.userId });
            const taskId = String((taskRes as any)?.insertedId || (taskRes as any)?._id || '');
            if (taskId) workItemIds.push(taskId);
          }
        }
      }
    }
  }

  if (input.createDependencySkeleton) {
    const pairs = getDependencySkeletonPairs(preview.artifacts);
    for (const pair of pairs) {
      const source = await findWorkItemRecord({
        title: pair.fromEpicName,
        milestoneIds: { $in: [milestoneIdMap.get(pair.fromMilestoneIndex)] }
      });
      const target = await findWorkItemRecord({
        title: pair.toEpicName,
        milestoneIds: { $in: [milestoneIdMap.get(pair.toMilestoneIndex)] }
      });
      if (source && target) {
        try {
          await addWorkItemLink(String(source._id || source.id), String(target._id || target.id), 'BLOCKS', { name: user.email || user.userId });
        } catch {}
      }
    }
  }

  await createWorkDeliveryPlanRunRecord({
    _id: runId,
    previewId: previewDoc._id,
    createdAt: new Date().toISOString(),
    createdBy: String(user.userId),
    scopeType: scope.scopeType,
    scopeId: scope.scopeId,
    milestoneIds: Array.from(milestoneIdMap.values()),
    sprintIds: Array.from(sprintIdMap.values()),
    workItemIds,
    roadmapPhaseIds: roadmapIds
  });

  await emitEvent({
    ts: new Date().toISOString(),
    type: 'workitems.plan.created',
    actor: { userId: String(user.userId), displayName: user.email || user.userId, email: user.email },
    resource: { type: 'workitems.plan', id: String(runId), title: `Delivery plan ${scope.scopeName}` },
    context: { bundleId: scope.bundleId, appId: scope.applicationId },
    payload: { previewId, milestoneCount: milestoneIdMap.size, sprintCount: sprintIdMap.size, workItemCount: workItemIds.length }
  });

  if (scope.bundleId) {
    await invalidateWorkItemScope({ scopeType: 'BUNDLE', scopeId: String(scope.bundleId) }, 'delivery-plan.create');
    await primeWorkItemScope({ scopeType: 'BUNDLE', scopeId: String(scope.bundleId) });
  }
  if (scope.applicationId) {
    await invalidateWorkItemScope({ scopeType: 'APPLICATION', scopeId: String(scope.applicationId) }, 'delivery-plan.create');
    await primeWorkItemScope({ scopeType: 'APPLICATION', scopeId: String(scope.applicationId) });
  }

  return {
    runId: String(runId),
    milestoneIds: Array.from(milestoneIdMap.values()),
    sprintIds: Array.from(sprintIdMap.values()),
    workItemIds,
    roadmapPhaseIds: roadmapIds
  };
};
