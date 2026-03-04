import assert from 'node:assert';
import { runTest, callRoute } from './test-harness';
import { ObjectId } from 'mongodb';

export const run = async () => {
  await runTest('ownership', async ({ db, createUser, createBundle, createMilestone, createWorkItem, setAuthToken }) => {
    await db.collection('notifications').deleteMany({});
    await db.collection('events').deleteMany({});

    const { user: adminUser, token: adminToken } = await createUser({
      name: 'Admin User',
      email: 'admin@owner.local',
      role: 'Admin'
    });
    const { user: ownerUser, token: ownerToken } = await createUser({
      name: 'Bundle Owner',
      email: 'owner@owner.local',
      role: 'Engineering'
    });
    const { user: watcherUser, token: watcherToken } = await createUser({
      name: 'Bundle Watcher',
      email: 'watcher@owner.local',
      role: 'Engineering'
    });
    const { user: outsiderUser, token: outsiderToken } = await createUser({
      name: 'Outsider',
      email: 'outsider@owner.local',
      role: 'Engineering'
    });

    const bundle = await createBundle('Ownership Bundle');
    const bundleId = String(bundle._id);

    await db.collection('bundle_assignments').insertOne({
      _id: new ObjectId(),
      bundleId,
      userId: String(ownerUser._id),
      assignmentType: 'bundle_owner',
      active: true,
      createdAt: new Date().toISOString()
    });

    await db.collection('notification_watchers').insertOne({
      _id: new ObjectId(),
      scopeType: 'BUNDLE',
      scopeId: bundleId,
      userId: String(watcherUser._id),
      createdAt: new Date().toISOString()
    });

    const milestone = await createMilestone({
      name: 'Owner M1',
      bundleId,
      status: 'COMMITTED',
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    });

    const workItem = await createWorkItem({
      key: 'OWN-1',
      title: 'Owner Item',
      bundleId,
      milestoneIds: [String(milestone._id)],
      status: 'TODO',
      type: 'STORY'
    });

    setAuthToken(ownerToken);
    (globalThis as any).__testToken = ownerToken;
    const { GET: workItemSuggestions } = await import('../src/app/api/work-items/[id]/owner-suggestions/route');
    const res = await callRoute(workItemSuggestions, 'http://localhost/api/work-items/own/owner-suggestions', {
      method: 'GET',
      params: { id: String(workItem._id) }
    });
    assert.strictEqual(res.status, 200, 'Expected owner suggestions to be visible');
    const data = await res.json();
    const ids = (data?.candidates || []).map((c: any) => c.userId);
    assert.ok(ids.includes(String(ownerUser._id)), 'Expected bundle owner suggestion');
    assert.ok(ids.includes(String(watcherUser._id)), 'Expected watcher suggestion');

    const { PATCH } = await import('../src/app/api/milestones/[id]/route');
    setAuthToken(outsiderToken);
    (globalThis as any).__testToken = outsiderToken;
    const forbidden = await callRoute(PATCH, 'http://localhost/api/milestones/owner', {
      method: 'PATCH',
      params: { id: String(milestone._id) },
      body: { ownerUserId: String(ownerUser._id), ownerEmail: ownerUser.email }
    });
    assert.strictEqual(forbidden.status, 403, 'Expected non-owner to be forbidden');

    setAuthToken(ownerToken);
    (globalThis as any).__testToken = ownerToken;
    const allowed = await callRoute(PATCH, 'http://localhost/api/milestones/owner', {
      method: 'PATCH',
      params: { id: String(milestone._id) },
      body: { ownerUserId: String(ownerUser._id), ownerEmail: ownerUser.email }
    });
    assert.strictEqual(allowed.status, 200, 'Expected owner to set milestone owner');

    const ownerEvent = await db.collection('events').findOne({ type: 'milestones.milestone.ownerchanged' });
    assert.ok(ownerEvent, 'Expected owner changed event');

    const notification = await db.collection('notifications').findOne({ type: 'milestone.owner.changed' });
    assert.ok(notification, 'Expected owner changed notification');

    await db.collection('bundles').updateOne({ _id: bundle._id }, { $set: { visibility: 'PRIVATE' } });
    setAuthToken(outsiderToken);
    (globalThis as any).__testToken = outsiderToken;
    const { GET: milestoneSuggestions } = await import('../src/app/api/milestones/[id]/owner-suggestions/route');
    const denied = await callRoute(milestoneSuggestions, 'http://localhost/api/milestones/owner-suggestions', {
      method: 'GET',
      params: { id: String(milestone._id) }
    });
    assert.strictEqual(denied.status, 404, 'Expected visibility to block suggestions');

    setAuthToken(adminToken);
    (globalThis as any).__testToken = adminToken;
  });

  console.log('ownership tests passed');
};

if (!process.env.TEST_API_RUNNER) {
  run();
}
