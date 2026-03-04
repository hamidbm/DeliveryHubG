import assert from 'node:assert';
import { ObjectId } from 'mongodb';
import { runTest } from './test-harness';

export const run = async () => {
  await runTest('roadmap-intel', async ({ db }) => {
    await db.collection('milestones').deleteMany({});
    await db.collection('workitems').deleteMany({});

    const m1 = { _id: new ObjectId(), name: 'M1', startDate: new Date().toISOString(), endDate: new Date().toISOString(), status: 'COMMITTED', targetCapacity: 10 };
    const m2 = { _id: new ObjectId(), name: 'M2', startDate: new Date().toISOString(), endDate: new Date().toISOString(), status: 'COMMITTED', targetCapacity: 10 };
    await db.collection('milestones').insertMany([m1, m2]);

    const blockerId = new ObjectId();
    const blockedId = new ObjectId();
    const riskId = new ObjectId();

    await db.collection('workitems').insertMany([
      {
        _id: blockerId,
        key: 'BLK-1',
        title: 'Blocker Item',
        type: 'TASK',
        status: 'IN_PROGRESS',
        storyPoints: 5,
        milestoneIds: [String(m1._id)],
        links: [{ type: 'BLOCKS', targetId: String(blockedId), targetKey: 'BLD-1', targetTitle: 'Blocked Item' }]
      },
      {
        _id: blockedId,
        key: 'BLD-1',
        title: 'Blocked Item',
        type: 'TASK',
        status: 'TODO',
        storyPoints: 3,
        milestoneIds: [String(m2._id)],
        links: []
      },
      {
        _id: riskId,
        key: 'RSK-1',
        title: 'High Risk',
        type: 'RISK',
        status: 'TODO',
        storyPoints: 2,
        milestoneIds: [String(m1._id)],
        risk: { probability: 4, impact: 4, severity: 'high' }
      }
    ]);

    const { GET } = await import('../src/app/api/work-items/roadmap-intel/route');
    const { GET: GET_LISTS } = await import('../src/app/api/work-items/roadmap-intel/lists/route');

    const req = new Request(`http://localhost/api/work-items/roadmap-intel?milestoneIds=${m1._id.toString()},${m2._id.toString()}`);
    const res = await GET(req);
    const body = await res.json();

    assert.ok(body.milestones.length === 2, 'Expected two milestones in response');
    const m1Entry = body.milestones.find((e: any) => String(e.milestone._id || e.milestone.id || e.milestone.name) === String(m1._id || m1.name));
    const m2Entry = body.milestones.find((e: any) => String(e.milestone._id || e.milestone.id || e.milestone.name) === String(m2._id || m2.name));

    assert.ok(m1Entry.readiness, 'Expected readiness for M1');
    assert.ok(m1Entry.listCounts, 'Expected listCounts in M1');
    assert.strictEqual(m1Entry.lists, undefined, 'Expected lists omitted when includeLists=false');
    assert.ok(m1Entry.listCounts.highRisksCount === 1, 'Expected high risk count in M1');
    assert.ok(m2Entry.listCounts.blockedItemsCount === 1, 'Expected blocked count in M2');
    assert.ok(m1Entry.listCounts.crossMilestoneBlocksCount === 1, 'Expected cross milestone block count');

    const listsReq = new Request(`http://localhost/api/work-items/roadmap-intel/lists?milestoneId=${m1._id.toString()}`);
    const listsRes = await GET_LISTS(listsReq);
    const listsBody = await listsRes.json();
    assert.ok(listsBody.lists.highRisks.length === 1, 'Expected high risk list in M1');
  });

  console.log('roadmap intel tests passed');
};

if (!process.env.TEST_API_RUNNER) {
  run();
}
