import assert from 'node:assert';
import { ObjectId } from 'mongodb';
import { runTest, callRoute } from './test-harness';
import { computeMilestoneCriticalPath } from '../src/services/criticalPath';

export const run = async () => {
  await runTest('critical-path', async ({ db, createUser, createBundle, createMilestone, createWorkItem, setAuthToken }) => {
    const { user, token } = await createUser({
      name: 'Admin User',
      email: 'admin@critical.local',
      role: 'Admin'
    });
    setAuthToken(token);
    (globalThis as any).__testToken = token;

    const bundle = await createBundle('Critical Bundle');
    const milestone = await createMilestone({
      name: 'Critical M1',
      bundleId: String(bundle._id),
      status: 'COMMITTED',
      startDate: new Date().toISOString(),
      endDate: new Date().toISOString()
    });

    const aId = new ObjectId();
    const bId = new ObjectId();
    const cId = new ObjectId();
    const dId = new ObjectId();

    await db.collection('workitems').insertMany([
      {
        _id: aId,
        key: 'CP-1',
        title: 'Missing estimate blocker',
        status: 'TODO',
        type: 'STORY',
        milestoneIds: [String(milestone._id)],
        links: [{ type: 'BLOCKS', targetId: String(bId) }]
      },
      {
        _id: bId,
        key: 'CP-2',
        title: 'Blocked critical item',
        status: 'BLOCKED',
        type: 'STORY',
        storyPoints: 5,
        milestoneIds: [String(milestone._id)],
        links: [{ type: 'BLOCKS', targetId: String(cId) }]
      },
      {
        _id: cId,
        key: 'CP-3',
        title: 'Downstream work',
        status: 'TODO',
        type: 'STORY',
        storyPoints: 2,
        milestoneIds: [String(milestone._id)],
        links: []
      },
      {
        _id: dId,
        key: 'CP-4',
        title: 'Side work',
        status: 'TODO',
        type: 'STORY',
        storyPoints: 6,
        milestoneIds: [String(milestone._id)],
        links: []
      }
    ]);

    const result = await computeMilestoneCriticalPath(String(milestone._id));
    assert.ok(result, 'Expected critical path result');
    assert.strictEqual(result?.criticalPath?.remainingPoints, 7, 'Expected critical path remaining points');
    const criticalKeys = (result?.criticalPath?.nodes || []).map((n) => n.key);
    assert.deepStrictEqual(criticalKeys, ['CP-1', 'CP-2', 'CP-3'], 'Expected critical path nodes in order');
    const actionTypes = (result?.topActions || []).map((a) => a.type);
    assert.ok(actionTypes.includes('UNBLOCK'), 'Expected UNBLOCK action');
    assert.ok(actionTypes.includes('SET_ESTIMATE'), 'Expected SET_ESTIMATE action');
    assert.ok(actionTypes.includes('REQUEST_ESTIMATE'), 'Expected REQUEST_ESTIMATE action');

    const { GET } = await import('../src/app/api/milestones/[id]/critical-path/route');
    const apiRes = await callRoute(GET, `http://localhost/api/milestones/${milestone._id}/critical-path?includeGraph=true`, {
      method: 'GET',
      params: { id: String(milestone._id) }
    });
    assert.strictEqual(apiRes.status, 200, 'Expected critical path API to succeed');
    const apiBody = await apiRes.json();
    assert.ok(Array.isArray(apiBody.nodes), 'Expected nodes in critical path response');
    assert.ok(Array.isArray(apiBody.edges), 'Expected edges in critical path response');

    const externalMilestone = await createMilestone({
      name: 'Critical External',
      bundleId: String(bundle._id),
      status: 'COMMITTED',
      startDate: new Date().toISOString(),
      endDate: new Date().toISOString()
    });

    const eId = new ObjectId();
    const fId = new ObjectId();
    await db.collection('workitems').insertMany([
      {
        _id: eId,
        key: 'CP-E',
        title: 'External blocker',
        status: 'TODO',
        type: 'STORY',
        storyPoints: 4,
        bundleId: String(bundle._id),
        milestoneIds: [String(externalMilestone._id)],
        links: [{ type: 'BLOCKS', targetId: String(aId) }]
      },
      {
        _id: fId,
        key: 'CP-F',
        title: 'External upstream',
        status: 'TODO',
        type: 'STORY',
        storyPoints: 3,
        bundleId: String(bundle._id),
        milestoneIds: [String(externalMilestone._id)],
        links: [{ type: 'BLOCKS', targetId: String(eId) }]
      }
    ]);

    const withoutExternal = await computeMilestoneCriticalPath(String(milestone._id), { includeExternal: false });
    const withExternal = await computeMilestoneCriticalPath(String(milestone._id), { includeExternal: true, maxExternalDepth: 2 });
    assert.ok(withoutExternal?.nodesByScope.external === 0, 'Expected no external nodes when disabled');
    assert.ok((withExternal?.nodesByScope.external || 0) >= 2, 'Expected external nodes when enabled');
    assert.ok((withExternal?.external?.depthUsed || 0) >= 2, 'Expected external depth to be used');

    const cycleMilestone = await createMilestone({
      name: 'Critical Cycle',
      bundleId: String(bundle._id),
      status: 'COMMITTED',
      startDate: new Date().toISOString(),
      endDate: new Date().toISOString()
    });
    const xId = new ObjectId();
    const yId = new ObjectId();
    await db.collection('workitems').insertMany([
      {
        _id: xId,
        key: 'CP-X',
        title: 'Cycle X',
        status: 'TODO',
        type: 'STORY',
        storyPoints: 1,
        milestoneIds: [String(cycleMilestone._id)],
        links: [{ type: 'BLOCKS', targetId: String(yId) }]
      },
      {
        _id: yId,
        key: 'CP-Y',
        title: 'Cycle Y',
        status: 'TODO',
        type: 'STORY',
        storyPoints: 1,
        milestoneIds: [String(cycleMilestone._id)],
        links: [{ type: 'BLOCKS', targetId: String(xId) }]
      }
    ]);

    const cycleResult = await computeMilestoneCriticalPath(String(cycleMilestone._id));
    assert.ok(cycleResult?.cycleDetected, 'Expected cycle detection');
    assert.ok((cycleResult?.cycleNodes || []).length >= 2, 'Expected cycle nodes');
  });

  console.log('critical path tests passed');
};

if (!process.env.TEST_API_RUNNER) {
  run();
}
