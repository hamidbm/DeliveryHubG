import assert from 'node:assert';
import { ObjectId } from 'mongodb';
import { runTest, callRoute } from './test-harness';
import { GET as GET_PLAN, POST as POST_PLAN } from '../src/app/api/optimize/plan/[planId]/route';
import { GET as GET_PORTFOLIO } from '../src/app/api/optimize/portfolio/route';

export const run = async () => {
  await runTest('optimize-api', async ({ db, createUser, setAuthToken }) => {
    const { user, token } = await createUser({ name: 'Optimize API User', email: 'optimize-api@demo.local', role: 'Admin' });
    setAuthToken(token);

    const previewId = new ObjectId();
    await db.collection('work_plan_previews').insertOne({
      _id: previewId,
      createdAt: new Date().toISOString(),
      createdBy: String(user._id),
      scopeType: 'BUNDLE',
      scopeId: 'bundle-opt-api',
      preview: {
        milestones: [
          { index: 1, name: 'M1', startDate: '2026-05-01T00:00:00.000Z', endDate: '2026-05-14T00:00:00.000Z', targetCapacity: 12 },
          { index: 2, name: 'M2', startDate: '2026-05-15T00:00:00.000Z', endDate: '2026-05-28T00:00:00.000Z', targetCapacity: 28 }
        ],
        artifacts: [
          { milestoneIndex: 1, storyCount: 20 },
          { milestoneIndex: 2, storyCount: 6 }
        ]
      }
    });

    const planId = `preview:${String(previewId)}`;

    const resGet = await callRoute(
      GET_PLAN,
      `http://localhost/api/optimize/plan/${encodeURIComponent(planId)}?maxVariants=2`,
      { method: 'GET', params: { planId } }
    );
    assert.strictEqual((resGet as Response).status, 200);
    const getData = await (resGet as Response).json();
    assert.ok(getData.optimizedVariants?.length);

    const resPost = await callRoute(
      POST_PLAN,
      `http://localhost/api/optimize/plan/${encodeURIComponent(planId)}`,
      {
        method: 'POST',
        params: { planId },
        body: {
          objectiveWeights: { onTime: 0.6, riskReduction: 0.2, capacityBalance: 0.1, slippageMinimization: 0.1 },
          options: { maxVariants: 2 }
        }
      }
    );
    assert.strictEqual((resPost as Response).status, 200);
    const postData = await (resPost as Response).json();
    assert.ok(postData.recommendedVariantId);

    const resPortfolio = await callRoute(
      GET_PORTFOLIO,
      `http://localhost/api/optimize/portfolio?planIds=${encodeURIComponent(planId)}`,
      { method: 'GET' }
    );
    assert.strictEqual((resPortfolio as Response).status, 200);
    const portfolioData = await (resPortfolio as Response).json();
    assert.strictEqual(portfolioData.plansAnalyzed, 1);
  });

  console.log('optimize api tests passed');
};

if (!process.env.TEST_API_RUNNER) {
  run();
}
