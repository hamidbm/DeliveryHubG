import assert from 'node:assert';
import { ObjectId } from 'mongodb';
import { runTest } from './test-harness';

export const run = async () => {
  await runTest('rollup-warnings', async ({ db }) => {
    await db.collection('milestones').deleteMany({});
    await db.collection('workitems').deleteMany({});

    const milestone = { _id: new ObjectId(), name: 'M1', startDate: new Date().toISOString(), endDate: new Date().toISOString(), status: 'COMMITTED', targetCapacity: 10 };
    await db.collection('milestones').insertOne(milestone);

    await db.collection('workitems').insertOne({
      _id: new ObjectId(),
      key: 'TASK-1',
      title: 'Missing points',
      type: 'TASK',
      status: 'TODO',
      milestoneIds: [String(milestone._id)]
    });

    const { computeMilestoneRollup } = await import('../src/services/db');
    const { GET } = await import('../src/app/api/milestones/rollups/route');
    const rollup = await computeMilestoneRollup(String(milestone._id));
    assert.ok(rollup?.warnings?.some((w) => w.includes('missing storyPoints')), 'Expected storyPoints warning');

    const res = await GET(new Request(`http://localhost/api/milestones/rollups?milestoneIds=${milestone._id}`));
    const apiRollups = await res.json();
    assert.ok(Array.isArray(apiRollups) && apiRollups.length === 1, 'Expected rollups array');
    const apiRollup = apiRollups[0];
    assert.ok(apiRollup.confidence, 'Expected confidence in rollup');
    assert.ok(apiRollup.schedule, 'Expected schedule in rollup');
    assert.ok(Array.isArray(apiRollup.warnings), 'Expected warnings in rollup');
  });

  console.log('rollup warnings tests passed');
};

if (!process.env.TEST_API_RUNNER) {
  run();
}
