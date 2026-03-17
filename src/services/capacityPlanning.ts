import { ObjectId } from 'mongodb';
import { computeMilestoneRollups } from './rollupAnalytics';
import { listBundleCapacity } from '../server/db/repositories/bundleCapacityRepo';
import { listBundlesByRefs } from '../server/db/repositories/bundlesRepo';
import { listMilestonesByBundleIds } from '../server/db/repositories/milestonesRepo';
import { MilestoneStatus } from '../types';

export type CapacityBucketType = 'WEEK' | 'SPRINT';

export type BundleCapacityPlan = {
  bundleId: string;
  bundleName?: string;
  capacity: { unit: 'POINTS_PER_SPRINT' | 'POINTS_PER_WEEK'; value: number };
  horizon: { startDate: string; endDate: string; buckets: CapacityBucketType; count: number };
  buckets: Array<{
    key: string;
    startDate: string;
    endDate: string;
    capacityPoints: number;
    demandPoints: number;
    overBy: number;
    drivers: Array<{ milestoneId: string; name: string; demandPoints: number; endDate?: string; p50?: string; p80?: string; p90?: string; hitProbability?: number }>;
  }>;
  summary: {
    totalCapacity: number;
    totalDemand: number;
    isOvercommitted: boolean;
    maxOverBy: number;
  };
};

export type CapacityAction = {
  type: 'SCOPE_REDUCE' | 'SLIP_MILESTONE' | 'ADD_CAPACITY';
  bundleId: string;
  milestoneId?: string;
  milestoneName?: string;
  reason: string;
  overBy?: number;
};

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const SPRINT_WEEKS = 2;

const startOfDay = (value: Date) => new Date(value.getFullYear(), value.getMonth(), value.getDate());

const buildWeekBuckets = (horizonWeeks: number) => {
  const start = startOfDay(new Date());
  const buckets = Array.from({ length: horizonWeeks }).map((_, idx) => {
    const bucketStart = new Date(start.getTime() + idx * WEEK_MS);
    const bucketEnd = new Date(bucketStart.getTime() + WEEK_MS - 1);
    return {
      key: bucketStart.toISOString().slice(0, 10),
      startDate: bucketStart,
      endDate: bucketEnd
    };
  });
  return buckets;
};

const buildMilestoneKey = (m: any) => String(m?._id || m?.id || m?.name || '');

const resolveMilestoneEnd = (milestone: any, rollup: any) => {
  const forecastEnd = rollup?.forecast?.estimatedCompletionDate;
  const raw = forecastEnd || milestone?.endDate || milestone?.dueDate;
  if (!raw) return null;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return null;
  return date;
};

export const computeBundleCapacityPlans = async (bundleIds: string[], horizonWeeks = 12) => {
  const bundleIdList = bundleIds.map(String).filter(Boolean);
  if (!bundleIdList.length) {
    return { bundlePlans: [] as BundleCapacityPlan[], atRiskBundles: [], recommendedActions: [] as CapacityAction[] };
  }

  const bundles = await listBundlesByRefs(bundleIdList);
  const bundleNameMap = new Map<string, string>();
  bundles.forEach((b: any) => bundleNameMap.set(String(b._id || b.id || b.key || ''), String(b.name || b.title || '')));

  const capacities = await listBundleCapacity(bundleIdList);
  const capacityMap = new Map<string, any>();
  capacities.forEach((c: any) => capacityMap.set(String(c.bundleId), c));

  const milestones = await listMilestonesByBundleIds(bundleIdList, [MilestoneStatus.COMMITTED, MilestoneStatus.IN_PROGRESS]);

  const rollups = milestones.length ? await computeMilestoneRollups(milestones.map(buildMilestoneKey)) : [];
  const rollupMap = new Map<string, any>();
  rollups.forEach((r: any) => rollupMap.set(String(r.milestoneId), r));

  const weekBuckets = buildWeekBuckets(Math.max(1, horizonWeeks));
  const horizonStart = weekBuckets[0]?.startDate || startOfDay(new Date());
  const horizonEnd = weekBuckets[weekBuckets.length - 1]?.endDate || horizonStart;

  const plans: BundleCapacityPlan[] = [];
  const actions: CapacityAction[] = [];

  const perBundleMilestones = new Map<string, any[]>();
  milestones.forEach((m) => {
    const bundleId = String(m.bundleId || '');
    if (!bundleId) return;
    if (!perBundleMilestones.has(bundleId)) perBundleMilestones.set(bundleId, []);
    perBundleMilestones.get(bundleId)!.push(m);
  });

  for (const bundleId of bundleIdList) {
    const bundleMilestones = perBundleMilestones.get(bundleId) || [];
    const capacity = capacityMap.get(bundleId) || { unit: 'POINTS_PER_WEEK', value: 0 };
    const unit = capacity.unit === 'POINTS_PER_SPRINT' ? 'POINTS_PER_SPRINT' : 'POINTS_PER_WEEK';
    const value = typeof capacity.value === 'number' ? capacity.value : 0;
    const perBucketCapacity = unit === 'POINTS_PER_WEEK' ? value : value / SPRINT_WEEKS;

    const buckets = weekBuckets.map((bucket) => ({
      key: bucket.key,
      startDate: bucket.startDate.toISOString(),
      endDate: bucket.endDate.toISOString(),
      capacityPoints: perBucketCapacity,
      demandPoints: 0,
      overBy: 0,
      drivers: [] as Array<{ milestoneId: string; name: string; demandPoints: number; endDate?: string; p50?: string; p80?: string; p90?: string; hitProbability?: number }>
    }));

    const driverTotals = new Map<string, { milestoneId: string; name: string; demandPoints: number; endDate: Date | null }>();
    bundleMilestones.forEach((milestone) => {
      const milestoneId = buildMilestoneKey(milestone);
      const rollup = rollupMap.get(milestoneId) || null;
      const remainingPoints = Math.max(0, Number(rollup?.capacity?.remainingPoints || 0));
      if (!remainingPoints) return;
      const endDate = resolveMilestoneEnd(milestone, rollup);
      if (!endDate) return;
      const mc = rollup?.forecast?.monteCarlo;

      let lastIndex = buckets.length - 1;
      if (endDate.getTime() < horizonStart.getTime()) {
        lastIndex = 0;
      } else if (endDate.getTime() <= horizonEnd.getTime()) {
        lastIndex = buckets.findIndex((b) => new Date(b.endDate).getTime() >= endDate.getTime());
        if (lastIndex < 0) lastIndex = buckets.length - 1;
      }

      const bucketCount = Math.max(1, lastIndex + 1);
      const perBucket = remainingPoints / bucketCount;

      for (let idx = 0; idx <= lastIndex; idx += 1) {
        const bucket = buckets[idx];
        bucket.demandPoints += perBucket;
        const drivers = bucket.drivers;
        const name = String(milestone.name || milestone.title || milestoneId);
        const existing = drivers.find((d) => d.milestoneId === milestoneId);
        if (existing) {
          existing.demandPoints += perBucket;
        } else {
          drivers.push({
            milestoneId,
            name,
            demandPoints: perBucket,
            endDate: endDate.toISOString(),
            p50: mc?.p50,
            p80: mc?.p80,
            p90: mc?.p90,
            hitProbability: mc?.hitProbability
          });
        }
      }

      const total = driverTotals.get(milestoneId) || { milestoneId, name: String(milestone.name || milestone.title || milestoneId), demandPoints: 0, endDate };
      total.demandPoints += remainingPoints;
      driverTotals.set(milestoneId, total);
    });

    buckets.forEach((bucket) => {
      bucket.demandPoints = Number(bucket.demandPoints.toFixed(2));
      bucket.capacityPoints = Number(bucket.capacityPoints.toFixed(2));
      bucket.overBy = Math.max(0, Number((bucket.demandPoints - bucket.capacityPoints).toFixed(2)));
      bucket.drivers.sort((a, b) => b.demandPoints - a.demandPoints);
    });

    const totalCapacity = buckets.reduce((sum, b) => sum + b.capacityPoints, 0);
    const totalDemand = buckets.reduce((sum, b) => sum + b.demandPoints, 0);
    const maxOverBy = buckets.reduce((max, b) => Math.max(max, b.overBy), 0);
    const isOvercommitted = maxOverBy > 0;

    const plan: BundleCapacityPlan = {
      bundleId,
      bundleName: bundleNameMap.get(bundleId),
      capacity: { unit, value },
      horizon: {
        startDate: horizonStart.toISOString(),
        endDate: horizonEnd.toISOString(),
        buckets: 'WEEK',
        count: buckets.length
      },
      buckets,
      summary: {
        totalCapacity: Number(totalCapacity.toFixed(2)),
        totalDemand: Number(totalDemand.toFixed(2)),
        isOvercommitted,
        maxOverBy: Number(maxOverBy.toFixed(2))
      }
    };
    plans.push(plan);

    if (isOvercommitted) {
      const overBuckets = buckets.filter((b) => b.overBy > 0);
      const bucketDrivers = new Map<string, { milestoneId: string; name: string; overBy: number }>();
      overBuckets.forEach((bucket) => {
        const topDriver = bucket.drivers[0];
        if (!topDriver) return;
        const existing = bucketDrivers.get(topDriver.milestoneId);
        if (existing) {
          existing.overBy = Math.max(existing.overBy, bucket.overBy);
        } else {
          bucketDrivers.set(topDriver.milestoneId, { milestoneId: topDriver.milestoneId, name: topDriver.name, overBy: bucket.overBy });
        }
      });

      bucketDrivers.forEach((driver) => {
        actions.push({
          type: 'SCOPE_REDUCE',
          bundleId,
          milestoneId: driver.milestoneId,
          milestoneName: driver.name,
          reason: `Scope exceeds capacity by ${driver.overBy} points in upcoming buckets`,
          overBy: driver.overBy
        });
      });

      if (overBuckets.length >= 2) {
        actions.push({
          type: 'ADD_CAPACITY',
          bundleId,
          reason: `Sustained overcommit across ${overBuckets.length} upcoming buckets`,
          overBy: maxOverBy
        });
      }

      const lastOverBucket = overBuckets[overBuckets.length - 1];
      const topLastDriver = lastOverBucket?.drivers?.[0];
      if (topLastDriver) {
        actions.push({
          type: 'SLIP_MILESTONE',
          bundleId,
          milestoneId: topLastDriver.milestoneId,
          milestoneName: topLastDriver.name,
          reason: `Milestone end date drives overcommit at ${lastOverBucket.key}`
        });
      }
    }

    bundleMilestones.forEach((milestone) => {
      const milestoneId = buildMilestoneKey(milestone);
      const rollup = rollupMap.get(milestoneId) || null;
      const mc = rollup?.forecast?.monteCarlo;
      if (!mc?.p80 || !milestone?.endDate) return;
      const p80 = new Date(mc.p80);
      const end = new Date(milestone.endDate);
      if (Number.isNaN(p80.getTime()) || Number.isNaN(end.getTime())) return;
      if (p80.getTime() > end.getTime()) {
        actions.push({
          type: 'SLIP_MILESTONE',
          bundleId,
          milestoneId,
          milestoneName: milestone.name || milestone.title || milestoneId,
          reason: `P80 finish date (${p80.toLocaleDateString()}) exceeds target end date`
        });
      }
    });
  }

  const atRiskBundles = plans
    .filter((p) => p.summary.isOvercommitted)
    .map((p) => {
      const driverTotals = new Map<string, { milestoneId: string; name: string; demandPoints: number }>();
      p.buckets.forEach((bucket) => {
        bucket.drivers.forEach((driver) => {
          const existing = driverTotals.get(driver.milestoneId) || { milestoneId: driver.milestoneId, name: driver.name, demandPoints: 0 };
          existing.demandPoints += driver.demandPoints;
          driverTotals.set(driver.milestoneId, existing);
        });
      });
      const topDrivers = Array.from(driverTotals.values()).sort((a, b) => b.demandPoints - a.demandPoints).slice(0, 3);
      return {
        bundleId: p.bundleId,
        bundleName: p.bundleName,
        totalCapacity: p.summary.totalCapacity,
        totalDemand: p.summary.totalDemand,
        maxOverBy: p.summary.maxOverBy,
        topDrivers
      };
    })
    .sort((a, b) => b.maxOverBy - a.maxOverBy);

  return { bundlePlans: plans, atRiskBundles, recommendedActions: actions };
};
