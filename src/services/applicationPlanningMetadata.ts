import { ObjectId } from 'mongodb';
import { getDb, ensureApplicationPlanningMetadataIndexes } from './db';
import type { Application, ApplicationPlanningMetadata, PlanningEnvironmentEntry } from '../types';

const resolveApplication = async (applicationId: string): Promise<Application | null> => {
  const db = await getDb();
  const candidates: any[] = [
    { id: applicationId },
    { aid: applicationId }
  ];
  if (ObjectId.isValid(applicationId)) {
    candidates.push({ _id: new ObjectId(applicationId) });
  }
  return await db.collection<Application>('applications').findOne({ $or: candidates });
};

const parseIsoDate = (value?: string | null) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
};

const toIsoDate = (date: Date | null) => {
  if (!date) return null;
  return date.toISOString().slice(0, 10);
};

const addDays = (date: Date, days: number) => {
  const copy = new Date(date.getTime());
  copy.setDate(copy.getDate() + days);
  return copy;
};

const calcDurationDays = (start?: string | null, end?: string | null) => {
  const startDate = parseIsoDate(start);
  const endDate = parseIsoDate(end);
  if (!startDate || !endDate) return null;
  const diff = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
  const rounded = Math.ceil(diff);
  return Math.max(1, rounded || 1);
};

const deriveEndDate = (start?: string | null, durationDays?: number | null) => {
  if (!start || !durationDays) return null;
  const startDate = parseIsoDate(start);
  if (!startDate) return null;
  return toIsoDate(addDays(startDate, durationDays));
};

const normalizeEnvRow = (row: PlanningEnvironmentEntry & { plannedStart?: string | null; plannedEnd?: string | null }) => {
  const startDate = row.startDate ?? (row as any).plannedStart ?? null;
  const endDate = row.endDate ?? (row as any).plannedEnd ?? deriveEndDate(startDate, row.durationDays ?? null);
  const durationDays = typeof row.durationDays === 'number'
    ? row.durationDays
    : calcDurationDays(startDate, endDate);
  return {
    name: String(row.name).toUpperCase(),
    startDate,
    durationDays: durationDays ?? null,
    endDate,
    actualStart: row.actualStart ?? null,
    actualEnd: row.actualEnd ?? null
  };
};

const ensureEnvRows = (rows: PlanningEnvironmentEntry[]) => {
  const seen = new Set<string>();
  const normalized: PlanningEnvironmentEntry[] = [];
  rows.forEach((row) => {
    if (!row?.name) return;
    const name = String(row.name).toUpperCase();
    if (seen.has(name)) return;
    seen.add(name);
    normalized.push(normalizeEnvRow({ ...row, name }));
  });
  return normalized;
};

const mapLegacyEnvObject = (envObj: any): PlanningEnvironmentEntry[] => {
  if (!envObj || typeof envObj !== 'object') return [];
  const mapping: Array<{ key: string; name: string }> = [
    { key: 'dev', name: 'DEV' },
    { key: 'sit', name: 'SIT' },
    { key: 'integration', name: 'INT' },
    { key: 'int', name: 'INT' },
    { key: 'uat', name: 'UAT' },
    { key: 'prod', name: 'PROD' }
  ];

  return mapping.map(({ key, name }) => {
    const value = envObj[key] || envObj[name] || {};
    const plannedStart = value?.plannedStart ?? null;
    const plannedEnd = value?.plannedEnd ?? null;
    const durationDays = calcDurationDays(plannedStart, plannedEnd);
    return normalizeEnvRow({
      name,
      startDate: plannedStart,
      durationDays,
      endDate: plannedEnd,
      actualStart: value?.actualStart ?? null,
      actualEnd: value?.actualEnd ?? null
    });
  });
};

const resolveGoLive = (record: any) => {
  const direct = record?.goLive || {};
  const legacy = record?.environments?.goLive || {};
  return {
    planned: direct?.planned ?? legacy?.plannedDate ?? null,
    actual: direct?.actual ?? legacy?.actualDate ?? null
  };
};

const resolvePlanningDefaults = (record: any) => {
  if (record?.planningDefaults && ('milestoneCount' in record.planningDefaults)) {
    return {
      milestoneCount: record.planningDefaults.milestoneCount ?? null,
      sprintDurationWeeks: record.planningDefaults.sprintDurationWeeks ?? null,
      milestoneDurationWeeks: record.planningDefaults.milestoneDurationWeeks ?? null
    };
  }
  const legacy = record?.planningContext || {};
  return {
    milestoneCount: legacy.defaultMilestoneCount ?? null,
    sprintDurationWeeks: legacy.defaultSprintDurationWeeks ?? null,
    milestoneDurationWeeks: legacy.defaultMilestoneDurationWeeks ?? null
  };
};

const resolveCapacityDefaults = (record: any) => {
  if (record?.capacityDefaults) {
    return {
      capacityModel: record.capacityDefaults.capacityModel ?? null,
      deliveryTeams: record.capacityDefaults.deliveryTeams ?? null,
      sprintVelocityPerTeam: record.capacityDefaults.sprintVelocityPerTeam ?? null,
      directSprintCapacity: record.capacityDefaults.directSprintCapacity ?? null,
      teamSize: record.capacityDefaults.teamSize ?? null,
      projectSize: record.capacityDefaults.projectSize ?? null
    };
  }

  const legacy = record?.planningDefaults || {};
  return {
    capacityModel: legacy.capacityMode ?? legacy.capacityModel ?? null,
    deliveryTeams: legacy.deliveryTeams ?? null,
    sprintVelocityPerTeam: legacy.sprintVelocityPerTeam ?? null,
    directSprintCapacity: legacy.directSprintCapacity ?? null,
    teamSize: legacy.teamSize ?? null,
    projectSize: legacy.projectSize ?? null
  };
};

const resolveNotes = (record: any) => {
  if (typeof record?.notes === 'string') return record.notes;
  if (record?.notes && typeof record.notes === 'object') {
    const schedule = record.notes.scheduleNotes ? `Schedule: ${record.notes.scheduleNotes}` : '';
    const planning = record.notes.planningNotes ? `Planning: ${record.notes.planningNotes}` : '';
    return [schedule, planning].filter(Boolean).join('\n');
  }
  return null;
};

const normalizeRecord = (
  record: any,
  scopeType: 'bundle' | 'application',
  scopeId: string,
  bundleId?: string | null,
  applicationId?: string | null
): ApplicationPlanningMetadata => {
  const envs = Array.isArray(record?.environments)
    ? record.environments
    : mapLegacyEnvObject(record?.environments);

  return {
    _id: record?._id,
    scopeType,
    scopeId,
    bundleId: bundleId ?? record?.bundleId ?? null,
    applicationId: applicationId ?? record?.applicationId,
    environments: ensureEnvRows(envs || []),
    goLive: resolveGoLive(record),
    planningDefaults: resolvePlanningDefaults(record),
    capacityDefaults: resolveCapacityDefaults(record),
    notes: resolveNotes(record),
    createdAt: record?.createdAt,
    updatedAt: record?.updatedAt
  };
};

export const fetchApplicationById = async (applicationId: string) => {
  return await resolveApplication(applicationId);
};

export const getPlanningMetadataByScope = async (scopeType: 'bundle' | 'application', scopeId: string) => {
  const db = await getDb();
  await ensureApplicationPlanningMetadataIndexes(db);
  if (scopeType === 'application') {
    return await db.collection<ApplicationPlanningMetadata>('application_planning_metadata').findOne({
      $or: [
        { scopeType: 'application', scopeId: String(scopeId) },
        { applicationId: String(scopeId) }
      ]
    });
  }
  return await db.collection<ApplicationPlanningMetadata>('application_planning_metadata').findOne({
    scopeType: 'bundle',
    scopeId: String(scopeId)
  });
};

export const getApplicationPlanningMetadata = async (applicationId: string) => {
  return await getPlanningMetadataByScope('application', applicationId);
};

export const getBundlePlanningMetadata = async (bundleId: string) => {
  return await getPlanningMetadataByScope('bundle', bundleId);
};

export const upsertPlanningMetadata = async (
  scopeType: 'bundle' | 'application',
  scopeId: string,
  payload: Partial<ApplicationPlanningMetadata> & { bundleId?: string | null; applicationId?: string | null }
) => {
  const db = await getDb();
  await ensureApplicationPlanningMetadataIndexes(db);
  const now = new Date().toISOString();
  const { createdAt: _createdAt, _id: _id, ...rest } = payload || {};
  const doc: Partial<ApplicationPlanningMetadata> = {
    ...rest,
    scopeType,
    scopeId: String(scopeId),
    bundleId: payload.bundleId ?? null,
    applicationId: payload.applicationId ?? (scopeType === 'application' ? String(scopeId) : undefined),
    updatedAt: now
  };
  await db.collection<ApplicationPlanningMetadata>('application_planning_metadata').updateOne(
    { scopeType, scopeId: String(scopeId) },
    {
      $set: doc,
      $setOnInsert: { createdAt: now }
    },
    { upsert: true }
  );
};

export const normalizePlanningMetadata = (
  record: any,
  scopeType: 'bundle' | 'application',
  scopeId: string,
  bundleId?: string | null,
  applicationId?: string | null
) => normalizeRecord(record || {}, scopeType, scopeId, bundleId, applicationId);

const mergeEnvironmentRows = (bundleRows: PlanningEnvironmentEntry[], appRows: PlanningEnvironmentEntry[]) => {
  const bundleMap = new Map<string, PlanningEnvironmentEntry>();
  bundleRows.forEach((row) => {
    if (!row?.name) return;
    bundleMap.set(String(row.name).toUpperCase(), row);
  });
  const appMap = new Map<string, PlanningEnvironmentEntry>();
  appRows.forEach((row) => {
    if (!row?.name) return;
    appMap.set(String(row.name).toUpperCase(), row);
  });

  const orderedNames: string[] = [];
  bundleRows.forEach((row) => {
    const name = String(row.name || '').toUpperCase();
    if (name && !orderedNames.includes(name)) orderedNames.push(name);
  });
  appRows.forEach((row) => {
    const name = String(row.name || '').toUpperCase();
    if (name && !orderedNames.includes(name)) orderedNames.push(name);
  });

  return ensureEnvRows(orderedNames.map((name) => {
    const base = bundleMap.get(name) || { name };
    const override = appMap.get(name);
    const merged = {
      name,
      startDate: override?.startDate ?? base.startDate ?? null,
      durationDays: typeof override?.durationDays === 'number' ? override.durationDays : (typeof base.durationDays === 'number' ? base.durationDays : null),
      endDate: override?.endDate ?? base.endDate ?? null,
      actualStart: override?.actualStart ?? base.actualStart ?? null,
      actualEnd: override?.actualEnd ?? base.actualEnd ?? null
    };
    return normalizeEnvRow(merged as PlanningEnvironmentEntry);
  }));
};

const mergePrimitive = <T>(bundleValue: T | null | undefined, appValue: T | null | undefined) => {
  if (typeof appValue !== 'undefined' && appValue !== null && appValue !== '') return appValue;
  return bundleValue ?? null;
};

export const buildResolvedPlanningMetadata = (
  bundleMeta: ApplicationPlanningMetadata | null,
  appMeta: ApplicationPlanningMetadata | null,
  applicationId: string,
  bundleId?: string | null
) => {
  const normalizedBundle = bundleMeta
    ? normalizePlanningMetadata(bundleMeta, 'bundle', bundleMeta.scopeId || String(bundleId || ''), bundleId, null)
    : normalizePlanningMetadata({}, 'bundle', String(bundleId || ''), bundleId, null);
  const normalizedApp = appMeta
    ? normalizePlanningMetadata(appMeta, 'application', appMeta.scopeId || String(applicationId), bundleId, applicationId)
    : normalizePlanningMetadata({}, 'application', String(applicationId), bundleId, applicationId);

  return {
    scopeType: 'application' as const,
    scopeId: String(applicationId),
    applicationId: String(applicationId),
    bundleId: bundleId ?? null,
    environments: mergeEnvironmentRows(normalizedBundle.environments || [], normalizedApp.environments || []),
    goLive: {
      planned: mergePrimitive(normalizedBundle.goLive?.planned, normalizedApp.goLive?.planned),
      actual: mergePrimitive(normalizedBundle.goLive?.actual, normalizedApp.goLive?.actual)
    },
    planningDefaults: {
      milestoneCount: mergePrimitive(normalizedBundle.planningDefaults?.milestoneCount, normalizedApp.planningDefaults?.milestoneCount),
      sprintDurationWeeks: mergePrimitive(normalizedBundle.planningDefaults?.sprintDurationWeeks, normalizedApp.planningDefaults?.sprintDurationWeeks),
      milestoneDurationWeeks: mergePrimitive(normalizedBundle.planningDefaults?.milestoneDurationWeeks, normalizedApp.planningDefaults?.milestoneDurationWeeks)
    },
    capacityDefaults: {
      capacityModel: mergePrimitive(normalizedBundle.capacityDefaults?.capacityModel, normalizedApp.capacityDefaults?.capacityModel),
      deliveryTeams: mergePrimitive(normalizedBundle.capacityDefaults?.deliveryTeams, normalizedApp.capacityDefaults?.deliveryTeams),
      sprintVelocityPerTeam: mergePrimitive(normalizedBundle.capacityDefaults?.sprintVelocityPerTeam, normalizedApp.capacityDefaults?.sprintVelocityPerTeam),
      directSprintCapacity: mergePrimitive(normalizedBundle.capacityDefaults?.directSprintCapacity, normalizedApp.capacityDefaults?.directSprintCapacity),
      teamSize: mergePrimitive(normalizedBundle.capacityDefaults?.teamSize, normalizedApp.capacityDefaults?.teamSize),
      projectSize: mergePrimitive(normalizedBundle.capacityDefaults?.projectSize, normalizedApp.capacityDefaults?.projectSize)
    },
    notes: mergePrimitive(normalizedBundle.notes, normalizedApp.notes),
    createdAt: normalizedApp.createdAt || normalizedBundle.createdAt,
    updatedAt: normalizedApp.updatedAt || normalizedBundle.updatedAt
  } as ApplicationPlanningMetadata;
};

export const buildPlanningContextPayload = (
  bundleMeta: ApplicationPlanningMetadata | null,
  appMeta: ApplicationPlanningMetadata | null,
  resolved: ApplicationPlanningMetadata
) => ({
  bundleMetadata: bundleMeta,
  applicationMetadata: appMeta,
  resolvedMetadata: resolved
});
