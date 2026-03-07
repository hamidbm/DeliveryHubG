import assert from 'node:assert';
import { computeMilestoneForecast, computePlanForecast } from '../src/services/forecastingEngine';

export const run = async () => {
  const forecast = computeMilestoneForecast({
    milestoneId: 'm1',
    plannedEndDate: '2026-06-01T00:00:00.000Z',
    startDate: '2026-05-01T00:00:00.000Z',
    utilizationPercent: 1.15,
    blockedItemCount: 6,
    dependencyInbound: 4,
    readinessBand: 'medium',
    riskLevel: 'HIGH'
  });

  assert.ok(forecast.bestCaseDate);
  assert.ok(forecast.expectedDate);
  assert.ok(forecast.worstCaseDate);
  assert.strictEqual(forecast.forecastConfidence, 'LOW');
  assert.strictEqual(forecast.slipRisk, 'HIGH');

  const plan = await computePlanForecast({
    planId: 'created:test',
    milestones: [
      { id: 'm1', startDate: '2026-05-01', endDate: '2026-06-01', targetCapacity: 100 },
      { id: 'm2', startDate: '2026-06-02', endDate: '2026-06-30', targetCapacity: 100 }
    ],
    rollups: {
      m1: { capacity: { targetCapacity: 100, committedPoints: 120, capacityUtilization: 1.2 }, totals: { blockedDerived: 6 } },
      m2: { capacity: { targetCapacity: 100, committedPoints: 80, capacityUtilization: 0.8 }, totals: { blockedDerived: 0 } }
    },
    readinessByMilestone: { m1: { band: 'low' }, m2: { band: 'high' } },
    dependencyInbound: { m1: 4, m2: 0 }
  });

  assert.strictEqual(plan.summary.milestonesAnalyzed, 2);
  assert.ok(plan.summary.averageSlipDays >= 0);
  console.log('forecasting engine tests passed');
};

if (!process.env.TEST_API_RUNNER) {
  run();
}
