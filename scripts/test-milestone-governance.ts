import assert from 'node:assert';
import { evaluateCapacity } from '../src/services/milestoneGovernance';
import { isPrivilegedMilestoneRole } from '../src/services/authz';
import { runTest } from './test-harness';

export const run = async () => {
  await runTest('milestone-governance', async () => {
    const roleTests = [
      { role: 'CMO Architect', expected: true },
      { role: 'admin', expected: true },
      { role: 'Engineer', expected: false },
      { role: '', expected: false }
    ];

    roleTests.forEach(({ role, expected }) => {
      assert.strictEqual(isPrivilegedMilestoneRole(role), expected, `Role check failed for ${role}`);
    });

    const missingEstimate = evaluateCapacity({
      milestoneId: 'M1',
      isCommitted: true,
      targetCapacity: 10,
      committedPoints: 5,
      incomingPoints: 0,
      existingPoints: 0,
      allowOverCapacity: false
    });
    assert.strictEqual(missingEstimate.ok, false, 'Expected missing estimate error');
    assert.strictEqual(missingEstimate.error?.code, 'MISSING_ESTIMATE');

    const overCap = evaluateCapacity({
      milestoneId: 'M2',
      isCommitted: true,
      targetCapacity: 10,
      committedPoints: 9,
      incomingPoints: 5,
      existingPoints: 0,
      allowOverCapacity: false
    });
    assert.strictEqual(overCap.ok, false, 'Expected over capacity error');
    assert.strictEqual(overCap.error?.code, 'OVER_CAPACITY');

    const overrideAllowed = evaluateCapacity({
      milestoneId: 'M3',
      isCommitted: true,
      targetCapacity: 10,
      committedPoints: 9,
      incomingPoints: 5,
      existingPoints: 0,
      allowOverCapacity: true
    });
    assert.strictEqual(overrideAllowed.ok, true, 'Expected override to allow over capacity');

    const warning = evaluateCapacity({
      milestoneId: 'M4',
      isCommitted: false,
      targetCapacity: 10,
      committedPoints: 9,
      incomingPoints: 5,
      existingPoints: 0,
      allowOverCapacity: false
    });
    assert.strictEqual(warning.ok, true, 'Expected warning but ok');
    assert.strictEqual(warning.warning?.code, 'OVER_CAPACITY');
  });

  console.log('milestone governance tests passed');
};

if (!process.env.TEST_API_RUNNER) {
  run();
}
