import assert from 'node:assert';
import { ObjectId } from 'mongodb';
import { runTest } from './test-harness';
import { computeSprintRollups } from '../src/services/db';

export const run = async () => {
  await runTest('sprint-rollups', async ({ db, createBundle, createMilestone, createWorkItem }) => {
    const bundle = await createBundle('Bundle Sprint');
    const milestone = await createMilestone({
      name: 'M-Sprint',
      bundleId: String(bundle._id),
      status: 'COMMITTED',
      startDate: new Date().toISOString(),
      endDate: new Date().toISOString()
    });

    const sprint = { _id: new ObjectId(), name: 'Sprint 1', status: 'ACTIVE', bundleId: String(bundle._id), startDate: new Date().toISOString(), endDate: new Date().toISOString(), capacityPoints: 10 };
    await db.collection('workitems_sprints').insertOne(sprint);

    await createWorkItem({
      key: 'S-1',
      title: 'Done item',
      type: 'TASK',
      status: 'DONE',
      storyPoints: 5,
      sprintId: String(sprint._id),
      bundleId: String(bundle._id),
      milestoneIds: [String(milestone._id)]
    });
    await createWorkItem({
      key: 'S-2',
      title: 'Open item',
      type: 'TASK',
      status: 'TODO',
      storyPoints: 4,
      sprintId: String(sprint._id),
      bundleId: String(bundle._id),
      milestoneIds: [String(milestone._id)]
    });
    await createWorkItem({
      key: 'R-1',
      title: 'Risk item',
      type: 'RISK',
      status: 'TODO',
      storyPoints: 1,
      sprintId: String(sprint._id),
      bundleId: String(bundle._id),
      milestoneIds: [String(milestone._id)],
      risk: { severity: 'high' }
    });

    const rollups = await computeSprintRollups({ sprintIds: [String(sprint._id)] });
    assert.strictEqual(rollups.length, 1, 'Expected one sprint rollup');
    const rollup = rollups[0];
    assert.strictEqual(rollup.scope.items, 3, 'Expected total items');
    assert.strictEqual(rollup.scope.done, 1, 'Expected done items');
    assert.strictEqual(rollup.capacity.committedPoints, 10, 'Expected committed points');
    assert.strictEqual(rollup.capacity.isOverCapacity, false, 'Expected not over capacity');
    assert.strictEqual(rollup.risks.highCritical, 1, 'Expected high risk count');

    const rollupsFiltered = await computeSprintRollups({ milestoneId: String(milestone._id) });
    assert.ok(rollupsFiltered.length >= 1, 'Expected rollups filtered by milestone');
  });

  console.log('sprint rollups tests passed');
};

if (!process.env.TEST_API_RUNNER) {
  run();
}
