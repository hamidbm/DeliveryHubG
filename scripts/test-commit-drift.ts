import assert from 'node:assert';
import { runTest, callRoute } from './test-harness';
import { getDeliveryPolicy, saveDeliveryPolicy } from '../src/services/policy';

export const run = async () => {
  await runTest('commit-drift', async ({ db, createUser, createBundle, createMilestone, createWorkItem, setAuthToken }) => {
    const { user: adminUser, token: adminToken } = await createUser({
      name: 'Admin User',
      email: 'admin@drift.local',
      role: 'Admin'
    });

    const bundle = await createBundle('Drift Bundle');
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
      name: 'Drift M1',
      bundleId,
      status: 'Planned',
      startDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    });

    await createWorkItem({
      key: 'DRIFT-DONE',
      title: 'Velocity seed',
      bundleId,
      type: 'STORY',
      storyPoints: 10,
      status: 'DONE',
      updatedAt: new Date().toISOString()
    });

    await createWorkItem({
      key: 'DRIFT-BASE',
      title: 'Baseline scope',
      bundleId,
      milestoneIds: [String(milestone._id)],
      type: 'STORY',
      storyPoints: 10,
      status: 'TODO'
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
        minHitProbability: 0,
        blockIfP80AfterEndDate: false,
        maxCriticalStale: 10,
        maxHighRisks: 10,
        capacityOvercommitThreshold: 1000,
        drift: {
          enabled: true,
          majorSlipDays: 1,
          majorHitProbDrop: 0.05,
          majorDataQualityDrop: 5,
          majorExternalBlockersIncrease: 1,
          requireReReviewOnMajor: false
        }
      }
    });

    setAuthToken(adminToken);
    (globalThis as any).__testToken = adminToken;
    const { POST: submitCommit } = await import('../src/app/api/milestones/[id]/commit-review/submit/route');
    const { GET: getDrift } = await import('../src/app/api/milestones/[id]/commit-drift/route');

    const commitRes = await callRoute(submitCommit, `http://localhost/api/milestones/${milestone._id}/commit-review/submit`, {
      method: 'POST',
      body: { decision: 'COMMIT' },
      params: { id: String(milestone._id) }
    });
    assert.strictEqual(commitRes.status, 200, 'Expected baseline commit review');

    await createWorkItem({
      key: 'DRIFT-RISK-1',
      title: 'External dependency risk',
      bundleId,
      milestoneIds: [String(milestone._id)],
      type: 'RISK',
      status: 'TODO',
      risk: { severity: 'high', probability: 5, impact: 5 }
    });

    await createWorkItem({
      key: 'DRIFT-RISK-2',
      title: 'Vendor latency risk',
      bundleId,
      milestoneIds: [String(milestone._id)],
      type: 'RISK',
      status: 'TODO',
      risk: { severity: 'high', probability: 5, impact: 5 }
    });

    const driftRes = await callRoute(getDrift, `http://localhost/api/milestones/${milestone._id}/commit-drift`, {
      method: 'GET',
      params: { id: String(milestone._id) }
    });
    const driftBody = await driftRes.json();
    assert.strictEqual(driftBody.enabled, true, 'Expected drift enabled');
    assert.strictEqual(driftBody.drift?.driftBand, 'MAJOR', 'Expected major drift');

    const driftEvent = await db.collection('events').findOne({ type: 'milestones.commitdrift.detected' });
    assert.ok(driftEvent, 'Expected drift detected event');
    const driftNotification = await db.collection('notifications').findOne({ type: 'milestone.commitment.drift' });
    assert.ok(driftNotification, 'Expected drift notification');

    await db.collection('workitems').updateMany(
      { key: { $in: ['DRIFT-RISK-1', 'DRIFT-RISK-2'] } },
      { $set: { status: 'DONE', updatedAt: new Date().toISOString() } }
    );

    const driftRes2 = await callRoute(getDrift, `http://localhost/api/milestones/${milestone._id}/commit-drift`, {
      method: 'GET',
      params: { id: String(milestone._id) }
    });
    const driftBody2 = await driftRes2.json();
    assert.ok(driftBody2.enabled, 'Expected drift enabled');
    assert.notStrictEqual(driftBody2.drift?.driftBand, 'MAJOR', 'Expected drift cleared');

    const clearedEvent = await db.collection('events').findOne({ type: 'milestones.commitdrift.cleared' });
    assert.ok(clearedEvent, 'Expected drift cleared event');
  });

  console.log('commit drift tests passed');
};

if (!process.env.TEST_API_RUNNER) {
  run();
}
