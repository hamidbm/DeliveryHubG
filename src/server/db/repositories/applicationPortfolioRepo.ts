import { ObjectId } from 'mongodb';
import type {
  Application,
  ApplicationDependency,
  ApplicationEnvironmentStrategy,
  ApplicationLifecycleRecord,
  ApplicationPortfolio,
  ReleaseTrain
} from '../../../types';
import { getServerDb } from '../client';

const toId = (value: any) => String(value || '');
const asObjectId = (value: string) => (ObjectId.isValid(value) ? new ObjectId(value) : null);

const safeCreateIndex = async (db: any, collection: string, key: any, options?: any) => {
  try {
    await db.collection(collection).createIndex(key, options);
  } catch (error: any) {
    const code = Number(error?.code || 0);
    const message = String(error?.message || '');
    const conflict =
      code === 85 ||
      code === 86 ||
      code === 11000 ||
      message.includes('IndexOptionsConflict') ||
      message.includes('IndexKeySpecsConflict');
    if (!conflict) throw error;
  }
};

export const ensureApplicationPortfolioIndexes = async () => {
  const db = await getServerDb();
  await safeCreateIndex(db, 'application_portfolios', { name: 1 }, { unique: true });
  await safeCreateIndex(db, 'application_portfolios', { executiveOwner: 1 });
  await safeCreateIndex(db, 'application_dependencies', { sourceApplicationId: 1, targetApplicationId: 1, dependencyType: 1 }, { unique: true });
  await safeCreateIndex(db, 'application_dependencies', { sourceApplicationId: 1 });
  await safeCreateIndex(db, 'application_dependencies', { targetApplicationId: 1 });
  await safeCreateIndex(db, 'application_dependencies', { criticality: 1 });
  await safeCreateIndex(db, 'application_lifecycle', { applicationId: 1 }, { unique: true });
  await safeCreateIndex(db, 'application_lifecycle', { lifecycleStage: 1, updatedAt: -1 });
  await safeCreateIndex(db, 'application_environment_strategy', { applicationId: 1 }, { unique: true });
  await safeCreateIndex(db, 'release_trains', { name: 1 }, { unique: true });
  await safeCreateIndex(db, 'release_trains', { portfolioId: 1, cadence: 1 });
  await safeCreateIndex(db, 'applications', { portfolioId: 1 });
  await safeCreateIndex(db, 'applications', { releaseTrain: 1 });
  await safeCreateIndex(db, 'applications', { lifecycleStatus: 1 });
  await safeCreateIndex(db, 'applications', { businessCriticality: 1 });
  return db;
};

export const resolveApplicationRef = async (ref: string) => {
  const db = await getServerDb();
  const id = String(ref || '');
  if (!id) return null;
  const oid = asObjectId(id);
  const app = await db.collection<Application>('applications').findOne({
    $or: [
      oid ? { _id: oid } : null,
      { id },
      { aid: id }
    ].filter(Boolean) as any[]
  });
  if (!app) return null;
  return { app, id: String(app._id || app.id || app.aid || id) };
};

export const listApplicationPortfoliosRecord = async () => {
  const db = await ensureApplicationPortfolioIndexes();
  return await db.collection<ApplicationPortfolio>('application_portfolios').find({}).sort({ name: 1 }).toArray();
};

export const createApplicationPortfolioRecord = async (payload: Partial<ApplicationPortfolio>) => {
  const name = String(payload?.name || '').trim();
  if (!name) throw new Error('name is required');
  const db = await ensureApplicationPortfolioIndexes();
  const now = new Date().toISOString();
  const doc: ApplicationPortfolio = {
    name,
    description: payload?.description ? String(payload.description) : undefined,
    executiveOwner: payload?.executiveOwner ? String(payload.executiveOwner) : undefined,
    createdAt: now,
    updatedAt: now
  };
  try {
    const res = await db.collection('application_portfolios').insertOne(doc as any);
    return await db.collection('application_portfolios').findOne({ _id: res.insertedId });
  } catch (error: any) {
    if (Number(error?.code || 0) === 11000) {
      const existing = await db.collection('application_portfolios').findOne({ name });
      if (existing) return existing;
    }
    throw error;
  }
};

export const getApplicationPortfolioByIdRecord = async (id: string) => {
  const db = await ensureApplicationPortfolioIndexes();
  const oid = asObjectId(id);
  return await db.collection('application_portfolios').findOne(oid ? { _id: oid } : { _id: id as any });
};

export const updateApplicationPortfolioRecord = async (id: string, payload: Partial<ApplicationPortfolio>) => {
  const db = await ensureApplicationPortfolioIndexes();
  const oid = asObjectId(id);
  if (!oid) throw new Error('invalid portfolio id');
  const update: any = { updatedAt: new Date().toISOString() };
  if (typeof payload?.name !== 'undefined') update.name = String(payload.name || '').trim();
  if (typeof payload?.description !== 'undefined') update.description = payload.description ? String(payload.description) : undefined;
  if (typeof payload?.executiveOwner !== 'undefined') update.executiveOwner = payload.executiveOwner ? String(payload.executiveOwner) : undefined;
  if (update.name === '') throw new Error('name is required');
  await db.collection('application_portfolios').updateOne({ _id: oid }, { $set: update });
  return await db.collection('application_portfolios').findOne({ _id: oid });
};

export const listReleaseTrainsRecord = async (portfolioId?: string) => {
  const db = await ensureApplicationPortfolioIndexes();
  const query: any = {};
  if (portfolioId) query.portfolioId = String(portfolioId);
  return await db.collection<ReleaseTrain>('release_trains').find(query).sort({ name: 1 }).toArray();
};

export const createReleaseTrainRecord = async (payload: Partial<ReleaseTrain>) => {
  const name = String(payload?.name || '').trim();
  if (!name) throw new Error('name is required');
  const cadence = String(payload?.cadence || 'QUARTERLY').toUpperCase();
  const allowed = new Set(['QUARTERLY', 'MONTHLY', 'BIWEEKLY', 'WEEKLY', 'CUSTOM']);
  if (!allowed.has(cadence)) throw new Error('invalid cadence');
  const db = await ensureApplicationPortfolioIndexes();
  const now = new Date().toISOString();
  const doc: ReleaseTrain = {
    name,
    cadence: cadence as ReleaseTrain['cadence'],
    portfolioId: payload?.portfolioId ? String(payload.portfolioId) : undefined,
    description: payload?.description ? String(payload.description) : undefined,
    createdAt: now,
    updatedAt: now
  };
  try {
    const res = await db.collection('release_trains').insertOne(doc as any);
    return await db.collection('release_trains').findOne({ _id: res.insertedId });
  } catch (error: any) {
    if (Number(error?.code || 0) === 11000) {
      const existing = await db.collection('release_trains').findOne({ name });
      if (existing) return existing;
    }
    throw error;
  }
};

export const getReleaseTrainByIdRecord = async (id: string) => {
  const db = await ensureApplicationPortfolioIndexes();
  const oid = asObjectId(id);
  return await db.collection('release_trains').findOne(oid ? { _id: oid } : { _id: id as any });
};

export const updateReleaseTrainRecord = async (id: string, payload: Partial<ReleaseTrain>) => {
  const db = await ensureApplicationPortfolioIndexes();
  const oid = asObjectId(id);
  if (!oid) throw new Error('invalid release train id');
  const update: any = { updatedAt: new Date().toISOString() };
  if (typeof payload?.name !== 'undefined') update.name = String(payload.name || '').trim();
  if (typeof payload?.cadence !== 'undefined') {
    const cadence = String(payload.cadence || '').toUpperCase();
    const allowed = new Set(['QUARTERLY', 'MONTHLY', 'BIWEEKLY', 'WEEKLY', 'CUSTOM']);
    if (!allowed.has(cadence)) throw new Error('invalid cadence');
    update.cadence = cadence;
  }
  if (typeof payload?.portfolioId !== 'undefined') update.portfolioId = payload.portfolioId ? String(payload.portfolioId) : undefined;
  if (typeof payload?.description !== 'undefined') update.description = payload.description ? String(payload.description) : undefined;
  if (update.name === '') throw new Error('name is required');
  await db.collection('release_trains').updateOne({ _id: oid }, { $set: update });
  return await db.collection('release_trains').findOne({ _id: oid });
};

export const listApplicationDependenciesRecord = async (applicationId?: string) => {
  const db = await ensureApplicationPortfolioIndexes();
  const resolved = applicationId ? await resolveApplicationRef(applicationId) : null;
  const appKey = resolved?.id ? String(resolved.id) : '';
  const query = appKey ? { $or: [{ sourceApplicationId: appKey }, { targetApplicationId: appKey }] } : {};
  const deps = await db.collection<ApplicationDependency>('application_dependencies').find(query).sort({ createdAt: -1 }).toArray();
  if (!deps.length) return [];

  const ids = Array.from(new Set(deps.flatMap((dep) => [toId(dep.sourceApplicationId), toId(dep.targetApplicationId)]).filter(Boolean)));
  const oids = ids.map(asObjectId).filter(Boolean) as ObjectId[];
  const apps = await db.collection<Application>('applications').find({
    $or: [
      oids.length ? { _id: { $in: oids } } : null,
      { id: { $in: ids } },
      { aid: { $in: ids } }
    ].filter(Boolean) as any[]
  }).toArray();

  const appMap = new Map<string, Application>();
  apps.forEach((app) => {
    [toId(app._id), toId(app.id), toId(app.aid)].filter(Boolean).forEach((key) => appMap.set(key, app));
  });

  return deps.map((dep) => ({
    ...dep,
    sourceApplication: appMap.get(toId(dep.sourceApplicationId)) || null,
    targetApplication: appMap.get(toId(dep.targetApplicationId)) || null
  }));
};

export const createApplicationDependencyRecord = async (payload: Partial<ApplicationDependency>) => {
  const sourceRef = String(payload?.sourceApplicationId || '').trim();
  const targetRef = String(payload?.targetApplicationId || '').trim();
  if (!sourceRef || !targetRef) throw new Error('sourceApplicationId and targetApplicationId are required');
  const source = await resolveApplicationRef(sourceRef);
  const target = await resolveApplicationRef(targetRef);
  if (!source || !target) throw new Error('source or target application not found');
  if (source.id === target.id) throw new Error('self dependency is not allowed');

  const depType = String(payload?.dependencyType || '').toUpperCase();
  if (!['API', 'DATA', 'EVENT', 'SHARED_INFRA'].includes(depType)) throw new Error('invalid dependencyType');
  const criticality = String(payload?.criticality || 'MEDIUM').toUpperCase();
  if (!['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(criticality)) throw new Error('invalid criticality');

  const db = await ensureApplicationPortfolioIndexes();
  const now = new Date().toISOString();
  const doc: ApplicationDependency = {
    sourceApplicationId: source.id,
    targetApplicationId: target.id,
    dependencyType: depType as ApplicationDependency['dependencyType'],
    criticality: criticality as ApplicationDependency['criticality'],
    notes: payload?.notes ? String(payload.notes) : undefined,
    createdAt: now,
    updatedAt: now
  };
  try {
    const res = await db.collection('application_dependencies').insertOne(doc as any);
    return await db.collection('application_dependencies').findOne({ _id: res.insertedId });
  } catch (error: any) {
    if (Number(error?.code || 0) === 11000) {
      return await db.collection('application_dependencies').findOne({
        sourceApplicationId: doc.sourceApplicationId,
        targetApplicationId: doc.targetApplicationId,
        dependencyType: doc.dependencyType
      });
    }
    throw error;
  }
};

export const deleteApplicationDependencyRecord = async (id: string) => {
  const db = await ensureApplicationPortfolioIndexes();
  const oid = asObjectId(id);
  if (!oid) throw new Error('invalid dependency id');
  const res = await db.collection('application_dependencies').deleteOne({ _id: oid });
  return res.deletedCount > 0;
};

export const getApplicationLifecycleRecordByApp = async (applicationId: string) => {
  const resolved = await resolveApplicationRef(applicationId);
  if (!resolved) return null;
  const db = await ensureApplicationPortfolioIndexes();
  return await db.collection<ApplicationLifecycleRecord>('application_lifecycle').findOne({ applicationId: resolved.id });
};

export const upsertApplicationLifecycleRecord = async (applicationId: string, payload: Partial<ApplicationLifecycleRecord>) => {
  const resolved = await resolveApplicationRef(applicationId);
  if (!resolved) throw new Error('application not found');
  const stage = String(payload?.lifecycleStage || 'ACTIVE').toUpperCase();
  if (!['ACTIVE', 'MAINTENANCE', 'SUNSETTING', 'RETIRED'].includes(stage)) throw new Error('invalid lifecycleStage');

  const db = await ensureApplicationPortfolioIndexes();
  const now = new Date().toISOString();
  await db.collection('application_lifecycle').updateOne(
    { applicationId: resolved.id },
    {
      $set: {
        applicationId: resolved.id,
        lifecycleStage: stage,
        lifecycleOwner: payload?.lifecycleOwner ? String(payload.lifecycleOwner) : undefined,
        lifecycleNotes: payload?.lifecycleNotes ? String(payload.lifecycleNotes) : undefined,
        updatedAt: now
      },
      $setOnInsert: { createdAt: now }
    },
    { upsert: true }
  );

  const appOid = asObjectId(resolved.id);
  await db.collection('applications').updateOne(
    {
      $or: [
        appOid ? { _id: appOid } : null,
        { id: resolved.id },
        { aid: resolved.id }
      ].filter(Boolean) as any[]
    },
    { $set: { lifecycleStatus: stage, updatedAt: now } }
  );

  return await db.collection('application_lifecycle').findOne({ applicationId: resolved.id });
};

export const DEFAULT_ENV_FLOW = ['DEV', 'SIT', 'INT', 'QA', 'PERF', 'UAT', 'STAGING', 'PREPROD', 'PROD'];

export const getApplicationEnvironmentStrategyRecord = async (applicationId: string) => {
  const resolved = await resolveApplicationRef(applicationId);
  if (!resolved) return null;
  const db = await ensureApplicationPortfolioIndexes();

  const strategy = await db.collection<ApplicationEnvironmentStrategy>('application_environment_strategy').findOne({ applicationId: resolved.id });
  if (strategy) return strategy;

  const planning = await db.collection('application_planning_metadata').findOne({
    $or: [{ scopeType: 'application', scopeId: resolved.id }, { applicationId: resolved.id }]
  });
  const envNames = Array.isArray(planning?.environments) && planning.environments.length
    ? planning.environments.map((row: any) => String(row?.name || '').toUpperCase()).filter(Boolean)
    : DEFAULT_ENV_FLOW;

  return {
    applicationId: resolved.id,
    environments: envNames.map((name: string, idx: number) => ({
      name,
      order: idx + 1,
      description: `${name} environment`
    }))
  } as ApplicationEnvironmentStrategy;
};

export const upsertApplicationEnvironmentStrategyRecord = async (
  applicationId: string,
  payload: Partial<ApplicationEnvironmentStrategy>
) => {
  const resolved = await resolveApplicationRef(applicationId);
  if (!resolved) throw new Error('application not found');
  const rows = Array.isArray(payload?.environments) ? payload.environments : [];
  if (!rows.length) throw new Error('environments are required');

  const normalized = rows
    .map((row, idx) => ({
      name: String(row?.name || '').toUpperCase(),
      order: Number(row?.order || idx + 1),
      description: row?.description ? String(row.description) : undefined
    }))
    .filter((row) => row.name);
  if (!normalized.length) throw new Error('at least one valid environment is required');

  const db = await ensureApplicationPortfolioIndexes();
  const now = new Date().toISOString();
  await db.collection('application_environment_strategy').updateOne(
    { applicationId: resolved.id },
    {
      $set: { applicationId: resolved.id, environments: normalized, updatedAt: now },
      $setOnInsert: { createdAt: now }
    },
    { upsert: true }
  );
  return await db.collection('application_environment_strategy').findOne({ applicationId: resolved.id });
};

export const computeApplicationDeliveryImpactRecord = async (applicationId: string) => {
  const resolved = await resolveApplicationRef(applicationId);
  if (!resolved) return null;
  const db = await ensureApplicationPortfolioIndexes();
  const appId = resolved.id;
  const appOid = asObjectId(appId);

  const [deps, app, workItems] = await Promise.all([
    db.collection<ApplicationDependency>('application_dependencies').find({
      $or: [{ sourceApplicationId: appId }, { targetApplicationId: appId }]
    }).toArray(),
    db.collection('applications').findOne({
      $or: [
        appOid ? { _id: appOid } : null,
        { id: appId },
        { aid: appId }
      ].filter(Boolean) as any[]
    }),
    db.collection('workitems').find({ applicationId: appId }).project({ milestoneIds: 1 }).toArray()
  ]);

  const outbound = deps.filter((dep) => String(dep.sourceApplicationId) === appId);
  const inbound = deps.filter((dep) => String(dep.targetApplicationId) === appId);
  const connectedIds = Array.from(new Set([
    ...outbound.map((dep) => String(dep.targetApplicationId)),
    ...inbound.map((dep) => String(dep.sourceApplicationId))
  ]));

  const connectedApps = connectedIds.length
    ? await db.collection('applications').find({
        $or: [
          { _id: { $in: connectedIds.map(asObjectId).filter(Boolean) } },
          { id: { $in: connectedIds } },
          { aid: { $in: connectedIds } }
        ]
      }).toArray()
    : [];

  const releaseTrain = app?.releaseTrain ? String(app.releaseTrain) : '';
  const sharedReleaseTrainApps = releaseTrain
    ? await db.collection('applications').find({
        releaseTrain,
        ...(appOid ? { _id: { $ne: appOid } } : {})
      }).project({ _id: 1, name: 1, aid: 1 }).toArray()
    : [];

  const milestoneIds = new Set<string>();
  workItems.forEach((item: any) => {
    (item?.milestoneIds || []).forEach((id: any) => milestoneIds.add(String(id)));
  });

  return {
    applicationId: appId,
    summary: {
      outboundDependencies: outbound.length,
      inboundDependencies: inbound.length,
      connectedApplications: connectedIds.length,
      sharedReleaseTrainApplications: sharedReleaseTrainApps.length,
      impactedMilestones: milestoneIds.size,
      relatedWorkItems: workItems.length
    },
    outbound,
    inbound,
    connectedApplications: connectedApps.map((entry) => ({
      id: String(entry._id || entry.id || entry.aid),
      name: entry.name,
      aid: entry.aid,
      releaseTrain: entry.releaseTrain || null
    })),
    sharedReleaseTrainApps: sharedReleaseTrainApps.map((entry: any) => ({
      id: String(entry._id || entry.id || entry.aid),
      name: entry.name,
      aid: entry.aid
    }))
  };
};
