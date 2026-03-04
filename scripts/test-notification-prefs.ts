import assert from 'node:assert';
import { ObjectId } from 'mongodb';
import { runTest, callRoute } from './test-harness';
import { createNotificationsForEvent } from '../src/services/notifications';

export const run = async () => {
  await runTest('notification-prefs', async ({ db, createUser, setAuthToken }) => {
    const { user: adminUser, token: adminToken } = await createUser({
      name: 'Admin User',
      email: 'admin@test.local',
      role: 'Admin'
    });

    const { user: standardUser, token: standardToken } = await createUser({
      name: 'Standard User',
      email: 'standard@test.local',
      role: 'Engineering'
    });

    const { GET: GET_SETTINGS, PUT: PUT_SETTINGS } = await import('../src/app/api/admin/notification-settings/route');
    const { GET: GET_PREFS, PUT: PUT_PREFS } = await import('../src/app/api/user/notification-prefs/route');
    const { POST: POST_DIGEST } = await import('../src/app/api/notifications/digest/send/route');

    setAuthToken(standardToken);
    (globalThis as any).__testToken = standardToken;
    const deniedSettings = await callRoute(GET_SETTINGS, 'http://localhost/api/admin/notification-settings', { method: 'GET' });
    assert.strictEqual(deniedSettings.status, 403, 'Expected non-admin denied for settings');

    setAuthToken(adminToken);
    (globalThis as any).__testToken = adminToken;

    const initialSettingsRes = await callRoute(GET_SETTINGS, 'http://localhost/api/admin/notification-settings', { method: 'GET' });
    assert.strictEqual(initialSettingsRes.status, 200, 'Expected admin settings fetch');
    const initialSettings = await initialSettingsRes.json();

    const disabled = {
      ...initialSettings.settings,
      enabledTypes: {
        ...initialSettings.settings.enabledTypes,
        'milestone.status.changed': false
      }
    };

    const updateRes = await callRoute(PUT_SETTINGS, 'http://localhost/api/admin/notification-settings', { method: 'PUT', body: disabled });
    assert.strictEqual(updateRes.status, 200, 'Expected admin settings update');

    await createNotificationsForEvent({
      type: 'milestone.status.changed',
      actor: { userId: String(adminUser._id), name: adminUser.name, email: adminUser.email },
      payload: { milestone: { name: 'M1', bundleId: 'B1' }, from: 'TODO', to: 'DONE' }
    });

    const shouldBeZero = await db.collection('notifications').countDocuments({ type: 'milestone.status.changed' });
    assert.strictEqual(shouldBeZero, 0, 'Expected disabled type to skip notification');

    const enabled = {
      ...disabled,
      enabledTypes: {
        ...disabled.enabledTypes,
        'milestone.status.changed': true,
        'milestone.readiness.blocked': true
      },
      routing: {
        ...disabled.routing,
        includeActorOnBlocked: true,
        includeAdmins: false,
        includeBundleOwners: true
      },
      digest: {
        ...disabled.digest,
        enabled: true
      }
    };

    await callRoute(PUT_SETTINGS, 'http://localhost/api/admin/notification-settings', { method: 'PUT', body: enabled });

    setAuthToken(standardToken);
    (globalThis as any).__testToken = standardToken;
    const prefsRes = await callRoute(PUT_PREFS, 'http://localhost/api/user/notification-prefs', {
      method: 'PUT',
      body: { mutedTypes: ['milestone.readiness.blocked'], digestOptIn: true }
    });
    assert.strictEqual(prefsRes.status, 200, 'Expected user prefs update');

    await createNotificationsForEvent({
      type: 'milestone.readiness.blocked',
      actor: { userId: String(standardUser._id), name: standardUser.name, email: standardUser.email },
      payload: { milestone: { name: 'M2', bundleId: 'B2' }, readiness: { blockers: [{ detail: 'Missing artifact' }] } }
    });

    const mutedNotif = await db.collection('notifications').findOne({ type: 'milestone.readiness.blocked', recipient: standardUser.name });
    assert.ok(!mutedNotif, 'Expected muted type to skip notification');

    await db.collection('bundle_assignments').insertOne({
      _id: new ObjectId(),
      bundleId: 'B1',
      userId: String(standardUser._id),
      assignmentType: 'bundle_owner',
      active: true
    });

    await createNotificationsForEvent({
      type: 'milestone.status.changed',
      actor: { userId: String(adminUser._id), name: adminUser.name, email: adminUser.email },
      payload: { milestone: { name: 'M3', bundleId: 'B1' }, from: 'TODO', to: 'IN_PROGRESS' }
    });

    const queued = await db.collection('notification_digest_queue').findOne({ userId: String(standardUser._id), type: 'milestone.status.changed' });
    assert.ok(queued, 'Expected digest queue entry');

    setAuthToken(standardToken);
    (globalThis as any).__testToken = standardToken;
    const digestRes = await callRoute(POST_DIGEST, `http://localhost/api/notifications/digest/send?userId=${encodeURIComponent(String(standardUser._id))}`, { method: 'POST' });
    assert.strictEqual(digestRes.status, 200, 'Expected digest send response');
    const digestBody = await digestRes.json();
    assert.ok(digestBody.created, 'Expected digest to be created');

    const digestNotif = await db.collection('notifications').findOne({ type: 'digest.daily', recipient: standardUser.name });
    assert.ok(digestNotif, 'Expected digest notification');

    const queueLeft = await db.collection('notification_digest_queue').countDocuments({ userId: String(standardUser._id) });
    assert.strictEqual(queueLeft, 0, 'Expected digest queue cleared');

    const prefsGet = await callRoute(GET_PREFS, 'http://localhost/api/user/notification-prefs', { method: 'GET' });
    assert.strictEqual(prefsGet.status, 200, 'Expected prefs get');
  });

  console.log('notification prefs tests passed');
};

if (!process.env.TEST_API_RUNNER) {
  run();
}
