import assert from 'node:assert';
import { ObjectId } from 'mongodb';
import { runTest, callRoute } from './test-harness';

export const run = async () => {
  await runTest('sprint-governance', async ({ db, createUser, createBundle, createWorkItem, setAuthToken }) => {
    const { user: admin, token: adminToken } = await createUser({
      name: 'Admin User',
      email: 'admin@sprint.local',
      role: 'Admin'
    });
    const { token: userToken } = await createUser({
      name: 'Regular User',
      email: 'user@sprint.local',
      role: 'Engineering'
    });

    const bundle = await createBundle('Sprint Bundle');
    const sprintId = new ObjectId();
    await db.collection('workitems_sprints').insertOne({
      _id: sprintId,
      name: 'Sprint Gov 1',
      status: 'DRAFT',
      bundleId: String(bundle._id),
      startDate: new Date().toISOString(),
      endDate: new Date().toISOString(),
      capacityPoints: 5
    });

    const { PATCH: PATCH_SPRINT } = await import('../src/app/api/sprints/[id]/route');
    const { PATCH: PATCH_WORK_ITEM } = await import('../src/app/api/work-items/[id]/route');

    setAuthToken(userToken);
    (globalThis as any).__testToken = userToken;
    const deniedStart = await callRoute(PATCH_SPRINT, 'http://localhost/api/sprints/denied', {
      method: 'PATCH',
      params: { id: String(sprintId) },
      body: { status: 'ACTIVE' }
    });
    assert.strictEqual(deniedStart.status, 403, 'Expected non-admin sprint start to be forbidden');

    setAuthToken(adminToken);
    (globalThis as any).__testToken = adminToken;
    const startRes = await callRoute(PATCH_SPRINT, 'http://localhost/api/sprints/start', {
      method: 'PATCH',
      params: { id: String(sprintId) },
      body: { status: 'ACTIVE' }
    });
    assert.strictEqual(startRes.status, 200, 'Expected admin to start sprint');
    const started = await startRes.json();
    assert.strictEqual(String(started?.sprint?.status || '').toUpperCase(), 'ACTIVE');

    const missingEstimateItem = await createWorkItem({
      key: 'SG-1',
      title: 'Missing estimate',
      bundleId: String(bundle._id)
    });
    const missingEstimateRes = await callRoute(PATCH_WORK_ITEM, 'http://localhost/api/work-items/missing', {
      method: 'PATCH',
      params: { id: String(missingEstimateItem._id) },
      body: { sprintId: String(sprintId) }
    });
    assert.strictEqual(missingEstimateRes.status, 400, 'Expected missing estimate to fail');
    const missingBody = await missingEstimateRes.json();
    assert.strictEqual(missingBody.error, 'MISSING_ESTIMATE');

    await createWorkItem({
      key: 'SG-2',
      title: 'Existing scope',
      bundleId: String(bundle._id),
      sprintId: String(sprintId),
      storyPoints: 4
    });
    const incomingItem = await createWorkItem({
      key: 'SG-3',
      title: 'Incoming scope',
      bundleId: String(bundle._id),
      storyPoints: 3
    });
    const overCapRes = await callRoute(PATCH_WORK_ITEM, 'http://localhost/api/work-items/overcap', {
      method: 'PATCH',
      params: { id: String(incomingItem._id) },
      body: { sprintId: String(sprintId) }
    });
    assert.strictEqual(overCapRes.status, 409, 'Expected over capacity to fail');
    const overCapBody = await overCapRes.json();
    assert.strictEqual(overCapBody.error, 'OVER_CAPACITY');

    const blockedClose = await callRoute(PATCH_SPRINT, 'http://localhost/api/sprints/close', {
      method: 'PATCH',
      params: { id: String(sprintId) },
      body: { status: 'CLOSED' }
    });
    assert.strictEqual(blockedClose.status, 409, 'Expected sprint close to be blocked');
    const blockedBody = await blockedClose.json();
    assert.strictEqual(blockedBody.error, 'SPRINT_CLOSE_BLOCKED');
    assert.ok(Array.isArray(blockedBody.readiness?.blockers), 'Expected readiness blockers');

    const overrideClose = await callRoute(PATCH_SPRINT, 'http://localhost/api/sprints/override', {
      method: 'PATCH',
      params: { id: String(sprintId) },
      body: { status: 'CLOSED', allowOverride: true, overrideReason: 'Accepted outstanding scope' }
    });
    assert.strictEqual(overrideClose.status, 200, 'Expected override close to succeed');
    const overrideBody = await overrideClose.json();
    assert.strictEqual(String(overrideBody?.sprint?.status || '').toUpperCase(), 'CLOSED');

    const statusEvent = await db.collection('events').findOne({ type: 'sprints.sprint.statuschanged' });
    const overrideEvent = await db.collection('events').findOne({ type: 'sprints.sprint.override' });
    assert.ok(statusEvent, 'Expected sprint statuschanged event');
    assert.ok(overrideEvent, 'Expected sprint override event');

    const statusNotification = await db.collection('notifications').findOne({ type: 'sprint.status.changed' });
    assert.ok(statusNotification, 'Expected sprint status notification');
  });

  console.log('sprint governance tests passed');
};

if (!process.env.TEST_API_RUNNER) {
  run();
}
