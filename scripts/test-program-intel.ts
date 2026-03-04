import assert from 'node:assert';
import { ObjectId } from 'mongodb';
import { runTest } from './test-harness';

export const run = async () => {
  await runTest('program-intel', async ({ db }) => {
    await db.collection('bundles').deleteMany({});
    await db.collection('milestones').deleteMany({});
    await db.collection('workitems').deleteMany({});

    const bundle1 = { _id: new ObjectId(), name: 'Bundle A' };
    const bundle2 = { _id: new ObjectId(), name: 'Bundle B' };
    await db.collection('bundles').insertMany([bundle1, bundle2]);

    const m1 = { _id: new ObjectId(), name: 'M1', bundleId: String(bundle1._id), startDate: new Date().toISOString(), endDate: new Date().toISOString(), status: 'COMMITTED', targetCapacity: 10 };
    const m2 = { _id: new ObjectId(), name: 'M2', bundleId: String(bundle2._id), startDate: new Date().toISOString(), endDate: new Date().toISOString(), status: 'COMMITTED', targetCapacity: 10 };
    await db.collection('milestones').insertMany([m1, m2]);

    await db.collection('workitems').insertMany([
      { _id: new ObjectId(), key: 'A-1', title: 'Bundle A work', type: 'TASK', status: 'TODO', storyPoints: 3, bundleId: String(bundle1._id), milestoneIds: [String(m1._id)] },
      { _id: new ObjectId(), key: 'B-1', title: 'Bundle B work', type: 'TASK', status: 'TODO', storyPoints: 5, bundleId: String(bundle2._id), milestoneIds: [String(m2._id)] }
    ]);

    const { GET } = await import('../src/app/api/program/intel/route');
    const req = new Request(`http://localhost/api/program/intel?bundleIds=${bundle1._id.toString()}&includeLists=false`);
    const res = await GET(req);
    const body = await res.json();

    assert.ok(body.bundleRollups.length === 1, 'Expected one bundle rollup');
    assert.ok(String(body.bundleRollups[0].bundleId) === String(bundle1._id), 'Expected bundle rollup to match bundleId');
    assert.ok(body.bundleRollups[0].aggregated, 'Expected aggregated rollup');
    assert.ok(body.bundleRollups[0].band, 'Expected band on bundle rollup');
    assert.ok(body.listCounts, 'Expected listCounts present');
  });

  console.log('program intel tests passed');
};

if (!process.env.TEST_API_RUNNER) {
  run();
}
