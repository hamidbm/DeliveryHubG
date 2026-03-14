import bcrypt from 'bcryptjs';
import { ObjectId } from 'mongodb';
import { createDeliveryPlan, previewDeliveryPlan } from './deliveryPlanGenerator';
import { getDb } from './db';
import { invalidateAllWorkItemCaches, primeWorkItemScope } from './workItemCache';
import { DeliveryPlanInput, WorkItemStatus, WorkItemType } from '../types';
import {
  BuiltBundlePlanInput,
  DemoScenario,
  DemoScenarioAssignmentRules,
  DemoScenarioInstallResponse,
  DemoScenarioPreviewResponse,
  DemoScenarioUser,
  DemoScenarioValidationResult
} from '../types/demoScenario';

class DemoScenarioValidationError extends Error {
  code = 'DEMO_SCENARIO_VALIDATION' as const;
  errors: DemoScenarioValidationResult['errors'];

  constructor(errors: DemoScenarioValidationResult['errors']) {
    super('Demo scenario validation failed');
    this.errors = errors;
  }
}

const DEFAULT_DEMO_PASSWORD = 'DemoUser!123';

const id = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
const normalizeName = (value: string) => String(value || '').trim().toLowerCase();
const normalizeEmail = (value: string) => String(value || '').trim().toLowerCase();
const slugify = (value: string) => String(value || '')
  .toUpperCase()
  .replace(/[^A-Z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')
  .replace(/-{2,}/g, '-');
const toSafeIso = (date: Date) => date.toISOString().replace(/[:.]/g, '-');

const getAllScenarioUsers = (scenario: DemoScenario): DemoScenarioUser[] => {
  const users: DemoScenarioUser[] = [];
  for (const bundle of scenario.bundles || []) {
    for (const team of bundle.teams || []) {
      for (const user of team.users || []) users.push(user);
    }
  }
  return users;
};

const toValidationError = (path: string, code: string, message: string) => ({ path, code, message });

export const getDefaultDemoScenario = (): DemoScenario => ({
  scenarioKey: 'default-demo',
  scenarioName: 'Default DeliveryHub Demo',
  resetBeforeInstall: true,
  defaults: { defaultPassword: DEFAULT_DEMO_PASSWORD },
  bundles: [
    {
      tempId: id('bundle'),
      key: 'DEMO-PAYMENTS',
      name: 'Payments Platform',
      description: 'Migration and modernization of payment processing services.',
      applications: [
        { tempId: id('app'), aid: 'APP-DEMO-PAYMENTS-API', key: 'APP-DEMO-PAYMENTS-API', name: 'Payments API', isActive: true, status: { phase: 'MIGRATION', health: 'Risk' } },
        { tempId: id('app'), aid: 'APP-DEMO-BILLING-ORCH', key: 'APP-DEMO-BILLING-ORCH', name: 'Billing Orchestrator', isActive: true, status: { phase: 'MODERNIZATION', health: 'Healthy' } },
        { tempId: id('app'), aid: 'APP-DEMO-FRAUD-SVC', key: 'APP-DEMO-FRAUD-SVC', name: 'Fraud Detection Service', isActive: true, status: { phase: 'ENHANCEMENT', health: 'Risk' } }
      ],
      planning: {
        plannedStartDate: '2026-01-05',
        devStartDate: '2026-01-05',
        integrationStartDate: '2026-02-02',
        uatStartDate: '2026-03-09',
        goLiveDate: '2026-04-20',
        stabilizationEndDate: '2026-05-08',
        milestoneCount: 5,
        sprintDurationWeeks: 2,
        milestoneDurationStrategy: 'AUTO_DISTRIBUTE',
        deliveryPattern: 'MIGRATION',
        backlogShape: 'DETAILED',
        projectSize: 'LARGE',
        capacityMode: 'TEAM_VELOCITY',
        deliveryTeams: 3,
        sprintVelocityPerTeam: 28,
        createTasksUnderStories: true,
        environmentFlow: 'DEV_SIT_UAT_PROD',
        releaseType: 'PHASED',
        suggestMilestoneOwners: true,
        suggestWorkItemOwners: true,
        createDependencySkeleton: true,
        preallocateStoriesToSprints: true,
        autoLinkMilestonesToRoadmap: true,
        generateDraftOnly: true
      },
      teams: [
        {
          name: 'Engineering',
          tempId: id('team'),
          users: [
            { tempId: id('user'), name: 'Iris Engineer', username: 'iris.engineer', email: 'iris.engineer@demo.deliveryhub.local', team: 'Engineering', role: 'Engineering', assignmentIntent: 'PRIMARY' },
            { tempId: id('user'), name: 'Leo Engineer', username: 'leo.engineer', email: 'leo.engineer@demo.deliveryhub.local', team: 'Engineering', role: 'Engineering', assignmentIntent: 'PRIMARY' }
          ]
        },
        {
          name: 'CMO',
          tempId: id('team'),
          users: [
            { tempId: id('user'), name: 'Nina CMO', username: 'nina.cmo', email: 'nina.cmo@demo.deliveryhub.local', team: 'CMO', role: 'CMO Architect', assignmentIntent: 'SECONDARY' }
          ]
        },
        {
          name: 'SVP',
          tempId: id('team'),
          users: [
            { tempId: id('user'), name: 'Nadia Architect', username: 'nadia.architect', email: 'nadia.architect@demo.deliveryhub.local', team: 'SVP', role: 'SVP Architect', assignmentIntent: 'PRIMARY' },
            { tempId: id('user'), name: 'Sami SME', username: 'sami.sme', email: 'sami.sme@demo.deliveryhub.local', team: 'SVP', role: 'SVP SME', assignmentIntent: 'PRIMARY' },
            { tempId: id('user'), name: 'Peyman SME', username: 'peyman.sme', email: 'peyman.sme@demo.deliveryhub.local', team: 'SVP', role: 'SVP SME', assignmentIntent: 'PRIMARY' },
            { tempId: id('user'), name: 'Dina SME', username: 'dina.sme', email: 'dina.sme@demo.deliveryhub.local', team: 'SVP', role: 'SVP SME', assignmentIntent: 'PRIMARY' },
            { tempId: id('user'), name: 'Kian SME', username: 'kian.sme', email: 'kian.sme@demo.deliveryhub.local', team: 'SVP', role: 'SVP SME', assignmentIntent: 'PRIMARY' }
          ]
        }
      ],
      assignmentRules: {
        assignSomeToSvp: true,
        leaveSomeUnassigned: true,
        unassignedPercentage: 18,
        svpAssignmentPercentage: 10,
        assignEpicsAndFeaturesToOwners: true,
        assignStoriesAndTasksToTeamMembers: true
      }
    },
    {
      tempId: id('bundle'),
      key: 'DEMO-CUSTOMER',
      name: 'Customer Engagement',
      description: 'Incremental experience modernization across customer channels.',
      applications: [
        { tempId: id('app'), aid: 'APP-DEMO-MEMBER-PORTAL', key: 'APP-DEMO-MEMBER-PORTAL', name: 'Member Portal', isActive: true, status: { phase: 'ENHANCEMENT', health: 'Risk' } },
        { tempId: id('app'), aid: 'APP-DEMO-IDENTITY', key: 'APP-DEMO-IDENTITY', name: 'Identity Service', isActive: true, status: { phase: 'MIGRATION', health: 'Critical' } },
        { tempId: id('app'), aid: 'APP-DEMO-NOTIFY', key: 'APP-DEMO-NOTIFY', name: 'Notification Hub', isActive: true, status: { phase: 'MODERNIZATION', health: 'Healthy' } }
      ],
      planning: {
        plannedStartDate: '2026-02-02',
        devStartDate: '2026-02-02',
        integrationStartDate: '2026-03-02',
        uatStartDate: '2026-04-06',
        goLiveDate: '2026-05-18',
        stabilizationEndDate: '2026-06-01',
        milestoneCount: 4,
        sprintDurationWeeks: 2,
        milestoneDurationStrategy: 'AUTO_DISTRIBUTE',
        deliveryPattern: 'PRODUCT_INCREMENT',
        backlogShape: 'STANDARD',
        projectSize: 'MEDIUM',
        capacityMode: 'TEAM_VELOCITY',
        deliveryTeams: 2,
        sprintVelocityPerTeam: 24,
        createTasksUnderStories: true,
        environmentFlow: 'DEV_SIT_UAT_PROD',
        releaseType: 'INCREMENTAL',
        suggestMilestoneOwners: true,
        suggestWorkItemOwners: true,
        createDependencySkeleton: true,
        preallocateStoriesToSprints: true,
        autoLinkMilestonesToRoadmap: true,
        generateDraftOnly: true
      },
      teams: [
        {
          name: 'Engineering',
          tempId: id('team'),
          users: [
            { tempId: id('user'), name: 'Lina Engineer', username: 'lina.engineer', email: 'lina.engineer@demo.deliveryhub.local', team: 'Engineering', role: 'Engineering', assignmentIntent: 'PRIMARY' },
            { tempId: id('user'), name: 'Omid Engineer', username: 'omid.engineer', email: 'omid.engineer@demo.deliveryhub.local', team: 'Engineering', role: 'Engineering', assignmentIntent: 'PRIMARY' }
          ]
        },
        {
          name: 'CMO',
          tempId: id('team'),
          users: [
            { tempId: id('user'), name: 'Ayla CMO', username: 'ayla.cmo', email: 'ayla.cmo@demo.deliveryhub.local', team: 'CMO', role: 'CMO Architect', assignmentIntent: 'SECONDARY' }
          ]
        },
        {
          name: 'SVP',
          tempId: id('team'),
          users: [
            { tempId: id('user'), name: 'Farah Architect', username: 'farah.architect', email: 'farah.architect@demo.deliveryhub.local', team: 'SVP', role: 'SVP Architect', assignmentIntent: 'PRIMARY' },
            { tempId: id('user'), name: 'Ramin SME', username: 'ramin.sme', email: 'ramin.sme@demo.deliveryhub.local', team: 'SVP', role: 'SVP SME', assignmentIntent: 'PRIMARY' },
            { tempId: id('user'), name: 'Navid SME', username: 'navid.sme', email: 'navid.sme@demo.deliveryhub.local', team: 'SVP', role: 'SVP SME', assignmentIntent: 'PRIMARY' },
            { tempId: id('user'), name: 'Tara SME', username: 'tara.sme', email: 'tara.sme@demo.deliveryhub.local', team: 'SVP', role: 'SVP SME', assignmentIntent: 'PRIMARY' },
            { tempId: id('user'), name: 'Laleh SME', username: 'laleh.sme', email: 'laleh.sme@demo.deliveryhub.local', team: 'SVP', role: 'SVP SME', assignmentIntent: 'PRIMARY' }
          ]
        }
      ],
      assignmentRules: {
        assignSomeToSvp: true,
        leaveSomeUnassigned: true,
        unassignedPercentage: 15,
        svpAssignmentPercentage: 8,
        assignEpicsAndFeaturesToOwners: true,
        assignStoriesAndTasksToTeamMembers: true
      }
    }
  ]
});

const cloneScenario = (scenario: DemoScenario): DemoScenario => JSON.parse(JSON.stringify(scenario));

const normalizeScenario = (scenario: DemoScenario): { scenario: DemoScenario; warnings: string[] } => {
  const warnings: string[] = [];
  const copy = cloneScenario(scenario);
  copy.bundles = (copy.bundles || []).map((bundle, bi) => {
    bundle.tempId = bundle.tempId || id(`bundle-${bi}`);
    bundle.applications = (bundle.applications || []).map((app, ai) => ({
      ...app,
      tempId: app.tempId || id(`app-${bi}-${ai}`),
      isActive: app.isActive !== false,
      status: app.status || { health: 'Healthy' }
    }));
    bundle.teams = (bundle.teams || []).map((team, ti) => {
      const users = (team.users || []).map((user, ui) => ({
        ...user,
        tempId: user.tempId || id(`user-${bi}-${ti}-${ui}`),
        isActive: user.isActive !== false,
        assignmentIntent: user.assignmentIntent || 'PRIMARY'
      }));
      if (team.size !== undefined && team.size !== users.length) {
        warnings.push(`bundle[${bi}] team[${ti}] size normalized from ${team.size} to ${users.length}`);
      }
      return {
        ...team,
        tempId: team.tempId || id(`team-${bi}-${ti}`),
        size: users.length,
        users
      };
    });
    return bundle;
  });
  return { scenario: copy, warnings };
};

export const validateDemoScenario = (input: DemoScenario): DemoScenarioValidationResult => {
  const errors: DemoScenarioValidationResult['errors'] = [];
  const scenarioName = String(input?.scenarioName || '').trim();
  if (!scenarioName) errors.push(toValidationError('scenarioName', 'REQUIRED', 'Scenario name is required.'));

  const bundles = input?.bundles || [];
  if (!bundles.length) errors.push(toValidationError('bundles', 'REQUIRED', 'At least one bundle is required.'));

  const bundleNames = new Set<string>();
  const emails = new Set<string>();

  bundles.forEach((bundle, bi) => {
    const bundlePath = `bundles[${bi}]`;
    const bundleName = normalizeName(bundle?.name || '');
    if (!bundleName) errors.push(toValidationError(`${bundlePath}.name`, 'REQUIRED', 'Bundle name is required.'));
    else if (bundleNames.has(bundleName)) errors.push(toValidationError(`${bundlePath}.name`, 'DUPLICATE', 'Duplicate bundle name in scenario.'));
    else bundleNames.add(bundleName);

    const apps = bundle?.applications || [];
    if (!apps.length) errors.push(toValidationError(`${bundlePath}.applications`, 'REQUIRED', 'At least one application per bundle is required.'));

    const appNames = new Set<string>();
    apps.forEach((app, ai) => {
      const appName = normalizeName(app?.name || '');
      const appPath = `${bundlePath}.applications[${ai}]`;
      if (!appName) errors.push(toValidationError(`${appPath}.name`, 'REQUIRED', 'Application name is required.'));
      else if (appNames.has(appName)) errors.push(toValidationError(`${appPath}.name`, 'DUPLICATE', 'Duplicate application name in this bundle.'));
      else appNames.add(appName);
    });

    const planning = bundle?.planning;
    if (!planning?.devStartDate) errors.push(toValidationError(`${bundlePath}.planning.devStartDate`, 'REQUIRED', 'DEV start date is required.'));
    if (!planning?.uatStartDate) errors.push(toValidationError(`${bundlePath}.planning.uatStartDate`, 'REQUIRED', 'UAT start date is required.'));
    if (!planning?.goLiveDate) errors.push(toValidationError(`${bundlePath}.planning.goLiveDate`, 'REQUIRED', 'Go-live date is required.'));
    if (Number(planning?.milestoneCount || 0) < 1) errors.push(toValidationError(`${bundlePath}.planning.milestoneCount`, 'INVALID', 'Milestone count must be at least 1.'));
    if (Number(planning?.sprintDurationWeeks || 0) < 1) errors.push(toValidationError(`${bundlePath}.planning.sprintDurationWeeks`, 'INVALID', 'Sprint duration weeks must be at least 1.'));

    if (planning?.capacityMode === 'TEAM_VELOCITY') {
      if (Number(planning?.deliveryTeams || 0) < 1) errors.push(toValidationError(`${bundlePath}.planning.deliveryTeams`, 'INVALID', 'Delivery teams must be at least 1 for TEAM_VELOCITY mode.'));
      if (Number(planning?.sprintVelocityPerTeam || 0) < 1) errors.push(toValidationError(`${bundlePath}.planning.sprintVelocityPerTeam`, 'INVALID', 'Sprint velocity per team must be at least 1 for TEAM_VELOCITY mode.'));
    }

    if (planning?.capacityMode === 'DIRECT_SPRINT_CAPACITY' && Number(planning?.directSprintCapacity || 0) < 1) {
      errors.push(toValidationError(`${bundlePath}.planning.directSprintCapacity`, 'INVALID', 'Direct sprint capacity must be at least 1 for DIRECT_SPRINT_CAPACITY mode.'));
    }

    const rules = bundle?.assignmentRules as DemoScenarioAssignmentRules | undefined;
    if (rules) {
      if (rules.unassignedPercentage < 0 || rules.unassignedPercentage > 100) {
        errors.push(toValidationError(`${bundlePath}.assignmentRules.unassignedPercentage`, 'INVALID_RANGE', 'Unassigned percentage must be between 0 and 100.'));
      }
      if (rules.svpAssignmentPercentage < 0 || rules.svpAssignmentPercentage > 100) {
        errors.push(toValidationError(`${bundlePath}.assignmentRules.svpAssignmentPercentage`, 'INVALID_RANGE', 'SVP assignment percentage must be between 0 and 100.'));
      }
    }

    (bundle?.teams || []).forEach((team, ti) => {
      (team?.users || []).forEach((user, ui) => {
        const email = normalizeEmail(user?.email || '');
        const emailPath = `${bundlePath}.teams[${ti}].users[${ui}].email`;
        if (!email) {
          errors.push(toValidationError(emailPath, 'REQUIRED', 'User email is required.'));
          return;
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          errors.push(toValidationError(emailPath, 'INVALID_EMAIL', 'User email is invalid.'));
          return;
        }
        if (emails.has(email)) {
          errors.push(toValidationError(emailPath, 'DUPLICATE', 'Duplicate user email across scenario.'));
          return;
        }
        emails.add(email);
      });
    });
  });

  return { valid: errors.length === 0, errors };
};

const assertValidScenario = (input: DemoScenario) => {
  const validation = validateDemoScenario(input);
  if (!validation.valid) {
    throw new DemoScenarioValidationError(validation.errors);
  }
};

const getDemoTag = (scenario: DemoScenario) => {
  const base = slugify(scenario.scenarioKey || 'default-demo').toLowerCase() || 'default-demo';
  return scenario.demoTag?.trim() || `${base}-${toSafeIso(new Date())}`;
};

const getDemoDeleteFilter = (demoTag?: string) => {
  if (demoTag) return { demoTag: String(demoTag) };
  return { $or: [{ demoTag: { $exists: true } }, { demoScenarioKey: { $exists: true } }] };
};

const dedupeUsersByEmail = (scenario: DemoScenario) => {
  const users = getAllScenarioUsers(scenario);
  const map = new Map<string, DemoScenarioUser>();
  for (const user of users) {
    const email = normalizeEmail(user.email);
    if (!email) continue;
    if (!map.has(email)) map.set(email, user);
  }
  return map;
};

const provisionScenarioUsers = async (db: any, scenario: DemoScenario, demoTag: string, actorUserId: string) => {
  const users = dedupeUsersByEmail(scenario);
  const hashed = await bcrypt.hash(String(scenario.defaults?.defaultPassword || DEFAULT_DEMO_PASSWORD), 10);
  const now = new Date().toISOString();
  const byEmail = new Map<string, any>();
  let processed = 0;

  for (const [email, user] of users.entries()) {
    const username = (user.username || email.split('@')[0] || '').trim() || email.split('@')[0];
    await db.collection('users').updateOne(
      { email },
      {
        $set: {
          name: user.name,
          username,
          email,
          team: user.team,
          role: user.role,
          isActive: user.isActive !== false,
          demoTag,
          demoScenarioKey: scenario.scenarioKey,
          updatedAt: now,
          updatedBy: actorUserId
        },
        $setOnInsert: {
          password: hashed,
          createdAt: now,
          createdBy: actorUserId
        }
      },
      { upsert: true }
    );
    const persisted = await db.collection('users').findOne({ email });
    if (persisted) byEmail.set(email, persisted);
    processed += 1;
  }

  return { processed, byEmail };
};

const provisionScenarioBundles = async (db: any, scenario: DemoScenario, demoTag: string, actorUserId: string) => {
  const now = new Date().toISOString();
  const byTempId = new Map<string, { _id: string; name: string; key: string }>();
  let processed = 0;

  for (const bundle of scenario.bundles || []) {
    const key = (bundle.key || `DEMO-${slugify(bundle.name)}`).toUpperCase();
    const filter = bundle.key ? { key: bundle.key } : { name: bundle.name };
    await db.collection('bundles').updateOne(
      filter,
      {
        $set: {
          key,
          name: bundle.name,
          description: bundle.description || '',
          demoTag,
          demoScenarioKey: scenario.scenarioKey,
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
    const persisted = await db.collection('bundles').findOne({ key });
    if (persisted?._id) {
      byTempId.set(bundle.tempId, { _id: String(persisted._id), name: persisted.name || bundle.name, key: persisted.key || key });
      processed += 1;
    }
  }

  return { processed, byTempId };
};

const buildGeneratedAid = (bundleKey: string, appName: string) => `APP-${slugify(bundleKey)}-${slugify(appName)}`;

const provisionScenarioApplications = async (
  db: any,
  scenario: DemoScenario,
  bundleByTempId: Map<string, { _id: string; name: string; key: string }>,
  demoTag: string,
  actorUserId: string
) => {
  const now = new Date().toISOString();
  let processed = 0;

  for (const bundle of scenario.bundles || []) {
    const persistedBundle = bundleByTempId.get(bundle.tempId);
    if (!persistedBundle) continue;

    for (const app of bundle.applications || []) {
      const aid = app.aid || buildGeneratedAid(persistedBundle.key, app.name);
      const key = app.key || aid;
      const filter = app.aid
        ? { aid: app.aid }
        : { bundleId: persistedBundle._id, name: app.name };

      await db.collection('applications').updateOne(
        filter,
        {
          $set: {
            aid,
            key,
            name: app.name,
            bundleId: persistedBundle._id,
            isActive: app.isActive !== false,
            status: app.status || { health: 'Healthy' },
            demoTag,
            demoScenarioKey: scenario.scenarioKey,
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
      processed += 1;
    }
  }

  return { processed };
};

const provisionBundleAssignments = async (
  db: any,
  scenario: DemoScenario,
  bundleByTempId: Map<string, { _id: string; name: string; key: string }>,
  usersByEmail: Map<string, any>,
  demoTag: string,
  actorUserId: string
) => {
  const now = new Date().toISOString();
  const inferAssignmentTypes = (teamValue?: string) => {
    const value = String(teamValue || '').toLowerCase();
    if (value.includes('engineering')) return ['bundle_owner'];
    if (value.includes('svp')) return ['svp'];
    if (value.includes('cmo')) return ['assigned_cmo'];
    return [] as string[];
  };

  for (const bundle of scenario.bundles || []) {
    const persistedBundle = bundleByTempId.get(bundle.tempId);
    if (!persistedBundle) continue;

    for (const team of bundle.teams || []) {
      for (const scenarioUser of team.users || []) {
        const persistedUser = usersByEmail.get(normalizeEmail(scenarioUser.email));
        if (!persistedUser?._id) continue;
        const assignmentTypes = inferAssignmentTypes(scenarioUser.team || team.name);

        for (const assignmentType of assignmentTypes) {
          await db.collection('bundle_assignments').updateOne(
            {
              bundleId: persistedBundle._id,
              userId: String(persistedUser._id),
              assignmentType
            },
            {
              $set: {
                bundleId: persistedBundle._id,
                userId: String(persistedUser._id),
                assignmentType,
                active: true,
                demoTag,
                demoScenarioKey: scenario.scenarioKey,
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
        }
      }
    }
  }
};

export const buildDeliveryPlanInputsFromScenario = (
  input: DemoScenario,
  bundleByTempId: Map<string, { _id: string; name: string; key: string }>
): BuiltBundlePlanInput[] => {
  const built: BuiltBundlePlanInput[] = [];
  for (const bundle of input.bundles || []) {
    const persisted = bundleByTempId.get(bundle.tempId);
    if (!persisted) continue;
    built.push({
      bundleTempId: bundle.tempId,
      bundleName: bundle.name,
      bundleId: persisted._id,
      input: {
        scopeType: 'BUNDLE',
        scopeId: persisted._id,
        ...bundle.planning
      }
    });
  }
  return built;
};

const countScenarioApplications = (scenario: DemoScenario) => (scenario.bundles || []).reduce((sum, bundle) => sum + (bundle.applications || []).length, 0);

const asObjectIds = (ids: string[]) => ids.filter((v) => ObjectId.isValid(v)).map((v) => new ObjectId(v));

const tagGeneratedArtifacts = async (
  db: any,
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
  actorUserId: string
) => {
  const now = new Date().toISOString();
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

const shuffle = <T,>(items: T[]): T[] => {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};

const pickRoundRobin = <T,>(items: T[], index: number): T | null => {
  if (!items.length) return null;
  return items[index % items.length];
};

export const enrichGeneratedDemoArtifacts = async (
  db: any,
  params: {
    scenario: DemoScenario;
    demoTag: string;
    usersByEmail: Map<string, any>;
    runsByBundleTempId: Map<string, { workItemIds: string[] }>;
    actorUserId: string;
  }
) => {
  const now = new Date().toISOString();

  for (const bundle of params.scenario.bundles || []) {
    const run = params.runsByBundleTempId.get(bundle.tempId);
    if (!run?.workItemIds?.length) continue;
    const rules = bundle.assignmentRules || {
      assignSomeToSvp: true,
      leaveSomeUnassigned: true,
      unassignedPercentage: 15,
      svpAssignmentPercentage: 8,
      assignEpicsAndFeaturesToOwners: true,
      assignStoriesAndTasksToTeamMembers: true
    };

    const scenarioUsers = (bundle.teams || []).flatMap((team) => team.users || []);
    const persistedUsers = scenarioUsers
      .map((user) => params.usersByEmail.get(normalizeEmail(user.email)))
      .filter(Boolean);

    const owners = persistedUsers.filter((u: any) => {
      const match = scenarioUsers.find((s) => normalizeEmail(s.email) === normalizeEmail(u.email));
      return String(match?.team || '').toLowerCase().includes('engineering');
    });
    const svps = persistedUsers.filter((u: any) => {
      const match = scenarioUsers.find((s) => normalizeEmail(s.email) === normalizeEmail(u.email));
      return String(match?.team || '').toLowerCase().includes('svp');
    });
    const primary = persistedUsers.filter((u: any) => {
      const match = scenarioUsers.find((s) => normalizeEmail(s.email) === normalizeEmail(u.email));
      return (match?.assignmentIntent || 'PRIMARY') === 'PRIMARY';
    });
    const secondary = persistedUsers.filter((u: any) => {
      const match = scenarioUsers.find((s) => normalizeEmail(s.email) === normalizeEmail(u.email));
      return (match?.assignmentIntent || 'PRIMARY') === 'SECONDARY';
    });

    const itemIds = run.workItemIds.filter((idValue) => ObjectId.isValid(idValue)).map((idValue) => new ObjectId(idValue));
    const workItems: any[] = await db.collection('workitems').find({ _id: { $in: itemIds } }).toArray();

    const storiesById = new Map<string, any>();
    workItems.forEach((item: any) => {
      if (String(item.type || '').toUpperCase() === WorkItemType.STORY) storiesById.set(String(item._id), item);
    });

    let ownerIndex = 0;
    let deliveryIndex = 0;
    for (const item of shuffle(workItems)) {
      const type = String(item.type || '').toUpperCase();
      let assignTo: any | null = null;

      if ((type === WorkItemType.EPIC || type === WorkItemType.FEATURE) && rules.assignEpicsAndFeaturesToOwners) {
        assignTo = pickRoundRobin(owners.length ? owners : primary.length ? primary : secondary, ownerIndex);
        ownerIndex += 1;
      }

      if ((type === WorkItemType.STORY || type === WorkItemType.TASK) && rules.assignStoriesAndTasksToTeamMembers) {
        const unassigned = rules.leaveSomeUnassigned && Math.random() * 100 < Number(rules.unassignedPercentage || 0);
        if (!unassigned && rules.assignSomeToSvp && svps.length && Math.random() * 100 < Number(rules.svpAssignmentPercentage || 0)) {
          assignTo = pickRoundRobin(svps, deliveryIndex);
        } else if (!unassigned) {
          const pool = primary.length ? primary : secondary;
          assignTo = pickRoundRobin(pool, deliveryIndex);
        }
        deliveryIndex += 1;

        if (type === WorkItemType.TASK && item.parentId && !assignTo) {
          const parentStory = storiesById.get(String(item.parentId));
          if (parentStory?.assignedTo && Math.random() < 0.7) {
            assignTo = {
              _id: parentStory.assigneeUserIds?.[0],
              email: parentStory.assignedTo
            };
          }
        }
      }

      const statusRoll = Math.random();
      const status = statusRoll < 0.07 ? WorkItemStatus.DONE : statusRoll < 0.33 ? WorkItemStatus.IN_PROGRESS : WorkItemStatus.TODO;

      if (assignTo?.email) {
        await db.collection('workitems').updateOne(
          { _id: item._id },
          {
            $set: {
              assignedTo: String(assignTo.email),
              assigneeUserIds: assignTo._id ? [String(assignTo._id)] : [],
              status,
              labels: Array.from(new Set([...(item.labels || []), 'demo'])),
              demoTag: params.demoTag,
              demoScenarioKey: params.scenario.scenarioKey,
              updatedAt: now,
              updatedBy: params.actorUserId
            }
          }
        );
      } else {
        await db.collection('workitems').updateOne(
          { _id: item._id },
          {
            $set: {
              status,
              labels: Array.from(new Set([...(item.labels || []), 'demo'])),
              demoTag: params.demoTag,
              demoScenarioKey: params.scenario.scenarioKey,
              updatedAt: now,
              updatedBy: params.actorUserId
            },
            $unset: {
              assignedTo: '',
              assigneeUserIds: ''
            }
          }
        );
      }
    }
  }
};

const getActorEmail = async (db: any, userId: string, fallback?: string) => {
  if (!ObjectId.isValid(userId)) return fallback || 'admin@deliveryhub.local';
  const user = await db.collection('users').findOne({ _id: new ObjectId(userId) }).catch(() => null);
  return String(user?.email || fallback || 'admin@deliveryhub.local');
};

const provisionScenarioContext = async (db: any, scenario: DemoScenario, demoTag: string, actorUserId: string) => {
  const users = await provisionScenarioUsers(db, scenario, demoTag, actorUserId);
  const bundles = await provisionScenarioBundles(db, scenario, demoTag, actorUserId);
  const apps = await provisionScenarioApplications(db, scenario, bundles.byTempId, demoTag, actorUserId);
  await provisionBundleAssignments(db, scenario, bundles.byTempId, users.byEmail, demoTag, actorUserId);
  return {
    users,
    bundles,
    apps,
    builtInputs: buildDeliveryPlanInputsFromScenario(scenario, bundles.byTempId)
  };
};

export const previewDemoScenario = async (
  input: DemoScenario,
  actor: { userId: string; email?: string }
): Promise<DemoScenarioPreviewResponse> => {
  assertValidScenario(input);
  const normalized = normalizeScenario(input);
  const scenario = normalized.scenario;
  const db = await getDb();
  const demoTag = getDemoTag(scenario);
  const actorEmail = actor.email || await getActorEmail(db, actor.userId, actor.email);

  const context = await provisionScenarioContext(db, scenario, demoTag, actor.userId);
  const bundlePreviews: DemoScenarioPreviewResponse['bundlePreviews'] = [];

  for (const bundleInput of context.builtInputs) {
    const preview = await previewDeliveryPlan(bundleInput.input, { userId: actor.userId, email: actorEmail });
    bundlePreviews.push({
      bundleTempId: bundleInput.bundleTempId,
      bundleId: bundleInput.bundleId,
      bundleName: bundleInput.bundleName,
      previewId: String(preview.previewId),
      milestoneCount: Number(preview.counts?.milestones || 0),
      sprintCount: Number(preview.counts?.sprints || 0),
      roadmapPhaseCount: Number(preview.counts?.roadmapPhases || 0),
      epicCount: Number(preview.counts?.epics || 0),
      featureCount: Number(preview.counts?.features || 0),
      storyCount: Number(preview.counts?.stories || 0),
      taskCount: Number(preview.counts?.tasks || 0)
    });
  }

  const totals = bundlePreviews.reduce((acc, bundle) => {
    acc.milestones += bundle.milestoneCount;
    acc.sprints += bundle.sprintCount;
    acc.roadmapPhases += bundle.roadmapPhaseCount;
    acc.epics += bundle.epicCount;
    acc.features += bundle.featureCount;
    acc.stories += bundle.storyCount;
    acc.tasks += bundle.taskCount;
    return acc;
  }, {
    bundles: scenario.bundles.length,
    applications: countScenarioApplications(scenario),
    users: dedupeUsersByEmail(scenario).size,
    milestones: 0,
    sprints: 0,
    roadmapPhases: 0,
    epics: 0,
    features: 0,
    stories: 0,
    tasks: 0
  });

  return {
    scenarioKey: scenario.scenarioKey,
    scenarioName: scenario.scenarioName,
    bundlePreviews,
    totals,
    warnings: normalized.warnings.length ? normalized.warnings : undefined
  };
};

export const installDemoScenario = async (
  input: DemoScenario,
  actor: { userId: string; email?: string }
): Promise<DemoScenarioInstallResponse> => {
  assertValidScenario(input);
  const normalized = normalizeScenario(input);
  const scenario = normalized.scenario;
  const db = await getDb();
  const demoTag = getDemoTag(scenario);
  const actorEmail = actor.email || await getActorEmail(db, actor.userId, actor.email);

  if (scenario.resetBeforeInstall) {
    await resetDemoScenarioData();
  }

  const context = await provisionScenarioContext(db, scenario, demoTag, actor.userId);
  const runs: DemoScenarioInstallResponse['planRuns'] = [];
  const runsByBundleTempId = new Map<string, { workItemIds: string[] }>();

  for (const bundleInput of context.builtInputs) {
    const preview = await previewDeliveryPlan(bundleInput.input, { userId: actor.userId, email: actorEmail });
    const created = await createDeliveryPlan(String(preview.previewId), { userId: actor.userId, email: actorEmail });
    await tagGeneratedArtifacts(db, {
      demoTag,
      demoScenarioKey: scenario.scenarioKey,
      previewId: String(preview.previewId),
      runId: String(created.runId),
      milestoneIds: created.milestoneIds || [],
      sprintIds: created.sprintIds || [],
      workItemIds: created.workItemIds || [],
      roadmapPhaseIds: created.roadmapPhaseIds || []
    }, actor.userId);

    runsByBundleTempId.set(bundleInput.bundleTempId, { workItemIds: created.workItemIds || [] });

    runs.push({
      bundleId: bundleInput.bundleId,
      bundleName: bundleInput.bundleName,
      previewId: String(preview.previewId),
      runId: String(created.runId),
      milestoneCount: created.milestoneIds?.length || 0,
      sprintCount: created.sprintIds?.length || 0,
      roadmapPhaseCount: created.roadmapPhaseIds?.length || 0,
      workItemCount: created.workItemIds?.length || 0
    });
  }

  await enrichGeneratedDemoArtifacts(db, {
    scenario,
    demoTag,
    usersByEmail: context.users.byEmail,
    runsByBundleTempId,
    actorUserId: actor.userId
  });

  const totals = runs.reduce((acc, run) => {
    acc.milestones += run.milestoneCount;
    acc.sprints += run.sprintCount;
    acc.roadmapPhases += run.roadmapPhaseCount;
    acc.workItems += run.workItemCount;
    return acc;
  }, { milestones: 0, sprints: 0, roadmapPhases: 0, workItems: 0 });

  await invalidateAllWorkItemCaches('sample.install');
  for (const bundle of context.bundles.byTempId.values()) {
    await primeWorkItemScope({ scopeType: 'BUNDLE', scopeId: String(bundle._id) });
  }

  return {
    scenarioKey: scenario.scenarioKey,
    scenarioName: scenario.scenarioName,
    demoTag,
    bundlesCreatedOrUpdated: context.bundles.processed,
    applicationsCreatedOrUpdated: context.apps.processed,
    usersCreatedOrUpdated: context.users.processed,
    planRuns: runs,
    totals
  };
};

export const resetDemoScenarioData = async (demoTag?: string) => {
  const db = await getDb();
  const filter = getDemoDeleteFilter(demoTag);
  const collections = [
    'users',
    'bundles',
    'applications',
    'workitems',
    'work_items',
    'milestones',
    'workitems_sprints',
    'work_roadmap_phases',
    'work_delivery_plan_runs',
    'work_plan_previews',
    'bundle_assignments',
    'architecture_diagrams',
    'wiki_pages',
    'reviews',
    'comment_threads',
    'comment_messages'
  ];

  for (const collection of collections) {
    try {
      await db.collection(collection).deleteMany(filter as any);
    } catch {
      // ignore missing/non-existing collections
    }
  }

  await invalidateAllWorkItemCaches('sample.reset');

  return { success: true, demoTag: demoTag || null };
};

export { DemoScenarioValidationError };
