import assert from 'node:assert';
import { runTest, callRoute } from './test-harness';
import { getDeliveryPolicy, saveDeliveryPolicy } from '../src/services/policy';

export const run = async () => {
  await runTest('commit-review', async ({ db, createUser, createBundle, createMilestone, createWorkItem, setAuthToken }) => {
    const { user: adminUser, token: adminToken } = await createUser({
      name: 'Admin User',
      email: 'admin@commit.local',
      role: 'Admin'
    });

    const bundle = await createBundle('Commit Bundle');
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
      name: 'Commit M1',
      bundleId,
      status: 'Planned',
      startDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    });

    await createWorkItem({
      key: 'COM-1',
      title: 'Commit story',
      bundleId,
      milestoneIds: [String(milestone._id)],
      type: 'STORY',
      storyPoints: 60,
      status: 'TODO'
    });

    await createWorkItem({
      key: 'COM-DONE',
      title: 'Velocity sample',
      bundleId,
      type: 'STORY',
      storyPoints: 10,
      status: 'DONE',
      updatedAt: new Date().toISOString()
    });

    const basePolicy = await getDeliveryPolicy();
    await saveDeliveryPolicy({
      ...basePolicy,
      forecasting: {
        ...basePolicy.forecasting,
        monteCarlo: {
          ...basePolicy.forecasting.monteCarlo,
          enabled: true,
          iterations: 200,
          minSampleSize: 1
        }
      },
      commitReview: {
        ...basePolicy.commitReview,
        enabled: true,
        minHitProbability: 0.9,
        blockIfP80AfterEndDate: true,
        blockOnExternalBlockers: false,
        maxCriticalStale: 10,
        maxHighRisks: 10,
        capacityOvercommitThreshold: 1000
      }
    });

    setAuthToken(adminToken);
    (globalThis as any).__testToken = adminToken;
    const { GET } = await import('../src/app/api/milestones/[id]/commit-review/route');
    const { POST } = await import('../src/app/api/milestones/[id]/commit-review/submit/route');

    const reviewRes = await callRoute(GET, `http://localhost/api/milestones/${milestone._id}/commit-review`, {
      method: 'GET',
      params: { id: String(milestone._id) }
    });
    const reviewBody = await reviewRes.json();
    assert.strictEqual(reviewBody.enabled, true, 'Expected commit review enabled');
    assert.strictEqual(reviewBody.review.canCommit, false, 'Expected commit blocked');

    const failRes = await callRoute(POST, `http://localhost/api/milestones/${milestone._id}/commit-review/submit`, {
      method: 'POST',
      body: { decision: 'COMMIT' },
      params: { id: String(milestone._id) }
    });
    assert.strictEqual(failRes.status, 409, 'Expected commit review failure');
    const failEvent = await db.collection('events').findOne({ type: 'milestones.commitreview.failed' });
    assert.ok(failEvent, 'Expected failed commit review event');

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

    const passRes = await callRoute(POST, `http://localhost/api/milestones/${milestone._id}/commit-review/submit`, {
      method: 'POST',
      body: { decision: 'COMMIT' },
      params: { id: String(milestone._id) }
    });
    assert.strictEqual(passRes.status, 200, 'Expected commit success');
    const passEvent = await db.collection('events').findOne({ type: 'milestones.commitreview.passed' });
    assert.ok(passEvent, 'Expected passed commit review event');

    const stored = await db.collection('commitment_reviews').findOne({ milestoneId: String(milestone._id) });
    assert.ok(stored, 'Expected commitment review persisted');

    const overrideMilestone = await createMilestone({
      name: 'Commit M2',
      bundleId,
      status: 'Planned',
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
      dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString()
    });

    await saveDeliveryPolicy({
      ...basePolicy,
      forecasting: {
        ...basePolicy.forecasting,
        monteCarlo: { ...basePolicy.forecasting.monteCarlo, enabled: true, iterations: 200, minSampleSize: 1 }
      },
      commitReview: {
        ...basePolicy.commitReview,
        enabled: true,
        minHitProbability: 0.9,
        blockIfP80AfterEndDate: true,
        maxCriticalStale: 10,
        maxHighRisks: 10,
        capacityOvercommitThreshold: 1000
      }
    });

    const overrideRes = await callRoute(POST, `http://localhost/api/milestones/${overrideMilestone._id}/commit-review/submit`, {
      method: 'POST',
      body: { decision: 'OVERRIDE', overrideReason: 'Board override' },
      params: { id: String(overrideMilestone._id) }
    });
    assert.strictEqual(overrideRes.status, 200, 'Expected override success');
    const overrideEvent = await db.collection('events').findOne({ type: 'milestones.commitreview.overridden' });
    assert.ok(overrideEvent, 'Expected override event');

    const overrideStored = await db.collection('commitment_reviews').findOne({ milestoneId: String(overrideMilestone._id), result: 'OVERRIDDEN' });
    assert.ok(overrideStored, 'Expected override persisted');
  });

  console.log('commit review tests passed');
};

if (!process.env.TEST_API_RUNNER) {
  run();
}
