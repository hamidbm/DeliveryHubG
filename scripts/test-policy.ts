import assert from 'node:assert';
import { runTest, callRoute } from './test-harness';
import { computeMilestoneRollup } from '../src/services/db';
import { getDeliveryPolicy, saveDeliveryPolicy } from '../src/services/policy';
import { evaluateMilestoneReadiness } from '../src/services/milestoneGovernance';

export const run = async () => {
  await runTest('policy', async ({ db, createUser, createBundle, createMilestone, createWorkItem, setAuthToken }) => {
    await db.collection('delivery_policies').deleteMany({});

    const { token } = await createUser({
      name: 'Admin User',
      email: 'admin@policy.local',
      role: 'Admin'
    });
    setAuthToken(token);
    (globalThis as any).__testToken = token;

    const policy = await getDeliveryPolicy();
    assert.ok(policy, 'Expected default policy to be inserted');
    assert.strictEqual(policy._id, 'global');

    const bundle = await createBundle('Policy Bundle');
    const milestone = await createMilestone({
      name: 'Policy M1',
      bundleId: String(bundle._id),
      status: 'COMMITTED',
      startDate: new Date().toISOString(),
      endDate: new Date().toISOString()
    });

    await createWorkItem({
      key: 'POL-1',
      title: 'Missing points',
      bundleId: String(bundle._id),
      milestoneIds: [String(milestone._id)],
      status: 'TODO',
      type: 'STORY'
    });

    const rollup = await computeMilestoneRollup(String(milestone._id));
    assert.ok(rollup?.dataQuality?.score !== undefined, 'Expected data quality score');

    const adjusted = {
      ...policy,
      dataQuality: {
        ...policy.dataQuality,
        weights: { ...policy.dataQuality.weights, missingStoryPoints: 20 }
      }
    };
    await saveDeliveryPolicy(adjusted);
    const rollupAdjusted = await computeMilestoneRollup(String(milestone._id));
    assert.ok((rollupAdjusted?.dataQuality?.score || 0) < (rollup?.dataQuality?.score || 0), 'Expected data quality to drop with higher weight');

    const readiness = await evaluateMilestoneReadiness(rollupAdjusted);
    assert.ok(readiness.score <= 100, 'Expected readiness score to remain valid');

    const { PUT } = await import('../src/app/api/admin/delivery-policy/route');
    const invalid = await callRoute(PUT, 'http://localhost/api/admin/delivery-policy', {
      method: 'PUT',
      body: {
        ...policy,
        forecasting: { ...policy.forecasting, atRiskPct: 2 }
      }
    });
    assert.strictEqual(invalid.status, 400, 'Expected invalid policy update to be rejected');
  });

  console.log('policy tests passed');
};

if (!process.env.TEST_API_RUNNER) {
  run();
}
