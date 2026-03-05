import assert from 'node:assert';
import { runTest, callRoute } from './test-harness';
import { getDeliveryPolicy, saveDeliveryPolicy } from '../src/services/policy';

export const run = async () => {
  await runTest('drift-scheduler', async ({ db, createUser, createBundle, createMilestone, createWorkItem, setAuthToken }) => {
    const { user: adminUser, token: adminToken } = await createUser({
      name: 'Admin User',
      email: 'admin@driftcron.local',
      role: 'Admin'
    });

    const bundle = await createBundle('Drift Cron Bundle');
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
      name: 'Cron M1',
      bundleId,
      status: 'COMMITTED',
      startDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    });

    await createWorkItem({
      key: 'CRON-DONE',
      title: 'Velocity seed',
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
        monteCarlo: { ...basePolicy.forecasting.monteCarlo, enabled: true, iterations: 200, minSampleSize: 1 }
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
    const commitRes = await callRoute(submitCommit, `http://localhost/api/milestones/${milestone._id}/commit-review/submit`, {
      method: 'POST',
      body: { decision: 'COMMIT' },
      params: { id: String(milestone._id) }
    });
    assert.strictEqual(commitRes.status, 200, 'Expected baseline commit review');

    await createWorkItem({
      key: 'CRON-RISK-1',
      title: 'Risk spike',
      bundleId,
      milestoneIds: [String(milestone._id)],
      type: 'RISK',
      status: 'TODO',
      risk: { severity: 'high', probability: 5, impact: 5 }
    });

    await createWorkItem({
      key: 'CRON-RISK-2',
      title: 'Risk spike 2',
      bundleId,
      milestoneIds: [String(milestone._id)],
      type: 'RISK',
      status: 'TODO',
      risk: { severity: 'high', probability: 5, impact: 5 }
    });

    process.env.COMMIT_DRIFT_CRON_SECRET = 'test-secret';
    const { POST: runDrift } = await import('../src/app/api/admin/commit-drift/run/route');

    const req = new Request('http://localhost/api/admin/commit-drift/run', {
      method: 'POST',
      headers: { 'x-cron-secret': 'test-secret' }
    });
    const res = await runDrift(req);
    const body = await res.json();
    assert.strictEqual(res.status, 200, 'Expected drift run success');
    assert.ok(body?.counts?.scanned >= 1, 'Expected milestones scanned');
    assert.ok(body?.counts?.notifiedMajor >= 1, 'Expected major drift notifications');

    const snapshot = await db.collection('commitment_drift_snapshots').findOne({ milestoneId: String(milestone._id) });
    assert.ok(snapshot, 'Expected drift snapshot stored');
    assert.strictEqual(snapshot?.driftBand, 'MAJOR', 'Expected drift band MAJOR');

    const second = await runDrift(new Request('http://localhost/api/admin/commit-drift/run', {
      method: 'POST',
      headers: { 'x-cron-secret': 'test-secret' }
    }));
    const secondBody = await second.json();
    assert.ok(secondBody?.skipped, 'Expected idempotent skip');
  });

  console.log('drift scheduler tests passed');
};

if (!process.env.TEST_API_RUNNER) {
  run();
}
