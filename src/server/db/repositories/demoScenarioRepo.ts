import { ObjectId } from 'mongodb';
import { getServerDb } from '../client';

const asObjectIds = (ids: string[]) => ids.filter((value) => ObjectId.isValid(value)).map((value) => new ObjectId(value));

export const upsertDemoUserRecord = async ({
  email,
  name,
  username,
  team,
  role,
  isActive,
  demoTag,
  demoScenarioKey,
  passwordHash,
  actorUserId,
  now
}: {
  email: string;
  name: string;
  username: string;
  team?: string;
  role?: string;
  isActive: boolean;
  demoTag: string;
  demoScenarioKey: string;
  passwordHash: string;
  actorUserId: string;
  now: string;
}) => {
  const db = await getServerDb();
  await db.collection('users').updateOne(
    { email },
    {
      $set: {
        name,
        username,
        email,
        team,
        role,
        isActive,
        demoTag,
        demoScenarioKey,
        updatedAt: now,
        updatedBy: actorUserId
      },
      $setOnInsert: {
        password: passwordHash,
        createdAt: now,
        createdBy: actorUserId
      }
    },
    { upsert: true }
  );
  return await db.collection('users').findOne({ email });
};

export const upsertDemoBundleRecord = async ({
  filter,
  key,
  name,
  description,
  demoTag,
  demoScenarioKey,
  actorUserId,
  now
}: {
  filter: Record<string, unknown>;
  key: string;
  name: string;
  description: string;
  demoTag: string;
  demoScenarioKey: string;
  actorUserId: string;
  now: string;
}) => {
  const db = await getServerDb();
  await db.collection('bundles').updateOne(
    filter,
    {
      $set: {
        key,
        name,
        description,
        demoTag,
        demoScenarioKey,
        updatedAt: now,
        updatedBy: actorUserId
      },
      $setOnInsert: {
        createdAt: now,
        createdBy: actorUserId
      }
    },
    { upsert: true }
  );
  return await db.collection('bundles').findOne({ key });
};

export const upsertDemoApplicationRecord = async ({
  filter,
  aid,
  key,
  name,
  bundleId,
  isActive,
  status,
  demoTag,
  demoScenarioKey,
  actorUserId,
  now
}: {
  filter: Record<string, unknown>;
  aid: string;
  key: string;
  name: string;
  bundleId: string;
  isActive: boolean;
  status: Record<string, unknown>;
  demoTag: string;
  demoScenarioKey: string;
  actorUserId: string;
  now: string;
}) => {
  const db = await getServerDb();
  return await db.collection('applications').updateOne(
    filter,
    {
      $set: {
        aid,
        key,
        name,
        bundleId,
        isActive,
        status,
        demoTag,
        demoScenarioKey,
        updatedAt: now,
        updatedBy: actorUserId
      },
      $setOnInsert: {
        createdAt: now,
        createdBy: actorUserId
      }
    },
    { upsert: true }
  );
};

export const upsertDemoBundleAssignmentRecord = async ({
  bundleId,
  userId,
  assignmentType,
  demoTag,
  demoScenarioKey,
  actorUserId,
  now
}: {
  bundleId: string;
  userId: string;
  assignmentType: string;
  demoTag: string;
  demoScenarioKey: string;
  actorUserId: string;
  now: string;
}) => {
  const db = await getServerDb();
  return await db.collection('bundle_assignments').updateOne(
    { bundleId, userId, assignmentType },
    {
      $set: {
        bundleId,
        userId,
        assignmentType,
        active: true,
        demoTag,
        demoScenarioKey,
        updatedAt: now,
        updatedBy: actorUserId
      },
      $setOnInsert: {
        createdAt: now,
        createdBy: actorUserId
      }
    },
    { upsert: true }
  );
};

export const tagGeneratedDemoArtifactsRecord = async (
  payload: {
    demoTag: string;
    demoScenarioKey: string;
    previewId: string;
    runId: string;
    milestoneIds: string[];
    sprintIds: string[];
    workItemIds: string[];
    roadmapPhaseIds: string[];
  },
  actorUserId: string,
  now: string
) => {
  const db = await getServerDb();
  const tagSet = {
    demoTag: payload.demoTag,
    demoScenarioKey: payload.demoScenarioKey,
    updatedAt: now,
    updatedBy: actorUserId
  };

  if (payload.milestoneIds.length) {
    await db.collection('milestones').updateMany({ _id: { $in: asObjectIds(payload.milestoneIds) } }, { $set: tagSet });
  }
  if (payload.sprintIds.length) {
    await db.collection('workitems_sprints').updateMany({ _id: { $in: asObjectIds(payload.sprintIds) } }, { $set: tagSet });
  }
  if (payload.workItemIds.length) {
    await db.collection('workitems').updateMany({ _id: { $in: asObjectIds(payload.workItemIds) } }, { $set: tagSet });
  }
  if (payload.roadmapPhaseIds.length) {
    await db.collection('work_roadmap_phases').updateMany({ _id: { $in: asObjectIds(payload.roadmapPhaseIds) } }, { $set: tagSet });
  }
  if (ObjectId.isValid(payload.previewId)) {
    await db.collection('work_plan_previews').updateOne({ _id: new ObjectId(payload.previewId) }, { $set: tagSet });
  }
  if (ObjectId.isValid(payload.runId)) {
    await db.collection('work_delivery_plan_runs').updateOne({ _id: new ObjectId(payload.runId) }, { $set: tagSet });
  }
};

export const listWorkItemsByIds = async (ids: string[]) => {
  const objectIds = asObjectIds(ids);
  if (!objectIds.length) return [];
  const db = await getServerDb();
  return await db.collection('workitems').find({ _id: { $in: objectIds } }).toArray();
};

export const updateDemoWorkItemAssignmentRecord = async ({
  workItemId,
  assignedTo,
  assigneeUserIds,
  status,
  demoTag,
  demoScenarioKey,
  actorUserId,
  labels,
  now
}: {
  workItemId: ObjectId;
  assignedTo?: string;
  assigneeUserIds?: string[];
  status: string;
  demoTag: string;
  demoScenarioKey: string;
  actorUserId: string;
  labels: string[];
  now: string;
}) => {
  const db = await getServerDb();
  const setData: Record<string, unknown> = {
    status,
    labels,
    demoTag,
    demoScenarioKey,
    updatedAt: now,
    updatedBy: actorUserId
  };
  const unsetData: Record<string, string> = {};
  if (assignedTo) {
    setData.assignedTo = assignedTo;
    setData.assigneeUserIds = assigneeUserIds || [];
  } else {
    unsetData.assignedTo = '';
    unsetData.assigneeUserIds = '';
  }
  return await db.collection('workitems').updateOne(
    { _id: workItemId },
    Object.keys(unsetData).length ? { $set: setData, $unset: unsetData } : { $set: setData }
  );
};

export const getUserEmailById = async (userId: string) => {
  if (!ObjectId.isValid(userId)) return null;
  const db = await getServerDb();
  const user = await db.collection('users').findOne({ _id: new ObjectId(userId) }).catch(() => null);
  return user?.email ? String(user.email) : null;
};

export const deleteDemoScenarioRecords = async (collections: string[], filter: Record<string, unknown>) => {
  const db = await getServerDb();
  for (const collection of collections) {
    try {
      await db.collection(collection).deleteMany(filter as any);
    } catch {
      // ignore missing/non-existing collections
    }
  }
};
