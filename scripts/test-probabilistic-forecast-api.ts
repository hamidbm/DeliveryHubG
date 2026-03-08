import assert from 'node:assert';
import { ObjectId } from 'mongodb';
import { runTest, callRoute } from './test-harness';
import { GET as GET_PLAN } from '../src/app/api/probabilistic-forecast/plan/[planId]/route';
import { POST as POST_PORTFOLIO } from '../src/app/api/probabilistic-forecast/portfolio/route';

export const run = async () => {
  await runTest('probabilistic-forecast-api', async ({ db, createUser, setAuthToken }) => {
    const { user, token } = await createUser({ name: 'Prob Forecast User', email: 'prob@demo.local', role: 'Admin' });
    setAuthToken(token);

    const bundle = await db.collection('bundles').insertOne({ name: 'Prob Bundle' });
    const milestoneId = new ObjectId();
    await db.collection('milestones').insertOne({
      _id: milestoneId,
      name: 'Prob M1',
      bundleId: String(bundle.insertedId),
      startDate: '2026-04-01',
      endDate: '2026-04-15',
      targetCapacity: 100
    });

    const workItemId = new ObjectId();
    await db.collection('workitems').insertOne({
      _id: workItemId,
      key: 'P-1',
      title: 'Prob Item',
      milestoneIds: [String(milestoneId)]
    });

    const runId = new ObjectId();
    await db.collection('work_delivery_plan_runs').insertOne({
      _id: runId,
      createdAt: new Date().toISOString(),
      createdBy: String(user._id),
      scopeType: 'BUNDLE',
      scopeId: String(bundle.insertedId),
      milestoneIds: [String(milestoneId)],
      workItemIds: [String(workItemId)]
    });

    const resPlan = await callRoute(
      GET_PLAN,
      `http://localhost/api/probabilistic-forecast/plan/created:${String(runId)}?seed=123&sampleCount=50`,
      { method: 'GET', params: { planId: `created:${String(runId)}` } }
    );
    assert.strictEqual((resPlan as Response).status, 200);
    const planData = await (resPlan as Response).json();
    assert.ok(planData.milestoneForecasts?.length === 1);

    const resPortfolio = await callRoute(
      POST_PORTFOLIO,
      'http://localhost/api/probabilistic-forecast/portfolio',
      { method: 'POST', body: { planIds: [`created:${String(runId)}`], seed: 123, sampleCount: 50 } }
    );
    assert.strictEqual((resPortfolio as Response).status, 200);
    const portfolioData = await (resPortfolio as Response).json();
    assert.ok(portfolioData.portfolioSummary);
  });

  console.log('probabilistic forecast api tests passed');
};

if (!process.env.TEST_API_RUNNER) {
  run();
}
