import assert from 'node:assert';
import { ObjectId } from 'mongodb';
import { runTest, callRoute } from './test-harness';
import { getDeliveryPolicy, saveDeliveryPolicy, saveDeliveryPolicyOverride } from '../src/services/policy';

export const run = async () => {
  await runTest('staleness-policy', async ({ db, createUser, createBundle, createMilestone, createWorkItem, setAuthToken }) => {
    await db.collection('notifications').deleteMany({});
    await db.collection('events').deleteMany({});
    await db.collection('staleness_nudges').deleteMany({});

    const { user: adminUser, token: adminToken } = await createUser({
      name: 'Admin User',
      email: 'admin@stale-policy.local',
      role: 'Admin'
    });
    const { user: watcherUser, token: watcherToken } = await createUser({
      name: 'Watcher User',
      email: 'watcher@stale-policy.local',
      role: 'Engineering'
    });

    const bundle = await createBundle('Policy Bundle');
    const bundleId = String(bundle._id);

    await db.collection('notification_watchers').insertOne({
      _id: new ObjectId(),
      scopeType: 'BUNDLE',
      scopeId: bundleId,
      userId: String(watcherUser._id),
      createdAt: new Date().toISOString()
    });

    const milestone = await createMilestone({
      name: 'Policy M1',
      bundleId,
      status: 'COMMITTED',
      startDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      endDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString()
    });
    const milestoneId = String(milestone._id);
    const daysAgo = (days: number) => new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    await createWorkItem({
      key: 'POL-1',
      title: 'Policy stale',
      bundleId,
      milestoneIds: [milestoneId],
      type: 'STORY',
      status: 'TODO',
      updatedAt: daysAgo(3),
      createdAt: daysAgo(4)
    });

    const global = await getDeliveryPolicy();
    await saveDeliveryPolicy({
      ...global,
      staleness: {
        ...global.staleness,
        thresholdsDays: {
          ...global.staleness.thresholdsDays,
          workItemStale: 1
        },
        nudges: {
          ...global.staleness.nudges,
          enabled: true,
          allowedRoles: ['ADMIN'],
          cooldownHoursPerItem: 24,
          maxNudgesPerUserPerDay: 10
        },
        digest: {
          ...global.staleness.digest,
          includeStaleSummary: true,
          minCriticalStaleToInclude: 0
        }
      }
    });

    setAuthToken(adminToken);
    (globalThis as any).__testToken = adminToken;
    const { GET: rollupsRoute } = await import('../src/app/api/milestones/rollups/route');
    const rollupRes = await callRoute(rollupsRoute, `http://localhost/api/milestones/rollups?milestoneIds=${encodeURIComponent(milestoneId)}`, { method: 'GET' });
    assert.strictEqual(rollupRes.status, 200, 'Expected rollups response');
    const rollupBody = await rollupRes.json();
    assert.strictEqual(rollupBody[0]?.staleness?.staleCount, 1, 'Expected stale count with global policy');

    await saveDeliveryPolicyOverride(bundleId, {
      staleness: {
        thresholdsDays: { workItemStale: 30 }
      }
    }, String(adminUser._id));

    const rollupRes2 = await callRoute(rollupsRoute, `http://localhost/api/milestones/rollups?milestoneIds=${encodeURIComponent(milestoneId)}`, { method: 'GET' });
    const rollupBody2 = await rollupRes2.json();
    assert.strictEqual(rollupBody2[0]?.staleness?.staleCount, 0, 'Expected override to relax staleness');

    const { POST: nudgeRoute } = await import('../src/app/api/work-items/stale/route');
    setAuthToken(watcherToken);
    (globalThis as any).__testToken = watcherToken;
    const nudgeForbidden = await callRoute(nudgeRoute, 'http://localhost/api/work-items/stale', {
      method: 'POST',
      body: { workItemKey: 'POL-1', reason: 'Test', kind: 'stale' }
    });
    assert.strictEqual(nudgeForbidden.status, 403, 'Expected nudge forbidden for watcher');

    setAuthToken(adminToken);
    (globalThis as any).__testToken = adminToken;
    const nudgeOk = await callRoute(nudgeRoute, 'http://localhost/api/work-items/stale', {
      method: 'POST',
      body: { workItemKey: 'POL-1', reason: 'Test', kind: 'stale' }
    });
    assert.strictEqual(nudgeOk.status, 200, 'Expected nudge success');

    const nudgeCooldown = await callRoute(nudgeRoute, 'http://localhost/api/work-items/stale', {
      method: 'POST',
      body: { workItemKey: 'POL-1', reason: 'Test', kind: 'stale' }
    });
    assert.strictEqual(nudgeCooldown.status, 409, 'Expected cooldown response');

    const eventBlocked = await db.collection('events').findOne({ type: 'workitem.stale.blocked' });
    assert.ok(eventBlocked, 'Expected nudge blocked event');

    await saveDeliveryPolicy({
      ...global,
      staleness: {
        ...global.staleness,
        thresholdsDays: { ...global.staleness.thresholdsDays, workItemStale: 1 },
        nudges: {
          ...global.staleness.nudges,
          enabled: true,
          allowedRoles: ['ADMIN'],
          cooldownHoursPerItem: 0,
          maxNudgesPerUserPerDay: 1
        },
        digest: { ...global.staleness.digest, includeStaleSummary: true, minCriticalStaleToInclude: 0 }
      }
    });

    await createWorkItem({
      key: 'POL-2',
      title: 'Policy stale 2',
      bundleId,
      milestoneIds: [milestoneId],
      type: 'STORY',
      status: 'TODO',
      updatedAt: daysAgo(3),
      createdAt: daysAgo(4)
    });

    const nudgeLimit = await callRoute(nudgeRoute, 'http://localhost/api/work-items/stale', {
      method: 'POST',
      body: { workItemKey: 'POL-2', reason: 'Test', kind: 'stale' }
    });
    assert.strictEqual(nudgeLimit.status, 429, 'Expected nudge limit reached');
  });

  console.log('staleness policy tests passed');
};

if (!process.env.TEST_API_RUNNER) {
  run();
}
