import { getServerDb } from '../client';

const ensureWorkBlueprintIndexes = async (db: any) => {
  await db.collection('work_blueprints').createIndex({ key: 1 }, { unique: true });
};

const ensureWorkGeneratorIndexes = async (db: any) => {
  await db.collection('work_generators').createIndex({ eventType: 1 }, { unique: true });
};

export const listWorkBlueprints = async () => {
  const db = await getServerDb();
  await ensureWorkBlueprintIndexes(db);
  return await db.collection('work_blueprints').find({}).sort({ createdAt: -1 }).toArray();
};

export const updateWorkBlueprintByKey = async (
  key: string,
  update: { enabled?: boolean; isDefault?: boolean }
) => {
  const db = await getServerDb();
  await ensureWorkBlueprintIndexes(db);
  if (update.isDefault) {
    await db.collection('work_blueprints').updateMany({}, { $set: { isDefault: false } });
  }
  const patch: any = {};
  if (typeof update.enabled === 'boolean') patch.enabled = update.enabled;
  if (typeof update.isDefault === 'boolean') patch.isDefault = update.isDefault;
  await db.collection('work_blueprints').updateOne({ key }, { $set: patch });
};

export const listWorkGenerators = async () => {
  const db = await getServerDb();
  await ensureWorkGeneratorIndexes(db);
  return await db.collection('work_generators').find({}).sort({ createdAt: -1 }).toArray();
};

export const updateWorkGeneratorByEventType = async (eventType: string, update: { enabled?: boolean }) => {
  const db = await getServerDb();
  await ensureWorkGeneratorIndexes(db);
  const patch: any = {};
  if (typeof update.enabled === 'boolean') patch.enabled = update.enabled;
  await db.collection('work_generators').updateOne({ eventType }, { $set: patch });
};

export const seedBuiltInWorkBlueprints = async () => {
  const db = await getServerDb();
  await ensureWorkBlueprintIndexes(db);
  const builtIns = [
    {
      key: 'review_story_v1',
      name: 'Review Story Generator v1',
      scope: 'bundle',
      version: 1,
      enabled: true,
      isBuiltIn: true,
      isDefault: true,
      template: {
        epicStrategy: 'scope',
        featureStrategy: 'governance_reviews',
        storyStrategy: 'review_cycle'
      },
      createdAt: new Date().toISOString()
    }
  ];
  for (const bp of builtIns) {
    await db.collection('work_blueprints').updateOne(
      { key: bp.key },
      { $setOnInsert: bp },
      { upsert: true }
    );
  }
};

export const seedBuiltInWorkGenerators = async () => {
  const db = await getServerDb();
  await ensureWorkGeneratorIndexes(db);
  const builtIns = [
    {
      eventType: 'reviews.cycle.requested',
      enabled: true,
      blueprintKey: 'review_story_v1',
      assignmentStrategy: 'reviewers',
      priorityStrategy: 'normal',
      createdAt: new Date().toISOString()
    },
    {
      eventType: 'reviews.cycle.resubmitted',
      enabled: true,
      blueprintKey: 'review_story_v1',
      assignmentStrategy: 'reviewers',
      priorityStrategy: 'normal',
      createdAt: new Date().toISOString()
    }
  ];
  for (const gen of builtIns) {
    await db.collection('work_generators').updateOne(
      { eventType: gen.eventType },
      { $setOnInsert: gen },
      { upsert: true }
    );
  }
};

export const findWorkGeneratorByEventType = async (eventType: string) => {
  const db = await getServerDb();
  await ensureWorkGeneratorIndexes(db);
  return await db.collection('work_generators').findOne({ eventType });
};
