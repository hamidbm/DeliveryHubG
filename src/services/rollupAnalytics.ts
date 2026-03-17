import { ObjectId } from 'mongodb';
import { evaluateWorkItemStaleness } from '../lib/staleness';
import { WorkItemStatus, WorkItemType } from '../types';
import { getServerDb } from '../server/db/client';
import { deriveWorkItemLinkSummary, ensureWorkItemsIndexes } from '../server/db/repositories/workItemsRepo';
import { computeMilestoneCriticalPath } from './criticalPath';
import { computeBundleVelocity, forecastMilestoneCompletion } from './forecasting';
import { runMonteCarloForecast } from './monteCarlo';
import { getDeliveryPolicy, getEffectivePolicyForBundle, getStrictestPolicyForBundles } from './policy';

const safeIdMatch = (id: string) => (ObjectId.isValid(id) ? new ObjectId(id) : id);

let warnedLegacySprints = false;
const warnLegacySprints = async (db: any) => {
  if (warnedLegacySprints) return;
  warnedLegacySprints = true;
  try {
    const legacyCount = await db.collection('sprints').countDocuments({}, { limit: 1 });
    if (legacyCount > 0) {
      console.warn('Legacy collection sprints contains data. Work Items now use workitems_sprints; consider migrating.');
    }
  } catch {
    // Best-effort warning only.
  }
};

const ensureSprintsIndexes = async (db: any) => {
  await db.collection('workitems_sprints').createIndex({ startDate: 1, endDate: 1, status: 1 });
  await db.collection('workitems_sprints').createIndex({ bundleId: 1, status: 1 });
};

const computeRiskSeverity = (risk?: any) => {
  if (!risk?.probability || !risk?.impact) return undefined;
  const score = Number(risk.probability) * Number(risk.impact);
  if (score <= 4) return 'low';
  if (score <= 9) return 'medium';
  if (score <= 16) return 'high';
  return 'critical';
};

const isWorkItemOpen = (item: any) => item.status !== WorkItemStatus.DONE;

const getMilestoneIdCandidates = (milestone: any) => {
  const candidates = new Set<string>();
  if (milestone?._id) candidates.add(String(milestone._id));
  if (milestone?.id) candidates.add(String(milestone.id));
  if (milestone?.name) candidates.add(String(milestone.name));
  return Array.from(candidates);
};

const normalizeWorkItemId = (item: any) => {
  const id = item?._id || item?.id || '';
  return id ? String(id) : '';
};

export const computeMilestoneRollup = async (milestoneId: string) => {
  const [rollup] = await computeMilestoneRollups([milestoneId]);
  return rollup || null;
};

export const computeMilestoneRollups = async (milestoneIds: string[]) => {
  try {
    const db = await getServerDb();
    const idList = milestoneIds.map((id) => String(id)).filter(Boolean);
    if (!idList.length) return [];

    const objectIds = idList.filter((id) => ObjectId.isValid(id)).map((id) => new ObjectId(id));
    const milestones = await db.collection('milestones').find({
      $or: [
        { _id: { $in: objectIds } },
        { id: { $in: idList } },
        { name: { $in: idList } }
      ]
    }).toArray();

    if (!milestones.length) return [];

    const globalPolicy = await getDeliveryPolicy();

    const milestoneCandidates = new Map<string, string[]>();
    milestones.forEach((m) => {
      milestoneCandidates.set(String(m._id || m.id || m.name), getMilestoneIdCandidates(m));
    });

    const allCandidateIds = Array.from(new Set(Array.from(milestoneCandidates.values()).flat()));
    const query = {
      $and: [
        { $or: [{ isArchived: { $exists: false } }, { isArchived: false }] },
        {
          $or: [
            { milestoneIds: { $in: allCandidateIds } },
            { milestoneId: { $in: allCandidateIds } }
          ]
        }
      ]
    };

    await ensureWorkItemsIndexes();
    let items = await db.collection('workitems').find(query).toArray();
    try {
      items = await deriveWorkItemLinkSummary(items);
    } catch (err) {
      if (process.env.DEBUG_ROADMAP) {
        console.error('[roadmap] deriveWorkItemLinkSummary failed', err);
      }
    }

    const allowedTypes = new Set([
      WorkItemType.EPIC,
      WorkItemType.FEATURE,
      WorkItemType.STORY,
      WorkItemType.TASK,
      WorkItemType.BUG,
      WorkItemType.SUBTASK,
      WorkItemType.DEPENDENCY,
      WorkItemType.RISK
    ]);

    const now = new Date();
    const nowTime = now.getTime();

    const bundleIds = Array.from(new Set(milestones.map((m) => String(m.bundleId || '')).filter(Boolean)));
    const velocityMap = new Map<string, any>();
    for (const bundleId of bundleIds) {
      try {
        const velocity = await computeBundleVelocity(bundleId, 5);
        velocityMap.set(bundleId, velocity);
      } catch {
        velocityMap.set(bundleId, { avgVelocityPoints: 0, avgVelocityHours: 0, sampleSize: 0 });
      }
    }

    return await Promise.all(milestones.map(async (milestone) => {
      const milestoneKey = String(milestone._id || milestone.id || milestone.name);
      const candidates = milestoneCandidates.get(milestoneKey) || [];

      const scopedItems = items.filter((item) => {
        if (!allowedTypes.has(item.type)) return false;
        const ids = (item.milestoneIds || []).map(String);
        const legacy = item.milestoneId ? String(item.milestoneId) : '';
        return candidates.some((c) => ids.includes(c) || legacy === c);
      });

      let committedPoints = 0;
      let completedPoints = 0;
      let committedHours = 0;
      let completedHours = 0;
      let blockedDerived = 0;
      let blockedStatus = 0;
      let overdueOpen = 0;
      let openBlockingDependencies = 0;
      let missingStoryPoints = 0;
      let missingAssignee = 0;
      let missingDueAt = 0;
      let missingRiskSeverity = 0;
      let missingSprintId = 0;
      let staleCount = 0;
      let criticalStaleCount = 0;
      let blockedStaleCount = 0;
      let unassignedStaleCount = 0;
      let githubStaleCount = 0;
      const riskCounts = { low: 0, medium: 0, high: 0, critical: 0 };

      const criticalIdSet = new Set<string>();
      let criticalRemainingPoints: number | null = null;
      try {
        const critical = await computeMilestoneCriticalPath(milestoneKey);
        (critical?.criticalPath?.nodes || []).forEach((node: any) => {
          if (node?.id) criticalIdSet.add(String(node.id));
          if (node?.key) criticalIdSet.add(String(node.key));
        });
        if (typeof critical?.criticalPath?.remainingPoints === 'number') {
          criticalRemainingPoints = critical.criticalPath.remainingPoints;
        }
      } catch {}

      const bundleId = milestone.bundleId ? String(milestone.bundleId) : '';
      const velocity = bundleId ? velocityMap.get(bundleId) : null;
      const scopedBundleIds = Array.from(new Set([
        bundleId,
        ...scopedItems.map((item) => String(item.bundleId || '')).filter(Boolean)
      ].filter(Boolean)));
      let policyRef: any = { effective: globalPolicy, refs: { strategy: 'global', globalVersion: globalPolicy.version }, hasOverrides: false };
      let policyStrategy: 'global' | 'bundle' | 'strictest' = 'global';
      let bundleVersionRefs: Array<{ bundleId: string; version: number }> | undefined = undefined;
      if (scopedBundleIds.length === 1) {
        const scopedBundleId = scopedBundleIds[0];
        const bundleRef = await getEffectivePolicyForBundle(scopedBundleId);
        policyRef = bundleRef;
        policyStrategy = 'bundle';
        if (bundleRef.refs.bundleVersion) {
          bundleVersionRefs = [{ bundleId: scopedBundleId, version: bundleRef.refs.bundleVersion }];
        }
      } else if (scopedBundleIds.length > 1) {
        const strictRef = await getStrictestPolicyForBundles(scopedBundleIds);
        policyRef = strictRef;
        policyStrategy = 'strictest';
        bundleVersionRefs = strictRef.refs.bundleVersions;
      }
      const policy = policyRef.effective;

      scopedItems.forEach((item) => {
        const isOpen = isWorkItemOpen(item);
        const points = typeof item.storyPoints === 'number' ? item.storyPoints : 0;
        if (isOpen && (item.storyPoints === undefined || item.storyPoints === null)) {
          missingStoryPoints += 1;
        }
        if (isOpen && !item.assignedTo && (!Array.isArray(item.assigneeUserIds) || item.assigneeUserIds.length === 0)) {
          missingAssignee += 1;
        }
        const hours = typeof item.timeEstimate === 'number' ? item.timeEstimate : 0;
        committedPoints += points;
        committedHours += hours;
        if (!isOpen) {
          completedPoints += points;
          completedHours += hours;
        }

        if (item.isBlocked) blockedDerived += 1;
        if (item.status === WorkItemStatus.BLOCKED) blockedStatus += 1;

        if (isOpen && item.dueAt) {
          const due = new Date(item.dueAt).getTime();
          if (!Number.isNaN(due) && due < nowTime) overdueOpen += 1;
        } else if (isOpen && !item.dueAt) {
          missingDueAt += 1;
        }

        if (isOpen && item.status === WorkItemStatus.IN_PROGRESS && !item.sprintId) {
          missingSprintId += 1;
        }

        if (item.type === WorkItemType.DEPENDENCY && isOpen && item.dependency?.blocking !== false) {
          openBlockingDependencies += 1;
        }

        if (item.type === WorkItemType.RISK && isOpen) {
          const derivedSeverity = item.risk?.severity || computeRiskSeverity(item.risk);
          if (!derivedSeverity) missingRiskSeverity += 1;
          const severity = derivedSeverity || 'low';
          if (severity === 'low') riskCounts.low += 1;
          if (severity === 'medium') riskCounts.medium += 1;
          if (severity === 'high') riskCounts.high += 1;
          if (severity === 'critical') riskCounts.critical += 1;
        }

        const itemId = normalizeWorkItemId(item);
        const isCritical = (itemId && criticalIdSet.has(itemId)) || (item?.key && criticalIdSet.has(String(item.key)));
        const staleness = evaluateWorkItemStaleness(item, { isCritical, policy });
        if (staleness.stale) staleCount += 1;
        if (staleness.criticalStale) criticalStaleCount += 1;
        if (staleness.blockedStale) blockedStaleCount += 1;
        if (staleness.unassignedStale) unassignedStaleCount += 1;
        if (staleness.githubStale) githubStaleCount += 1;
      });

      const openItems = scopedItems.filter(isWorkItemOpen).length;
      const doneItems = scopedItems.length - openItems;

      const remainingPoints = Math.max(committedPoints - completedPoints, 0);
      const remainingHours = Math.max(committedHours - completedHours, 0);
      const targetCapacity = milestone.targetCapacity;
      const isOverCapacity = typeof targetCapacity === 'number' && committedPoints > targetCapacity;
      const capacityUtilization = typeof targetCapacity === 'number' && targetCapacity > 0
        ? Number((committedPoints / targetCapacity).toFixed(2))
        : null;

      const endDate = milestone.endDate ? new Date(milestone.endDate) : null;
      const isLate = !!endDate && nowTime > endDate.getTime() && (remainingPoints > 0 || remainingHours > 0);
      const slipDays = isLate && endDate
        ? Math.max(0, Math.ceil((nowTime - endDate.getTime()) / (24 * 60 * 60 * 1000)))
        : 0;

      let score = 100;
      const drivers: Array<{ key: string; detail: string }> = [];

      if (blockedDerived > 0) {
        const delta = Math.min(30, blockedDerived * 5);
        score -= delta;
        drivers.push({ key: 'blocked', detail: `${blockedDerived} blocked by dependencies` });
      }
      if (overdueOpen > 0) {
        const delta = Math.min(20, overdueOpen * 2);
        score -= delta;
        drivers.push({ key: 'overdue', detail: `${overdueOpen} overdue items` });
      }
      const riskPenalty = (riskCounts.low * 1) + (riskCounts.medium * 3) + (riskCounts.high * 6) + (riskCounts.critical * 10);
      if (riskPenalty > 0) {
        score -= Math.min(25, riskPenalty);
        drivers.push({ key: 'risk', detail: `${riskCounts.high + riskCounts.critical} high/critical risks` });
      }
      if (openBlockingDependencies > 0) {
        const delta = Math.min(20, openBlockingDependencies * 4);
        score -= delta;
        drivers.push({ key: 'dependencies', detail: `${openBlockingDependencies} open blocking dependencies` });
      }
      if (isOverCapacity) {
        score -= 15;
        drivers.push({ key: 'capacity', detail: 'Committed scope exceeds target capacity' });
      }
      if (isLate) {
        const delta = Math.min(20, slipDays);
        score -= delta;
        drivers.push({ key: 'schedule', detail: `Late by ${slipDays} days` });
      }

      score = Math.max(0, Math.min(100, Math.round(score)));
      const band = score >= 80 ? 'high' : score >= 50 ? 'medium' : 'low';

      const dqWeights = policy.dataQuality.weights;
      const dqCaps = policy.dataQuality.caps;
      const forecast = await forecastMilestoneCompletion({
        capacity: { remainingPoints },
        schedule: { endDate: milestone.endDate }
      }, velocity || { avgVelocityPoints: 0, sampleSize: 0 }, policy);
      const highCriticalRisks = riskCounts.high + riskCounts.critical;
      const monteCarloConfig = policy.forecasting?.monteCarlo;
      const weeklySamples = (velocity as any)?.weeklySamples || [];
      const remainingForMonteCarlo = monteCarloConfig?.useCriticalPath && typeof criticalRemainingPoints === 'number'
        ? criticalRemainingPoints
        : remainingPoints;
      const riskMultiplier = 1
        + (blockedDerived > 0 ? 0.1 : 0)
        + (highCriticalRisks > 0 ? 0.1 : 0)
        + (criticalStaleCount > 0 ? 0.05 : 0);
      const monteCarlo = monteCarloConfig?.enabled && weeklySamples.length >= (monteCarloConfig.minSampleSize || 0) && remainingForMonteCarlo > 0
        ? runMonteCarloForecast({
          remainingPoints: remainingForMonteCarlo,
          weeklySamples,
          iterations: monteCarloConfig.iterations,
          pLevels: monteCarloConfig.pLevels,
          endDate: milestone.endDate,
          riskMultiplier
        })
        : null;
      const forecastWithMonteCarlo = forecast || monteCarlo
        ? {
          ...(forecast || {
            estimatedCompletionDate: monteCarlo?.p50 || new Date().toISOString(),
            sprintsRemaining: 0,
            varianceDays: 0,
            band: 'on-track' as const
          }),
          monteCarlo
        }
        : null;

      let qualityScore = 100;
      qualityScore -= Math.min(dqCaps.missingStoryPoints, missingStoryPoints * dqWeights.missingStoryPoints);
      qualityScore -= Math.min(dqCaps.missingAssignee, missingAssignee * dqWeights.missingAssignee);
      qualityScore -= Math.min(dqCaps.missingDueAt, missingDueAt * dqWeights.missingDueAt);
      qualityScore -= Math.min(dqCaps.missingRiskSeverity, missingRiskSeverity * dqWeights.missingRiskSeverity);
      qualityScore = Math.max(0, Math.min(100, Math.round(qualityScore)));
      const qualityIssues = [
        missingStoryPoints ? { key: 'missingStoryPoints', count: missingStoryPoints, detail: 'Missing story points', impact: Math.min(dqCaps.missingStoryPoints, missingStoryPoints * dqWeights.missingStoryPoints) } : null,
        missingAssignee ? { key: 'missingAssignee', count: missingAssignee, detail: 'Missing assignee', impact: Math.min(dqCaps.missingAssignee, missingAssignee * dqWeights.missingAssignee) } : null,
        missingDueAt ? { key: 'missingDueAt', count: missingDueAt, detail: 'Missing due dates', impact: Math.min(dqCaps.missingDueAt, missingDueAt * dqWeights.missingDueAt) } : null,
        missingRiskSeverity ? { key: 'missingRiskSeverity', count: missingRiskSeverity, detail: 'Risks missing severity', impact: Math.min(dqCaps.missingRiskSeverity, missingRiskSeverity * dqWeights.missingRiskSeverity) } : null,
        missingSprintId ? { key: 'missingSprintId', count: missingSprintId, detail: 'In-progress items without sprint', impact: 5 } : null
      ].filter(Boolean) as Array<{ key: string; count: number; detail: string; impact: number }>;
      qualityIssues.sort((a, b) => b.impact - a.impact);

      return {
        milestoneId: milestoneKey,
        policy: {
          strategy: policyStrategy,
          globalVersion: policyRef.refs.globalVersion || policy.version,
          bundleVersions: bundleVersionRefs
        },
        warnings: [
          missingStoryPoints ? `${missingStoryPoints} items missing storyPoints in this milestone` : null,
          missingDueAt ? `${missingDueAt} items missing due dates` : null,
          missingRiskSeverity ? `${missingRiskSeverity} risks missing severity` : null
        ].filter(Boolean) as string[],
        totals: {
          items: scopedItems.length,
          openItems,
          doneItems,
          blockedDerived,
          blockedStatus,
          overdueOpen
        },
        capacity: {
          targetCapacity,
          committedPoints,
          completedPoints,
          remainingPoints,
          committedHours,
          completedHours,
          remainingHours,
          isOverCapacity,
          capacityUtilization
        },
        risks: {
          openBySeverity: riskCounts,
          openTotal: riskCounts.low + riskCounts.medium + riskCounts.high + riskCounts.critical
        },
        dependencies: {
          openBlockingDependencies
        },
        schedule: {
          startDate: milestone.startDate,
          endDate: milestone.endDate,
          isLate,
          slipDays
        },
        confidence: {
          score,
          band,
          drivers
        },
        dataQuality: {
          score: qualityScore,
          issues: qualityIssues.map(({ impact, ...rest }) => rest)
        },
        staleness: {
          staleCount,
          criticalStaleCount,
          blockedStaleCount,
          unassignedStaleCount,
          githubStaleCount
        },
        forecast: forecastWithMonteCarlo
      };
    }));
  } catch (err) {
    if (process.env.DEBUG_ROADMAP) {
      console.error('[roadmap] computeMilestoneRollups failed', err);
    }
    return [];
  }
};

export const computeSprintRollups = async (filters: {
  bundleId?: string;
  milestoneId?: string;
  sprintIds?: string[];
  status?: string;
  limit?: number;
}) => {
  const db = await getServerDb();
  await warnLegacySprints(db);
  await ensureSprintsIndexes(db);
  await ensureWorkItemsIndexes();

  const sprintQuery: any = {};
  const limit = Math.min(Math.max(filters.limit || 8, 1), 50);

  if (filters.bundleId && filters.bundleId !== 'all') {
    sprintQuery.bundleId = safeIdMatch(filters.bundleId);
  }

  if (filters.status) {
    sprintQuery.status = filters.status;
  }

  if (filters.sprintIds && filters.sprintIds.length) {
    const ids = filters.sprintIds.map(String).filter(Boolean);
    const objectIds = ids.filter(ObjectId.isValid).map((id) => new ObjectId(id));
    sprintQuery.$or = [
      { _id: { $in: objectIds } },
      { id: { $in: ids } },
      { name: { $in: ids } }
    ];
  }

  let sprints = await db.collection('workitems_sprints').find(sprintQuery).sort({ startDate: -1 }).limit(limit).toArray();

  if (!filters.sprintIds && !filters.bundleId && !filters.status) {
    sprints = await db.collection('workitems_sprints')
      .find({ status: { $in: ['ACTIVE', 'PLANNED', 'CLOSED'] } })
      .sort({ startDate: -1 })
      .limit(limit)
      .toArray();
  }

  const globalPolicy = await getDeliveryPolicy();

  if (!sprints.length) return [];

  const sprintIdCandidates = new Map<string, string[]>();
  sprints.forEach((s) => {
    const ids = new Set<string>();
    if (s._id) ids.add(String(s._id));
    if (s.id) ids.add(String(s.id));
    if (s.name) ids.add(String(s.name));
    sprintIdCandidates.set(String(s._id || s.id || s.name), Array.from(ids));
  });

  const allSprintIds = Array.from(new Set(Array.from(sprintIdCandidates.values()).flat()));
  const sprintObjectIds = allSprintIds.filter(ObjectId.isValid).map((id) => new ObjectId(id));

  const itemQuery: any = {
    $and: [
      { $or: [{ isArchived: { $exists: false } }, { isArchived: false }] },
      { sprintId: { $in: [...allSprintIds, ...sprintObjectIds] } }
    ]
  };

  if (filters.bundleId && filters.bundleId !== 'all') {
    itemQuery.$and.push({ bundleId: safeIdMatch(filters.bundleId) });
  }

  if (filters.milestoneId && filters.milestoneId !== 'all') {
    const msId = String(filters.milestoneId);
    const msObjectIds = ObjectId.isValid(msId) ? [new ObjectId(msId)] : [];
    itemQuery.$and.push({
      $or: [
        { milestoneIds: { $in: [msId, ...msObjectIds] } },
        { milestoneId: { $in: [msId, ...msObjectIds] } }
      ]
    });
  }

  let items = await db.collection('workitems').find(itemQuery).toArray();
  try {
    items = await deriveWorkItemLinkSummary(items);
  } catch {}

  return Promise.all(sprints.map(async (sprint) => {
    const sprintKey = String(sprint._id || sprint.id || sprint.name);
    const candidates = sprintIdCandidates.get(sprintKey) || [];
    const sprintItems = items.filter((item: any) => candidates.includes(String(item.sprintId)));

    const bundleId = sprint.bundleId ? String(sprint.bundleId) : '';
    const policyRef = bundleId
      ? await getEffectivePolicyForBundle(bundleId)
      : { effective: globalPolicy, refs: { globalVersion: globalPolicy.version }, hasOverrides: false };
    const policy = policyRef.effective;
    const dqWeights = policy.dataQuality.weights;
    const dqCaps = policy.dataQuality.caps;

    const criticalIdSet = new Set<string>();
    try {
      const milestoneIds = new Set<string>();
      sprintItems.forEach((item: any) => {
        (item.milestoneIds || []).forEach((id: any) => { if (id) milestoneIds.add(String(id)); });
        if (item.milestoneId) milestoneIds.add(String(item.milestoneId));
      });
      for (const msId of Array.from(milestoneIds)) {
        const critical = await computeMilestoneCriticalPath(msId);
        (critical?.criticalPath?.nodes || []).forEach((node: any) => {
          if (node?.id) criticalIdSet.add(String(node.id));
          if (node?.key) criticalIdSet.add(String(node.key));
        });
      }
    } catch {}

    const totalItems = sprintItems.length;
    const doneItems = sprintItems.filter((item: any) => !isWorkItemOpen(item)).length;
    const openItems = totalItems - doneItems;
    const blockedDerived = sprintItems.filter((item: any) => item.isBlocked).length;
    let staleCount = 0;
    let criticalStaleCount = 0;
    let blockedStaleCount = 0;
    let unassignedStaleCount = 0;
    let githubStaleCount = 0;

    const committedPoints = sprintItems.reduce((sum: number, item: any) => sum + (item.storyPoints || 0), 0);
    const completedPoints = sprintItems.filter((item: any) => !isWorkItemOpen(item)).reduce((sum: number, item: any) => sum + (item.storyPoints || 0), 0);
    const remainingPoints = Math.max(committedPoints - completedPoints, 0);
    const targetPoints = typeof sprint.capacityPoints === 'number' ? sprint.capacityPoints : undefined;
    const utilization = targetPoints ? Number((committedPoints / targetPoints).toFixed(2)) : null;
    const isOverCapacity = Boolean(targetPoints && committedPoints > targetPoints);

    const highCritical = sprintItems.filter((item: any) => item.type === WorkItemType.RISK && item.status !== WorkItemStatus.DONE)
      .filter((item: any) => {
        const severity = item.risk?.severity || computeRiskSeverity(item.risk) || 'low';
        return severity === 'high' || severity === 'critical';
      }).length;

    const openSprintItems = sprintItems.filter(isWorkItemOpen);
    const missingStoryPoints = openSprintItems.filter((item: any) => item.storyPoints === undefined || item.storyPoints === null).length;
    const missingAssignee = openSprintItems.filter((item: any) => !item.assignedTo && (!Array.isArray(item.assigneeUserIds) || item.assigneeUserIds.length === 0)).length;
    const missingDueAt = openSprintItems.filter((item: any) => !item.dueAt).length;

    sprintItems.forEach((item: any) => {
      const id = normalizeWorkItemId(item);
      const isCritical = (id && criticalIdSet.has(id)) || (item?.key && criticalIdSet.has(String(item.key)));
      const staleness = evaluateWorkItemStaleness(item, { isCritical, policy });
      if (staleness.stale) staleCount += 1;
      if (staleness.criticalStale) criticalStaleCount += 1;
      if (staleness.blockedStale) blockedStaleCount += 1;
      if (staleness.unassignedStale) unassignedStaleCount += 1;
      if (staleness.githubStale) githubStaleCount += 1;
    });

    let qualityScore = 100;
    qualityScore -= Math.min(dqCaps.missingStoryPoints, missingStoryPoints * dqWeights.missingStoryPoints);
    qualityScore -= Math.min(dqCaps.missingAssignee, missingAssignee * dqWeights.missingAssignee);
    qualityScore -= Math.min(dqCaps.missingDueAt, missingDueAt * dqWeights.missingDueAt);
    qualityScore = Math.max(0, Math.min(100, Math.round(qualityScore)));
    const qualityIssues = [
      missingStoryPoints ? { key: 'missingStoryPoints', count: missingStoryPoints, detail: 'Missing story points', impact: Math.min(dqCaps.missingStoryPoints, missingStoryPoints * dqWeights.missingStoryPoints) } : null,
      missingAssignee ? { key: 'missingAssignee', count: missingAssignee, detail: 'Missing assignee', impact: Math.min(dqCaps.missingAssignee, missingAssignee * dqWeights.missingAssignee) } : null,
      missingDueAt ? { key: 'missingDueAt', count: missingDueAt, detail: 'Missing due dates', impact: Math.min(dqCaps.missingDueAt, missingDueAt * dqWeights.missingDueAt) } : null,
      openItems ? { key: 'openItems', count: openItems, detail: 'Open items remaining', impact: Math.min(30, openItems * 2) } : null
    ].filter(Boolean) as Array<{ key: string; count: number; detail: string; impact: number }>;
    qualityIssues.sort((a, b) => b.impact - a.impact);

    return {
      sprintId: sprintKey,
      name: sprint.name || sprint.id || sprintKey,
      startDate: sprint.startDate,
      endDate: sprint.endDate,
      status: sprint.status,
      policy: {
        strategy: 'bundle',
        globalVersion: policyRef.refs.globalVersion,
        bundleVersions: policyRef.refs.bundleVersion ? [{ bundleId, version: policyRef.refs.bundleVersion }] : undefined
      },
      scope: {
        items: totalItems,
        open: openItems,
        done: doneItems,
        blockedDerived
      },
      capacity: {
        targetPoints,
        committedPoints,
        completedPoints,
        remainingPoints,
        utilization,
        isOverCapacity
      },
      risks: {
        highCritical
      },
      warnings: {
        missingStoryPoints
      },
      dataQuality: {
        score: qualityScore,
        issues: qualityIssues.map(({ impact, ...rest }) => rest)
      },
      staleness: {
        staleCount,
        criticalStaleCount,
        blockedStaleCount,
        unassignedStaleCount,
        githubStaleCount
      }
    };
  }));
};
