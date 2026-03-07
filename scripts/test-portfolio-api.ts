import assert from 'node:assert';
import { ObjectId } from 'mongodb';
import { runTest, callRoute } from './test-harness';
import { GET as GET_PLANS } from '../src/app/api/portfolio/plans/route';
import { GET as GET_OVERVIEW } from '../src/app/api/portfolio/overview/route';
import { POST as POST_COMPARE } from '../src/app/api/portfolio/compare/route';

export const run = async () => {
  await runTest('portfolio-api', async ({ db, createUser, setAuthToken }) => {
    const { user, token } = await createUser({ name: 'Portfolio Admin', email: 'portfolio-api@demo.local', role: 'Admin' });
    setAuthToken(token);

    const bundle = await db.collection('bundles').insertOne({ name: 'Bundle Beta' });
    const milestone = new ObjectId();
    await db.collection('milestones').insertOne({
      _id: milestone,
      name: 'M1',
      bundleId: String(bundle.insertedId),
      startDate: '2026-03-01',
      endDate: '2026-03-10',
      targetCapacity: 120
    });

    const item = new ObjectId();
    await db.collection('workitems').insertOne({
      _id: item,
      key: 'B-1',
      title: 'Item B',
      milestoneIds: [String(milestone)]
    });

    const runId = new ObjectId();
    await db.collection('work_delivery_plan_runs').insertOne({
      _id: runId,
      createdAt: new Date().toISOString(),
      createdBy: String(user._id),
      scopeType: 'BUNDLE',
      scopeId: String(bundle.insertedId),
      milestoneIds: [String(milestone)],
      workItemIds: [String(item)]
    });

    const resPlans = await callRoute(GET_PLANS, 'http://localhost/api/portfolio/plans', { method: 'GET' });
    assert.strictEqual((resPlans as Response).status, 200);
    const plansData = await (resPlans as Response).json();
    assert.ok(Array.isArray(plansData.plans));

    const resOverview = await callRoute(GET_OVERVIEW, 'http://localhost/api/portfolio/overview', { method: 'GET' });
    assert.strictEqual((resOverview as Response).status, 200);

    const resCompare = await callRoute(
      POST_COMPARE,
      'http://localhost/api/portfolio/compare',
      { method: 'POST', body: { planIds: [`created:${String(runId)}`] } }
    );
    assert.strictEqual((resCompare as Response).status, 200);
    const compareData = await (resCompare as Response).json();
    assert.ok(compareData.plans?.length === 1);
  });

  console.log('portfolio api tests passed');
};

if (!process.env.TEST_API_RUNNER) {
  run();
}
