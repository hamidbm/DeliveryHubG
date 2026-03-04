import assert from 'node:assert';
import { ObjectId } from 'mongodb';
import { runTest, callRoute } from './test-harness';
import { createNotificationsForEvent } from '../src/services/notifications';

export const run = async () => {
  await runTest('watchers', async ({ db, createUser, createBundle, createMilestone, setAuthToken }) => {
    const { user: watcher, token: watcherToken } = await createUser({
      name: 'Watcher User',
      email: 'watcher@test.local',
      role: 'Engineering'
    });
    const { user: admin, token: adminToken } = await createUser({
      name: 'Admin User',
      email: 'admin@test.local',
      role: 'Admin'
    });

    const bundleA = await createBundle('Bundle A');
    const bundleB = await createBundle('Bundle B');
    const milestoneA = await createMilestone({
      name: 'M1',
      bundleId: String(bundleA._id),
      status: 'COMMITTED',
      startDate: new Date().toISOString(),
      endDate: new Date().toISOString()
    });

    const { POST: POST_WATCH, DELETE: DELETE_WATCH } = await import('../src/app/api/watchers/route');
    const { GET: GET_SCOPE } = await import('../src/app/api/watchers/scope/route');

    setAuthToken(watcherToken);
    (globalThis as any).__testToken = watcherToken;
    const resWatch = await callRoute(POST_WATCH, 'http://localhost/api/watchers', {
      method: 'POST',
      body: { scopeType: 'BUNDLE', scopeId: String(bundleA._id) }
    });
    assert.strictEqual(resWatch.status, 200, 'Expected watch to succeed');

    const resWatchDup = await callRoute(POST_WATCH, 'http://localhost/api/watchers', {
      method: 'POST',
      body: { scopeType: 'BUNDLE', scopeId: String(bundleA._id) }
    });
    assert.strictEqual(resWatchDup.status, 200, 'Expected duplicate watch to be idempotent');

    const watchers = await db.collection('notification_watchers').find({ userId: String(watcher._id) }).toArray();
    assert.strictEqual(watchers.length, 1, 'Expected single watcher entry');

    await createNotificationsForEvent({
      type: 'dependency.crossbundle.created',
      actor: { userId: String(admin._id), name: admin.name, email: admin.email },
      payload: { blocker: { key: 'A-1', bundleId: String(bundleA._id) }, blocked: { key: 'B-1', bundleId: String(bundleB._id) } }
    });

    const notif = await db.collection('notifications').findOne({ recipient: watcher.name, type: 'dependency.crossbundle.created' });
    assert.ok(notif, 'Expected watcher to receive cross-bundle notification');

    const resWatchMilestone = await callRoute(POST_WATCH, 'http://localhost/api/watchers', {
      method: 'POST',
      body: { scopeType: 'MILESTONE', scopeId: String(milestoneA._id) }
    });
    assert.strictEqual(resWatchMilestone.status, 200, 'Expected milestone watch to succeed');

    await createNotificationsForEvent({
      type: 'milestone.status.changed',
      actor: { userId: String(admin._id), name: admin.name, email: admin.email },
      payload: { milestone: { _id: milestoneA._id, name: milestoneA.name, bundleId: String(bundleA._id) }, from: 'TODO', to: 'IN_PROGRESS' }
    });

    const milestoneNotif = await db.collection('notifications').findOne({ recipient: watcher.name, type: 'milestone.status.changed' });
    assert.ok(milestoneNotif, 'Expected watcher to receive milestone notification');

    const resUnwatch = await callRoute(DELETE_WATCH, 'http://localhost/api/watchers', {
      method: 'DELETE',
      body: { scopeType: 'BUNDLE', scopeId: String(bundleA._id) }
    });
    assert.strictEqual(resUnwatch.status, 200, 'Expected unwatch to succeed');

    setAuthToken(adminToken);
    (globalThis as any).__testToken = adminToken;
    const resScope = await callRoute(GET_SCOPE, `http://localhost/api/watchers/scope?scopeType=BUNDLE&scopeId=${encodeURIComponent(String(bundleA._id))}`, { method: 'GET' });
    assert.strictEqual(resScope.status, 200, 'Expected admin to list watchers for scope');
  });

  console.log('watchers tests passed');
};

if (!process.env.TEST_API_RUNNER) {
  run();
}
