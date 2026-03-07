import assert from 'node:assert';
import { runTest, callRoute } from './test-harness';
import { POST } from '../src/app/api/work-items/plan/simulate/route';

export const run = async () => {
  await runTest('simulation-api', async ({ createUser, setAuthToken }) => {
    const { token } = await createUser({ name: 'Sim User', email: 'sim@test.local', role: 'Admin' });
    setAuthToken(token);

    const baselineInput = {
      scopeType: 'PROGRAM',
      scopeId: 'program',
      devStartDate: '2026-01-01T00:00:00.000Z',
      uatStartDate: '2026-01-10T00:00:00.000Z',
      goLiveDate: '2026-02-01T00:00:00.000Z',
      milestoneCount: 2,
      sprintDurationWeeks: 2,
      milestoneDurationStrategy: 'AUTO_DISTRIBUTE',
      deliveryPattern: 'STANDARD_PHASED',
      backlogShape: 'STANDARD'
    };

    const body = {
      baselineInput,
      scenario: {
        name: 'Capacity shift +10',
        overrides: [{ type: 'CAPACITY_SHIFT', params: { deltaCapacity: 10 } }]
      }
    };

    const res = await callRoute(
      POST,
      'http://localhost/api/work-items/plan/simulate',
      { method: 'POST', body }
    );
    assert.strictEqual((res as Response).status, 200);
    const data = await (res as Response).json();
    assert.ok(data.baselinePreview);
    assert.ok(data.scenarioPreview);
    assert.ok(data.comparison?.summary);
  });

  console.log('simulation api tests passed');
};

if (!process.env.TEST_API_RUNNER) {
  run();
}
