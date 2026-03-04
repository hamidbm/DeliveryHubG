import assert from 'node:assert';
import { ObjectId } from 'mongodb';
import { runTest } from './test-harness';
import { computeBundleVelocity } from '../src/services/forecasting';
import { computeMilestoneRollups } from '../src/services/db';

export const run = async () => {
  await runTest('forecasting', async ({ db, createBundle, createMilestone, createWorkItem }) => {
    const bundle = await createBundle('Bundle Forecast');

    const sprintA = { _id: new ObjectId(), name: 'Sprint A', status: 'CLOSED', bundleId: String(bundle._id), startDate: new Date().toISOString(), endDate: new Date().toISOString() };
    const sprintB = { _id: new ObjectId(), name: 'Sprint B', status: 'CLOSED', bundleId: String(bundle._id), startDate: new Date().toISOString(), endDate: new Date().toISOString() };
    await db.collection('workitems_sprints').insertMany([sprintA, sprintB]);

    const milestone = await createMilestone({
      name: 'M-Forecast',
      bundleId: String(bundle._id),
      status: 'COMMITTED',
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      targetCapacity: 20
    });

    await createWorkItem({
      key: 'F-1',
      title: 'Done 1',
      type: 'TASK',
      status: 'DONE',
      storyPoints: 5,
      bundleId: String(bundle._id),
      sprintId: String(sprintA._id),
      milestoneIds: [String(milestone._id)]
    });
    await createWorkItem({
      key: 'F-2',
      title: 'Done 2',
      type: 'TASK',
      status: 'DONE',
      storyPoints: 3,
      bundleId: String(bundle._id),
      sprintId: String(sprintA._id),
      milestoneIds: [String(milestone._id)]
    });
    await createWorkItem({
      key: 'F-3',
      title: 'Done 3',
      type: 'TASK',
      status: 'DONE',
      storyPoints: 8,
      bundleId: String(bundle._id),
      sprintId: String(sprintB._id),
      milestoneIds: [String(milestone._id)]
    });

    await createWorkItem({
      key: 'F-4',
      title: 'Open 1',
      type: 'TASK',
      status: 'TODO',
      storyPoints: 10,
      bundleId: String(bundle._id),
      milestoneIds: [String(milestone._id)]
    });

    const velocity = await computeBundleVelocity(String(bundle._id), 2);
    assert.ok(velocity.avgVelocityPoints > 0, 'Expected velocity points');
    assert.ok(velocity.sampleSize >= 3, 'Expected velocity sample size');

    const [rollup] = await computeMilestoneRollups([String(milestone._id)]);
    assert.ok(rollup?.forecast?.estimatedCompletionDate, 'Expected forecast on rollup');
    const forecastDate = new Date(rollup.forecast.estimatedCompletionDate);
    assert.ok(forecastDate.getTime() > Date.now(), 'Expected forecast date in future');
    assert.ok(['on-track', 'at-risk', 'off-track'].includes(rollup.forecast.band), 'Expected forecast band');
  });

  console.log('forecasting tests passed');
};

if (!process.env.TEST_API_RUNNER) {
  run();
}
