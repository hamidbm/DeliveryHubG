import assert from 'node:assert';
import { ObjectId } from 'mongodb';
import { runTest } from './test-harness';
import { listPortfolioPlans, comparePortfolioPlans, getPortfolioOverview } from '../src/services/portfolioAnalytics';

export const run = async () => {
  await runTest('portfolio-analytics', async ({ db, createUser }) => {
    const { user } = await createUser({ name: 'Portfolio Admin', email: 'portfolio@demo.local', role: 'Admin' });

    const bundle = await db.collection('bundles').insertOne({ name: 'Bundle Alpha' });
    const milestoneA = new ObjectId();
    const milestoneB = new ObjectId();
    await db.collection('milestones').insertMany([
      { _id: milestoneA, name: 'M1', bundleId: String(bundle.insertedId), startDate: '2026-01-01', endDate: '2026-01-10', targetCapacity: 100 },
      { _id: milestoneB, name: 'M2', bundleId: String(bundle.insertedId), startDate: '2026-01-11', endDate: '2026-01-20', targetCapacity: 100 }
    ]);

    const itemA = new ObjectId();
    const itemB = new ObjectId();
    await db.collection('workitems').insertMany([
      { _id: itemA, key: 'A-1', title: 'Item A', milestoneIds: [String(milestoneA)], links: [{ type: 'BLOCKS', targetId: String(itemB) }] },
      { _id: itemB, key: 'B-1', title: 'Item B', milestoneIds: [String(milestoneB)] }
    ]);

    const runId = new ObjectId();
    await db.collection('work_delivery_plan_runs').insertOne({
      _id: runId,
      createdAt: new Date().toISOString(),
      createdBy: String(user._id),
      scopeType: 'BUNDLE',
      scopeId: String(bundle.insertedId),
      milestoneIds: [String(milestoneA), String(milestoneB)],
      workItemIds: [String(itemA), String(itemB)]
    });

    await db.collection('work_plan_previews').insertOne({
      _id: new ObjectId(),
      createdAt: new Date().toISOString(),
      createdBy: String(user._id),
      scopeType: 'BUNDLE',
      scopeId: 'preview-bundle',
      input: { scopeType: 'BUNDLE', scopeId: 'preview-bundle' },
      preview: {
        previewId: 'preview-1',
        counts: { roadmapPhases: 0, milestones: 1, sprints: 0, epics: 0, features: 0, stories: 0, tasks: 0 },
        roadmap: [],
        milestones: [{ index: 1, name: 'Preview M1', startDate: '2026-02-01', endDate: '2026-02-10', themes: [], sprintCount: 0, targetCapacity: 80 }],
        sprints: [],
        artifacts: [{ milestoneIndex: 1, epicCount: 0, featureCount: 0, storyCount: 40, taskCount: 0, epics: [] }],
        warnings: [],
        assumptions: []
      },
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
    });

    const plans = await listPortfolioPlans({ userId: String(user._id), role: user.role });
    assert.ok(plans.length >= 1);

    const overview = await getPortfolioOverview({ userId: String(user._id), role: user.role });
    assert.strictEqual(overview.totalPlans, plans.length);

    const compare = await comparePortfolioPlans([`created:${String(runId)}`], { userId: String(user._id), role: user.role });
    assert.strictEqual(compare.plans.length, 1);
    assert.ok(compare.dependencies.length >= 1);
  });

  console.log('portfolio analytics tests passed');
};

if (!process.env.TEST_API_RUNNER) {
  run();
}
