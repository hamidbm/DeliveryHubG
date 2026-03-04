import assert from 'node:assert';
import { evaluateMilestoneReadiness } from '../src/services/milestoneGovernance';
import { isPrivilegedMilestoneRole } from '../src/services/authz';
import { runTest } from './test-harness';

export const run = async () => {
  await runTest('milestone-readiness', async () => {
    const roleTests = [
      { role: 'CMO Architect', expected: true },
      { role: 'Admin', expected: true },
      { role: 'Engineer', expected: false }
    ];

    roleTests.forEach(({ role, expected }) => {
      assert.strictEqual(isPrivilegedMilestoneRole(role), expected, `Role check failed for ${role}`);
    });

    const rollupReady = {
      capacity: { committedPoints: 10, remainingPoints: 0, remainingHours: 0, isOverCapacity: false },
      totals: { blockedDerived: 0, overdueOpen: 0 },
      risks: { openBySeverity: { low: 0, medium: 0, high: 0, critical: 0 } },
      schedule: { isLate: false }
    };

    const readinessReady = await evaluateMilestoneReadiness(rollupReady);
    assert.strictEqual(readinessReady.canComplete, true, 'Expected completion allowed');

    const rollupBlocked = {
      capacity: { committedPoints: 10, remainingPoints: 5, remainingHours: 0, isOverCapacity: false },
      totals: { blockedDerived: 1, overdueOpen: 0 },
      risks: { openBySeverity: { low: 0, medium: 0, high: 1, critical: 0 } },
      schedule: { isLate: false }
    };

    const readinessBlocked = await evaluateMilestoneReadiness(rollupBlocked);
    assert.strictEqual(readinessBlocked.canComplete, false, 'Expected completion blocked');
    assert.ok(readinessBlocked.blockers.some(b => b.key === 'remaining_work'), 'Expected remaining work blocker');
    assert.ok(readinessBlocked.blockers.some(b => b.key === 'risks'), 'Expected risk blocker');
  });

  console.log('milestone readiness tests passed');
};

if (!process.env.TEST_API_RUNNER) {
  run();
}
