import assert from 'node:assert';
import {
  sampleMilestoneFinishDates,
  computeMilestoneProbabilisticForecast,
  computePlanProbabilisticForecast
} from '../src/services/probabilisticForecastingEngine';

export const run = async () => {
  const samplesA = sampleMilestoneFinishDates({
    plannedEndDate: '2026-06-01T00:00:00.000Z',
    startDate: '2026-05-01T00:00:00.000Z',
    utilizationPercent: 1.25,
    dependencyInbound: 6,
    blockedItemCount: 10,
    readinessBand: 'low',
    confidenceBand: 'low',
    sampleCount: 50,
    seed: 123
  });
  const samplesB = sampleMilestoneFinishDates({
    plannedEndDate: '2026-06-01T00:00:00.000Z',
    startDate: '2026-05-01T00:00:00.000Z',
    utilizationPercent: 1.25,
    dependencyInbound: 6,
    blockedItemCount: 10,
    readinessBand: 'low',
    confidenceBand: 'low',
    sampleCount: 50,
    seed: 123
  });
  assert.strictEqual(samplesA[0].toISOString(), samplesB[0].toISOString());

  const forecast = computeMilestoneProbabilisticForecast({
    milestoneId: 'm1',
    plannedEndDate: '2026-06-01T00:00:00.000Z',
    startDate: '2026-05-01T00:00:00.000Z',
    utilizationPercent: 1.2,
    dependencyInbound: 4,
    blockedItemCount: 6,
    readinessBand: 'medium',
    confidenceBand: 'medium',
    sampleCount: 100,
    seed: 99
  });
  assert.ok(forecast.onTimeProbability >= 0 && forecast.onTimeProbability <= 1);
  assert.ok(forecast.p90Date >= forecast.p50Date);

  const plan = await computePlanProbabilisticForecast({
    planId: 'created:test',
    milestones: [
      { id: 'm1', startDate: '2026-05-01', endDate: '2026-06-01', targetCapacity: 100 },
      { id: 'm2', startDate: '2026-06-02', endDate: '2026-06-30', targetCapacity: 100 }
    ],
    rollups: {
      m1: { capacity: { targetCapacity: 100, committedPoints: 120, capacityUtilization: 1.2 }, totals: { blockedDerived: 6 }, confidence: { band: 'low' } },
      m2: { capacity: { targetCapacity: 100, committedPoints: 80, capacityUtilization: 0.8 }, totals: { blockedDerived: 0 }, confidence: { band: 'high' } }
    },
    readinessByMilestone: { m1: { band: 'low' }, m2: { band: 'high' } },
    dependencyInbound: { m1: 4, m2: 0 },
    sampleCount: 80,
    seed: 7
  });
  assert.strictEqual(plan.summary.milestonesAnalyzed, 2);
  assert.ok(plan.summary.averageOnTimeProbability >= 0 && plan.summary.averageOnTimeProbability <= 1);

  console.log('probabilistic forecasting engine tests passed');
};

if (!process.env.TEST_API_RUNNER) {
  run();
}
