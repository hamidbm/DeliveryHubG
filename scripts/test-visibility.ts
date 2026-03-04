import assert from 'node:assert';
import { ObjectId } from 'mongodb';
import { runTest, callRoute } from './test-harness';
import { GET as GET_WORK_ITEMS } from '../src/app/api/work-items/route';
import { GET as GET_WORK_ITEM } from '../src/app/api/work-items/[id]/route';
import { GET as GET_FEED } from '../src/app/api/feed/route';

export const run = async () => {
  await runTest('visibility', async ({ db, createUser, createBundle, createMilestone, createWorkItem, setAuthToken }) => {
    const { user: admin, token: adminToken } = await createUser({ name: 'Admin User', email: 'admin@test.local', role: 'Admin' });
    const { user: owner, token: ownerToken } = await createUser({ name: 'Owner User', email: 'owner@test.local', role: 'Engineering' });
    const { user: watcher, token: watcherToken } = await createUser({ name: 'Watcher User', email: 'watcher@test.local', role: 'Engineering' });
    const { user: regular, token: regularToken } = await createUser({ name: 'Regular User', email: 'regular@test.local', role: 'Engineering' });

    const privateBundle = await createBundle('Private Bundle');
    const internalBundle = await createBundle('Internal Bundle');
    await db.collection('bundles').updateOne({ _id: privateBundle._id }, { $set: { visibility: 'PRIVATE' } });
    await db.collection('bundles').updateOne({ _id: internalBundle._id }, { $set: { visibility: 'INTERNAL' } });

    await db.collection('bundle_assignments').insertOne({
      _id: new ObjectId(),
      bundleId: String(privateBundle._id),
      userId: String(owner._id),
      assignmentType: 'bundle_owner',
      active: true,
      createdAt: new Date().toISOString()
    });
    await db.collection('notification_watchers').insertOne({
      _id: new ObjectId(),
      scopeType: 'BUNDLE',
      scopeId: String(privateBundle._id),
      userId: String(watcher._id),
      createdAt: new Date().toISOString()
    });

    const privateMilestone = await createMilestone({
      name: 'M-Private',
      bundleId: String(privateBundle._id),
      status: 'COMMITTED'
    });
    const internalMilestone = await createMilestone({
      name: 'M-Internal',
      bundleId: String(internalBundle._id),
      status: 'COMMITTED'
    });

    const privateItem = await createWorkItem({
      key: 'PRIV-1',
      title: 'Private work item',
      type: 'TASK',
      status: 'TODO',
      bundleId: String(privateBundle._id),
      milestoneIds: [String(privateMilestone._id)]
    });
    const internalItem = await createWorkItem({
      key: 'INT-1',
      title: 'Internal work item',
      type: 'TASK',
      status: 'TODO',
      bundleId: String(internalBundle._id),
      milestoneIds: [String(internalMilestone._id)],
      links: [
        { type: 'BLOCKS', targetId: String(privateItem._id), targetKey: privateItem.key, targetTitle: privateItem.title }
      ]
    });

    await db.collection('events').insertMany([
      {
        _id: new ObjectId(),
        ts: new Date(),
        type: 'milestones.milestone.statuschanged',
        actor: { userId: String(admin._id), displayName: admin.name, email: admin.email },
        resource: { type: 'milestones.milestone', id: String(privateMilestone._id), title: 'M-Private' },
        context: { bundleId: String(privateBundle._id), milestoneId: String(privateMilestone._id) },
        payload: { from: 'PLANNED', to: 'ACTIVE' }
      },
      {
        _id: new ObjectId(),
        ts: new Date(),
        type: 'milestones.milestone.statuschanged',
        actor: { userId: String(admin._id), displayName: admin.name, email: admin.email },
        resource: { type: 'milestones.milestone', id: String(internalMilestone._id), title: 'M-Internal' },
        context: { bundleId: String(internalBundle._id), milestoneId: String(internalMilestone._id) },
        payload: { from: 'PLANNED', to: 'ACTIVE' }
      }
    ]);

    (globalThis as any).__testToken = regularToken;
    setAuthToken(regularToken);
    const resList = await callRoute(GET_WORK_ITEMS, 'http://localhost/api/work-items', { method: 'GET' }) as Response;
    const listData = await resList.json();
    assert.strictEqual(resList.status, 200);
    assert.ok(Array.isArray(listData));
    assert.ok(listData.some((i: any) => i.key === 'INT-1'), 'Expected internal item visible');
    assert.ok(!listData.some((i: any) => i.key === 'PRIV-1'), 'Expected private item hidden');
    const internalFromList = listData.find((i: any) => i.key === 'INT-1');
    const blockedBy = internalFromList?.linkSummary?.blocks || [];
    if (blockedBy.length) {
      assert.strictEqual(blockedBy[0].targetTitle, 'Restricted item');
    }

    const resPrivate = await callRoute(GET_WORK_ITEM, `http://localhost/api/work-items/${privateItem._id}`, { method: 'GET', params: { id: String(privateItem._id) } }) as Response;
    assert.strictEqual(resPrivate.status, 404);

    (globalThis as any).__testToken = watcherToken;
    setAuthToken(watcherToken);
    const resWatcher = await callRoute(GET_WORK_ITEM, `http://localhost/api/work-items/${privateItem._id}`, { method: 'GET', params: { id: String(privateItem._id) } }) as Response;
    assert.strictEqual(resWatcher.status, 200);

    (globalThis as any).__testToken = regularToken;
    setAuthToken(regularToken);
    const resFeed = await callRoute(GET_FEED, 'http://localhost/api/feed?scopeType=PROGRAM', { method: 'GET' }) as Response;
    const feedData = await resFeed.json();
    assert.strictEqual(resFeed.status, 200);
    const hasPrivateLink = (feedData.items || []).some((item: any) =>
      (item.links || []).some((link: any) => String(link.href || '').includes(String(privateMilestone._id)))
    );
    assert.ok(!hasPrivateLink, 'Expected private milestone links hidden in feed');
  });

  console.log('visibility tests passed');
};

if (!process.env.TEST_API_RUNNER) {
  run();
}
