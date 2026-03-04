import assert from 'node:assert';
import { runTest, callRoute } from './test-harness';
import { computeMilestoneRollup } from '../src/services/db';
import { evaluateMilestoneReadiness } from '../src/services/milestoneGovernance';
import { getDefaultDeliveryPolicy, getEffectivePolicyForBundle, getStrictestPolicyForBundles, saveDeliveryPolicy, saveDeliveryPolicyOverride } from '../src/services/policy';

export const run = async () => {
  await runTest('policy-overrides', async ({ db, createUser, createBundle, createMilestone, createWorkItem, setAuthToken }) => {
    await db.collection('delivery_policies').deleteMany({});
    await db.collection('delivery_policy_overrides').deleteMany({});

    const resetPolicy = {
      ...getDefaultDeliveryPolicy(),
      updatedAt: new Date().toISOString(),
      updatedBy: 'system'
    };
    await saveDeliveryPolicy(resetPolicy);

    const { token } = await createUser({
      name: 'Admin User',
      email: 'admin@policy.local',
      role: 'Admin'
    });
    setAuthToken(token);
    (globalThis as any).__testToken = token;

    const bundleA = await createBundle('Policy Bundle A');
    const bundleB = await createBundle('Policy Bundle B');

    const milestone = await createMilestone({
      name: 'Policy Override M1',
      bundleId: String(bundleA._id),
      status: 'COMMITTED',
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    });

    await createWorkItem({
      key: 'PO-1',
      title: 'Missing points A',
      bundleId: String(bundleA._id),
      milestoneIds: [String(milestone._id)],
      status: 'TODO',
      type: 'STORY',
      assignedTo: 'user-a',
      dueAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString()
    });

    await createWorkItem({
      key: 'PO-2',
      title: 'Remaining work A',
      bundleId: String(bundleA._id),
      milestoneIds: [String(milestone._id)],
      status: 'TODO',
      type: 'STORY',
      storyPoints: 8,
      assignedTo: 'user-a',
      dueAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString()
    });

    await createWorkItem({
      key: 'PO-DONE',
      title: 'Done work A',
      bundleId: String(bundleA._id),
      status: 'DONE',
      type: 'STORY',
      storyPoints: 5,
      updatedAt: new Date().toISOString()
    });

    const baseline = await computeMilestoneRollup(String(milestone._id));
    const baselineScore = baseline?.dataQuality?.score ?? 0;
    assert.ok(baselineScore >= 0, 'Expected baseline data quality score');
    assert.strictEqual(baseline?.forecast, null, 'Expected baseline forecast to be null with min sample size');

    await saveDeliveryPolicyOverride(String(bundleA._id), {
      dataQuality: { weights: { missingStoryPoints: 20 } },
      forecasting: { minSampleSize: 1 },
      readiness: { milestone: { warnScoreBelow: 95 } }
    }, 'Admin User');

    const effectiveA = await getEffectivePolicyForBundle(String(bundleA._id));
    assert.strictEqual(
      effectiveA.effective.dataQuality.weights.missingStoryPoints,
      20,
      'Expected bundle override to update effective policy'
    );

    const updatedA = await computeMilestoneRollup(String(milestone._id));
    const updatedScore = updatedA?.dataQuality?.score ?? 0;
    assert.ok(updatedScore < baselineScore, 'Expected data quality score to drop with override weights');
    assert.ok(updatedA?.forecast, 'Expected forecast to be computed with minSampleSize override');
    assert.ok(Array.isArray(updatedA?.policy?.bundleVersions), 'Expected rollup policy bundle versions array');

    const readiness = await evaluateMilestoneReadiness(updatedA, effectiveA.effective);
    assert.ok(readiness.blockers.some((b) => b.key === 'data_quality'), 'Expected readiness to include data quality warning');

    await saveDeliveryPolicyOverride(String(bundleB._id), {
      dataQuality: { weights: { missingStoryPoints: 40 } }
    }, 'Admin User');

    await createWorkItem({
      key: 'PO-3',
      title: 'Missing points B',
      bundleId: String(bundleB._id),
      milestoneIds: [String(milestone._id)],
      status: 'TODO',
      type: 'STORY',
      assignedTo: 'user-b',
      dueAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString()
    });

    const updatedStrict = await computeMilestoneRollup(String(milestone._id));
    const scoreStrict = updatedStrict?.dataQuality?.score ?? 0;
    const strictPolicy = await getStrictestPolicyForBundles([String(bundleA._id), String(bundleB._id)]);
    assert.strictEqual(
      strictPolicy.effective.dataQuality.weights.missingStoryPoints,
      40,
      'Expected strictest policy to apply across bundles'
    );
    assert.ok(scoreStrict <= baselineScore, 'Expected strict policy to not increase data quality score');
    assert.ok(
      updatedStrict?.policy?.bundleVersions?.some((entry: any) => entry.bundleId === String(bundleB._id)),
      'Expected bundle policy version in rollup'
    );

    const before = await getEffectivePolicyForBundle(String(bundleA._id));
    await saveDeliveryPolicyOverride(String(bundleA._id), {
      dataQuality: { weights: { missingStoryPoints: 35 } }
    }, 'Admin User');
    const after = await getEffectivePolicyForBundle(String(bundleA._id));
    assert.notStrictEqual(
      before.effective.dataQuality.weights.missingStoryPoints,
      after.effective.dataQuality.weights.missingStoryPoints,
      'Expected cache invalidation after override update'
    );

    const { GET, PUT } = await import('../src/app/api/admin/bundles/[bundleId]/delivery-policy/route');
    const { token: viewerToken } = await createUser({
      name: 'Viewer User',
      email: 'viewer@policy.local',
      role: 'Engineering'
    });
    setAuthToken(viewerToken);
    (globalThis as any).__testToken = viewerToken;

    const forbiddenGet = await callRoute(GET, 'http://localhost/api/admin/bundles/bundle/delivery-policy', {
      method: 'GET',
      params: { bundleId: String(bundleA._id) }
    });
    assert.strictEqual(forbiddenGet.status, 403, 'Expected non-admin GET to be forbidden');

    const forbiddenPut = await callRoute(PUT, 'http://localhost/api/admin/bundles/bundle/delivery-policy', {
      method: 'PUT',
      params: { bundleId: String(bundleA._id) },
      body: { overrides: { readiness: { milestone: { warnScoreBelow: 90 } } } }
    });
    assert.strictEqual(forbiddenPut.status, 403, 'Expected non-admin PUT to be forbidden');
  });

  console.log('policy override tests passed');
};

if (!process.env.TEST_API_RUNNER) {
  run();
}
