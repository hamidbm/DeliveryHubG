import { ObjectId } from 'mongodb';
import { getDb } from './db';
import { evaluateMilestoneCommitReview } from './commitmentReview';
import { getEffectivePolicyForMilestone } from './policy';
import { computeMilestoneBaselineDelta } from './baselineDelta';

type DriftDelta = {
  key: string;
  before: any;
  after: any;
  status: 'IMPROVED' | 'WORSENED' | 'NEW' | 'CLEARED';
  severity: 'info' | 'warn' | 'critical';
  detail: string;
};

export type DriftResult = {
  milestoneId: string;
  hasBaseline: boolean;
  baselineAt?: string;
  driftBand: 'NONE' | 'MINOR' | 'MAJOR';
  deltas: DriftDelta[];
  recommendedActions: Array<{ type: 'REREVIEW' | 'ESCALATE' | 'SCOPE_REDUCE' | 'UNBLOCK'; reason: string }>;
};

const DAY_MS = 24 * 60 * 60 * 1000;

const buildMilestoneQuery = (id: string) => {
  if (ObjectId.isValid(id)) {
    return { $or: [{ _id: new ObjectId(id) }, { id }, { name: id }] };
  }
  return { $or: [{ id }, { name: id }] };
};

const compareNumber = (before: number | null, after: number | null) => {
  if (before === null && after !== null) return { status: 'NEW' as const, delta: null };
  if (before !== null && after === null) return { status: 'CLEARED' as const, delta: null };
  if (before === null || after === null) return { status: 'NEW' as const, delta: null };
  if (after > before) return { status: 'WORSENED' as const, delta: after - before };
  if (after < before) return { status: 'IMPROVED' as const, delta: before - after };
  return { status: 'IMPROVED' as const, delta: 0 };
};

const compareDate = (before?: string, after?: string) => {
  const beforeDate = before ? new Date(before) : null;
  const afterDate = after ? new Date(after) : null;
  if (beforeDate && Number.isNaN(beforeDate.getTime())) return { status: 'NEW' as const, deltaDays: null };
  if (afterDate && Number.isNaN(afterDate.getTime())) return { status: 'NEW' as const, deltaDays: null };
  if (!beforeDate && afterDate) return { status: 'NEW' as const, deltaDays: null };
  if (beforeDate && !afterDate) return { status: 'CLEARED' as const, deltaDays: null };
  if (!beforeDate || !afterDate) return { status: 'NEW' as const, deltaDays: null };
  const deltaDays = Math.round((afterDate.getTime() - beforeDate.getTime()) / DAY_MS);
  if (deltaDays > 0) return { status: 'WORSENED' as const, deltaDays };
  if (deltaDays < 0) return { status: 'IMPROVED' as const, deltaDays: Math.abs(deltaDays) };
  return { status: 'IMPROVED' as const, deltaDays: 0 };
};

export const evaluateMilestoneCommitmentDrift = async (milestoneId: string): Promise<DriftResult | null> => {
  const id = String(milestoneId || '');
  if (!id) return null;
  const db = await getDb();
  const milestone = await db.collection('milestones').findOne(buildMilestoneQuery(id));
  if (!milestone) return null;

  const baseline = await db.collection('commitment_reviews')
    .find({ milestoneId: String(milestone._id || milestone.id || milestone.name || id), result: { $in: ['PASS', 'OVERRIDDEN'] } })
    .sort({ evaluatedAt: -1 })
    .limit(1)
    .toArray();
  const baselineDoc = baseline[0];
  if (!baselineDoc?.review) {
    return {
      milestoneId: String(milestone._id || milestone.id || milestone.name || id),
      hasBaseline: false,
      driftBand: 'NONE',
      deltas: [],
      recommendedActions: []
    };
  }

  const current = await evaluateMilestoneCommitReview(String(milestone._id || milestone.id || milestone.name || id));
  if (!current) return null;

  const policyRef = await getEffectivePolicyForMilestone(String(milestone._id || milestone.id || milestone.name || id));
  const driftPolicy = policyRef.effective.commitReview?.drift || {
    enabled: true,
    majorSlipDays: 7,
    majorHitProbDrop: 0.2,
    majorDataQualityDrop: 15,
    majorExternalBlockersIncrease: 1,
    requireReReviewOnMajor: false
  };
  if (!driftPolicy.enabled) {
    return {
      milestoneId: String(milestone._id || milestone.id || milestone.name || id),
      hasBaseline: true,
      baselineAt: baselineDoc.evaluatedAt,
      driftBand: 'NONE',
      deltas: [],
      recommendedActions: []
    };
  }

  const deltas: DriftDelta[] = [];

  const baselineMc = baselineDoc.review?.snapshot?.monteCarlo;
  const currentMc = current.snapshot?.monteCarlo;
  const p80Delta = compareDate(baselineMc?.p80, currentMc?.p80);
  if (p80Delta.deltaDays !== null || p80Delta.status !== 'IMPROVED') {
    const severity: DriftDelta['severity'] = p80Delta.status === 'WORSENED' && (p80Delta.deltaDays || 0) >= driftPolicy.majorSlipDays
      ? 'critical'
      : p80Delta.status === 'WORSENED'
        ? 'warn'
        : 'info';
    deltas.push({
      key: 'p80',
      before: baselineMc?.p80,
      after: currentMc?.p80,
      status: p80Delta.status,
      severity,
      detail: p80Delta.deltaDays !== null ? `P80 moved ${p80Delta.deltaDays} days` : 'P80 updated'
    });
  }

  const hitBefore = typeof baselineMc?.hitProbability === 'number' ? baselineMc.hitProbability : null;
  const hitAfter = typeof currentMc?.hitProbability === 'number' ? currentMc.hitProbability : null;
  const hitCompare = compareNumber(hitBefore, hitAfter);
  if (hitCompare.delta !== null || hitCompare.status !== 'IMPROVED') {
    const drop = hitCompare.status === 'WORSENED' ? (hitAfter! - hitBefore!) : 0;
    const severity: DriftDelta['severity'] = hitCompare.status === 'WORSENED' && (Math.abs(drop) >= driftPolicy.majorHitProbDrop || (hitAfter !== null && hitAfter < policyRef.effective.commitReview.minHitProbability))
      ? 'critical'
      : hitCompare.status === 'WORSENED'
        ? 'warn'
        : 'info';
    deltas.push({
      key: 'hitProbability',
      before: hitBefore,
      after: hitAfter,
      status: hitCompare.status,
      severity,
      detail: hitAfter !== null && hitBefore !== null ? `Hit probability ${Math.round(hitBefore * 100)}% → ${Math.round(hitAfter * 100)}%` : 'Hit probability updated'
    });
  }

  const capBefore = typeof baselineDoc.review?.snapshot?.capacitySignal?.overcommitMax === 'number'
    ? baselineDoc.review.snapshot.capacitySignal.overcommitMax
    : null;
  const capAfter = typeof current.snapshot?.capacitySignal?.overcommitMax === 'number'
    ? current.snapshot.capacitySignal.overcommitMax
    : null;
  const capCompare = compareNumber(capBefore, capAfter);
  if (capCompare.delta !== null || capCompare.status !== 'IMPROVED') {
    const inc = capCompare.status === 'WORSENED' ? (capAfter! - capBefore!) : 0;
    const severity: DriftDelta['severity'] = capCompare.status === 'WORSENED' && inc >= policyRef.effective.commitReview.capacityOvercommitThreshold
      ? 'critical'
      : capCompare.status === 'WORSENED'
        ? 'warn'
        : 'info';
    deltas.push({
      key: 'capacityOvercommit',
      before: capBefore,
      after: capAfter,
      status: capCompare.status,
      severity,
      detail: capAfter !== null && capBefore !== null ? `Overcommit ${Math.round(capBefore)} → ${Math.round(capAfter)} pts` : 'Capacity signal updated'
    });
  }

  const extBefore = baselineDoc.review?.snapshot?.criticalPath?.externalCount ?? null;
  const extAfter = current.snapshot?.criticalPath?.externalCount ?? null;
  const extCompare = compareNumber(extBefore, extAfter);
  if (extCompare.delta !== null || extCompare.status !== 'IMPROVED') {
    const inc = extCompare.status === 'WORSENED' ? (extAfter! - extBefore!) : 0;
    const severity: DriftDelta['severity'] = extCompare.status === 'WORSENED' && inc >= driftPolicy.majorExternalBlockersIncrease
      ? 'critical'
      : extCompare.status === 'WORSENED'
        ? 'warn'
        : 'info';
    deltas.push({
      key: 'externalBlockers',
      before: extBefore,
      after: extAfter,
      status: extCompare.status,
      severity,
      detail: extAfter !== null && extBefore !== null ? `External blockers ${extBefore} → ${extAfter}` : 'External blockers updated'
    });
  }

  const dqBefore = baselineDoc.review?.snapshot?.rollup?.dataQuality?.score ?? null;
  const dqAfter = current.snapshot?.rollup?.dataQuality?.score ?? null;
  const dqCompare = compareNumber(dqBefore, dqAfter);
  if (dqCompare.delta !== null || dqCompare.status !== 'IMPROVED') {
    const drop = dqCompare.status === 'WORSENED' ? (dqBefore! - dqAfter!) : 0;
    const severity: DriftDelta['severity'] = dqCompare.status === 'WORSENED' && drop >= driftPolicy.majorDataQualityDrop
      ? 'critical'
      : dqCompare.status === 'WORSENED'
        ? 'warn'
        : 'info';
    deltas.push({
      key: 'dataQuality',
      before: dqBefore,
      after: dqAfter,
      status: dqCompare.status,
      severity,
      detail: dqAfter !== null && dqBefore !== null ? `Data quality ${dqBefore} → ${dqAfter}` : 'Data quality updated'
    });
  }

  const staleBefore = baselineDoc.review?.snapshot?.staleness?.criticalStaleCount ?? 0;
  const staleAfter = current.snapshot?.staleness?.criticalStaleCount ?? 0;
  const staleCompare = compareNumber(staleBefore, staleAfter);
  if (staleCompare.delta !== null || staleCompare.status !== 'IMPROVED') {
    const inc = staleCompare.status === 'WORSENED' ? (staleAfter - staleBefore) : 0;
    const severity: DriftDelta['severity'] = staleCompare.status === 'WORSENED' && inc >= 2
      ? 'critical'
      : staleCompare.status === 'WORSENED'
        ? 'warn'
        : 'info';
    deltas.push({
      key: 'criticalStale',
      before: staleBefore,
      after: staleAfter,
      status: staleCompare.status,
      severity,
      detail: `Critical stale ${staleBefore} → ${staleAfter}`
    });
  }

  const highBefore = (baselineDoc.review?.snapshot?.rollup?.risks?.openBySeverity?.high || 0)
    + (baselineDoc.review?.snapshot?.rollup?.risks?.openBySeverity?.critical || 0);
  const highAfter = (current.snapshot?.rollup?.risks?.openBySeverity?.high || 0)
    + (current.snapshot?.rollup?.risks?.openBySeverity?.critical || 0);
  const highCompare = compareNumber(highBefore, highAfter);
  if (highCompare.delta !== null || highCompare.status !== 'IMPROVED') {
    const inc = highCompare.status === 'WORSENED' ? (highAfter - highBefore) : 0;
    const severity: DriftDelta['severity'] = highCompare.status === 'WORSENED' && inc >= 2
      ? 'critical'
      : highCompare.status === 'WORSENED'
        ? 'warn'
        : 'info';
    deltas.push({
      key: 'highRisks',
      before: highBefore,
      after: highAfter,
      status: highCompare.status,
      severity,
      detail: `High/critical risks ${highBefore} → ${highAfter}`
    });
  }

  const baselineDelta = await computeMilestoneBaselineDelta(String(milestone._id || milestone.id || milestone.name || id), { includeHidden: true });
  if (baselineDelta) {
    if (baselineDelta.netScopeDeltaPoints !== 0) {
      const absDelta = Math.abs(baselineDelta.netScopeDeltaPoints);
      const severity: DriftDelta['severity'] = absDelta >= 15 ? 'critical' : absDelta >= 5 ? 'warn' : 'info';
      deltas.push({
        key: 'scopeDelta',
        before: baselineDelta.baselineTotals.pointsOpen,
        after: baselineDelta.currentTotals.pointsOpen,
        status: baselineDelta.netScopeDeltaPoints > 0 ? 'WORSENED' : 'IMPROVED',
        severity,
        detail: `Scope ${baselineDelta.netScopeDeltaPoints > 0 ? '+' : ''}${baselineDelta.netScopeDeltaPoints} pts since commit`
      });
    }
    if (baselineDelta.estimateChanges.pointsDelta !== 0) {
      const absDelta = Math.abs(baselineDelta.estimateChanges.pointsDelta);
      const severity: DriftDelta['severity'] = absDelta >= 15 ? 'critical' : absDelta >= 5 ? 'warn' : 'info';
      deltas.push({
        key: 'estimateDelta',
        before: null,
        after: baselineDelta.estimateChanges.pointsDelta,
        status: baselineDelta.estimateChanges.pointsDelta > 0 ? 'WORSENED' : 'IMPROVED',
        severity,
        detail: `Estimates ${baselineDelta.estimateChanges.pointsDelta > 0 ? '+' : ''}${baselineDelta.estimateChanges.pointsDelta} pts since commit`
      });
    }
  }

  const hasCritical = deltas.some((d) => d.severity === 'critical');
  const hasWarn = deltas.some((d) => d.severity === 'warn');
  const driftBand: DriftResult['driftBand'] = hasCritical ? 'MAJOR' : hasWarn ? 'MINOR' : 'NONE';

  const recommendedActions: DriftResult['recommendedActions'] = [];
  if (driftBand === 'MAJOR') {
    recommendedActions.push({ type: 'REREVIEW', reason: 'Major drift detected since last commitment review' });
    if (driftPolicy.requireReReviewOnMajor) {
      recommendedActions.push({ type: 'ESCALATE', reason: 'Policy requires re-review for major drift' });
    }
  }
  if (deltas.some((d) => d.key === 'capacityOvercommit' && d.status === 'WORSENED')) {
    recommendedActions.push({ type: 'SCOPE_REDUCE', reason: 'Capacity overcommit increased' });
  }
  if (baselineDelta && baselineDelta.netScopeDeltaPoints > 0) {
    recommendedActions.push({ type: 'SCOPE_REDUCE', reason: 'Scope increased since commit' });
  }
  if (deltas.some((d) => d.key === 'externalBlockers' && d.status === 'WORSENED')) {
    recommendedActions.push({ type: 'UNBLOCK', reason: 'External blockers increased' });
  }

  return {
    milestoneId: String(milestone._id || milestone.id || milestone.name || id),
    hasBaseline: true,
    baselineAt: baselineDoc.evaluatedAt,
    driftBand,
    deltas,
    recommendedActions
  };
};
