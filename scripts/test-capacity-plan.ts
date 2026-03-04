import assert from 'node:assert';
import { runTest, callRoute } from './test-harness';

export const run = async () => {
  await runTest('capacity-plan', async ({ db, createUser, createBundle, createMilestone, createWorkItem, setAuthToken }) => {
    const { user: adminUser, token: adminToken } = await createUser({
      name: 'Admin User',
      email: 'admin@capacity.local',
      role: 'Admin'
    });
    const { user: regularUser, token: regularToken } = await createUser({
      name: 'Engineer User',
      email: 'eng@capacity.local',
      role: 'Engineering'
    });

    const bundleOne = await createBundle('Bundle One');
    const bundleTwo = await createBundle('Bundle Two');
    await db.collection('bundles').updateOne({ _id: bundleTwo._id }, { $set: { visibility: 'PRIVATE' } });

    await db.collection('bundle_capacity').insertMany([
      { _id: String(bundleOne._id), bundleId: String(bundleOne._id), unit: 'POINTS_PER_WEEK', value: 20, updatedAt: new Date().toISOString(), updatedBy: String(adminUser._id) },
      { _id: String(bundleTwo._id), bundleId: String(bundleTwo._id), unit: 'POINTS_PER_WEEK', value: 10, updatedAt: new Date().toISOString(), updatedBy: String(adminUser._id) }
    ]);

    const milestone = await createMilestone({
      name: 'Capacity M1',
      bundleId: String(bundleOne._id),
      status: 'Committed',
      startDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      endDate: new Date(Date.now() + 12 * 24 * 60 * 60 * 1000).toISOString(),
      dueDate: new Date(Date.now() + 12 * 24 * 60 * 60 * 1000).toISOString()
    });
    await createWorkItem({
      key: 'CAP-1',
      title: 'Capacity story',
      bundleId: String(bundleOne._id),
      milestoneIds: [String(milestone._id)],
      type: 'STORY',
      storyPoints: 60,
      status: 'TODO'
    });

    const { GET } = await import('../src/app/api/capacity/plan/route');

    setAuthToken(regularToken);
    (globalThis as any).__testToken = regularToken;
    const res = await callRoute(GET, `http://localhost/api/capacity/plan?bundleIds=${bundleOne._id},${bundleTwo._id}&horizonWeeks=2`, { method: 'GET' });
    assert.strictEqual(res.status, 200, 'Expected capacity plan response');
    const body = await res.json();
    assert.strictEqual(body.bundlePlans.length, 1, 'Expected visibility filter to hide private bundle');
    const plan = body.bundlePlans[0];
    assert.strictEqual(plan.summary.totalDemand, 60, 'Expected total demand');
    assert.strictEqual(plan.buckets.length, 2, 'Expected 2 buckets');
    assert.strictEqual(plan.buckets[0].demandPoints, 30, 'Expected even allocation');
    assert.strictEqual(plan.summary.isOvercommitted, true, 'Expected overcommit flag');

    setAuthToken(adminToken);
    (globalThis as any).__testToken = adminToken;
    const adminRes = await callRoute(GET, `http://localhost/api/capacity/plan?horizonWeeks=2`, { method: 'GET' });
    const adminBody = await adminRes.json();
    assert.strictEqual(adminBody.bundlePlans.length, 2, 'Expected admin to see private bundle');
  });

  console.log('capacity plan tests passed');
};

if (!process.env.TEST_API_RUNNER) {
  run();
}
