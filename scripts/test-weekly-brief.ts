import assert from 'node:assert';
import { runTest, callRoute } from './test-harness';
import { getDeliveryPolicy, saveDeliveryPolicy } from '../src/services/policy';

export const run = async () => {
  await runTest('weekly-brief', async ({ db, createUser, createBundle, createMilestone, createWorkItem, setAuthToken }) => {
    const { user: adminUser, token: adminToken } = await createUser({
      name: 'Admin User',
      email: 'admin@brief.local',
      role: 'Admin'
    });

    const bundle = await createBundle('Brief Bundle');
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
      name: 'Brief M1',
      bundleId,
      status: 'Planned',
      startDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    });

    await createWorkItem({
      key: 'BRIEF-1',
      title: 'Baseline story',
      bundleId,
      milestoneIds: [String(milestone._id)],
      type: 'STORY',
      storyPoints: 5,
      status: 'TODO'
    });

    await createWorkItem({
      key: 'BRIEF-DONE',
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

    await createWorkItem({
      key: 'BRIEF-ADD',
      title: 'Scope add',
      bundleId,
      milestoneIds: [String(milestone._id)],
      type: 'STORY',
      storyPoints: 13,
      status: 'TODO'
    });

    const { GET: briefGet } = await import('../src/app/api/briefs/weekly/route');
    const briefRes = await callRoute(briefGet, `http://localhost/api/briefs/weekly?scopeType=MILESTONE&scopeId=${milestone._id}`, {
      method: 'GET'
    });
    const briefBody = await briefRes.json();
    assert.ok(briefBody?.brief?.summary?.headline, 'Expected headline');
    assert.ok(String(briefBody.brief.summary.headline).toLowerCase().includes('scope'), 'Expected scope in headline');

    process.env.WEEKLY_BRIEF_CRON_SECRET = 'test-secret';
    const { POST: cronRun } = await import('../src/app/api/admin/briefs/weekly/run/route');
    const cronRes = await cronRun(new Request('http://localhost/api/admin/briefs/weekly/run', {
      method: 'POST',
      headers: { 'x-cron-secret': 'test-secret' }
    }));
    assert.strictEqual(cronRes.status, 200, 'Expected cron run');
    const cronBody = await cronRes.json();
    assert.ok(cronBody?.counts?.program >= 1, 'Expected program brief');
  });

  console.log('weekly brief tests passed');
};

if (!process.env.TEST_API_RUNNER) {
  run();
}
