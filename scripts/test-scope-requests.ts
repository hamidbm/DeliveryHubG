import assert from 'node:assert';
import { ObjectId } from 'mongodb';
import { runTest, callRoute } from './test-harness';

export const run = async () => {
  await runTest('scope-requests', async ({ db, createUser, createBundle, createMilestone, createWorkItem, setAuthToken }) => {
    const { user: admin, token: adminToken } = await createUser({
      name: 'Admin User',
      email: 'admin@scope.local',
      role: 'Admin'
    });
    const { user: member, token: memberToken } = await createUser({
      name: 'Member User',
      email: 'member@scope.local',
      role: 'Engineering'
    });

    const bundle = await createBundle('Scope Bundle');
    const milestone = await createMilestone({
      name: 'Committed M1',
      bundleId: String(bundle._id),
      status: 'COMMITTED',
      targetCapacity: 5,
      startDate: new Date().toISOString(),
      endDate: new Date().toISOString()
    });

    const item = await createWorkItem({
      key: 'SC-1',
      title: 'Scope item',
      bundleId: String(bundle._id),
      storyPoints: 3
    });

    const { PATCH: PATCH_ITEM } = await import('../src/app/api/work-items/[id]/route');
    const { POST: POST_SCOPE, GET: GET_SCOPE } = await import('../src/app/api/milestones/[id]/scope-requests/route');
    const { POST: POST_DECIDE } = await import('../src/app/api/milestones/[id]/scope-requests/[requestId]/decide/route');

    setAuthToken(memberToken);
    (globalThis as any).__testToken = memberToken;
    const directRes = await callRoute(PATCH_ITEM, 'http://localhost/api/work-items/direct', {
      method: 'PATCH',
      params: { id: String(item._id) },
      body: { milestoneIds: [String(milestone._id)] }
    });
    assert.strictEqual(directRes.status, 409, 'Expected committed scope change to require approval');
    const directBody = await directRes.json();
    assert.strictEqual(directBody.error, 'COMMITTED_SCOPE_REQUIRES_APPROVAL');

    const createRes = await callRoute(POST_SCOPE, 'http://localhost/api/milestones/scope', {
      method: 'POST',
      params: { id: String(milestone._id) },
      body: { action: 'ADD_ITEMS', workItemIds: [String(item._id)] }
    });
    assert.strictEqual(createRes.status, 200, 'Expected scope request creation');
    const created = await createRes.json();
    assert.strictEqual(created.request.status, 'PENDING');

    const listRes = await callRoute(GET_SCOPE, 'http://localhost/api/milestones/scope', {
      method: 'GET',
      params: { id: String(milestone._id) }
    });
    assert.strictEqual(listRes.status, 200, 'Expected list requests');
    const listBody = await listRes.json();
    assert.ok(listBody.items.length >= 1, 'Expected at least one request');

    setAuthToken(adminToken);
    (globalThis as any).__testToken = adminToken;
    const approveRes = await callRoute(POST_DECIDE, 'http://localhost/api/milestones/scope/decide', {
      method: 'POST',
      params: { id: String(milestone._id), requestId: String(created.request._id) },
      body: { decision: 'APPROVE' }
    });
    assert.strictEqual(approveRes.status, 200, 'Expected approve to succeed');
    const approveBody = await approveRes.json();
    assert.strictEqual(approveBody.request.status, 'APPROVED');

    const updatedItem = await db.collection('workitems').findOne({ _id: item._id });
    assert.ok(updatedItem?.milestoneIds?.map(String).includes(String(milestone._id)), 'Expected item assigned to milestone');

    const event = await db.collection('events').findOne({ type: 'milestones.scope.approved' });
    assert.ok(event, 'Expected scope approved event');
    const notification = await db.collection('notifications').findOne({ type: 'milestone.scope.approved' });
    assert.ok(notification, 'Expected scope approved notification');

    const bigItem = await createWorkItem({
      key: 'SC-2',
      title: 'Over capacity',
      bundleId: String(bundle._id),
      storyPoints: 10
    });
    setAuthToken(memberToken);
    (globalThis as any).__testToken = memberToken;
    const createOver = await callRoute(POST_SCOPE, 'http://localhost/api/milestones/scope', {
      method: 'POST',
      params: { id: String(milestone._id) },
      body: { action: 'ADD_ITEMS', workItemIds: [String(bigItem._id)] }
    });
    const createOverBody = await createOver.json();
    setAuthToken(adminToken);
    (globalThis as any).__testToken = adminToken;
    const approveOver = await callRoute(POST_DECIDE, 'http://localhost/api/milestones/scope/decide', {
      method: 'POST',
      params: { id: String(milestone._id), requestId: String(createOverBody.request._id) },
      body: { decision: 'APPROVE' }
    });
    assert.strictEqual(approveOver.status, 409, 'Expected approval blocked when over capacity');

    const rejectRes = await callRoute(POST_DECIDE, 'http://localhost/api/milestones/scope/decide', {
      method: 'POST',
      params: { id: String(milestone._id), requestId: String(createOverBody.request._id) },
      body: { decision: 'REJECT', reason: 'Not now' }
    });
    assert.strictEqual(rejectRes.status, 200, 'Expected reject to succeed');
    const rejectBody = await rejectRes.json();
    assert.strictEqual(rejectBody.request.status, 'REJECTED');
    assert.strictEqual(rejectBody.request.decisionReason, 'Not now');
  });

  console.log('scope request tests passed');
};

if (!process.env.TEST_API_RUNNER) {
  run();
}
