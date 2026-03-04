import { getDeliveryPolicy, DeliveryPolicy } from './policy';

export type CapacityCheckResult = {
  ok: boolean;
  error?: { code: 'MISSING_ESTIMATE' | 'OVER_CAPACITY'; message: string; details?: any };
  warning?: { code: 'OVER_CAPACITY'; message: string; details?: any };
};

export type MilestoneReadiness = {
  canStart: boolean;
  canComplete: boolean;
  blockers: Array<{ key: string; detail: string; severity: 'info' | 'warn' | 'block' }>;
  score: number;
  band: 'high' | 'medium' | 'low';
};

export const evaluateCapacity = ({
  milestoneId,
  isCommitted,
  targetCapacity,
  committedPoints,
  incomingPoints,
  existingPoints = 0,
  allowOverCapacity = false
}: {
  milestoneId: string;
  isCommitted: boolean;
  targetCapacity?: number;
  committedPoints: number;
  incomingPoints: number;
  existingPoints?: number;
  allowOverCapacity?: boolean;
}): CapacityCheckResult => {
  const incoming = Number.isFinite(incomingPoints) ? incomingPoints : 0;
  if (isCommitted && (!Number.isFinite(incomingPoints) || incomingPoints <= 0)) {
    return {
      ok: false,
      error: {
        code: 'MISSING_ESTIMATE',
        message: 'Committed milestones require story point estimates.',
        details: { milestoneId }
      }
    };
  }

  if (typeof targetCapacity !== 'number') return { ok: true };

  const adjustedCommitted = Math.max(committedPoints - (Number.isFinite(existingPoints) ? existingPoints : 0), 0);
  const wouldBe = adjustedCommitted + incoming;

  if (wouldBe > targetCapacity) {
    const details = {
      milestoneId,
      targetCapacity,
      currentCommittedPoints: committedPoints,
      incomingItemPoints: incoming,
      wouldBeCommittedPoints: wouldBe
    };
    if (isCommitted && !allowOverCapacity) {
      return {
        ok: false,
        error: {
          code: 'OVER_CAPACITY',
          message: 'Milestone capacity exceeded.',
          details
        }
      };
    }
    if (!isCommitted) {
      return {
        ok: true,
        warning: {
          code: 'OVER_CAPACITY',
          message: 'Milestone capacity exceeded (not committed).',
          details
        }
      };
    }
  }

  return { ok: true };
};

export const evaluateMilestoneReadiness = async (rollup: any, policyOverride?: DeliveryPolicy): Promise<MilestoneReadiness> => {
  const policy = policyOverride || await getDeliveryPolicy();
  const warnScoreBelow = policy.readiness.milestone.warnScoreBelow;
  const blockScoreBelow = policy.readiness.milestone.blockScoreBelow;
  const blockOnBlockedItems = policy.readiness.milestone.blockOnBlockedItems;
  const blockOnHighCriticalRisks = policy.readiness.milestone.blockOnHighCriticalRisks;

  const blockers: MilestoneReadiness['blockers'] = [];
  const capacity = rollup?.capacity || {};
  const totals = rollup?.totals || {};
  const risks = rollup?.risks || { openBySeverity: { low: 0, medium: 0, high: 0, critical: 0 } };
  const schedule = rollup?.schedule || {};
  const dataQuality = rollup?.dataQuality;

  const highCriticalRisks = (risks.openBySeverity?.high || 0) + (risks.openBySeverity?.critical || 0);

  const canStartBlockers = [];
  let dataQualityWarned = false;
  if (typeof dataQuality?.score === 'number') {
    if (dataQuality.score < blockScoreBelow) {
      canStartBlockers.push({ key: 'data_quality', detail: `Data quality score ${dataQuality.score} (<${blockScoreBelow})`, severity: 'block' as const });
    } else if (dataQuality.score < warnScoreBelow) {
      blockers.push({ key: 'data_quality', detail: `Data quality score ${dataQuality.score} (<${warnScoreBelow})`, severity: 'warn' });
      dataQualityWarned = true;
    }
  }
  if (capacity.isOverCapacity) {
    canStartBlockers.push({ key: 'over_capacity', detail: 'Milestone is over capacity', severity: 'block' as const });
  }
  if (capacity.remainingPoints > 0 && capacity.committedPoints === 0) {
    blockers.push({ key: 'no_scoped_work', detail: 'No scoped work yet (committed points = 0)', severity: 'warn' });
  }
  if (totals.blockedDerived > 0) {
    if (blockOnBlockedItems) {
      canStartBlockers.push({ key: 'blocked', detail: `${totals.blockedDerived} blocked items`, severity: 'block' as const });
    } else {
      blockers.push({ key: 'blocked', detail: `${totals.blockedDerived} blocked items`, severity: 'warn' });
    }
  }
  if (highCriticalRisks > 0) {
    if (blockOnHighCriticalRisks) {
      canStartBlockers.push({ key: 'risks', detail: `${highCriticalRisks} high/critical risks`, severity: 'block' as const });
    } else {
      blockers.push({ key: 'risks', detail: `${highCriticalRisks} high/critical risks`, severity: 'warn' });
    }
  }

  const completeBlockers: Array<{ key: string; detail: string; severity: 'block' }> = [];
  if (typeof dataQuality?.score === 'number' && dataQuality.score < blockScoreBelow) {
    completeBlockers.push({ key: 'data_quality', detail: `Data quality score ${dataQuality.score} (<${blockScoreBelow})`, severity: 'block' });
  } else if (typeof dataQuality?.score === 'number' && dataQuality.score < warnScoreBelow && !dataQualityWarned) {
    blockers.push({ key: 'data_quality', detail: `Data quality score ${dataQuality.score} (<${warnScoreBelow})`, severity: 'warn' });
  }
  if ((capacity.remainingPoints || 0) > 0 || (capacity.remainingHours || 0) > 0) {
    completeBlockers.push({ key: 'remaining_work', detail: 'Remaining work exists', severity: 'block' });
  }
  if (totals.blockedDerived > 0 && blockOnBlockedItems) {
    completeBlockers.push({ key: 'blocked', detail: `${totals.blockedDerived} blocked items`, severity: 'block' });
  }
  if (highCriticalRisks > 0 && blockOnHighCriticalRisks) {
    completeBlockers.push({ key: 'risks', detail: `${highCriticalRisks} high/critical risks`, severity: 'block' });
  }
  if (totals.overdueOpen > 0) {
    completeBlockers.push({ key: 'overdue', detail: `${totals.overdueOpen} overdue items`, severity: 'block' });
  }

  blockers.push(...canStartBlockers, ...completeBlockers);

  let score = 100;
  if ((capacity.remainingPoints || 0) > 0) score -= Math.min(30, capacity.remainingPoints);
  if (totals.blockedDerived > 0) score -= Math.min(20, totals.blockedDerived * 5);
  if (highCriticalRisks > 0) score -= Math.min(25, highCriticalRisks * 5);
  if (totals.overdueOpen > 0) score -= Math.min(15, totals.overdueOpen * 3);
  if (capacity.isOverCapacity) score -= 10;
  if (schedule.isLate && (capacity.remainingPoints || 0) > 0) score -= 10;

  score = Math.max(0, Math.min(100, Math.round(score)));
  const band: MilestoneReadiness['band'] = score >= 80 ? 'high' : score >= 60 ? 'medium' : 'low';

  const canStart = !canStartBlockers.some(b => b.severity === 'block');
  const canComplete = completeBlockers.length === 0;

  return { canStart, canComplete, blockers, score, band };
};
