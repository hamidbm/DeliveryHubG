import assert from 'node:assert';
import { computeCapacityUtilization, computeDependencyPressure, computeMilestoneIntelligence, computeRiskScore } from '../src/components/roadmap/roadmapViewModels';

export const run = async () => {
  const util = computeCapacityUtilization(110, 100);
  assert.strictEqual(util.utilizationPercent?.toFixed(2), '1.10');
  assert.strictEqual(util.state, 'AT_RISK');

  const riskScore = computeRiskScore({
    utilizationPercent: 1.2,
    blockedItemCount: 4,
    dependencyInbound: 3,
    readiness: 'PARTIAL',
    startDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString()
  });
  assert.ok(riskScore >= 4, 'Expected high risk score');

  const pressure = computeDependencyPressure([
    { fromMilestoneId: 'm1', toMilestoneId: 'm2', count: 2, blockerCount: 2, blockedCount: 2 },
    { fromMilestoneId: 'm2', toMilestoneId: 'm3', count: 1, blockerCount: 1, blockedCount: 1 }
  ]);
  assert.strictEqual(pressure.m2.inbound, 2);
  assert.strictEqual(pressure.m2.outbound, 1);

  const intel = computeMilestoneIntelligence({
    milestone: {
      id: 'm1',
      name: 'Milestone 1',
      startDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
      endDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
      targetCapacity: 100
    },
    items: [
      { status: 'IN_PROGRESS', storyPoints: 50, isBlocked: true },
      { status: 'TODO', storyPoints: 60 }
    ] as any[],
    dependencyInbound: 3,
    dependencyOutbound: 1
  });
  assert.strictEqual(intel.utilizationState, 'AT_RISK');
  assert.strictEqual(intel.blockedItemCount, 1);
  assert.ok(['MEDIUM', 'HIGH'].includes(intel.riskLevel));

  console.log('roadmap intelligence tests passed');
};

if (!process.env.TEST_API_RUNNER) {
  run();
}
