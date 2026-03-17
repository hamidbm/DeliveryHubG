import { ObjectId } from 'mongodb';
import { computeMilestoneRollup } from './rollupAnalytics';
import { computeMilestoneCriticalPath } from './criticalPath';
import { getEffectivePolicyForMilestone } from './policy';
import { computeBundleCapacityPlans } from './capacityPlanning';
import type { CommitmentReview, MilestoneRollup } from '../types';
import { getMilestoneByRef } from '../server/db/repositories/milestonesRepo';

const scoreFromChecks = (checks: CommitmentReview['checks']) => {
  let score = 100;
  checks.forEach((c) => {
    if (c.status === 'FAIL') score -= 25;
    if (c.status === 'WARN') score -= 10;
  });
  score = Math.max(0, Math.min(100, score));
  const hasFail = checks.some((c) => c.status === 'FAIL');
  const hasWarn = checks.some((c) => c.status === 'WARN');
  const band: CommitmentReview['band'] = hasFail ? 'RED' : hasWarn ? 'YELLOW' : 'GREEN';
  return { score, band };
};

export const evaluateMilestoneCommitReview = async (milestoneId: string): Promise<CommitmentReview | null> => {
  const id = String(milestoneId || '');
  if (!id) return null;
  const milestone = await getMilestoneByRef(id);
  if (!milestone) return null;

  const rollup = await computeMilestoneRollup(String(milestone._id || milestone.id || milestone.name || id));
  if (!rollup) return null;

  const policyRef = await getEffectivePolicyForMilestone(String(milestone._id || milestone.id || milestone.name || id));
  const policy = policyRef.effective;
  const commitPolicy = policy.commitReview || {
    enabled: false,
    minHitProbability: 0.5,
    blockIfP80AfterEndDate: true,
    blockOnExternalBlockers: false,
    maxCriticalStale: 2,
    maxHighRisks: 3,
    capacityOvercommitThreshold: 20
  };
  const checks: CommitmentReview['checks'] = [];

  const mc = rollup.forecast?.monteCarlo;
  const endDate = milestone.endDate ? new Date(milestone.endDate) : null;
  if (mc?.hitProbability !== undefined) {
    if (mc.hitProbability < commitPolicy.minHitProbability) {
      checks.push({ key: 'hitProbability', status: 'FAIL', detail: `Hit probability ${Math.round(mc.hitProbability * 100)}% below threshold` });
    } else {
      checks.push({ key: 'hitProbability', status: 'PASS', detail: `Hit probability ${Math.round(mc.hitProbability * 100)}%` });
    }
  } else {
    checks.push({ key: 'hitProbability', status: 'WARN', detail: 'Hit probability unavailable' });
  }

  if (commitPolicy.blockIfP80AfterEndDate && mc?.p80 && endDate) {
    const p80 = new Date(mc.p80);
    if (p80.getTime() > endDate.getTime()) {
      checks.push({ key: 'p80', status: 'FAIL', detail: `P80 ${p80.toLocaleDateString()} exceeds end date` });
    } else {
      checks.push({ key: 'p80', status: 'PASS', detail: `P80 ${p80.toLocaleDateString()} within end date` });
    }
  } else if (mc?.p80 && endDate) {
    const p80 = new Date(mc.p80);
    const status = p80.getTime() > endDate.getTime() ? 'WARN' : 'PASS';
    checks.push({ key: 'p80', status, detail: `P80 ${p80.toLocaleDateString()}` });
  } else {
    checks.push({ key: 'p80', status: 'WARN', detail: 'P80 unavailable' });
  }

  let capacitySignal: CommitmentReview['snapshot']['capacitySignal'] | undefined;
  const bundleId = milestone.bundleId ? String(milestone.bundleId) : '';
  if (bundleId && endDate) {
    try {
      const horizonWeeks = Math.max(1, Math.ceil((endDate.getTime() - Date.now()) / (7 * 24 * 60 * 60 * 1000)));
      const capacity = await computeBundleCapacityPlans([bundleId], horizonWeeks);
      const plan = capacity.bundlePlans[0];
      if (plan) {
        const endTime = endDate.getTime();
        const overcommitMax = Math.max(0, ...plan.buckets.filter((b) => new Date(b.endDate).getTime() <= endTime).map((b) => b.overBy));
        capacitySignal = { overcommitMax: Number(overcommitMax.toFixed(2)), horizonWeeks };
        if (overcommitMax > commitPolicy.capacityOvercommitThreshold) {
          checks.push({ key: 'capacity', status: 'FAIL', detail: `Overcommit by ${Math.round(overcommitMax)} pts` });
        } else {
          checks.push({ key: 'capacity', status: 'PASS', detail: `Overcommit max ${Math.round(overcommitMax)} pts` });
        }
      }
    } catch {
      checks.push({ key: 'capacity', status: 'WARN', detail: 'Capacity signal unavailable' });
    }
  } else {
    checks.push({ key: 'capacity', status: 'WARN', detail: 'Capacity signal unavailable' });
  }

  const dqScore = rollup.dataQuality?.score ?? null;
  if (dqScore !== null) {
    if (dqScore < policy.readiness.milestone.blockScoreBelow) {
      checks.push({ key: 'dataQuality', status: 'FAIL', detail: `Data quality ${dqScore} below threshold` });
    } else {
      checks.push({ key: 'dataQuality', status: 'PASS', detail: `Data quality ${dqScore}` });
    }
  } else {
    checks.push({ key: 'dataQuality', status: 'WARN', detail: 'Data quality unavailable' });
  }

  let criticalPath: any = null;
  let externalCount = 0;
  try {
    criticalPath = await computeMilestoneCriticalPath(String(milestone._id || milestone.id || milestone.name || id));
    externalCount = criticalPath?.externalBlockers?.length || 0;
    if (externalCount > 0) {
      const status = commitPolicy.blockOnExternalBlockers ? 'FAIL' : 'WARN';
      checks.push({ key: 'externalBlockers', status, detail: `${externalCount} external blockers on critical path` });
    } else {
      checks.push({ key: 'externalBlockers', status: 'PASS', detail: 'No external blockers' });
    }
  } catch {
    checks.push({ key: 'externalBlockers', status: 'WARN', detail: 'Critical path unavailable' });
  }

  const criticalStaleCount = rollup.staleness?.criticalStaleCount ?? 0;
  if (criticalStaleCount >= commitPolicy.maxCriticalStale) {
    checks.push({ key: 'criticalStale', status: 'FAIL', detail: `${criticalStaleCount} critical stale items` });
  } else {
    checks.push({ key: 'criticalStale', status: 'PASS', detail: `${criticalStaleCount} critical stale items` });
  }

  const highRisks = (rollup.risks?.openBySeverity?.high || 0) + (rollup.risks?.openBySeverity?.critical || 0);
  if (highRisks >= commitPolicy.maxHighRisks) {
    checks.push({ key: 'highRisks', status: 'FAIL', detail: `${highRisks} high/critical risks` });
  } else {
    checks.push({ key: 'highRisks', status: 'PASS', detail: `${highRisks} high/critical risks` });
  }

  const { score, band } = scoreFromChecks(checks);
  const canCommit = !checks.some((c) => c.status === 'FAIL');

  return {
    milestoneId: String(milestone._id || milestone.id || milestone.name || id),
    canCommit,
    score,
    band,
    checks,
    snapshot: {
      rollup: rollup as MilestoneRollup,
      monteCarlo: mc,
      capacitySignal,
      criticalPath: criticalPath ? { externalCount, remainingPoints: criticalPath.criticalPath?.remainingPoints || 0 } : undefined,
      staleness: { criticalStaleCount }
    }
  };
};
