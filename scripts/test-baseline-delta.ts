import assert from 'node:assert';
import { runTest, callRoute } from './test-harness';
import { getDeliveryPolicy, saveDeliveryPolicy } from '../src/services/policy';

export const run = async () => {
  await runTest('baseline-delta', async ({ db, createUser, createBundle, createMilestone, createWorkItem, setAuthToken }) => {
    const { user: adminUser, token: adminToken } = await createUser({
      name: 'Admin User',
      email: 'admin@baseline.local',
      role: 'Admin'
    });

    const bundle = await createBundle('Baseline Bundle');
    const bundleId = String(bundle._id);

    await db.collection('bundle_capacity').insertOne({
      _id: bundleId,
      bundleId,
      unit: 'POINTS_PER_WEEK',
      value: 10,
      updatedAt: new Date().toISOString(),
      updatedBy: String(adminUser._id)
    });

    const milestone = await createMilestone({
      name: 'Baseline M1',
      bundleId,
      status: 'Planned',
      startDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    });

    await createWorkItem({
      key: 'BASE-1',
      title: 'Baseline story 1',
      bundleId,
      milestoneIds: [String(milestone._id)],
      type: 'STORY',
      storyPoints: 5,
      status: 'TODO'
    });

    const removable = await createWorkItem({
      key: 'BASE-2',
      title: 'Baseline story 2',
      bundleId,
      milestoneIds: [String(milestone._id)],
      type: 'STORY',
      storyPoints: 8,
      status: 'TODO'
    });

    await createWorkItem({
      key: 'BASE-DONE',
      title: 'Velocity seed',
      bundleId,
      type: 'STORY',
      storyPoints: 8,
      status: 'DONE',
      updatedAt: new Date().toISOString()
    });

    const basePolicy = await getDeliveryPolicy();
    await saveDeliveryPolicy({
      ...basePolicy,
      forecasting: {
        ...basePolicy.forecasting,
        monteCarlo: { ...basePolicy.forecasting.monteCarlo, enabled: true, iterations: 200, minSampleSize: 1 }
      },
      commitReview: {
        ...basePolicy.commitReview,
        enabled: true,
        minHitProbability: 0,
        blockIfP80AfterEndDate: false,
        maxCriticalStale: 10,
        maxHighRisks: 10,
        capacityOvercommitThreshold: 1000
      }
    });

    setAuthToken(adminToken);
    (globalThis as any).__testToken = adminToken;
    const { POST: submitCommit } = await import('../src/app/api/milestones/[id]/commit-review/submit/route');
    const commitRes = await callRoute(submitCommit, `http://localhost/api/milestones/${milestone._id}/commit-review/submit`, {
      method: 'POST',
      body: { decision: 'COMMIT' },
      params: { id: String(milestone._id) }
    });
    assert.strictEqual(commitRes.status, 200, 'Expected commit review success');

    const baselineDoc = await db.collection('milestone_baselines').findOne({ milestoneId: String(milestone._id) });
    assert.ok(baselineDoc, 'Expected baseline created');

    await createWorkItem({
      key: 'BASE-ADD',
      title: 'Added story',
      bundleId,
      milestoneIds: [String(milestone._id)],
      type: 'STORY',
      storyPoints: 13,
      status: 'TODO'
    });

    await db.collection('workitems').updateOne(
      { _id: removable._id },
      { $set: { milestoneIds: [], updatedAt: new Date().toISOString() } }
    );

    await db.collection('workitems').updateOne(
      { key: 'BASE-1' },
      { $set: { storyPoints: 11, updatedAt: new Date().toISOString() } }
    );

    const { GET: deltaGet } = await import('../src/app/api/milestones/[id]/baseline/delta/route');
    const deltaRes = await callRoute(deltaGet, `http://localhost/api/milestones/${milestone._id}/baseline/delta`, {
      method: 'GET',
      params: { id: String(milestone._id) }
    });
    const deltaBody = await deltaRes.json();
    assert.ok(deltaBody?.delta, 'Expected delta response');
    assert.ok(deltaBody.delta.added.count >= 1, 'Expected added items');
    assert.ok(deltaBody.delta.removed.count >= 1, 'Expected removed items');
    assert.ok(deltaBody.delta.estimateChanges.count >= 1, 'Expected estimate changes');

    const { GET: driftGet } = await import('../src/app/api/milestones/[id]/commit-drift/route');
    const driftRes = await callRoute(driftGet, `http://localhost/api/milestones/${milestone._id}/commit-drift`, {
      method: 'GET',
      params: { id: String(milestone._id) }
    });
    const driftBody = await driftRes.json();
    const scopeDelta = driftBody?.drift?.deltas?.find((d: any) => d.key === 'scopeDelta');
    assert.ok(scopeDelta, 'Expected scope delta in drift');
  });

  console.log('baseline delta tests passed');
};

if (!process.env.TEST_API_RUNNER) {
  run();
}
