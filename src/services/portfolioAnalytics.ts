import { deriveWorkItemLinkSummary, listWorkItemsByIds } from '../server/db/repositories/workItemsRepo';
import { computeMilestoneRollups } from './rollupAnalytics';
import { evaluateMilestoneReadiness } from './milestoneGovernance';
import { getEffectivePolicyForMilestone } from './policy';
import { findApplicationByAnyId } from '../server/db/repositories/applicationsRepo';
import { findBundleByAnyId } from '../server/db/repositories/bundlesRepo';
import { listMilestoneRecordsByIds } from '../server/db/repositories/milestonesRepo';
import {
  getWorkDeliveryPlanRunRecord,
  getWorkPlanPreviewRecord,
  listWorkDeliveryPlanRunRecords,
  listWorkPlanPreviewRecords
} from '../server/db/repositories/workPlansRepo';
import { createVisibilityContext } from './visibility';
import type {
  PortfolioPlanSummary,
  PortfolioPlanDetail,
  PortfolioOverview,
  PortfolioPlanSource,
  PortfolioMilestoneInsight,
  PortfolioDependencyEdge,
  WorkItem,
  DeliveryPlanPreview
} from '../types';

const PLAN_PREFIX = {
  created: 'created',
  preview: 'preview'
} as const;

const buildPlanId = (source: PortfolioPlanSource, id: string) => `${source === 'CREATED_PLAN' ? PLAN_PREFIX.created : PLAN_PREFIX.preview}:${id}`;
const parsePlanId = (id: string) => {
  const [prefix, raw] = id.split(':');
  if (!raw) return null;
  if (prefix === PLAN_PREFIX.created) return { source: 'CREATED_PLAN' as const, id: raw };
  if (prefix === PLAN_PREFIX.preview) return { source: 'PREVIEW' as const, id: raw };
  return null;
};

const computeUtilizationState = (utilizationPercent: number | null) => {
  if (utilizationPercent == null) return 'UNDERFILLED' as const;
  if (utilizationPercent < 0.7) return 'UNDERFILLED' as const;
  if (utilizationPercent <= 1) return 'HEALTHY' as const;
  if (utilizationPercent <= 1.2) return 'AT_RISK' as const;
  return 'OVERLOADED' as const;
};

const computeRiskScore = ({
  utilizationPercent,
  blockedItemCount,
  dependencyInbound,
  readinessBand,
  startDate
}: {
  utilizationPercent: number | null;
  blockedItemCount: number;
  dependencyInbound: number;
  readinessBand: 'high' | 'medium' | 'low';
  startDate?: string;
}) => {
  let score = 0;
  if (utilizationPercent != null && utilizationPercent > 1.1) score += 2;
  if (blockedItemCount > 3) score += 2;
  if (dependencyInbound > 2) score += 1;
  if (startDate) {
    const start = new Date(startDate);
    if (!Number.isNaN(start.getTime())) {
      const daysToStart = (start.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
      if (daysToStart <= 7 && readinessBand !== 'high') score += 2;
    }
  }
  return score;
};

const computeRiskLevel = ({
  utilizationPercent,
  blockedItemCount,
  dependencyInbound,
  readinessBand,
  startDate
}: {
  utilizationPercent: number | null;
  blockedItemCount: number;
  dependencyInbound: number;
  readinessBand: 'high' | 'medium' | 'low';
  startDate?: string;
}) => {
  const score = computeRiskScore({ utilizationPercent, blockedItemCount, dependencyInbound, readinessBand, startDate });
  return score >= 4 ? 'HIGH' : score >= 2 ? 'MEDIUM' : 'LOW';
};

const derivePlanName = async ({
  scopeType,
  scopeId,
  createdAt,
  source
}: {
  scopeType?: string;
  scopeId?: string;
  createdAt?: string;
  source?: PortfolioPlanSource;
}) => {
  const type = String(scopeType || '').toUpperCase();
  const id = String(scopeId || '');
  let base = '';
  if (type === 'PROGRAM') {
    base = 'Program';
  } else if (type === 'BUNDLE') {
    const bundle = await findBundleByAnyId(id);
    base = bundle?.name || bundle?.key || id;
  } else if (type === 'APPLICATION' || type === 'APP') {
    const app = await findApplicationByAnyId(id);
    base = app?.name || app?.key || id;
  } else {
    base = id || 'Plan';
  }
  if (!base) base = 'Plan';
  if (source === 'PREVIEW') base = `${base} Preview`;
  if (createdAt && !base.toLowerCase().includes(createdAt.slice(0, 10))) {
    return base;
  }
  return base;
};

const getItemMilestoneId = (item: any) => {
  const ids = item?.milestoneIds || [];
  const legacy = item?.milestoneId;
  return ids?.length ? String(ids[0]) : (legacy ? String(legacy) : null);
};

const getItemIdCandidates = (item: any) => {
  const candidates = new Set<string>();
  if (item?._id) candidates.add(String(item._id));
  if (item?.id) candidates.add(String(item.id));
  if (item?.key) candidates.add(String(item.key));
  return Array.from(candidates);
};

const buildDependencyEdges = (items: WorkItem[]) => {
  const itemToMilestone = new Map<string, string>();
  items.forEach((item) => {
    const milestoneId = getItemMilestoneId(item);
    if (!milestoneId) return;
    getItemIdCandidates(item).forEach((id) => itemToMilestone.set(id, milestoneId));
  });

  const edgeMap = new Map<string, PortfolioDependencyEdge>();
  items.forEach((item) => {
    const sourceMilestone = getItemMilestoneId(item);
    if (!sourceMilestone) return;
    const links = (item as any).links || [];
    links.filter((link: any) => String(link.type) === 'BLOCKS').forEach((link: any) => {
      const targetMilestone = itemToMilestone.get(String(link.targetId)) || itemToMilestone.get(String(link.targetKey));
      if (!targetMilestone || targetMilestone === sourceMilestone) return;
      const key = `${sourceMilestone}::${targetMilestone}`;
      const existing = edgeMap.get(key) || {
        fromMilestoneId: sourceMilestone,
        toMilestoneId: targetMilestone,
        count: 0,
        blockerCount: 0,
        blockedCount: 0
      };
      existing.count += 1;
      existing.blockerCount += 1;
      existing.blockedCount += 1;
      edgeMap.set(key, existing);
    });
  });

  return Array.from(edgeMap.values());
};

const computeDependencyPressure = (edges: PortfolioDependencyEdge[]) => {
  const map: Record<string, { inbound: number; outbound: number }> = {};
  edges.forEach((edge) => {
    if (!map[edge.fromMilestoneId]) map[edge.fromMilestoneId] = { inbound: 0, outbound: 0 };
    if (!map[edge.toMilestoneId]) map[edge.toMilestoneId] = { inbound: 0, outbound: 0 };
    map[edge.fromMilestoneId].outbound += edge.count;
    map[edge.toMilestoneId].inbound += edge.count;
  });
  return map;
};

const summarizePlanRisk = (milestones: PortfolioMilestoneInsight[]) => {
  let level: PortfolioPlanSummary['riskLevel'] = 'LOW';
  milestones.forEach((m) => {
    if (m.riskLevel === 'HIGH') level = 'HIGH';
    else if (m.riskLevel === 'MEDIUM' && level !== 'HIGH') level = 'MEDIUM';
  });
  return level;
};

const computePlanMilestonesFromPreview = (preview: DeliveryPlanPreview): PortfolioMilestoneInsight[] => {
  const loadByMilestone = new Map<number, number>();
  preview.artifacts.forEach((artifact) => {
    loadByMilestone.set(artifact.milestoneIndex, artifact.storyCount || 0);
  });

  return preview.milestones.map((ms) => {
    const committedLoad = loadByMilestone.get(ms.index) || 0;
    const utilizationPercent = ms.targetCapacity && ms.targetCapacity > 0
      ? committedLoad / ms.targetCapacity
      : null;
    const utilizationState = computeUtilizationState(utilizationPercent);
    const readinessBand: 'high' | 'medium' | 'low' = committedLoad > 0 ? 'high' : 'medium';
    const riskLevel = computeRiskLevel({
      utilizationPercent,
      blockedItemCount: 0,
      dependencyInbound: 0,
      readinessBand,
      startDate: ms.startDate
    });
    return {
      id: String(ms.index),
      name: ms.name,
      startDate: ms.startDate,
      endDate: ms.endDate,
      targetCapacity: ms.targetCapacity ?? null,
      committedLoad,
      remainingLoad: committedLoad,
      utilizationPercent,
      utilizationState,
      readinessBand,
      blockedItemCount: 0,
      dependencyInbound: 0,
      dependencyOutbound: 0,
      riskLevel
    };
  });
};

const computePlanMilestonesFromRun = async (milestones: any[]) => {
  const rollups = await computeMilestoneRollups(milestones.map((m) => String(m._id || m.id || m.name)));
  const rollupMap = new Map<string, any>();
  rollups.forEach((r: any) => rollupMap.set(String(r.milestoneId), r));

  return await Promise.all(milestones.map(async (milestone) => {
    const key = String(milestone._id || milestone.id || milestone.name);
    const rollup = rollupMap.get(key);
    const policyRef = await getEffectivePolicyForMilestone(key);
    const readiness = rollup ? await evaluateMilestoneReadiness(rollup, policyRef.effective) : null;
    const readinessBand: 'high' | 'medium' | 'low' = readiness?.band || 'medium';
    const capacity = rollup?.capacity || {};
    const utilizationPercent = typeof capacity.capacityUtilization === 'number'
      ? capacity.capacityUtilization
      : (capacity.targetCapacity && capacity.targetCapacity > 0 ? (capacity.committedPoints || 0) / capacity.targetCapacity : null);
    const blockedItemCount = rollup?.totals?.blockedDerived || 0;
    const utilizationState = computeUtilizationState(utilizationPercent);
    const riskLevel = computeRiskLevel({
      utilizationPercent,
      blockedItemCount,
      dependencyInbound: 0,
      readinessBand,
      startDate: milestone.startDate
    });
    return {
      id: key,
      name: milestone.name || key,
      startDate: milestone.startDate,
      endDate: milestone.endDate,
      targetCapacity: typeof milestone.targetCapacity === 'number' ? milestone.targetCapacity : (capacity.targetCapacity ?? null),
      committedLoad: capacity.committedPoints || 0,
      remainingLoad: capacity.remainingPoints || 0,
      utilizationPercent,
      utilizationState,
      readinessBand,
      blockedItemCount,
      dependencyInbound: 0,
      dependencyOutbound: 0,
      riskLevel
    } as PortfolioMilestoneInsight;
  }));
};

export const listPortfolioPlans = async (user: { userId?: string; role?: string } | null) => {
  const visibility = createVisibilityContext(user);

  const planRuns = await listWorkDeliveryPlanRunRecords(50);
  const createdScopeKeys = new Set(planRuns.map((r: any) => `${r.scopeType}:${r.scopeId}`));

  const previews = await listWorkPlanPreviewRecords({ limit: 50 });

  const createdSummaries: PortfolioPlanSummary[] = [];
  for (const run of planRuns) {
    const milestones = await listMilestoneRecordsByIds(run.milestoneIds || []);
    const visibleMilestones = [];
    for (const ms of milestones) {
      const canView = await visibility.canViewBundle(String(ms.bundleId || ''));
      if (canView) visibleMilestones.push(ms);
    }
    if (!visibleMilestones.length) continue;
    const milestoneInsights = await computePlanMilestonesFromRun(visibleMilestones);
    const riskLevel = summarizePlanRisk(milestoneInsights);
    const name = await derivePlanName({ scopeType: run.scopeType, scopeId: run.scopeId, createdAt: run.createdAt, source: 'CREATED_PLAN' });
    createdSummaries.push({
      id: buildPlanId('CREATED_PLAN', String(run._id)),
      name,
      createdAt: run.createdAt || new Date().toISOString(),
      milestoneCount: milestoneInsights.length,
      riskLevel,
      source: 'CREATED_PLAN'
    });
  }

  const previewSummaries: PortfolioPlanSummary[] = [];
  for (const preview of previews) {
    const scopeKey = `${preview.scopeType}:${preview.scopeId}`;
    if (createdScopeKeys.has(scopeKey)) continue;
    const milestoneInsights = computePlanMilestonesFromPreview(preview.preview as DeliveryPlanPreview);
    const riskLevel = summarizePlanRisk(milestoneInsights);
    const name = await derivePlanName({ scopeType: preview.scopeType, scopeId: preview.scopeId, createdAt: preview.createdAt, source: 'PREVIEW' });
    previewSummaries.push({
      id: buildPlanId('PREVIEW', String(preview._id)),
      name,
      createdAt: preview.createdAt || new Date().toISOString(),
      milestoneCount: milestoneInsights.length,
      riskLevel,
      source: 'PREVIEW'
    });
  }

  return [...createdSummaries, ...previewSummaries];
};

export const getPortfolioOverview = async (user: { userId?: string; role?: string } | null): Promise<PortfolioOverview> => {
  const plans = await listPortfolioPlans(user);
  const visibility = createVisibilityContext(user);
  let totalMilestones = 0;
  let highRiskMilestones = 0;
  let overloadedMilestones = 0;
  let utilizationSum = 0;
  let utilizationCount = 0;

  for (const plan of plans) {
    const parsed = parsePlanId(plan.id);
    if (!parsed) continue;
    if (parsed.source === 'CREATED_PLAN') {
      const run = await getWorkDeliveryPlanRunRecord(parsed.id);
      if (!run) continue;
      const milestones = await listMilestoneRecordsByIds(run.milestoneIds || []);
      const visibleMilestones = [];
      for (const ms of milestones) {
        const canView = await visibility.canViewBundle(String(ms.bundleId || ''));
        if (canView) visibleMilestones.push(ms);
      }
      const milestoneInsights = await computePlanMilestonesFromRun(visibleMilestones);
      totalMilestones += milestoneInsights.length;
      milestoneInsights.forEach((ms) => {
        if (ms.riskLevel === 'HIGH') highRiskMilestones += 1;
        if (ms.utilizationPercent != null) {
          utilizationSum += ms.utilizationPercent;
          utilizationCount += 1;
        }
        if (ms.utilizationState === 'OVERLOADED') overloadedMilestones += 1;
      });
    } else {
      const preview = await getWorkPlanPreviewRecord(parsed.id);
      if (!preview) continue;
      const milestoneInsights = computePlanMilestonesFromPreview(preview.preview as DeliveryPlanPreview);
      totalMilestones += milestoneInsights.length;
      milestoneInsights.forEach((ms) => {
        if (ms.riskLevel === 'HIGH') highRiskMilestones += 1;
        if (ms.utilizationPercent != null) {
          utilizationSum += ms.utilizationPercent;
          utilizationCount += 1;
        }
        if (ms.utilizationState === 'OVERLOADED') overloadedMilestones += 1;
      });
    }
  }

  return {
    totalPlans: plans.length,
    totalMilestones,
    highRiskMilestones,
    overloadedMilestones,
    avgUtilization: utilizationCount ? utilizationSum / utilizationCount : null,
    plansWithSimulations: 0
  };
};

export const comparePortfolioPlans = async (
  planIds: string[],
  user: { userId?: string; role?: string } | null
): Promise<{ plans: PortfolioPlanDetail[]; dependencies: PortfolioDependencyEdge[] }> => {
  const visibility = createVisibilityContext(user);
  const planDetails: PortfolioPlanDetail[] = [];
  const allItems: WorkItem[] = [];

  for (const planId of planIds) {
    const parsed = parsePlanId(planId);
    if (!parsed) continue;
    if (parsed.source === 'CREATED_PLAN') {
      const run = await getWorkDeliveryPlanRunRecord(parsed.id);
      if (!run) continue;
      const milestones = await listMilestoneRecordsByIds(run.milestoneIds || []);
      const visibleMilestones = [];
      for (const ms of milestones) {
        const canView = await visibility.canViewBundle(String(ms.bundleId || ''));
        if (canView) visibleMilestones.push(ms);
      }
      if (!visibleMilestones.length) continue;
      const items = await listWorkItemsByIds(run.workItemIds || []);
      const visibleItems = await visibility.filterVisibleWorkItems(items as unknown as WorkItem[]);
      const enriched = await deriveWorkItemLinkSummary(visibleItems as WorkItem[]);
      allItems.push(...(enriched as WorkItem[]));

      const milestoneInsights = await computePlanMilestonesFromRun(visibleMilestones);
      const name = await derivePlanName({ scopeType: run.scopeType, scopeId: run.scopeId, createdAt: run.createdAt, source: 'CREATED_PLAN' });
      planDetails.push({
        id: buildPlanId('CREATED_PLAN', String(run._id)),
        name,
        createdAt: run.createdAt || new Date().toISOString(),
        source: 'CREATED_PLAN',
        scopeType: run.scopeType,
        scopeId: run.scopeId,
        milestoneCount: milestoneInsights.length,
        milestones: milestoneInsights
      });
    } else {
      const preview = await getWorkPlanPreviewRecord(parsed.id);
      if (!preview) continue;
      const milestoneInsights = computePlanMilestonesFromPreview(preview.preview as DeliveryPlanPreview);
      const name = await derivePlanName({ scopeType: preview.scopeType, scopeId: preview.scopeId, createdAt: preview.createdAt, source: 'PREVIEW' });
      planDetails.push({
        id: buildPlanId('PREVIEW', String(preview._id)),
        name,
        createdAt: preview.createdAt || new Date().toISOString(),
        source: 'PREVIEW',
        scopeType: preview.scopeType,
        scopeId: preview.scopeId,
        milestoneCount: milestoneInsights.length,
        milestones: milestoneInsights
      });
    }
  }

  const dependencies = buildDependencyEdges(allItems);
  const dependencyPressure = computeDependencyPressure(dependencies);

  planDetails.forEach((plan) => {
    plan.milestones = plan.milestones.map((ms) => {
      const deps = dependencyPressure[ms.id] || { inbound: 0, outbound: 0 };
      const readinessBand = ms.readinessBand || 'medium';
      const blockedItemCount = ms.blockedItemCount || 0;
      const utilizationPercent = typeof ms.utilizationPercent === 'number' ? ms.utilizationPercent : null;
      const riskLevel = computeRiskLevel({
        utilizationPercent,
        blockedItemCount,
        dependencyInbound: deps.inbound,
        readinessBand,
        startDate: ms.startDate
      });
      return {
        ...ms,
        dependencyInbound: deps.inbound,
        dependencyOutbound: deps.outbound,
        riskLevel
      };
    });
  });

  return { plans: planDetails, dependencies };
};
