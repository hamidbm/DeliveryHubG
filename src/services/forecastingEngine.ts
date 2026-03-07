import { ObjectId } from 'mongodb';
import { getDb, computeMilestoneRollups, deriveWorkItemLinkSummary } from './db';
import { evaluateMilestoneReadiness } from './milestoneGovernance';
import { getEffectivePolicyForMilestone } from './policy';
import { createVisibilityContext } from './visibility';
import type {
  WorkItem,
  DeliveryPlanPreview,
  MilestoneForecast,
  PlanForecastSummary,
  PortfolioForecastSummary
} from '../types';

type PlanIdParsed = { source: 'CREATED_PLAN' | 'PREVIEW'; id: string };

const parsePlanId = (value: string): PlanIdParsed | null => {
  if (!value) return null;
  const [prefix, raw] = value.split(':');
  if (!raw) return null;
  if (prefix === 'created') return { source: 'CREATED_PLAN', id: raw };
  if (prefix === 'preview') return { source: 'PREVIEW', id: raw };
  return null;
};

const toDate = (value?: string) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
};

const addDays = (value: Date, days: number) => {
  const next = new Date(value);
  next.setDate(next.getDate() + days);
  return next;
};

const daysBetween = (start?: string, end?: string) => {
  const s = toDate(start);
  const e = toDate(end);
  if (!s || !e) return 14;
  const delta = Math.max(1, Math.round((e.getTime() - s.getTime()) / (24 * 60 * 60 * 1000)));
  return delta;
};

const computeUtilizationState = (utilizationPercent: number | null) => {
  if (utilizationPercent == null) return 'UNDERFILLED' as const;
  if (utilizationPercent < 0.7) return 'UNDERFILLED' as const;
  if (utilizationPercent <= 1) return 'HEALTHY' as const;
  if (utilizationPercent <= 1.2) return 'AT_RISK' as const;
  return 'OVERLOADED' as const;
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
  let score = 0;
  if (utilizationPercent != null && utilizationPercent > 1.1) score += 2;
  if (blockedItemCount > 3) score += 2;
  if (dependencyInbound > 2) score += 1;
  if (startDate) {
    const start = toDate(startDate);
    if (start) {
      const daysToStart = (start.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
      if (daysToStart <= 7 && readinessBand !== 'high') score += 2;
    }
  }
  return score >= 4 ? 'HIGH' : score >= 2 ? 'MEDIUM' : 'LOW';
};

const computeForecastConfidence = ({
  utilizationPercent,
  dependencyInbound,
  readinessBand,
  riskLevel
}: {
  utilizationPercent: number | null;
  dependencyInbound: number;
  readinessBand: 'high' | 'medium' | 'low';
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
}) => {
  if (riskLevel === 'HIGH' || (utilizationPercent != null && utilizationPercent > 1.1) || dependencyInbound > 3) {
    return 'LOW' as const;
  }
  if ((utilizationPercent == null || utilizationPercent < 0.8) && dependencyInbound <= 1 && readinessBand === 'high') {
    return 'HIGH' as const;
  }
  return 'MEDIUM' as const;
};

const computeSlipRisk = ({
  utilizationPercent,
  dependencyInbound,
  blockedItemCount,
  readinessBand,
  riskLevel
}: {
  utilizationPercent: number | null;
  dependencyInbound: number;
  blockedItemCount: number;
  readinessBand: 'high' | 'medium' | 'low';
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
}) => {
  if (
    riskLevel === 'HIGH' ||
    (utilizationPercent != null && utilizationPercent > 1.2) ||
    dependencyInbound > 6 ||
    blockedItemCount > 5 ||
    readinessBand === 'low'
  ) {
    return 'HIGH' as const;
  }
  if (
    riskLevel === 'MEDIUM' ||
    (utilizationPercent != null && utilizationPercent > 1) ||
    dependencyInbound > 3 ||
    blockedItemCount > 0 ||
    readinessBand === 'medium'
  ) {
    return 'MEDIUM' as const;
  }
  return 'LOW' as const;
};

const computeRiskSpreadDays = ({
  baseSpread,
  utilizationPercent,
  dependencyInbound,
  blockedItemCount,
  readinessBand
}: {
  baseSpread: number;
  utilizationPercent: number | null;
  dependencyInbound: number;
  blockedItemCount: number;
  readinessBand: 'high' | 'medium' | 'low';
}) => {
  let spread = baseSpread;
  if (utilizationPercent != null) {
    if (utilizationPercent > 1.2) spread += 10;
    else if (utilizationPercent > 1) spread += 5;
  }
  if (dependencyInbound > 6) spread += 7;
  else if (dependencyInbound > 3) spread += 3;
  if (blockedItemCount > 5) spread += 4;
  if (readinessBand === 'low') spread += 6;
  else if (readinessBand === 'medium') spread += 3;
  return spread;
};

export const computeMilestoneForecast = ({
  milestoneId,
  plannedEndDate,
  startDate,
  utilizationPercent,
  blockedItemCount,
  dependencyInbound,
  readinessBand,
  riskLevel
}: {
  milestoneId: string;
  plannedEndDate: string;
  startDate?: string;
  utilizationPercent: number | null;
  blockedItemCount: number;
  dependencyInbound: number;
  readinessBand: 'high' | 'medium' | 'low';
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
}): MilestoneForecast => {
  const end = toDate(plannedEndDate) || new Date();
  const duration = daysBetween(startDate, plannedEndDate);
  const baseSpread = Math.max(1, Math.round(duration * 0.1));
  const riskSpread = computeRiskSpreadDays({
    baseSpread,
    utilizationPercent,
    dependencyInbound,
    blockedItemCount,
    readinessBand
  });
  const bestCase = addDays(end, -baseSpread);
  const expected = addDays(end, riskSpread);
  const worst = addDays(end, riskSpread * 2);
  const forecastConfidence = computeForecastConfidence({
    utilizationPercent,
    dependencyInbound,
    readinessBand,
    riskLevel
  });
  const slipRisk = computeSlipRisk({
    utilizationPercent,
    dependencyInbound,
    blockedItemCount,
    readinessBand,
    riskLevel
  });

  return {
    milestoneId,
    plannedEndDate: end.toISOString(),
    bestCaseDate: bestCase.toISOString(),
    expectedDate: expected.toISOString(),
    worstCaseDate: worst.toISOString(),
    forecastConfidence,
    slipRisk
  };
};

const buildDependencyEdges = (items: WorkItem[]) => {
  const itemToMilestone = new Map<string, string>();
  items.forEach((item) => {
    const ids = ((item as any).milestoneIds || []).map(String);
    const legacy = (item as any).milestoneId ? String((item as any).milestoneId) : null;
    const milestoneId = ids.length ? ids[0] : legacy;
    if (!milestoneId) return;
    if (item._id) itemToMilestone.set(String(item._id), milestoneId);
    if (item.id) itemToMilestone.set(String(item.id), milestoneId);
    if ((item as any).key) itemToMilestone.set(String((item as any).key), milestoneId);
  });

  const edgeMap = new Map<string, { from: string; to: string; count: number }>();
  items.forEach((item) => {
    const ids = ((item as any).milestoneIds || []).map(String);
    const legacy = (item as any).milestoneId ? String((item as any).milestoneId) : null;
    const source = ids.length ? ids[0] : legacy;
    if (!source) return;
    const links = (item as any).links || [];
    links.filter((link: any) => String(link.type) === 'BLOCKS').forEach((link: any) => {
      const target = itemToMilestone.get(String(link.targetId)) || itemToMilestone.get(String(link.targetKey));
      if (!target || target === source) return;
      const key = `${source}::${target}`;
      const entry = edgeMap.get(key) || { from: source, to: target, count: 0 };
      entry.count += 1;
      edgeMap.set(key, entry);
    });
  });

  const pressure: Record<string, number> = {};
  edgeMap.forEach((edge) => {
    pressure[edge.to] = (pressure[edge.to] || 0) + edge.count;
  });
  return pressure;
};

export const computePlanForecast = async ({
  planId,
  milestones,
  rollups,
  readinessByMilestone,
  dependencyInbound
}: {
  planId: string;
  milestones: Array<{ id: string; startDate?: string; endDate?: string; targetCapacity?: number | null }>;
  rollups: Record<string, any>;
  readinessByMilestone: Record<string, any>;
  dependencyInbound: Record<string, number>;
}): Promise<{ milestoneForecasts: MilestoneForecast[]; summary: PlanForecastSummary }> => {
  const forecasts: MilestoneForecast[] = [];
  for (const milestone of milestones) {
    const rollup = rollups[milestone.id];
    const readiness = readinessByMilestone[milestone.id];
    const readinessBand: 'high' | 'medium' | 'low' = readiness?.band || 'medium';
    const capacity = rollup?.capacity || {};
    const utilizationPercent = typeof capacity.capacityUtilization === 'number'
      ? capacity.capacityUtilization
      : (capacity.targetCapacity && capacity.targetCapacity > 0 ? (capacity.committedPoints || 0) / capacity.targetCapacity : null);
    const blockedItemCount = rollup?.totals?.blockedDerived || 0;
    const riskLevel = computeRiskLevel({
      utilizationPercent,
      blockedItemCount,
      dependencyInbound: dependencyInbound[milestone.id] || 0,
      readinessBand,
      startDate: milestone.startDate
    });
    const forecast = computeMilestoneForecast({
      milestoneId: milestone.id,
      plannedEndDate: milestone.endDate || new Date().toISOString(),
      startDate: milestone.startDate,
      utilizationPercent,
      blockedItemCount,
      dependencyInbound: dependencyInbound[milestone.id] || 0,
      readinessBand,
      riskLevel
    });
    forecasts.push(forecast);
  }

  const avgSlipDays = forecasts.length
    ? Math.round(
      forecasts.reduce((sum, f) => {
        const planned = toDate(f.plannedEndDate) || new Date();
        const expected = toDate(f.expectedDate) || planned;
        return sum + Math.round((expected.getTime() - planned.getTime()) / (24 * 60 * 60 * 1000));
      }, 0) / forecasts.length
    )
    : 0;
  const confidenceScore = forecasts.reduce((sum, f) => {
    const score = f.forecastConfidence === 'HIGH' ? 3 : f.forecastConfidence === 'MEDIUM' ? 2 : 1;
    return sum + score;
  }, 0);
  const avgConfidence = forecasts.length ? confidenceScore / forecasts.length : 0;
  const averageConfidence: PlanForecastSummary['averageConfidence'] =
    avgConfidence >= 2.5 ? 'HIGH' : avgConfidence >= 1.5 ? 'MEDIUM' : 'LOW';
  const highRiskMilestones = forecasts.filter((f) => f.slipRisk === 'HIGH').length;

  return {
    milestoneForecasts: forecasts,
    summary: {
      planId,
      milestonesAnalyzed: forecasts.length,
      highRiskMilestones,
      averageSlipDays: avgSlipDays,
      averageConfidence
    }
  };
};

export const computePortfolioForecast = (planSummaries: PlanForecastSummary[], milestoneForecasts: MilestoneForecast[]): PortfolioForecastSummary => {
  const totalMilestones = milestoneForecasts.length;
  const highRiskMilestones = milestoneForecasts.filter((f) => f.slipRisk === 'HIGH').length;
  const expectedPortfolioSlipDays = totalMilestones
    ? Math.round(
      milestoneForecasts.reduce((sum, f) => {
        const planned = toDate(f.plannedEndDate) || new Date();
        const expected = toDate(f.expectedDate) || planned;
        return sum + Math.round((expected.getTime() - planned.getTime()) / (24 * 60 * 60 * 1000));
      }, 0) / totalMilestones
    )
    : 0;

  return {
    plansAnalyzed: planSummaries.length,
    totalMilestones,
    highRiskMilestones,
    expectedPortfolioSlipDays
  };
};

const getPlanData = async (planId: string, user: { userId?: string; role?: string } | null) => {
  const parsed = parsePlanId(planId);
  if (!parsed) return null;
  const db = await getDb();
  const visibility = createVisibilityContext(user);

  if (parsed.source === 'PREVIEW') {
    const preview = await db.collection('work_plan_previews').findOne({ _id: new ObjectId(parsed.id) });
    if (!preview) return null;
    const data = preview.preview as DeliveryPlanPreview;
    const milestones = data.milestones.map((m) => ({
      id: String(m.index),
      startDate: m.startDate,
      endDate: m.endDate,
      targetCapacity: m.targetCapacity ?? null
    }));
    const rollups: Record<string, any> = {};
    data.artifacts.forEach((artifact) => {
      const cap = data.milestones.find((m) => m.index === artifact.milestoneIndex);
      const targetCapacity = cap?.targetCapacity ?? null;
      const committedPoints = artifact.storyCount || 0;
      rollups[String(artifact.milestoneIndex)] = {
        capacity: {
          targetCapacity,
          committedPoints,
          capacityUtilization: targetCapacity && targetCapacity > 0 ? committedPoints / targetCapacity : null
        },
        totals: { blockedDerived: 0 }
      };
    });
    const readinessByMilestone: Record<string, any> = {};
    milestones.forEach((m) => { readinessByMilestone[m.id] = { band: 'medium' }; });
    const dependencyInbound: Record<string, number> = {};
    return { milestones, rollups, readinessByMilestone, dependencyInbound };
  }

  const run = await db.collection('work_delivery_plan_runs').findOne({ _id: new ObjectId(parsed.id) });
  if (!run) return null;
  const milestoneIds = (run.milestoneIds || []).filter((id: any) => ObjectId.isValid(String(id))).map((id: any) => new ObjectId(String(id)));
  const milestonesRaw = await db.collection('milestones').find({ _id: { $in: milestoneIds } }).toArray();
  const visibleMilestones = [];
  for (const ms of milestonesRaw) {
    const canView = await visibility.canViewBundle(String(ms.bundleId || ''));
    if (canView) visibleMilestones.push(ms);
  }

  const milestones = visibleMilestones.map((m) => ({
    id: String(m._id || m.id || m.name),
    startDate: m.startDate,
    endDate: m.endDate,
    targetCapacity: typeof m.targetCapacity === 'number' ? m.targetCapacity : null
  }));
  const rollupList = await computeMilestoneRollups(milestones.map((m) => m.id));
  const rollups: Record<string, any> = {};
  rollupList.forEach((r: any) => { rollups[String(r.milestoneId)] = r; });
  const readinessByMilestone: Record<string, any> = {};
  for (const milestone of milestones) {
    const policyRef = await getEffectivePolicyForMilestone(milestone.id);
    const readiness = rollups[milestone.id] ? await evaluateMilestoneReadiness(rollups[milestone.id], policyRef.effective) : null;
    readinessByMilestone[milestone.id] = readiness || { band: 'medium' };
  }

  const itemIds = (run.workItemIds || []).filter((id: any) => ObjectId.isValid(String(id))).map((id: any) => new ObjectId(String(id)));
  const items = await db.collection('workitems').find({ _id: { $in: itemIds } }).toArray();
  const visibleItems = await visibility.filterVisibleWorkItems(items as unknown as WorkItem[]);
  const enriched = await deriveWorkItemLinkSummary(visibleItems as WorkItem[]);
  const dependencyInbound = buildDependencyEdges(enriched as WorkItem[]);

  return { milestones, rollups, readinessByMilestone, dependencyInbound };
};

export const getPlanForecast = async (planId: string, user: { userId?: string; role?: string } | null) => {
  const data = await getPlanData(planId, user);
  if (!data) return null;
  return await computePlanForecast({
    planId,
    milestones: data.milestones,
    rollups: data.rollups,
    readinessByMilestone: data.readinessByMilestone,
    dependencyInbound: data.dependencyInbound
  });
};

export const getPortfolioForecast = async (planIds: string[], user: { userId?: string; role?: string } | null) => {
  const planSummaries: PlanForecastSummary[] = [];
  const allMilestoneForecasts: MilestoneForecast[] = [];

  for (const planId of planIds) {
    const result = await getPlanForecast(planId, user);
    if (!result) continue;
    planSummaries.push(result.summary);
    allMilestoneForecasts.push(...result.milestoneForecasts);
  }

  const portfolioSummary = computePortfolioForecast(planSummaries, allMilestoneForecasts);
  return { planForecasts: planSummaries, portfolioSummary };
};

export const resolveLatestPlanId = async (scopeType: string, scopeId: string) => {
  const db = await getDb();
  if (!scopeType || !scopeId) return null;
  const run = await db.collection('work_delivery_plan_runs')
    .find({ scopeType, scopeId })
    .sort({ createdAt: -1 })
    .limit(1)
    .next();
  if (run?._id) return `created:${String(run._id)}`;
  return null;
};
