import { ObjectId } from 'mongodb';
import { getMongoClientPromise } from '../lib/mongodb';
import { recordCacheHit, recordCacheMiss } from './perfStats';

export type DeliveryPolicy = {
  _id: 'global';
  version: number;
  updatedAt: string;
  updatedBy: string;
  readiness: {
    milestone: {
      warnScoreBelow: number;
      blockScoreBelow: number;
      blockOnBlockedItems: boolean;
      blockOnHighCriticalRisks: boolean;
    };
    sprint: {
      warnScoreBelow: number;
      blockScoreBelow: number;
      blockOnBlockedItems: boolean;
      blockOnHighCriticalRisks: boolean;
    };
  };
  dataQuality: {
    weights: {
      missingStoryPoints: number;
      missingAssignee: number;
      missingDueAt: number;
      missingRiskSeverity: number;
    };
    caps: {
      missingStoryPoints: number;
      missingAssignee: number;
      missingDueAt: number;
      missingRiskSeverity: number;
    };
  };
  forecasting: {
    atRiskPct: number;
    offTrackPct: number;
    minSampleSize: number;
    monteCarlo: {
      enabled: boolean;
      iterations: number;
      useCriticalPath: boolean;
      minSampleSize: number;
      pLevels: number[];
    };
  };
  criticalPath: {
    nearCriticalSlackPct: number;
    defaultIncludeExternal: boolean;
    defaultExternalDepth: number;
  };
  commitReview: {
    enabled: boolean;
    minHitProbability: number;
    blockIfP80AfterEndDate: boolean;
    blockOnExternalBlockers: boolean;
    maxCriticalStale: number;
    maxHighRisks: number;
    capacityOvercommitThreshold: number;
    drift: {
      enabled: boolean;
      majorSlipDays: number;
      majorHitProbDrop: number;
      majorDataQualityDrop: number;
      majorExternalBlockersIncrease: number;
      requireReReviewOnMajor: boolean;
    };
  };
  staleness: {
    thresholdsDays: {
      workItemStale: number;
      criticalStale: number;
      blockedStale: number;
      unassignedStale: number;
      githubStale: number;
      inProgressNoPrStale: number;
    };
    nudges: {
      enabled: boolean;
      allowedRoles: Array<'ADMIN' | 'CMO' | 'BUNDLE_OWNER' | 'WATCHER'>;
      cooldownHoursPerItem: number;
      maxNudgesPerUserPerDay: number;
    };
    digest: {
      includeStaleSummary: boolean;
      minCriticalStaleToInclude: number;
    };
  };
};

export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K];
};

export type BundlePolicyVersionRef = {
  bundleId: string;
  version: number;
};

export type DeliveryPolicyOverride = {
  _id?: string;
  bundleId: string;
  version: number;
  updatedAt: string;
  updatedBy: string;
  overrides: DeepPartial<DeliveryPolicy>;
};

export type EffectivePolicyRef = {
  effective: DeliveryPolicy;
  refs: {
    globalVersion: number;
    bundleVersion?: number;
    strategy?: 'global' | 'bundle' | 'strictest';
    bundleVersions?: BundlePolicyVersionRef[];
  };
  hasOverrides: boolean;
};

const DEFAULT_POLICY: DeliveryPolicy = {
  _id: 'global',
  version: 1,
  updatedAt: new Date().toISOString(),
  updatedBy: 'system',
  readiness: {
    milestone: {
      warnScoreBelow: 70,
      blockScoreBelow: 50,
      blockOnBlockedItems: true,
      blockOnHighCriticalRisks: true
    },
    sprint: {
      warnScoreBelow: 70,
      blockScoreBelow: 50,
      blockOnBlockedItems: true,
      blockOnHighCriticalRisks: true
    }
  },
  dataQuality: {
    weights: {
      missingStoryPoints: 5,
      missingAssignee: 2,
      missingDueAt: 2,
      missingRiskSeverity: 10
    },
    caps: {
      missingStoryPoints: 30,
      missingAssignee: 20,
      missingDueAt: 20,
      missingRiskSeverity: 30
    }
  },
  forecasting: {
    atRiskPct: 0.15,
    offTrackPct: 0.3,
    minSampleSize: 3,
    monteCarlo: {
      enabled: false,
      iterations: 2000,
      useCriticalPath: true,
      minSampleSize: 3,
      pLevels: [0.5, 0.8, 0.9]
    }
  },
  criticalPath: {
    nearCriticalSlackPct: 0.1,
    defaultIncludeExternal: false,
    defaultExternalDepth: 3
  },
  commitReview: {
    enabled: false,
    minHitProbability: 0.5,
    blockIfP80AfterEndDate: true,
    blockOnExternalBlockers: false,
    maxCriticalStale: 2,
    maxHighRisks: 3,
    capacityOvercommitThreshold: 20,
    drift: {
      enabled: true,
      majorSlipDays: 7,
      majorHitProbDrop: 0.2,
      majorDataQualityDrop: 15,
      majorExternalBlockersIncrease: 1,
      requireReReviewOnMajor: false
    }
  },
  staleness: {
    thresholdsDays: {
      workItemStale: 7,
      criticalStale: 3,
      blockedStale: 5,
      unassignedStale: 2,
      githubStale: 5,
      inProgressNoPrStale: 5
    },
    nudges: {
      enabled: true,
      allowedRoles: ['ADMIN', 'CMO', 'BUNDLE_OWNER', 'WATCHER'],
      cooldownHoursPerItem: 24,
      maxNudgesPerUserPerDay: 20
    },
    digest: {
      includeStaleSummary: true,
      minCriticalStaleToInclude: 1
    }
  }
};

let cachedPolicy: { value: DeliveryPolicy; ts: number } | null = null;
let cachedOverrides: Map<string, { value: DeliveryPolicyOverride | null; ts: number }> = new Map();
let cachedEffective: Map<string, { value: EffectivePolicyRef; ts: number }> = new Map();
let cachedMilestoneEffective: Map<string, { value: EffectivePolicyRef; ts: number }> = new Map();
const CACHE_TTL_MS = 30_000;

const getDb = async () => {
  const client = await getMongoClientPromise();
  return client.db();
};

const ensureOverrideIndexes = async (db: any) => {
  await db.collection('delivery_policy_overrides').createIndex({ bundleId: 1 }, { unique: true });
};

const coerceNumber = (value: any, fallback: number) => {
  const num = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(num) ? num : fallback;
};

export const validateDeliveryPolicy = (policy: any) => {
  if (!policy) return { ok: false, error: 'Missing policy' };
  const inRange = (v: number, min: number, max: number) => Number.isFinite(v) && v >= min && v <= max;

  const warnMilestone = coerceNumber(policy.readiness?.milestone?.warnScoreBelow, DEFAULT_POLICY.readiness.milestone.warnScoreBelow);
  const blockMilestone = coerceNumber(policy.readiness?.milestone?.blockScoreBelow, DEFAULT_POLICY.readiness.milestone.blockScoreBelow);
  const warnSprint = coerceNumber(policy.readiness?.sprint?.warnScoreBelow, DEFAULT_POLICY.readiness.sprint.warnScoreBelow);
  const blockSprint = coerceNumber(policy.readiness?.sprint?.blockScoreBelow, DEFAULT_POLICY.readiness.sprint.blockScoreBelow);

  if (!inRange(warnMilestone, 0, 100) || !inRange(blockMilestone, 0, 100) || !inRange(warnSprint, 0, 100) || !inRange(blockSprint, 0, 100)) {
    return { ok: false, error: 'Readiness thresholds must be between 0 and 100.' };
  }

  const atRiskPct = coerceNumber(policy.forecasting?.atRiskPct, DEFAULT_POLICY.forecasting.atRiskPct);
  const offTrackPct = coerceNumber(policy.forecasting?.offTrackPct, DEFAULT_POLICY.forecasting.offTrackPct);
  const minSampleSize = coerceNumber(policy.forecasting?.minSampleSize, DEFAULT_POLICY.forecasting.minSampleSize);
  const mcIterations = coerceNumber(policy.forecasting?.monteCarlo?.iterations, DEFAULT_POLICY.forecasting.monteCarlo.iterations);
  const mcMinSampleSize = coerceNumber(policy.forecasting?.monteCarlo?.minSampleSize, DEFAULT_POLICY.forecasting.monteCarlo.minSampleSize);
  const mcPLevels = Array.isArray(policy.forecasting?.monteCarlo?.pLevels)
    ? policy.forecasting.monteCarlo.pLevels.map((v: any) => Number(v)).filter((v: number) => Number.isFinite(v))
    : DEFAULT_POLICY.forecasting.monteCarlo.pLevels;

  if (!inRange(atRiskPct, 0, 1) || !inRange(offTrackPct, 0, 1) || atRiskPct > offTrackPct) {
    return { ok: false, error: 'Forecast thresholds must be between 0 and 1 (atRisk <= offTrack).' };
  }
  if (!inRange(minSampleSize, 0, 100)) {
    return { ok: false, error: 'Forecast min sample size must be between 0 and 100.' };
  }
  if (!inRange(mcIterations, 100, 10000)) {
    return { ok: false, error: 'Monte Carlo iterations must be between 100 and 10000.' };
  }
  if (!inRange(mcMinSampleSize, 0, 100)) {
    return { ok: false, error: 'Monte Carlo min sample size must be between 0 and 100.' };
  }
  if (!mcPLevels.length || mcPLevels.some((v: number) => !inRange(v, 0.1, 0.99))) {
    return { ok: false, error: 'Monte Carlo p-levels must be between 0.1 and 0.99.' };
  }

  const minHitProbability = coerceNumber(policy.commitReview?.minHitProbability, DEFAULT_POLICY.commitReview.minHitProbability);
  const maxCriticalStale = coerceNumber(policy.commitReview?.maxCriticalStale, DEFAULT_POLICY.commitReview.maxCriticalStale);
  const maxHighRisks = coerceNumber(policy.commitReview?.maxHighRisks, DEFAULT_POLICY.commitReview.maxHighRisks);
  const capacityOvercommitThreshold = coerceNumber(policy.commitReview?.capacityOvercommitThreshold, DEFAULT_POLICY.commitReview.capacityOvercommitThreshold);
  const majorSlipDays = coerceNumber(policy.commitReview?.drift?.majorSlipDays, DEFAULT_POLICY.commitReview.drift.majorSlipDays);
  const majorHitProbDrop = coerceNumber(policy.commitReview?.drift?.majorHitProbDrop, DEFAULT_POLICY.commitReview.drift.majorHitProbDrop);
  const majorDataQualityDrop = coerceNumber(policy.commitReview?.drift?.majorDataQualityDrop, DEFAULT_POLICY.commitReview.drift.majorDataQualityDrop);
  const majorExternalBlockersIncrease = coerceNumber(policy.commitReview?.drift?.majorExternalBlockersIncrease, DEFAULT_POLICY.commitReview.drift.majorExternalBlockersIncrease);
  if (!inRange(minHitProbability, 0, 1)) {
    return { ok: false, error: 'Commit review min hit probability must be between 0 and 1.' };
  }
  if (!inRange(maxCriticalStale, 0, 1000) || !inRange(maxHighRisks, 0, 1000)) {
    return { ok: false, error: 'Commit review thresholds must be between 0 and 1000.' };
  }
  if (!inRange(capacityOvercommitThreshold, 0, 100000)) {
    return { ok: false, error: 'Commit review capacity threshold must be between 0 and 100000.' };
  }
  if (!inRange(majorSlipDays, 0, 365)) {
    return { ok: false, error: 'Commit review drift slip days must be between 0 and 365.' };
  }
  if (!inRange(majorHitProbDrop, 0, 1)) {
    return { ok: false, error: 'Commit review drift hit probability drop must be between 0 and 1.' };
  }
  if (!inRange(majorDataQualityDrop, 0, 100)) {
    return { ok: false, error: 'Commit review drift data quality drop must be between 0 and 100.' };
  }
  if (!inRange(majorExternalBlockersIncrease, 0, 100)) {
    return { ok: false, error: 'Commit review drift external blockers increase must be between 0 and 100.' };
  }

  const slack = coerceNumber(policy.criticalPath?.nearCriticalSlackPct, DEFAULT_POLICY.criticalPath.nearCriticalSlackPct);
  if (!inRange(slack, 0, 1)) {
    return { ok: false, error: 'Critical path slack must be between 0 and 1.' };
  }

  const thresholds = policy.staleness?.thresholdsDays || {};
  const workItemStale = coerceNumber(thresholds.workItemStale, DEFAULT_POLICY.staleness.thresholdsDays.workItemStale);
  const criticalStale = coerceNumber(thresholds.criticalStale, DEFAULT_POLICY.staleness.thresholdsDays.criticalStale);
  const blockedStale = coerceNumber(thresholds.blockedStale, DEFAULT_POLICY.staleness.thresholdsDays.blockedStale);
  const unassignedStale = coerceNumber(thresholds.unassignedStale, DEFAULT_POLICY.staleness.thresholdsDays.unassignedStale);
  const githubStale = coerceNumber(thresholds.githubStale, DEFAULT_POLICY.staleness.thresholdsDays.githubStale);
  const inProgressNoPrStale = coerceNumber(thresholds.inProgressNoPrStale, DEFAULT_POLICY.staleness.thresholdsDays.inProgressNoPrStale);
  if (![workItemStale, criticalStale, blockedStale, unassignedStale, githubStale, inProgressNoPrStale].every((v) => inRange(v, 0, 365))) {
    return { ok: false, error: 'Staleness thresholds must be between 0 and 365 days.' };
  }

  const cooldown = coerceNumber(policy.staleness?.nudges?.cooldownHoursPerItem, DEFAULT_POLICY.staleness.nudges.cooldownHoursPerItem);
  const maxPerDay = coerceNumber(policy.staleness?.nudges?.maxNudgesPerUserPerDay, DEFAULT_POLICY.staleness.nudges.maxNudgesPerUserPerDay);
  if (!inRange(cooldown, 0, 168)) {
    return { ok: false, error: 'Nudge cooldown must be between 0 and 168 hours.' };
  }
  if (!inRange(maxPerDay, 0, 1000)) {
    return { ok: false, error: 'Max nudges per day must be between 0 and 1000.' };
  }

  return { ok: true };
};

export const normalizeDeliveryPolicy = (policy: any): DeliveryPolicy => {
  return {
    _id: 'global',
    version: typeof policy?.version === 'number' ? policy.version : DEFAULT_POLICY.version,
    updatedAt: policy?.updatedAt || DEFAULT_POLICY.updatedAt,
    updatedBy: policy?.updatedBy || DEFAULT_POLICY.updatedBy,
    readiness: {
      milestone: {
        warnScoreBelow: coerceNumber(policy?.readiness?.milestone?.warnScoreBelow, DEFAULT_POLICY.readiness.milestone.warnScoreBelow),
        blockScoreBelow: coerceNumber(policy?.readiness?.milestone?.blockScoreBelow, DEFAULT_POLICY.readiness.milestone.blockScoreBelow),
        blockOnBlockedItems: policy?.readiness?.milestone?.blockOnBlockedItems ?? DEFAULT_POLICY.readiness.milestone.blockOnBlockedItems,
        blockOnHighCriticalRisks: policy?.readiness?.milestone?.blockOnHighCriticalRisks ?? DEFAULT_POLICY.readiness.milestone.blockOnHighCriticalRisks
      },
      sprint: {
        warnScoreBelow: coerceNumber(policy?.readiness?.sprint?.warnScoreBelow, DEFAULT_POLICY.readiness.sprint.warnScoreBelow),
        blockScoreBelow: coerceNumber(policy?.readiness?.sprint?.blockScoreBelow, DEFAULT_POLICY.readiness.sprint.blockScoreBelow),
        blockOnBlockedItems: policy?.readiness?.sprint?.blockOnBlockedItems ?? DEFAULT_POLICY.readiness.sprint.blockOnBlockedItems,
        blockOnHighCriticalRisks: policy?.readiness?.sprint?.blockOnHighCriticalRisks ?? DEFAULT_POLICY.readiness.sprint.blockOnHighCriticalRisks
      }
    },
    dataQuality: {
      weights: {
        missingStoryPoints: coerceNumber(policy?.dataQuality?.weights?.missingStoryPoints, DEFAULT_POLICY.dataQuality.weights.missingStoryPoints),
        missingAssignee: coerceNumber(policy?.dataQuality?.weights?.missingAssignee, DEFAULT_POLICY.dataQuality.weights.missingAssignee),
        missingDueAt: coerceNumber(policy?.dataQuality?.weights?.missingDueAt, DEFAULT_POLICY.dataQuality.weights.missingDueAt),
        missingRiskSeverity: coerceNumber(policy?.dataQuality?.weights?.missingRiskSeverity, DEFAULT_POLICY.dataQuality.weights.missingRiskSeverity)
      },
      caps: {
        missingStoryPoints: coerceNumber(policy?.dataQuality?.caps?.missingStoryPoints, DEFAULT_POLICY.dataQuality.caps.missingStoryPoints),
        missingAssignee: coerceNumber(policy?.dataQuality?.caps?.missingAssignee, DEFAULT_POLICY.dataQuality.caps.missingAssignee),
        missingDueAt: coerceNumber(policy?.dataQuality?.caps?.missingDueAt, DEFAULT_POLICY.dataQuality.caps.missingDueAt),
        missingRiskSeverity: coerceNumber(policy?.dataQuality?.caps?.missingRiskSeverity, DEFAULT_POLICY.dataQuality.caps.missingRiskSeverity)
      }
    },
    forecasting: {
      atRiskPct: coerceNumber(policy?.forecasting?.atRiskPct, DEFAULT_POLICY.forecasting.atRiskPct),
      offTrackPct: coerceNumber(policy?.forecasting?.offTrackPct, DEFAULT_POLICY.forecasting.offTrackPct),
      minSampleSize: coerceNumber(policy?.forecasting?.minSampleSize, DEFAULT_POLICY.forecasting.minSampleSize),
      monteCarlo: {
        enabled: policy?.forecasting?.monteCarlo?.enabled ?? DEFAULT_POLICY.forecasting.monteCarlo.enabled,
        iterations: coerceNumber(policy?.forecasting?.monteCarlo?.iterations, DEFAULT_POLICY.forecasting.monteCarlo.iterations),
        useCriticalPath: policy?.forecasting?.monteCarlo?.useCriticalPath ?? DEFAULT_POLICY.forecasting.monteCarlo.useCriticalPath,
        minSampleSize: coerceNumber(policy?.forecasting?.monteCarlo?.minSampleSize, DEFAULT_POLICY.forecasting.monteCarlo.minSampleSize),
        pLevels: (() => {
          if (!Array.isArray(policy?.forecasting?.monteCarlo?.pLevels)) return DEFAULT_POLICY.forecasting.monteCarlo.pLevels;
          const next = policy.forecasting.monteCarlo.pLevels.map((v: any) => Number(v)).filter((v: number) => Number.isFinite(v));
          return next.length ? next : DEFAULT_POLICY.forecasting.monteCarlo.pLevels;
        })()
      }
    },
    criticalPath: {
      nearCriticalSlackPct: coerceNumber(policy?.criticalPath?.nearCriticalSlackPct, DEFAULT_POLICY.criticalPath.nearCriticalSlackPct),
      defaultIncludeExternal: policy?.criticalPath?.defaultIncludeExternal ?? DEFAULT_POLICY.criticalPath.defaultIncludeExternal,
      defaultExternalDepth: coerceNumber(policy?.criticalPath?.defaultExternalDepth, DEFAULT_POLICY.criticalPath.defaultExternalDepth)
    },
    commitReview: {
      enabled: policy?.commitReview?.enabled ?? DEFAULT_POLICY.commitReview.enabled,
      minHitProbability: coerceNumber(policy?.commitReview?.minHitProbability, DEFAULT_POLICY.commitReview.minHitProbability),
      blockIfP80AfterEndDate: policy?.commitReview?.blockIfP80AfterEndDate ?? DEFAULT_POLICY.commitReview.blockIfP80AfterEndDate,
      blockOnExternalBlockers: policy?.commitReview?.blockOnExternalBlockers ?? DEFAULT_POLICY.commitReview.blockOnExternalBlockers,
      maxCriticalStale: coerceNumber(policy?.commitReview?.maxCriticalStale, DEFAULT_POLICY.commitReview.maxCriticalStale),
      maxHighRisks: coerceNumber(policy?.commitReview?.maxHighRisks, DEFAULT_POLICY.commitReview.maxHighRisks),
      capacityOvercommitThreshold: coerceNumber(policy?.commitReview?.capacityOvercommitThreshold, DEFAULT_POLICY.commitReview.capacityOvercommitThreshold),
      drift: {
        enabled: policy?.commitReview?.drift?.enabled ?? DEFAULT_POLICY.commitReview.drift.enabled,
        majorSlipDays: coerceNumber(policy?.commitReview?.drift?.majorSlipDays, DEFAULT_POLICY.commitReview.drift.majorSlipDays),
        majorHitProbDrop: coerceNumber(policy?.commitReview?.drift?.majorHitProbDrop, DEFAULT_POLICY.commitReview.drift.majorHitProbDrop),
        majorDataQualityDrop: coerceNumber(policy?.commitReview?.drift?.majorDataQualityDrop, DEFAULT_POLICY.commitReview.drift.majorDataQualityDrop),
        majorExternalBlockersIncrease: coerceNumber(policy?.commitReview?.drift?.majorExternalBlockersIncrease, DEFAULT_POLICY.commitReview.drift.majorExternalBlockersIncrease),
        requireReReviewOnMajor: policy?.commitReview?.drift?.requireReReviewOnMajor ?? DEFAULT_POLICY.commitReview.drift.requireReReviewOnMajor
      }
    },
    staleness: {
      thresholdsDays: {
        workItemStale: coerceNumber(policy?.staleness?.thresholdsDays?.workItemStale, DEFAULT_POLICY.staleness.thresholdsDays.workItemStale),
        criticalStale: coerceNumber(policy?.staleness?.thresholdsDays?.criticalStale, DEFAULT_POLICY.staleness.thresholdsDays.criticalStale),
        blockedStale: coerceNumber(policy?.staleness?.thresholdsDays?.blockedStale, DEFAULT_POLICY.staleness.thresholdsDays.blockedStale),
        unassignedStale: coerceNumber(policy?.staleness?.thresholdsDays?.unassignedStale, DEFAULT_POLICY.staleness.thresholdsDays.unassignedStale),
        githubStale: coerceNumber(policy?.staleness?.thresholdsDays?.githubStale, DEFAULT_POLICY.staleness.thresholdsDays.githubStale),
        inProgressNoPrStale: coerceNumber(policy?.staleness?.thresholdsDays?.inProgressNoPrStale, DEFAULT_POLICY.staleness.thresholdsDays.inProgressNoPrStale)
      },
      nudges: {
        enabled: policy?.staleness?.nudges?.enabled ?? DEFAULT_POLICY.staleness.nudges.enabled,
        allowedRoles: Array.isArray(policy?.staleness?.nudges?.allowedRoles)
          ? policy.staleness.nudges.allowedRoles.filter((role: any) => ['ADMIN', 'CMO', 'BUNDLE_OWNER', 'WATCHER'].includes(String(role)))
          : DEFAULT_POLICY.staleness.nudges.allowedRoles,
        cooldownHoursPerItem: coerceNumber(policy?.staleness?.nudges?.cooldownHoursPerItem, DEFAULT_POLICY.staleness.nudges.cooldownHoursPerItem),
        maxNudgesPerUserPerDay: coerceNumber(policy?.staleness?.nudges?.maxNudgesPerUserPerDay, DEFAULT_POLICY.staleness.nudges.maxNudgesPerUserPerDay)
      },
      digest: {
        includeStaleSummary: policy?.staleness?.digest?.includeStaleSummary ?? DEFAULT_POLICY.staleness.digest.includeStaleSummary,
        minCriticalStaleToInclude: coerceNumber(policy?.staleness?.digest?.minCriticalStaleToInclude, DEFAULT_POLICY.staleness.digest.minCriticalStaleToInclude)
      }
    }
  };
};

const deepMerge = (base: any, patch: any): any => {
  if (!patch || typeof patch !== 'object') return base;
  const output = Array.isArray(base) ? [...base] : { ...base };
  Object.keys(patch).forEach((key) => {
    const value = patch[key];
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      output[key] = deepMerge(base?.[key] || {}, value);
    } else if (value !== undefined) {
      output[key] = value;
    }
  });
  return output;
};

export const mergeDeliveryPolicy = (base: DeliveryPolicy, overrides: DeepPartial<DeliveryPolicy>) => {
  return deepMerge(base, overrides) as DeliveryPolicy;
};

export const getDeliveryPolicy = async (): Promise<DeliveryPolicy> => {
  if (cachedPolicy && Date.now() - cachedPolicy.ts < CACHE_TTL_MS) {
    recordCacheHit('policy');
    return cachedPolicy.value;
  }
  recordCacheMiss('policy');
  const db = await getDb();
  const existing = await db.collection('delivery_policies').findOne({ _id: 'global' as any });
  if (!existing) {
    await db.collection('delivery_policies').insertOne(DEFAULT_POLICY as any);
    cachedPolicy = { value: DEFAULT_POLICY, ts: Date.now() };
    return DEFAULT_POLICY;
  }
  const normalized = normalizeDeliveryPolicy(existing);
  cachedPolicy = { value: normalized, ts: Date.now() };
  return normalized;
};

export const getDeliveryPolicyOverride = async (bundleId: string): Promise<DeliveryPolicyOverride | null> => {
  const id = String(bundleId || '');
  if (!id) return null;
  const cached = cachedOverrides.get(id);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    recordCacheHit('policy');
    return cached.value;
  }
  recordCacheMiss('policy');
  const db = await getDb();
  await ensureOverrideIndexes(db);
  const doc = await db.collection<DeliveryPolicyOverride>('delivery_policy_overrides').findOne({ bundleId: id });
  cachedOverrides.set(id, { value: doc || null, ts: Date.now() });
  return doc || null;
};

export const saveDeliveryPolicyOverride = async (bundleId: string, overrides: DeepPartial<DeliveryPolicy>, updatedBy: string) => {
  const db = await getDb();
  await ensureOverrideIndexes(db);
  const existing = await db.collection('delivery_policy_overrides').findOne({ bundleId: String(bundleId) });
  const nextVersion = existing?.version ? Number(existing.version) + 1 : 1;
  const payload: DeliveryPolicyOverride = {
    bundleId: String(bundleId),
    version: nextVersion,
    updatedAt: new Date().toISOString(),
    updatedBy,
    overrides
  };
  await db.collection('delivery_policy_overrides').updateOne(
    { bundleId: String(bundleId) },
    { $set: payload },
    { upsert: true }
  );
  cachedOverrides.delete(String(bundleId));
  cachedEffective.delete(String(bundleId));
  cachedMilestoneEffective.clear();
  return payload;
};

export const deleteDeliveryPolicyOverride = async (bundleId: string) => {
  const db = await getDb();
  await ensureOverrideIndexes(db);
  await db.collection('delivery_policy_overrides').deleteOne({ bundleId: String(bundleId) });
  cachedOverrides.delete(String(bundleId));
  cachedEffective.delete(String(bundleId));
  cachedMilestoneEffective.clear();
};

export const getEffectivePolicyForBundle = async (bundleId: string): Promise<EffectivePolicyRef> => {
  const id = String(bundleId || '');
  if (!id) {
    const global = await getDeliveryPolicy();
    return { effective: global, refs: { globalVersion: global.version }, hasOverrides: false };
  }
  const cached = cachedEffective.get(id);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    recordCacheHit('policy');
    return cached.value;
  }
  recordCacheMiss('policy');
  const global = await getDeliveryPolicy();
  const override = await getDeliveryPolicyOverride(id);
  const merged = override?.overrides ? deepMerge(global, override.overrides) : global;
  const normalized = normalizeDeliveryPolicy(merged);
  const validation = validateDeliveryPolicy(normalized);
  if (!validation.ok) {
    const fallback = { effective: global, refs: { globalVersion: global.version }, hasOverrides: false };
    cachedEffective.set(id, { value: fallback, ts: Date.now() });
    return fallback;
  }
  const result: EffectivePolicyRef = {
    effective: normalized,
    refs: { globalVersion: global.version, bundleVersion: override?.version },
    hasOverrides: Boolean(override)
  };
  cachedEffective.set(id, { value: result, ts: Date.now() });
  return result;
};

const pickMax = (values: number[]) => (values.length ? Math.max(...values) : undefined);
const pickMin = (values: number[]) => (values.length ? Math.min(...values) : undefined);

export const getStrictestPolicyForBundles = async (bundleIds: string[]) => {
  const unique = Array.from(new Set(bundleIds.filter(Boolean)));
  const refs = await Promise.all(unique.map(async (id) => ({ id, ref: await getEffectivePolicyForBundle(id) })));
  if (!refs.length) {
    const global = await getDeliveryPolicy();
    return {
      effective: global,
      refs: { strategy: 'strictest', globalVersion: global.version, bundleVersions: [] },
      hasOverrides: false
    };
  }
  const policies = refs.map((r) => r.ref.effective);
  const strict: DeliveryPolicy = {
    _id: 'global',
    version: pickMax(policies.map((p) => p.version)) || 1,
    updatedAt: new Date().toISOString(),
    updatedBy: 'policy-resolver',
    readiness: {
      milestone: {
        warnScoreBelow: pickMax(policies.map((p) => p.readiness.milestone.warnScoreBelow)) || DEFAULT_POLICY.readiness.milestone.warnScoreBelow,
        blockScoreBelow: pickMax(policies.map((p) => p.readiness.milestone.blockScoreBelow)) || DEFAULT_POLICY.readiness.milestone.blockScoreBelow,
        blockOnBlockedItems: policies.some((p) => p.readiness.milestone.blockOnBlockedItems),
        blockOnHighCriticalRisks: policies.some((p) => p.readiness.milestone.blockOnHighCriticalRisks)
      },
      sprint: {
        warnScoreBelow: pickMax(policies.map((p) => p.readiness.sprint.warnScoreBelow)) || DEFAULT_POLICY.readiness.sprint.warnScoreBelow,
        blockScoreBelow: pickMax(policies.map((p) => p.readiness.sprint.blockScoreBelow)) || DEFAULT_POLICY.readiness.sprint.blockScoreBelow,
        blockOnBlockedItems: policies.some((p) => p.readiness.sprint.blockOnBlockedItems),
        blockOnHighCriticalRisks: policies.some((p) => p.readiness.sprint.blockOnHighCriticalRisks)
      }
    },
    dataQuality: {
      weights: {
        missingStoryPoints: pickMax(policies.map((p) => p.dataQuality.weights.missingStoryPoints)) || DEFAULT_POLICY.dataQuality.weights.missingStoryPoints,
        missingAssignee: pickMax(policies.map((p) => p.dataQuality.weights.missingAssignee)) || DEFAULT_POLICY.dataQuality.weights.missingAssignee,
        missingDueAt: pickMax(policies.map((p) => p.dataQuality.weights.missingDueAt)) || DEFAULT_POLICY.dataQuality.weights.missingDueAt,
        missingRiskSeverity: pickMax(policies.map((p) => p.dataQuality.weights.missingRiskSeverity)) || DEFAULT_POLICY.dataQuality.weights.missingRiskSeverity
      },
      caps: {
        missingStoryPoints: pickMax(policies.map((p) => p.dataQuality.caps.missingStoryPoints)) || DEFAULT_POLICY.dataQuality.caps.missingStoryPoints,
        missingAssignee: pickMax(policies.map((p) => p.dataQuality.caps.missingAssignee)) || DEFAULT_POLICY.dataQuality.caps.missingAssignee,
        missingDueAt: pickMax(policies.map((p) => p.dataQuality.caps.missingDueAt)) || DEFAULT_POLICY.dataQuality.caps.missingDueAt,
        missingRiskSeverity: pickMax(policies.map((p) => p.dataQuality.caps.missingRiskSeverity)) || DEFAULT_POLICY.dataQuality.caps.missingRiskSeverity
      }
    },
    forecasting: {
      atRiskPct: pickMin(policies.map((p) => p.forecasting.atRiskPct)) || DEFAULT_POLICY.forecasting.atRiskPct,
      offTrackPct: pickMin(policies.map((p) => p.forecasting.offTrackPct)) || DEFAULT_POLICY.forecasting.offTrackPct,
      minSampleSize: pickMax(policies.map((p) => p.forecasting.minSampleSize)) || DEFAULT_POLICY.forecasting.minSampleSize,
      monteCarlo: {
        enabled: policies.some((p) => p.forecasting?.monteCarlo?.enabled),
        iterations: pickMax(policies.map((p) => p.forecasting?.monteCarlo?.iterations || 0)) || DEFAULT_POLICY.forecasting.monteCarlo.iterations,
        useCriticalPath: policies.some((p) => p.forecasting?.monteCarlo?.useCriticalPath),
        minSampleSize: pickMax(policies.map((p) => p.forecasting?.monteCarlo?.minSampleSize || 0)) || DEFAULT_POLICY.forecasting.monteCarlo.minSampleSize,
        pLevels: (() => {
          const lists = policies.map((p) => p.forecasting?.monteCarlo?.pLevels || []).filter((p) => p.length);
          if (!lists.length) return DEFAULT_POLICY.forecasting.monteCarlo.pLevels;
          const longest = lists.sort((a, b) => b.length - a.length)[0];
          return longest.length ? longest : DEFAULT_POLICY.forecasting.monteCarlo.pLevels;
        })()
      }
    },
    criticalPath: {
      nearCriticalSlackPct: pickMin(policies.map((p) => p.criticalPath.nearCriticalSlackPct)) || DEFAULT_POLICY.criticalPath.nearCriticalSlackPct,
      defaultIncludeExternal: policies.every((p) => p.criticalPath.defaultIncludeExternal),
      defaultExternalDepth: pickMin(policies.map((p) => p.criticalPath.defaultExternalDepth)) || DEFAULT_POLICY.criticalPath.defaultExternalDepth
    },
    commitReview: {
      enabled: policies.some((p) => p.commitReview?.enabled),
      minHitProbability: pickMax(policies.map((p) => p.commitReview?.minHitProbability || 0)) || DEFAULT_POLICY.commitReview.minHitProbability,
      blockIfP80AfterEndDate: policies.some((p) => p.commitReview?.blockIfP80AfterEndDate),
      blockOnExternalBlockers: policies.some((p) => p.commitReview?.blockOnExternalBlockers),
      maxCriticalStale: pickMin(policies.map((p) => p.commitReview?.maxCriticalStale || DEFAULT_POLICY.commitReview.maxCriticalStale)) || DEFAULT_POLICY.commitReview.maxCriticalStale,
      maxHighRisks: pickMin(policies.map((p) => p.commitReview?.maxHighRisks || DEFAULT_POLICY.commitReview.maxHighRisks)) || DEFAULT_POLICY.commitReview.maxHighRisks,
      capacityOvercommitThreshold: pickMin(policies.map((p) => p.commitReview?.capacityOvercommitThreshold || DEFAULT_POLICY.commitReview.capacityOvercommitThreshold)) || DEFAULT_POLICY.commitReview.capacityOvercommitThreshold,
      drift: {
        enabled: policies.some((p) => p.commitReview?.drift?.enabled),
        majorSlipDays: pickMin(policies.map((p) => p.commitReview?.drift?.majorSlipDays || DEFAULT_POLICY.commitReview.drift.majorSlipDays)) || DEFAULT_POLICY.commitReview.drift.majorSlipDays,
        majorHitProbDrop: pickMax(policies.map((p) => p.commitReview?.drift?.majorHitProbDrop || 0)) || DEFAULT_POLICY.commitReview.drift.majorHitProbDrop,
        majorDataQualityDrop: pickMax(policies.map((p) => p.commitReview?.drift?.majorDataQualityDrop || 0)) || DEFAULT_POLICY.commitReview.drift.majorDataQualityDrop,
        majorExternalBlockersIncrease: pickMax(policies.map((p) => p.commitReview?.drift?.majorExternalBlockersIncrease || 0)) || DEFAULT_POLICY.commitReview.drift.majorExternalBlockersIncrease,
        requireReReviewOnMajor: policies.some((p) => p.commitReview?.drift?.requireReReviewOnMajor)
      }
    },
    staleness: {
      thresholdsDays: {
        workItemStale: pickMin(policies.map((p) => p.staleness.thresholdsDays.workItemStale)) || DEFAULT_POLICY.staleness.thresholdsDays.workItemStale,
        criticalStale: pickMin(policies.map((p) => p.staleness.thresholdsDays.criticalStale)) || DEFAULT_POLICY.staleness.thresholdsDays.criticalStale,
        blockedStale: pickMin(policies.map((p) => p.staleness.thresholdsDays.blockedStale)) || DEFAULT_POLICY.staleness.thresholdsDays.blockedStale,
        unassignedStale: pickMin(policies.map((p) => p.staleness.thresholdsDays.unassignedStale)) || DEFAULT_POLICY.staleness.thresholdsDays.unassignedStale,
        githubStale: pickMin(policies.map((p) => p.staleness.thresholdsDays.githubStale)) || DEFAULT_POLICY.staleness.thresholdsDays.githubStale,
        inProgressNoPrStale: pickMin(policies.map((p) => p.staleness.thresholdsDays.inProgressNoPrStale)) || DEFAULT_POLICY.staleness.thresholdsDays.inProgressNoPrStale
      },
      nudges: {
        enabled: policies.every((p) => p.staleness.nudges.enabled),
        allowedRoles: (() => {
          const sets = policies.map((p) => new Set(p.staleness.nudges.allowedRoles || []));
          if (!sets.length) return DEFAULT_POLICY.staleness.nudges.allowedRoles;
          const intersection = Array.from(sets[0]).filter((role) => sets.every((s) => s.has(role)));
          return intersection.length ? intersection as Array<'ADMIN' | 'CMO' | 'BUNDLE_OWNER' | 'WATCHER'> : DEFAULT_POLICY.staleness.nudges.allowedRoles;
        })(),
        cooldownHoursPerItem: pickMax(policies.map((p) => p.staleness.nudges.cooldownHoursPerItem)) || DEFAULT_POLICY.staleness.nudges.cooldownHoursPerItem,
        maxNudgesPerUserPerDay: pickMin(policies.map((p) => p.staleness.nudges.maxNudgesPerUserPerDay)) || DEFAULT_POLICY.staleness.nudges.maxNudgesPerUserPerDay
      },
      digest: {
        includeStaleSummary: policies.every((p) => p.staleness.digest.includeStaleSummary),
        minCriticalStaleToInclude: pickMax(policies.map((p) => p.staleness.digest.minCriticalStaleToInclude)) || DEFAULT_POLICY.staleness.digest.minCriticalStaleToInclude
      }
    }
  };

  const bundleVersions: Record<string, number> = {};
  refs.forEach((entry) => {
    if (entry.ref.refs.bundleVersion) bundleVersions[entry.id] = entry.ref.refs.bundleVersion;
  });
  const bundleVersionList: BundlePolicyVersionRef[] = Object.entries(bundleVersions).map(([bundleId, version]) => ({
    bundleId,
    version
  }));

  return {
    effective: strict,
    refs: { strategy: 'strictest', globalVersion: refs[0].ref.refs.globalVersion, bundleVersions: bundleVersionList },
    hasOverrides: refs.some((r) => r.ref.hasOverrides)
  };
};

const resolveMilestoneCandidates = (milestone: any) => {
  const candidates = new Set<string>();
  if (milestone?._id) candidates.add(String(milestone._id));
  if (milestone?.id) candidates.add(String(milestone.id));
  if (milestone?.name) candidates.add(String(milestone.name));
  return Array.from(candidates);
};

export const getEffectivePolicyForMilestone = async (milestoneId: string): Promise<EffectivePolicyRef> => {
  const id = String(milestoneId || '');
  if (!id) {
    const global = await getDeliveryPolicy();
    return { effective: global, refs: { strategy: 'global', globalVersion: global.version }, hasOverrides: false };
  }

  const cached = cachedMilestoneEffective.get(id);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    recordCacheHit('policy');
    return cached.value;
  }
  recordCacheMiss('policy');

  const db = await getDb();
  const objectIds = ObjectId.isValid(id) ? [new ObjectId(id)] : [];
  const milestone = await db.collection('milestones').findOne({
    $or: [
      { _id: { $in: objectIds } },
      { id },
      { name: id }
    ]
  });

  if (!milestone) {
    const global = await getDeliveryPolicy();
    const fallback: EffectivePolicyRef = {
      effective: global,
      refs: { strategy: 'global', globalVersion: global.version },
      hasOverrides: false
    };
    cachedMilestoneEffective.set(id, { value: fallback, ts: Date.now() });
    return fallback;
  }

  const candidates = resolveMilestoneCandidates(milestone);
  const candidateObjectIds = candidates.filter(ObjectId.isValid).map((c) => new ObjectId(c));
  const items = await db.collection('workitems').find({
    $and: [
      { $or: [{ isArchived: { $exists: false } }, { isArchived: false }] },
      { $or: [
        { milestoneIds: { $in: candidates } },
        { milestoneIds: { $in: candidateObjectIds } },
        { milestoneId: { $in: candidates } },
        { milestoneId: { $in: candidateObjectIds } }
      ] }
    ]
  }, { projection: { bundleId: 1 } }).toArray();

  const bundleIds = new Set<string>();
  if (milestone?.bundleId) bundleIds.add(String(milestone.bundleId));
  items.forEach((item: any) => {
    if (item?.bundleId) bundleIds.add(String(item.bundleId));
  });
  const bundleList = Array.from(bundleIds).filter(Boolean);

  if (!bundleList.length) {
    const global = await getDeliveryPolicy();
    const result: EffectivePolicyRef = {
      effective: global,
      refs: { strategy: 'global', globalVersion: global.version },
      hasOverrides: false
    };
    cachedMilestoneEffective.set(id, { value: result, ts: Date.now() });
    return result;
  }

  if (bundleList.length === 1) {
    const bundleId = bundleList[0];
    const ref = await getEffectivePolicyForBundle(bundleId);
    const bundleVersions = ref.refs.bundleVersion ? [{ bundleId, version: ref.refs.bundleVersion }] : undefined;
    const result: EffectivePolicyRef = {
      effective: ref.effective,
      refs: { strategy: 'bundle', globalVersion: ref.refs.globalVersion, bundleVersions },
      hasOverrides: ref.hasOverrides
    };
    cachedMilestoneEffective.set(id, { value: result, ts: Date.now() });
    return result;
  }

  const strictest = await getStrictestPolicyForBundles(bundleList);
  const result: EffectivePolicyRef = {
    effective: strictest.effective,
    refs: { ...strictest.refs, strategy: 'strictest' },
    hasOverrides: strictest.hasOverrides
  };
  cachedMilestoneEffective.set(id, { value: result, ts: Date.now() });
  return result;
};

export const saveDeliveryPolicy = async (policy: DeliveryPolicy) => {
  const db = await getDb();
  await db.collection('delivery_policies').updateOne({ _id: 'global' as any }, { $set: policy as any }, { upsert: true });
  cachedPolicy = { value: policy, ts: Date.now() };
  cachedEffective.clear();
  cachedMilestoneEffective.clear();
  return policy;
};

export const getDefaultDeliveryPolicy = () => DEFAULT_POLICY;
