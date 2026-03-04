import assert from 'node:assert';
import { ObjectId } from 'mongodb';
import { runTest, callRoute } from './test-harness';

export const run = async () => {
  await runTest('burnup', async ({ db, createBundle, createMilestone, createWorkItem }) => {
    const bundle = await createBundle('Burnup Bundle');
    const milestone = await createMilestone({
      name: 'Burnup M1',
      bundleId: String(bundle._id),
      status: 'COMMITTED',
      startDate: new Date('2025-01-01').toISOString(),
      endDate: new Date('2025-02-28').toISOString()
    });

    const sprint1Id = new ObjectId();
    const sprint2Id = new ObjectId();
    await db.collection('workitems_sprints').insertMany([
      {
        _id: sprint1Id,
        name: 'Sprint 1',
        status: 'CLOSED',
        bundleId: String(bundle._id),
        startDate: new Date('2025-01-01').toISOString(),
        endDate: new Date('2025-01-14').toISOString()
      },
      {
        _id: sprint2Id,
        name: 'Sprint 2',
        status: 'CLOSED',
        bundleId: String(bundle._id),
        startDate: new Date('2025-01-15').toISOString(),
        endDate: new Date('2025-01-28').toISOString()
      }
    ]);

    await createWorkItem({
      key: 'B-1',
      title: 'Done in sprint 1',
      bundleId: String(bundle._id),
      milestoneIds: [String(milestone._id)],
      status: 'DONE',
      storyPoints: 3,
      completedAt: new Date('2025-01-10').toISOString()
    });

    await createWorkItem({
      key: 'B-2',
      title: 'Done in sprint 2',
      bundleId: String(bundle._id),
      milestoneIds: [String(milestone._id)],
      status: 'DONE',
      storyPoints: 5,
      completedAt: new Date('2025-01-20').toISOString()
    });

    await createWorkItem({
      key: 'B-3',
      title: 'Open item',
      bundleId: String(bundle._id),
      milestoneIds: [String(milestone._id)],
      status: 'TODO',
      storyPoints: 4
    });

    const { GET: GET_BURNUP } = await import('../src/app/api/milestones/[id]/burnup/route');
    const res = await callRoute(GET_BURNUP, 'http://localhost/api/milestones/burnup', {
      method: 'GET',
      params: { id: String(milestone._id) }
    });
    assert.strictEqual(res.status, 200, 'Expected burnup response');
    const body = await res.json();
    assert.strictEqual(body.milestoneId, String(milestone._id));
    assert.strictEqual(body.scope.committedPoints, 12);
    assert.strictEqual(body.scope.completedPoints, 8);
    assert.strictEqual(body.scope.remainingPoints, 4);

    assert.strictEqual(body.sprints.length, 2);
    assert.strictEqual(body.sprints[0].completedPoints, 3);
    assert.strictEqual(body.sprints[0].cumulativeCompletedPoints, 3);
    assert.strictEqual(body.sprints[0].remainingPoints, 9);
    assert.strictEqual(body.sprints[1].completedPoints, 5);
    assert.strictEqual(body.sprints[1].cumulativeCompletedPoints, 8);
    assert.strictEqual(body.sprints[1].remainingPoints, 4);
  });

  console.log('burnup tests passed');
};

if (!process.env.TEST_API_RUNNER) {
  run();
}
