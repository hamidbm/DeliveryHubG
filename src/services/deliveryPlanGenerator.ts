import { ObjectId } from 'mongodb';
import {
  getDb,
  saveMilestone,
  saveSprint,
  saveWorkItem,
  addWorkItemLink,
  emitEvent
} from './db';
import { suggestOwnersForMilestoneScope, suggestOwnersForGeneratedArtifact } from './ownership';
import { WorkItemStatus, WorkItemType, MilestoneStatus } from '../types';

export type DeliveryPlanInput = {
  scopeType: 'BUNDLE' | 'APPLICATION' | 'PROGRAM';
  scopeId: string;
  plannedStartDate?: string;
  devStartDate: string;
  integrationStartDate?: string;
  uatStartDate: string;
  goLiveDate: string;
  stabilizationEndDate?: string;
  milestoneCount: number;
  sprintDurationWeeks: number;
  milestoneDurationStrategy: 'AUTO_DISTRIBUTE' | 'FIXED_WEEKS';
  milestoneDurationWeeks?: number;
  deliveryPattern: 'STANDARD_PHASED' | 'PRODUCT_INCREMENT' | 'MIGRATION' | 'COMPLIANCE';
  backlogShape: 'LIGHT' | 'STANDARD' | 'DETAILED';
  storiesPerFeatureTarget?: number;
  featuresPerMilestoneTarget?: number;
  createTasksUnderStories?: boolean;
  environmentFlow?: 'DEV_UAT_PROD' | 'DEV_SIT_UAT_PROD' | 'CUSTOM';
  releaseType?: 'BIG_BANG' | 'PHASED' | 'INCREMENTAL';
  suggestMilestoneOwners?: boolean;
  suggestWorkItemOwners?: boolean;
  createDependencySkeleton?: boolean;
  preallocateStoriesToSprints?: boolean;
  autoLinkMilestonesToRoadmap?: boolean;
  generateDraftOnly?: boolean;
  themesByMilestone?: Array<{ milestoneIndex: number; themes: string[] }>;
};

export type DeliveryPlanPreview = {
  previewId: string;
  counts: {
    roadmapPhases: number;
    milestones: number;
    sprints: number;
    epics: number;
    features: number;
    stories: number;
    tasks: number;
  };
  roadmap: Array<{ name: string; startDate: string; endDate: string; milestoneIndexes: number[] }>;
  milestones: Array<{
    index: number;
    name: string;
    startDate: string;
    endDate: string;
    themes: string[];
    sprintCount: number;
    suggestedOwner?: { userId?: string; email?: string; reason?: string };
    targetCapacity?: number | null;
  }>;
  sprints: Array<{ name: string; startDate: string; endDate: string; milestoneIndex?: number }>;
  artifacts: Array<{
    milestoneIndex: number;
    epicCount: number;
    featureCount: number;
    storyCount: number;
    taskCount: number;
    epics: Array<{
      name: string;
      features: Array<{
        name: string;
        stories: Array<{
          name: string;
          tasks: string[];
        }>;
      }>;
    }>;
  }>;
  warnings: string[];
  assumptions: string[];
};

type PlanScope = {
  scopeType: 'BUNDLE' | 'APPLICATION' | 'PROGRAM';
  scopeId: string;
  scopeName: string;
  bundleId?: string;
  applicationId?: string;
  scopeRef: { type: 'bundle' | 'application' | 'initiative'; id: string; name: string };
};

const ensureWorkPlanIndexes = async (db: any) => {
  await db.collection('work_plan_previews').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  await db.collection('work_plan_previews').createIndex({ createdBy: 1, createdAt: -1 });
  await db.collection('work_plan_previews').createIndex({ scopeType: 1, scopeId: 1, createdAt: -1 });
  await db.collection('work_roadmap_phases').createIndex({ scopeType: 1, scopeId: 1, startDate: 1 });
  await db.collection('work_roadmap_phases').createIndex({ milestoneIds: 1 });
  await db.collection('work_delivery_plan_runs').createIndex({ createdBy: 1, createdAt: -1 });
};

const parseDate = (value?: string) => (value ? new Date(value) : null);

const addDays = (date: Date, days: number) => new Date(date.getTime() + days * 24 * 60 * 60 * 1000);

const diffDays = (start: Date, end: Date) => Math.max(0, Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));

const getBundleCapacity = async (bundleId?: string | null) => {
  if (!bundleId) return null;
  const db = await getDb();
  const record = await db.collection('bundle_capacity').findOne({ bundleId: String(bundleId) });
  if (!record) return null;
  return {
    unit: record.unit as 'POINTS_PER_SPRINT' | 'POINTS_PER_WEEK',
    value: Number(record.value || 0)
  };
};

const resolveScope = async (input: DeliveryPlanInput): Promise<PlanScope> => {
  const db = await getDb();
  const scopeType = input.scopeType;
  const scopeId = String(input.scopeId || '');
  if (scopeType === 'PROGRAM') {
    return {
      scopeType,
      scopeId: scopeId || 'program',
      scopeName: 'Program',
      scopeRef: { type: 'initiative', id: 'program', name: 'Program' }
    };
  }

  if (scopeType === 'BUNDLE') {
    const bundle = ObjectId.isValid(scopeId)
      ? await db.collection('bundles').findOne({ _id: new ObjectId(scopeId) })
      : await db.collection('bundles').findOne({ $or: [{ id: scopeId }, { key: scopeId }] });
    const name = bundle?.name || bundle?.key || scopeId;
    return {
      scopeType,
      scopeId,
      scopeName: name,
      bundleId: bundle?._id ? String(bundle._id) : scopeId,
      scopeRef: { type: 'bundle', id: bundle?._id ? String(bundle._id) : scopeId, name }
    };
  }

  const app = ObjectId.isValid(scopeId)
    ? await db.collection('applications').findOne({ _id: new ObjectId(scopeId) })
    : await db.collection('applications').findOne({ $or: [{ id: scopeId }, { key: scopeId }, { aid: scopeId }] });
  const name = app?.name || app?.key || scopeId;
  const bundleId = app?.bundleId ? String(app.bundleId) : undefined;
  return {
    scopeType,
    scopeId,
    scopeName: name,
    bundleId,
    applicationId: app?._id ? String(app._id) : scopeId,
    scopeRef: { type: 'application', id: app?._id ? String(app._id) : scopeId, name }
  };
};

const normalizeInput = (input: DeliveryPlanInput) => {
  const warnings: string[] = [];
  const assumptions: string[] = [];
  const plannedStart = parseDate(input.plannedStartDate) || null;
  const devStart = parseDate(input.devStartDate);
  const uatStart = parseDate(input.uatStartDate);
  const goLive = parseDate(input.goLiveDate);
  const integrationStart = parseDate(input.integrationStartDate) || null;
  const stabilizationEnd = parseDate(input.stabilizationEndDate) || null;

  if (!devStart || !uatStart || !goLive) {
    throw new Error('Dev start, UAT start, and Go-Live dates are required.');
  }

  const overallStart = plannedStart || devStart;
  const overallEnd = stabilizationEnd || goLive;

  if (overallStart.getTime() <= devStart.getTime()) {
    // ok
  } else {
    warnings.push('Planned start is before dev start; using planned start as overall start.');
  }

  if (!(overallStart.getTime() <= devStart.getTime() && devStart.getTime() <= uatStart.getTime() && uatStart.getTime() <= goLive.getTime())) {
    throw new Error('Date order must satisfy planned/dev start <= UAT start <= Go-Live.');
  }

  if (integrationStart && (integrationStart.getTime() < devStart.getTime() || integrationStart.getTime() > uatStart.getTime())) {
    warnings.push('Integration start is outside the Dev → UAT window.');
  }
  if (!integrationStart) {
    assumptions.push('Integration start not provided; inferred within Dev → UAT window.');
  }

  const milestoneCount = Math.max(1, Number(input.milestoneCount || 1));
  const sprintDurationWeeks = Math.max(1, Number(input.sprintDurationWeeks || 1));
  const milestoneDurationWeeks = input.milestoneDurationWeeks ? Number(input.milestoneDurationWeeks) : undefined;

  return {
    overallStart,
    overallEnd,
    devStart,
    uatStart,
    goLive,
    integrationStart,
    stabilizationEnd,
    milestoneCount,
    sprintDurationWeeks,
    milestoneDurationWeeks,
    warnings,
    assumptions
  };
};

const generateMilestones = (
  input: DeliveryPlanInput,
  normalized: ReturnType<typeof normalizeInput>
) => {
  const { overallStart, goLive, uatStart, milestoneCount, milestoneDurationWeeks, warnings } = normalized;
  const milestones: Array<{ index: number; name: string; startDate: string; endDate: string; themes: string[] }> = [];

  if (input.milestoneDurationStrategy === 'FIXED_WEEKS' && milestoneDurationWeeks) {
    for (let i = 1; i <= milestoneCount; i += 1) {
      const start = addDays(overallStart, (i - 1) * milestoneDurationWeeks * 7);
      const end = addDays(start, milestoneDurationWeeks * 7);
      if (end.getTime() > goLive.getTime()) {
        warnings.push('Fixed milestone duration exceeds the delivery window. Adjust dates or milestone count.');
      }
      milestones.push({
        index: i,
        name: `Milestone ${i}`,
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        themes: []
      });
    }
    return milestones;
  }

  if (milestoneCount === 1) {
    milestones.push({
      index: 1,
      name: 'Milestone 1',
      startDate: overallStart.toISOString(),
      endDate: goLive.toISOString(),
      themes: []
    });
    return milestones;
  }

  const preUatDurationMs = uatStart.getTime() - overallStart.getTime();
  if (preUatDurationMs <= 0) {
    warnings.push('UAT start is not after planned start; distributing milestones evenly to Go-Live.');
    const totalMs = goLive.getTime() - overallStart.getTime();
    const slice = totalMs / milestoneCount;
    for (let i = 0; i < milestoneCount; i += 1) {
      const start = new Date(overallStart.getTime() + i * slice);
      const end = new Date(overallStart.getTime() + (i + 1) * slice);
      milestones.push({
        index: i + 1,
        name: `Milestone ${i + 1}`,
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        themes: []
      });
    }
    return milestones;
  }

  const slice = preUatDurationMs / (milestoneCount - 1);
  for (let i = 0; i < milestoneCount - 1; i += 1) {
    const start = new Date(overallStart.getTime() + i * slice);
    const end = new Date(overallStart.getTime() + (i + 1) * slice);
    milestones.push({
      index: i + 1,
      name: `Milestone ${i + 1}`,
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      themes: []
    });
  }
  milestones.push({
    index: milestoneCount,
    name: `Milestone ${milestoneCount}`,
    startDate: uatStart.toISOString(),
    endDate: goLive.toISOString(),
    themes: []
  });

  return milestones;
};

const generateRoadmapPhases = (input: DeliveryPlanInput, normalized: ReturnType<typeof normalizeInput>, milestoneCount: number) => {
  const { overallStart, goLive, stabilizationEnd } = normalized;
  let phaseNames: string[] = [];
  switch (input.deliveryPattern) {
    case 'STANDARD_PHASED':
      phaseNames = ['Foundation', 'Build', 'Integration', 'UAT / Hardening', 'Cutover / Launch'];
      break;
    case 'PRODUCT_INCREMENT':
      phaseNames = Array.from({ length: milestoneCount }, (_, i) => `Increment ${i + 1}`);
      break;
    case 'MIGRATION':
      phaseNames = ['Foundation', 'Migration Wave 1', 'Migration Wave 2', 'Cutover'];
      break;
    case 'COMPLIANCE':
      phaseNames = ['Assessment', 'Remediation', 'Validation', 'Signoff'];
      break;
    default:
      phaseNames = Array.from({ length: milestoneCount }, (_, i) => `Phase ${i + 1}`);
  }

  const totalMs = goLive.getTime() - overallStart.getTime();
  const slice = totalMs / Math.max(phaseNames.length, 1);
  const phases = phaseNames.map((name, idx) => {
    const start = new Date(overallStart.getTime() + idx * slice);
    const end = new Date(overallStart.getTime() + (idx + 1) * slice);
    return {
      name,
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      milestoneIndexes: []
    };
  });

  if (stabilizationEnd && stabilizationEnd.getTime() > goLive.getTime()) {
    phases.push({
      name: 'Stabilization',
      startDate: goLive.toISOString(),
      endDate: stabilizationEnd.toISOString(),
      milestoneIndexes: []
    });
  }

  return phases;
};

const generateSprints = (normalized: ReturnType<typeof normalizeInput>) => {
  const { overallStart, goLive, sprintDurationWeeks, warnings } = normalized;
  const sprints: Array<{ name: string; startDate: string; endDate: string }> = [];
  let idx = 1;
  let cursor = new Date(overallStart.getTime());
  const durationDays = sprintDurationWeeks * 7;
  while (cursor.getTime() < goLive.getTime()) {
    const end = addDays(cursor, durationDays);
    sprints.push({
      name: `Sprint ${idx}`,
      startDate: cursor.toISOString(),
      endDate: end.toISOString()
    });
    cursor = end;
    idx += 1;
  }
  const remainder = diffDays(cursor, goLive);
  if (remainder > 0) {
    warnings.push('Sprint cadence does not evenly divide the delivery window.');
  }
  return sprints;
};

const applyThemes = (milestones: Array<{ index: number; themes: string[] }>, input: DeliveryPlanInput, assumptions: string[]) => {
  milestones.forEach((ms) => {
    const entry = input.themesByMilestone?.find((t) => Number(t.milestoneIndex) === ms.index);
    ms.themes = entry?.themes?.length ? entry.themes : [];
    if (!ms.themes.length) {
      ms.themes = [`Milestone ${ms.index} Delivery`];
      assumptions.push(`No themes for Milestone ${ms.index}; using generic label.`);
    }
  });
};

const getShapeDefaults = (shape: DeliveryPlanInput['backlogShape']) => {
  if (shape === 'LIGHT') return { featuresPerEpic: 2, storiesPerFeature: 3 };
  if (shape === 'DETAILED') return { featuresPerEpic: 4, storiesPerFeature: 5 };
  return { featuresPerEpic: 3, storiesPerFeature: 4 };
};

const distributeCounts = (total: number, buckets: number) => {
  const base = Math.floor(total / buckets);
  const remainder = total % buckets;
  return Array.from({ length: buckets }, (_, i) => base + (i < remainder ? 1 : 0));
};

const generateArtifacts = (milestones: Array<{ index: number; themes: string[] }>, input: DeliveryPlanInput) => {
  const artifacts: DeliveryPlanPreview['artifacts'] = [];
  const defaults = getShapeDefaults(input.backlogShape);

  milestones.forEach((ms) => {
    const themes = ms.themes.length ? ms.themes : [`Milestone ${ms.index} Delivery`];
    const epicCount = themes.length;
    const totalFeatures = input.featuresPerMilestoneTarget
      ? Math.max(input.featuresPerMilestoneTarget, epicCount)
      : epicCount * defaults.featuresPerEpic;
    const featuresByEpic = distributeCounts(totalFeatures, epicCount);
    const storiesPerFeature = input.storiesPerFeatureTarget || defaults.storiesPerFeature;
    const createTasks = Boolean(input.createTasksUnderStories || input.backlogShape === 'DETAILED');

    const epics = themes.map((theme, themeIdx) => {
      const featureCount = featuresByEpic[themeIdx] || defaults.featuresPerEpic;
      const features = Array.from({ length: featureCount }, (_, fi) => {
        const featureName = `M${ms.index} ${theme} Feature ${fi + 1}`;
        const stories = Array.from({ length: storiesPerFeature }, (_, si) => {
          const storyName = `M${ms.index} ${theme} Story ${fi + 1}.${si + 1}`;
          const tasks = createTasks
            ? Array.from({ length: 2 }, (_, ti) => `Task ${ti + 1} - ${storyName}`)
            : [];
          return { name: storyName, tasks };
        });
        return { name: featureName, stories };
      });
      return { name: `M${ms.index} ${theme}`, features };
    });

    const featureCount = epics.reduce((sum, e) => sum + e.features.length, 0);
    const storyCount = epics.reduce((sum, e) => sum + e.features.reduce((acc, f) => acc + f.stories.length, 0), 0);
    const taskCount = epics.reduce(
      (sum, e) =>
        sum +
        e.features.reduce((acc, f) => acc + f.stories.reduce((sAcc, s) => sAcc + s.tasks.length, 0), 0),
      0
    );

    artifacts.push({
      milestoneIndex: ms.index,
      epicCount,
      featureCount,
      storyCount,
      taskCount,
      epics
    });
  });

  return artifacts;
};

const assignSprintsToMilestones = (
  sprints: DeliveryPlanPreview['sprints'],
  milestones: DeliveryPlanPreview['milestones']
) => {
  const withMilestones = sprints.map((sprint) => {
    const start = new Date(sprint.startDate);
    const end = new Date(sprint.endDate);
    const mid = new Date(start.getTime() + (end.getTime() - start.getTime()) / 2);
    const match = milestones.find((m) => mid.getTime() >= new Date(m.startDate).getTime() && mid.getTime() <= new Date(m.endDate).getTime());
    return { ...sprint, milestoneIndex: match?.index };
  });
  return withMilestones;
};

export const previewDeliveryPlan = async (input: DeliveryPlanInput, user: { userId: string; email?: string }) => {
  const db = await getDb();
  await ensureWorkPlanIndexes(db);

  const normalized = normalizeInput(input);
  const scope = await resolveScope(input);

  const milestones = generateMilestones(input, normalized);
  applyThemes(milestones, input, normalized.assumptions);

  const roadmap = generateRoadmapPhases(input, normalized, milestones.length);
  const sprints = generateSprints(normalized);
  const artifacts = generateArtifacts(milestones, input);

  const milestoneRecords: DeliveryPlanPreview['milestones'] = milestones.map((ms) => ({
    index: ms.index,
    name: ms.name,
    startDate: ms.startDate,
    endDate: ms.endDate,
    themes: ms.themes,
    sprintCount: 0
  }));

  const sprintRecords = assignSprintsToMilestones(
    sprints.map((s) => ({ ...s, milestoneIndex: undefined })),
    milestoneRecords
  );

  milestoneRecords.forEach((ms) => {
    ms.sprintCount = sprintRecords.filter((s) => s.milestoneIndex === ms.index).length;
  });

  if (input.suggestMilestoneOwners) {
    for (const ms of milestoneRecords) {
      const suggestion = await suggestOwnersForMilestoneScope({
        scopeType: scope.scopeType,
        scopeId: scope.scopeId,
        bundleId: scope.bundleId
      });
      const candidate = suggestion.candidates?.[0];
      if (candidate) {
        ms.suggestedOwner = { userId: candidate.userId, email: candidate.email, reason: candidate.reason };
      }
    }
  }

  const capacity = await getBundleCapacity(scope.bundleId);
  if (!capacity && scope.bundleId) {
    normalized.warnings.push('No bundle capacity configured; milestone target capacity left empty.');
  }
  if (capacity) {
    milestoneRecords.forEach((ms) => {
      const sprintCount = ms.sprintCount || 0;
      const sprintCapacity = capacity.unit === 'POINTS_PER_SPRINT'
        ? capacity.value
        : capacity.value * normalized.sprintDurationWeeks;
      ms.targetCapacity = sprintCount * sprintCapacity;
    });
  }

  const counts = {
    roadmapPhases: roadmap.length,
    milestones: milestoneRecords.length,
    sprints: sprintRecords.length,
    epics: artifacts.reduce((sum, a) => sum + a.epicCount, 0),
    features: artifacts.reduce((sum, a) => sum + a.featureCount, 0),
    stories: artifacts.reduce((sum, a) => sum + a.storyCount, 0),
    tasks: artifacts.reduce((sum, a) => sum + a.taskCount, 0)
  };

  const previewId = new ObjectId();
  const preview: DeliveryPlanPreview = {
    previewId: String(previewId),
    counts,
    roadmap,
    milestones: milestoneRecords,
    sprints: sprintRecords,
    artifacts,
    warnings: normalized.warnings,
    assumptions: normalized.assumptions
  };

  const now = new Date();
  const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  await db.collection('work_plan_previews').insertOne({
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
  const db = await getDb();
  await ensureWorkPlanIndexes(db);
  const lookupId = ObjectId.isValid(previewId) ? new ObjectId(previewId) : previewId;
  return await db.collection('work_plan_previews').findOne({ _id: lookupId } as any);
};

export const createDeliveryPlan = async (previewId: string, user: { userId: string; email?: string }) => {
  const db = await getDb();
  await ensureWorkPlanIndexes(db);

  const lookupId = ObjectId.isValid(previewId) ? new ObjectId(previewId) : previewId;
  const previewDoc = await db.collection('work_plan_previews').findOne({ _id: lookupId } as any);
  if (!previewDoc) throw new Error('Preview not found or expired.');

  const input = previewDoc.input as DeliveryPlanInput;
  const preview: DeliveryPlanPreview = previewDoc.preview as DeliveryPlanPreview;
  const scope = await resolveScope(input);
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
      generator
    } as any);
    const insertedId = (result as any)?.insertedId;
    if (insertedId) milestoneIdMap.set(ms.index, String(insertedId));
  }

  const roadmapIds: string[] = [];
  for (const phase of preview.roadmap) {
    const milestoneIds = phase.milestoneIndexes.map((idx) => milestoneIdMap.get(idx)).filter(Boolean);
    const res = await db.collection('work_roadmap_phases').insertOne({
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

  for (const msArtifact of preview.artifacts) {
    const milestoneId = milestoneIdMap.get(msArtifact.milestoneIndex);
    if (!milestoneId) continue;
    const sprintsForMilestone = preview.sprints.filter((s) => s.milestoneIndex === msArtifact.milestoneIndex);
    let storyCounter = 0;
    for (const epic of msArtifact.epics) {
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
      const epicId = String((epicRes as any)?.insertedId || (epicRes as any)?._id || '');
      if (epicId) workItemIds.push(epicId);

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
    const milestoneIndexes = preview.artifacts.map((a) => a.milestoneIndex);
    for (let i = 0; i < milestoneIndexes.length - 1; i += 1) {
      const current = preview.artifacts.find((a) => a.milestoneIndex === milestoneIndexes[i]);
      const next = preview.artifacts.find((a) => a.milestoneIndex === milestoneIndexes[i + 1]);
      const currentEpic = current?.epics?.[0]?.name;
      const nextEpic = next?.epics?.[0]?.name;
      if (currentEpic && nextEpic) {
        const source = await db.collection('workitems').findOne({ title: currentEpic, milestoneIds: { $in: [milestoneIdMap.get(milestoneIndexes[i])] } });
        const target = await db.collection('workitems').findOne({ title: nextEpic, milestoneIds: { $in: [milestoneIdMap.get(milestoneIndexes[i + 1])] } });
        if (source && target) {
          try {
            await addWorkItemLink(String(source._id || source.id), String(target._id || target.id), 'BLOCKS', { name: user.email || user.userId });
          } catch {}
        }
      }
    }
  }

  await db.collection('work_delivery_plan_runs').insertOne({
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

  return {
    runId: String(runId),
    milestoneIds: Array.from(milestoneIdMap.values()),
    sprintIds: Array.from(sprintIdMap.values()),
    workItemIds,
    roadmapPhaseIds: roadmapIds
  };
};
