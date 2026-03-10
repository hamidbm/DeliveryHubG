import assert from 'node:assert';
import { ObjectId } from 'mongodb';
import { runTest } from './test-harness';
import { optimizePlan, optimizePortfolio } from '../src/services/optimizationEngine';

export const run = async () => {
  await runTest('optimization-engine', async ({ db, createUser }) => {
    const { user } = await createUser({ name: 'Opt Admin', email: 'opt-engine@demo.local', role: 'Admin' });

    const previewId = new ObjectId();
    await db.collection('work_plan_previews').insertOne({
      _id: previewId,
      createdAt: new Date().toISOString(),
      createdBy: String(user._id),
      scopeType: 'BUNDLE',
      scopeId: 'bundle-opt',
      preview: {
        milestones: [
          { index: 1, name: 'M1', startDate: '2026-04-01T00:00:00.000Z', endDate: '2026-04-14T00:00:00.000Z', targetCapacity: 10 },
          { index: 2, name: 'M2', startDate: '2026-04-15T00:00:00.000Z', endDate: '2026-04-28T00:00:00.000Z', targetCapacity: 30 }
        ],
        artifacts: [
          { milestoneIndex: 1, storyCount: 18 },
          { milestoneIndex: 2, storyCount: 8 }
        ]
      }
    });

    const result = await optimizePlan(`preview:${String(previewId)}`, { userId: String(user._id), role: 'Admin' }, {
      constraints: { noChangeBeforeDate: '2026-03-20', environmentBounds: true },
      options: { maxVariants: 3 }
    });

    assert.ok(result, 'Expected optimization result');
    assert.ok(result?.optimizedVariants.length, 'Expected one or more variants');
    assert.ok(result?.baselinePlan.summary.onTimeProbability >= 0 && result!.baselinePlan.summary.onTimeProbability <= 1);

    const portfolio = await optimizePortfolio([`preview:${String(previewId)}`], { userId: String(user._id), role: 'Admin' }, {
      options: { maxVariants: 2 }
    });

    assert.strictEqual(portfolio.plansAnalyzed, 1);
    assert.strictEqual(portfolio.planSummaries.length, 1);
  });

  console.log('optimization engine tests passed');
};

if (!process.env.TEST_API_RUNNER) {
  run();
}
