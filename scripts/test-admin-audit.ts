import assert from 'node:assert';
import { ObjectId } from 'mongodb';
import { runTest, callRoute } from './test-harness';

export const run = async () => {
  await runTest('admin-audit', async ({ db, createUser, setAuthToken }) => {
    const { user: standardUser, token: standardToken } = await createUser({
      name: 'Standard User',
      email: 'user@test.local',
      role: 'Engineering'
    });

    const { user: adminUser, token: adminToken } = await createUser({
      name: 'Audit Admin',
      email: 'audit@test.local',
      role: 'Admin'
    });

    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
    const tenDaysAgo = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);

    await db.collection('events').insertMany([
      {
        _id: new ObjectId(),
        ts: now,
        type: 'milestones.milestone.statuschanged',
        actor: { userId: String(adminUser._id), name: adminUser.name, email: adminUser.email },
        resource: { type: 'milestones.milestone', id: 'M1', title: 'M1' },
        context: { bundleId: 'B1' }
      },
      {
        _id: new ObjectId(),
        ts: oneHourAgo,
        type: 'milestones.milestone.statuschanged',
        actor: { userId: String(adminUser._id), name: adminUser.name, email: adminUser.email },
        resource: { type: 'milestones.milestone', id: 'M2', title: 'M2' },
        context: { bundleId: 'B2' }
      },
      {
        _id: new ObjectId(),
        ts: twoHoursAgo,
        type: 'perf.api.latency',
        actor: { userId: String(standardUser._id), name: standardUser.name, email: standardUser.email },
        resource: { type: 'workitems.item', id: 'W1', title: 'Work Item' }
      },
      {
        _id: new ObjectId(),
        ts: tenDaysAgo,
        type: 'security.audit.access',
        actor: { userId: String(standardUser._id), name: standardUser.name, email: standardUser.email },
        resource: { type: 'auth.session', id: 'S1', title: 'Session' }
      }
    ]);

    await db.collection('notifications').insertMany([
      {
        _id: new ObjectId(),
        recipient: adminUser.name,
        sender: 'System',
        type: 'milestone.status.changed',
        title: 'Milestone updated',
        body: 'M1 moved to IN_PROGRESS',
        severity: 'info',
        read: false,
        createdAt: now.toISOString()
      },
      {
        _id: new ObjectId(),
        recipient: adminUser.name,
        sender: 'System',
        type: 'milestone.capacity.override',
        title: 'Capacity override',
        body: 'Override applied',
        severity: 'warn',
        read: true,
        createdAt: oneHourAgo.toISOString()
      },
      {
        _id: new ObjectId(),
        recipient: 'Other User',
        sender: 'System',
        type: 'dependency.crossbundle.created',
        title: 'Dependency created',
        body: 'Cross bundle block',
        severity: 'critical',
        read: false,
        createdAt: tenDaysAgo.toISOString()
      }
    ]);

    const { GET: GET_EVENTS } = await import('../src/app/api/admin/events/route');
    const { GET: GET_NOTIFICATIONS } = await import('../src/app/api/admin/notifications/route');

    setAuthToken(standardToken);
    (globalThis as any).__testToken = standardToken;
    const deniedEvents = await callRoute(GET_EVENTS, 'http://localhost/api/admin/events', { method: 'GET' });
    assert.strictEqual(deniedEvents.status, 403, 'Expected non-admin to be denied events');
    const deniedNotifications = await callRoute(GET_NOTIFICATIONS, 'http://localhost/api/admin/notifications', { method: 'GET' });
    assert.strictEqual(deniedNotifications.status, 403, 'Expected non-admin to be denied notifications');

    setAuthToken(adminToken);
    (globalThis as any).__testToken = adminToken;
    const resEvents = await callRoute(GET_EVENTS, 'http://localhost/api/admin/events?typePrefix=milestones&limit=1', { method: 'GET' });
    assert.strictEqual(resEvents.status, 200, 'Expected admin events access');
    const dataEvents = await resEvents.json();
    assert.strictEqual(dataEvents.items.length, 1, 'Expected paginated events');
    assert.ok(dataEvents.nextCursor, 'Expected next cursor');

    const resEventsPage2 = await callRoute(
      GET_EVENTS,
      `http://localhost/api/admin/events?typePrefix=milestones&limit=1&cursor=${encodeURIComponent(dataEvents.nextCursor)}`,
      { method: 'GET' }
    );
    const dataEventsPage2 = await resEventsPage2.json();
    assert.ok(dataEventsPage2.items.length >= 1, 'Expected second page of events');

    const resSecurityRange = await callRoute(
      GET_EVENTS,
      'http://localhost/api/admin/events?typePrefix=security&range=7d',
      { method: 'GET' }
    );
    const dataSecurityRange = await resSecurityRange.json();
    assert.strictEqual(dataSecurityRange.items.length, 0, 'Expected older security event filtered out');

    const resNotifs = await callRoute(
      GET_NOTIFICATIONS,
      `http://localhost/api/admin/notifications?recipient=${encodeURIComponent(adminUser.name)}&unreadOnly=true`,
      { method: 'GET' }
    );
    assert.strictEqual(resNotifs.status, 200, 'Expected admin notifications access');
    const dataNotifs = await resNotifs.json();
    assert.strictEqual(dataNotifs.items.length, 1, 'Expected unread only notification');

    const resNotifsPage = await callRoute(
      GET_NOTIFICATIONS,
      `http://localhost/api/admin/notifications?recipient=${encodeURIComponent(adminUser.name)}&limit=1`,
      { method: 'GET' }
    );
    const dataNotifsPage = await resNotifsPage.json();
    assert.ok(dataNotifsPage.nextCursor, 'Expected notifications cursor');
  });

  console.log('admin audit tests passed');
};

if (!process.env.TEST_API_RUNNER) {
  run();
}
