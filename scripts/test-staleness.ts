import assert from 'node:assert';
import { ObjectId } from 'mongodb';
import { runTest, callRoute } from './test-harness';

export const run = async () => {
  await runTest('staleness', async ({ db, createUser, createBundle, createMilestone, createWorkItem, setAuthToken }) => {
    await db.collection('notifications').deleteMany({});
    await db.collection('events').deleteMany({});

    const { user: adminUser, token: adminToken } = await createUser({
      name: 'Admin User',
      email: 'admin@stale.local',
      role: 'Admin'
    });
    const { user: watcherUser, token: watcherToken } = await createUser({
      name: 'Watcher User',
      email: 'watcher@stale.local',
      role: 'Engineering'
    });

    const bundle = await createBundle('Stale Bundle');
    const bundleId = String(bundle._id);

    await db.collection('notification_watchers').insertOne({
      _id: new ObjectId(),
      scopeType: 'BUNDLE',
      scopeId: bundleId,
      userId: String(watcherUser._id),
      createdAt: new Date().toISOString()
    });

    const milestone = await createMilestone({
      name: 'M1',
      bundleId,
      status: 'COMMITTED',
      startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      ownerUserId: String(adminUser._id),
      ownerEmail: adminUser.email
    });
    const milestoneId = String(milestone._id);
    const daysAgo = (days: number) => new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    const staleItem = await createWorkItem({
      key: 'STALE-1',
      title: 'Old item',
      bundleId,
      milestoneIds: [milestoneId],
      type: 'STORY',
      status: 'TODO',
      assignedTo: 'owner@stale.local',
      updatedAt: daysAgo(8),
      createdAt: daysAgo(10)
    });

    const criticalA = await createWorkItem({
      key: 'CRIT-1',
      title: 'Critical A',
      bundleId,
      milestoneIds: [milestoneId],
      type: 'STORY',
      status: 'IN_PROGRESS',
      assignedTo: 'owner@stale.local',
      storyPoints: 5,
      updatedAt: daysAgo(4),
      createdAt: daysAgo(5)
    });
    const criticalB = await createWorkItem({
      key: 'CRIT-2',
      title: 'Critical B',
      bundleId,
      milestoneIds: [milestoneId],
      type: 'STORY',
      status: 'IN_PROGRESS',
      assignedTo: 'owner@stale.local',
      storyPoints: 3,
      updatedAt: daysAgo(4),
      createdAt: daysAgo(5)
    });

    await db.collection('workitems').updateOne(
      { _id: criticalA._id },
      { $set: { links: [{ type: 'BLOCKS', targetId: String(criticalB._id), targetKey: criticalB.key, targetTitle: criticalB.title }] } }
    );

    await createWorkItem({
      key: 'BLOCK-1',
      title: 'Blocked item',
      bundleId,
      milestoneIds: [milestoneId],
      type: 'STORY',
      status: 'BLOCKED',
      assignedTo: 'owner@stale.local',
      updatedAt: daysAgo(6),
      createdAt: daysAgo(7)
    });

    await createWorkItem({
      key: 'UNASS-1',
      title: 'Unassigned item',
      bundleId,
      milestoneIds: [milestoneId],
      type: 'STORY',
      status: 'TODO',
      createdAt: daysAgo(3)
    });

    await createWorkItem({
      key: 'GH-1',
      title: 'GitHub item',
      bundleId,
      milestoneIds: [milestoneId],
      type: 'STORY',
      status: 'IN_PROGRESS',
      assignedTo: 'owner@stale.local',
      updatedAt: daysAgo(2),
      github: {
        prs: [{
          number: 1,
          title: 'Stale PR',
          url: 'https://example.com/pr/1',
          state: 'open',
          updatedAt: daysAgo(6)
        }]
      }
    });

    setAuthToken(adminToken);
    (globalThis as any).__testToken = adminToken;

    const { GET: rollupsRoute } = await import('../src/app/api/milestones/rollups/route');
    const rollupRes = await callRoute(rollupsRoute, `http://localhost/api/milestones/rollups?milestoneIds=${encodeURIComponent(milestoneId)}`, { method: 'GET' });
    assert.strictEqual(rollupRes.status, 200, 'Expected rollups response');
    const rollupBody = await rollupRes.json();
    const rollup = rollupBody[0];
    assert.ok(rollup?.staleness, 'Expected staleness rollup');
    assert.strictEqual(rollup.staleness.staleCount, 1, 'Expected stale count');
    assert.strictEqual(rollup.staleness.criticalStaleCount, 2, 'Expected critical stale count');
    assert.strictEqual(rollup.staleness.blockedStaleCount, 1, 'Expected blocked stale count');
    assert.strictEqual(rollup.staleness.unassignedStaleCount, 1, 'Expected unassigned stale count');
    assert.strictEqual(rollup.staleness.githubStaleCount, 1, 'Expected github stale count');

    const { GET: staleRoute, POST: nudgeRoute } = await import('../src/app/api/work-items/stale/route');
    const staleRes = await callRoute(staleRoute, `http://localhost/api/work-items/stale?milestoneId=${encodeURIComponent(milestoneId)}&kind=github`, { method: 'GET' });
    assert.strictEqual(staleRes.status, 200, 'Expected stale list response');
    const staleBody = await staleRes.json();
    const keys = (staleBody.items || []).map((i: any) => i.key);
    assert.ok(keys.includes('GH-1'), 'Expected GitHub stale item');

    setAuthToken(watcherToken);
    (globalThis as any).__testToken = watcherToken;
    const nudgeRes = await callRoute(nudgeRoute, 'http://localhost/api/work-items/stale', {
      method: 'POST',
      body: { workItemId: String(staleItem._id), reason: 'Stale test', kind: 'stale' }
    });
    assert.strictEqual(nudgeRes.status, 200, 'Expected nudge response');

    const notification = await db.collection('notifications').findOne({ type: 'workitem.stale.nudge' });
    assert.ok(notification, 'Expected nudge notification');
    const event = await db.collection('events').findOne({ type: 'workitem.stale.nudge' });
    assert.ok(event, 'Expected nudge event');
  });

  console.log('staleness tests passed');
};

if (!process.env.TEST_API_RUNNER) {
  run();
}
