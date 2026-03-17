import { ObjectId } from 'mongodb';
import { getServerDb } from '../server/db/client';
import { findApplicationByAnyId } from '../server/db/repositories/applicationsRepo';
import { findBundleByAnyId } from '../server/db/repositories/bundlesRepo';
import { findReviewByAnyId } from '../server/db/repositories/reviewsRepo';
import { findWorkItemByDedupKey, findWorkItemByIdOrKey, findWorkItemRecord, saveWorkItemRecord } from '../server/db/repositories/workItemsRepo';
import { findWorkGeneratorByEventType, seedBuiltInWorkBlueprints, seedBuiltInWorkGenerators } from '../server/db/repositories/workAutomationRepo';
import { WorkItemStatus, WorkItemType } from '../types';
import { saveMilestoneRecord, saveSprintRecord } from '../server/db/repositories/milestonesRepo';

const resolveScopeRef = async ({
  bundleId,
  applicationId,
  initiativeId,
  initiativeName
}: {
  bundleId?: string;
  applicationId?: string;
  initiativeId?: string;
  initiativeName?: string;
}) => {
  if (bundleId) {
    const bundle = await findBundleByAnyId(bundleId);
    const name = bundle?.name || bundle?.key || bundleId;
    return { type: 'bundle' as const, id: String(bundle?._id || bundle?.key || bundleId), name: String(name) };
  }
  if (applicationId) {
    const app = await findApplicationByAnyId(applicationId);
    const name = app?.name || app?.aid || applicationId;
    return { type: 'application' as const, id: String(app?._id || app?.aid || applicationId), name: String(name) };
  }
  return { type: 'initiative' as const, id: 'unscoped', name: 'Unscoped / Misc' };
};

const ensureEpicForScope = async (scopeRef: { type: 'bundle' | 'application' | 'initiative'; id: string; name: string }) => {
  const existing = await findWorkItemRecord({
    type: WorkItemType.EPIC,
    'scopeRef.type': scopeRef.type,
    'scopeRef.id': scopeRef.id
  });
  if (existing) return existing;

  const title = scopeRef.id === 'unscoped' ? scopeRef.name : `${scopeRef.name} Epic`;
  const outcome = await saveWorkItemRecord({
    type: WorkItemType.EPIC,
    title,
    description: `Epic for ${scopeRef.name}`,
    status: WorkItemStatus.TODO,
    priority: 'MEDIUM',
    bundleId: scopeRef.type === 'bundle' ? scopeRef.id : '',
    applicationId: scopeRef.type === 'application' ? scopeRef.id : undefined,
    scopeRef
  }, 'System');

  if (outcome.mode !== 'create') return existing;
  return await findWorkItemByIdOrKey(String(outcome.result.insertedId));
};

const ensureGovernanceFeature = async (
  epicId: string,
  scopeRef: { type: 'bundle' | 'application' | 'initiative'; id: string; name: string }
) => {
  const existing = await findWorkItemRecord({
    type: WorkItemType.FEATURE,
    parentId: epicId,
    title: 'Governance & Reviews'
  });
  if (existing) return existing;

  const outcome = await saveWorkItemRecord({
    type: WorkItemType.FEATURE,
    title: 'Governance & Reviews',
    description: 'Review and governance work stream',
    status: WorkItemStatus.TODO,
    priority: 'MEDIUM',
    bundleId: scopeRef.type === 'bundle' ? scopeRef.id : '',
    applicationId: scopeRef.type === 'application' ? scopeRef.id : undefined,
    parentId: epicId,
    scopeRef
  }, 'System');

  if (outcome.mode !== 'create') return existing;
  return await findWorkItemByIdOrKey(String(outcome.result.insertedId));
};

export const createReviewWorkItemRecord = async ({
  reviewId,
  cycleId,
  cycleNumber,
  eventType,
  resource,
  bundleId,
  applicationId,
  dueAt,
  requestedBy,
  notes,
  reviewers,
  actor
}: {
  reviewId: string;
  cycleId: string;
  cycleNumber?: number;
  eventType: 'reviews.cycle.requested' | 'reviews.cycle.resubmitted';
  resource: { type: string; id: string; title?: string };
  bundleId?: string;
  applicationId?: string;
  dueAt?: string;
  requestedBy?: { userId?: string; displayName?: string; email?: string };
  notes?: string;
  reviewers?: Array<{ userId: string; displayName: string; email?: string }>;
  actor: { userId: string; displayName: string; email?: string };
}) => {
  const db = await getServerDb();
  await seedBuiltInWorkBlueprints();
  await seedBuiltInWorkGenerators();
  const gen = await findWorkGeneratorByEventType(eventType);
  if (!gen || gen.enabled === false) return null;

  const dedupKey = `${eventType}:${reviewId}:${cycleId}`;
  const existing = await findWorkItemByDedupKey(dedupKey);
  if (existing) return existing;

  const scopeRef = await resolveScopeRef({
    bundleId,
    applicationId,
    initiativeId: resource.id,
    initiativeName: resource.title || 'Initiative'
  });
  const scopeDerivation = bundleId || applicationId ? 'direct' : 'unscoped_fallback';

  const epic = await ensureEpicForScope(scopeRef);
  const feature = await ensureGovernanceFeature(String(epic?._id || epic?.id || ''), scopeRef);

  const reviewerUserIds = reviewers?.map((r) => r.userId).filter(Boolean) || [];
  const assignedTo = reviewers?.[0]?.displayName || reviewers?.[0]?.email || actor.displayName || 'Unassigned';
  const watchers = reviewerUserIds.length ? reviewerUserIds : reviewers?.map((r) => r.email || r.displayName).filter(Boolean) || [];
  const dueDate = dueAt || new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString();
  const requester = requestedBy?.displayName || requestedBy?.email || actor.displayName || 'Unknown';
  const resourceLabel = resource.title || resource.id || resource.type;
  const cycleLabel = typeof cycleNumber === 'number' ? `#${cycleNumber}` : cycleId;
  const dueLabel = dueDate ? new Date(dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'TBD';
  const submitterNote = notes && String(notes).trim().length ? String(notes).trim() : 'No submitter note provided.';
  const narrative = [
    '## Review Required',
    '',
    `**Resource:** ${resourceLabel} (${resource.type})`,
    `**Cycle:** ${cycleLabel}`,
    `**Requested by:** ${requester}`,
    `**Due:** ${dueLabel}`,
    '',
    '### Submitter Note',
    submitterNote
  ].join('\n');

  let linkedResourceId = resource.id ? String(resource.id) : '';
  if (!linkedResourceId && reviewId && ObjectId.isValid(reviewId)) {
    const review = await findReviewByAnyId(reviewId);
    if (review?.resource?.id) linkedResourceId = String(review.resource.id);
  }

  const outcome = await saveWorkItemRecord({
    type: WorkItemType.STORY,
    title: `Review ${resource.title || resource.type}`,
    description: narrative,
    status: WorkItemStatus.TODO,
    priority: 'MEDIUM',
    bundleId: scopeRef.type === 'bundle' ? scopeRef.id : '',
    applicationId: scopeRef.type === 'application' ? scopeRef.id : undefined,
    parentId: String(feature?._id || feature?.id || ''),
    scopeRef,
    scopeDerivation,
    linkedResource: { type: resource.type, id: linkedResourceId, title: resource.title },
    reviewId,
    reviewCycleId: cycleId,
    reviewCycleNumber: cycleNumber,
    reviewRequestedBy: requestedBy,
    reviewNotes: notes ? String(notes) : undefined,
    dedupKey,
    assignedTo,
    assigneeUserIds: reviewerUserIds,
    watcherUserIds: reviewerUserIds,
    watchers,
    dueAt: dueDate
  }, actor.displayName);

  if (outcome.mode !== 'create') return existing;
  return await findWorkItemByIdOrKey(String(outcome.result.insertedId));
};

export const createSimpleWorkPlanFromIntakeRecord = async ({
  scopeType,
  scopeId,
  goLiveDate,
  devStartDate,
  uatStartDate,
  uatEndDate,
  milestoneCount = 4,
  milestoneDurationWeeks = 3,
  sprintDurationWeeks = 2,
  milestoneThemes = [],
  actor
}: {
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
}) => {
  await seedBuiltInWorkBlueprints();

  const scopeRef = await resolveScopeRef({
    bundleId: scopeType === 'bundle' ? scopeId : undefined,
    applicationId: scopeType === 'application' ? scopeId : undefined
  });
  const scopeDerivation = 'direct' as const;

  const epic = await ensureEpicForScope(scopeRef);
  const epicId = String(epic?._id || epic?.id || '');
  await ensureGovernanceFeature(epicId, scopeRef);

  const startDate = devStartDate ? new Date(devStartDate) : new Date();
  const milestones: Array<{ id: string; number: number }> = [];

  for (let i = 1; i <= milestoneCount; i += 1) {
    const msStart = new Date(startDate.getTime() + (i - 1) * milestoneDurationWeeks * 7 * 24 * 60 * 60 * 1000);
    const msEnd = new Date(msStart.getTime() + milestoneDurationWeeks * 7 * 24 * 60 * 60 * 1000);
    const ms = await saveMilestoneRecord({
      name: `Milestone ${i}`,
      startDate: msStart.toISOString(),
      endDate: msEnd.toISOString(),
      dueDate: msEnd.toISOString(),
      status: 'PLANNED',
      bundleId: scopeType === 'bundle' ? scopeId : undefined,
      applicationId: scopeType === 'application' ? scopeId : undefined
    } as any);
    const insertedId = (ms as any)?.insertedId;
    if (insertedId) milestones.push({ id: String(insertedId), number: i });
  }

  const actorName = actor.displayName || actor.name || actor.email || 'System';

  for (const ms of milestones) {
    const feature = await saveWorkItemRecord({
      type: WorkItemType.FEATURE,
      title: `Milestone ${ms.number}`,
      description: `Delivery milestone ${ms.number}`,
      status: WorkItemStatus.TODO,
      priority: 'MEDIUM',
      bundleId: scopeType === 'bundle' ? scopeId : '',
      applicationId: scopeType === 'application' ? scopeId : undefined,
      parentId: epicId,
      milestoneIds: [ms.id],
      scopeRef,
      scopeDerivation
    }, actorName);

    const featureId = feature.mode === 'create'
      ? String(feature.result.insertedId)
      : String((feature as any).existing?._id || '');

    const themes = milestoneThemes.find((m) => Number(m.milestoneNumber) === ms.number)?.themes || [];
    for (const theme of themes) {
      await saveWorkItemRecord({
        type: WorkItemType.STORY,
        title: String(theme),
        description: '',
        status: WorkItemStatus.TODO,
        priority: 'MEDIUM',
        bundleId: scopeType === 'bundle' ? scopeId : '',
        applicationId: scopeType === 'application' ? scopeId : undefined,
        parentId: featureId,
        milestoneIds: [ms.id],
        scopeRef,
        scopeDerivation
      }, actorName);
    }
  }

  if (sprintDurationWeeks && sprintDurationWeeks > 0) {
    const totalWeeks = milestoneCount * milestoneDurationWeeks;
    const sprintCount = Math.ceil(totalWeeks / sprintDurationWeeks);
    for (let i = 1; i <= sprintCount; i += 1) {
      const spStart = new Date(startDate.getTime() + (i - 1) * sprintDurationWeeks * 7 * 24 * 60 * 60 * 1000);
      const spEnd = new Date(spStart.getTime() + sprintDurationWeeks * 7 * 24 * 60 * 60 * 1000);
      await saveSprintRecord({
        name: `Sprint ${i}`,
        startDate: spStart.toISOString(),
        endDate: spEnd.toISOString(),
        status: 'PLANNED',
        bundleId: scopeType === 'bundle' ? scopeId : undefined,
        applicationId: scopeType === 'application' ? scopeId : undefined
      } as any);
    }
  }

  return { epicId, scopeRef, scopeDerivation, goLiveDate, uatStartDate, uatEndDate };
};
