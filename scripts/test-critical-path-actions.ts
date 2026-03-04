import assert from 'node:assert';
import { ObjectId } from 'mongodb';
import { runTest, callRoute } from './test-harness';

export const run = async () => {
  await runTest('critical-path-actions', async ({ db, createUser, createBundle, createMilestone, createWorkItem, setAuthToken }) => {
    const { user: admin, token: adminToken } = await createUser({
      name: 'Admin User',
      email: 'admin@actions.local',
      role: 'Admin'
    });
    const { user: member, token: memberToken } = await createUser({
      name: 'Member User',
      email: 'member@actions.local',
      role: 'Engineering'
    });

    const bundle = await createBundle('Action Bundle');
    const milestone = await createMilestone({
      name: 'Action M1',
      bundleId: String(bundle._id),
      status: 'COMMITTED',
      startDate: new Date().toISOString(),
      endDate: new Date().toISOString()
    });

    await db.collection('bundle_assignments').insertOne({
      _id: new ObjectId(),
      bundleId: String(bundle._id),
      userId: String(member._id),
      assignmentType: 'bundle_owner',
      active: true
    });

    await db.collection('notification_watchers').insertOne({
      _id: new ObjectId(),
      userId: String(member._id),
      scopeType: 'BUNDLE',
      scopeId: String(bundle._id),
      createdAt: new Date().toISOString()
    });

    const item = await createWorkItem({
      key: 'ACT-1',
      title: 'Needs estimate',
      bundleId: String(bundle._id),
      milestoneIds: [String(milestone._id)],
      assignedTo: member.name,
      type: 'STORY',
      status: 'TODO'
    });

    const { POST: POST_REQUEST } = await import('../src/app/api/work-items/[id]/actions/request-estimate/route');
    setAuthToken(adminToken);
    (globalThis as any).__testToken = adminToken;
    const res = await callRoute(POST_REQUEST, `http://localhost/api/work-items/${item._id}/actions/request-estimate`, {
      method: 'POST',
      params: { id: String(item._id) },
      body: { milestoneId: String(milestone._id), reason: 'Need estimate' }
    });
    assert.strictEqual(res.status, 200, 'Expected request-estimate to succeed');
    const notifications = await db.collection('notifications').find({ type: 'workitem.estimate.requested' }).toArray();
    assert.ok(notifications.length >= 1, 'Expected estimate request notification');

    const { POST: POST_NOTIFY } = await import('../src/app/api/work-items/[id]/actions/notify-owner/route');
    setAuthToken(memberToken);
    (globalThis as any).__testToken = memberToken;
    const forbidden = await callRoute(POST_NOTIFY, `http://localhost/api/work-items/${item._id}/actions/notify-owner`, {
      method: 'POST',
      params: { id: String(item._id) },
      body: { milestoneId: String(milestone._id) }
    });
    assert.strictEqual(forbidden.status, 403, 'Expected notify-owner to be admin-only');

    setAuthToken(adminToken);
    (globalThis as any).__testToken = adminToken;
    const notifyRes = await callRoute(POST_NOTIFY, `http://localhost/api/work-items/${item._id}/actions/notify-owner`, {
      method: 'POST',
      params: { id: String(item._id) },
      body: { milestoneId: String(milestone._id) }
    });
    assert.strictEqual(notifyRes.status, 200, 'Expected notify-owner to succeed');
    const escalations = await db.collection('notifications').find({ type: 'dependency.criticalpath.escalation' }).toArray();
    assert.ok(escalations.length >= 1, 'Expected escalation notification');
  });

  console.log('critical path action tests passed');
};

if (!process.env.TEST_API_RUNNER) {
  run();
}
