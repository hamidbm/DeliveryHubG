import { getDeliveryPolicy, DeliveryPolicy } from './policy';

export const evaluateSprintReadiness = async (rollup: any, policyOverride?: DeliveryPolicy) => {
  const policy = policyOverride || await getDeliveryPolicy();
  const warnScoreBelow = policy.readiness.sprint.warnScoreBelow;
  const blockScoreBelow = policy.readiness.sprint.blockScoreBelow;
  const blockOnBlockedItems = policy.readiness.sprint.blockOnBlockedItems;
  const blockOnHighCriticalRisks = policy.readiness.sprint.blockOnHighCriticalRisks;

  const blockers: Array<{ code: string; detail: string }> = [];
  const remainingPoints = rollup?.capacity?.remainingPoints ?? 0;
  const blockedDerived = rollup?.scope?.blockedDerived ?? 0;
  const highCriticalRisks = rollup?.risks?.highCritical ?? 0;
  const dataQualityScore = rollup?.dataQuality?.score;

  if (remainingPoints > 0) {
    blockers.push({ code: 'REMAINING_SCOPE', detail: `${remainingPoints} points remaining` });
  }
  if (blockedDerived > 0 && blockOnBlockedItems) {
    blockers.push({ code: 'BLOCKED_ITEMS', detail: `${blockedDerived} blocked items` });
  }
  if (highCriticalRisks > 0 && blockOnHighCriticalRisks) {
    blockers.push({ code: 'HIGH_RISK', detail: `${highCriticalRisks} high/critical risks` });
  }
  if (typeof dataQualityScore === 'number') {
    if (dataQualityScore < blockScoreBelow) {
      blockers.push({ code: 'DATA_QUALITY', detail: `Data quality score ${dataQualityScore} (<${blockScoreBelow})` });
    } else if (dataQualityScore < warnScoreBelow) {
      blockers.push({ code: 'DATA_QUALITY_WARN', detail: `Data quality score ${dataQualityScore} (<${warnScoreBelow})` });
    }
  }

  let score = 100;
  score -= remainingPoints > 0 ? 20 : 0;
  score -= blockedDerived > 0 ? 20 : 0;
  score -= highCriticalRisks > 0 ? 20 : 0;
  if (typeof dataQualityScore === 'number' && dataQualityScore < warnScoreBelow) score -= 10;
  score = Math.max(0, Math.min(100, score));

  const band = score >= 80 ? 'high' : score >= 50 ? 'medium' : 'low';

  return {
    canClose: blockers.filter((b) => b.code !== 'DATA_QUALITY_WARN').length === 0,
    blockers,
    score,
    band
  };
};
