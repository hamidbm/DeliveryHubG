import assert from 'node:assert';
import { ObjectId } from 'mongodb';
import { runTest, callRoute } from './test-harness';
import { GET } from '../src/app/api/feed/route';

export const run = async () => {
  await runTest('feed', async ({ db, createUser, createBundle, createMilestone, setAuthToken }) => {
    const { user, token } = await createUser({ name: 'Feed User', email: 'feed@test.local', role: 'Admin' });
    setAuthToken(token);
    (globalThis as any).__testToken = token;

    const bundleA = await createBundle('Bundle A');
    const bundleB = await createBundle('Bundle B');
    const milestoneA = await createMilestone({
      name: 'M1',
      bundleId: String(bundleA._id),
      status: 'COMMITTED',
      startDate: new Date().toISOString(),
      endDate: new Date().toISOString()
    });
    const milestoneB = await createMilestone({
      name: 'M2',
      bundleId: String(bundleB._id),
      status: 'COMMITTED',
      startDate: new Date().toISOString(),
      endDate: new Date().toISOString()
    });

    const actor = { userId: String(user._id), displayName: user.name, email: user.email };
    const now = Date.now();

    await db.collection('events').insertMany([
      {
        _id: new ObjectId(),
        ts: new Date(now - 1000),
        type: 'milestones.milestone.statuschanged',
        actor,
        resource: { type: 'milestones.milestone', id: String(milestoneA._id), title: 'M1' },
        context: { bundleId: String(bundleA._id), milestoneId: String(milestoneA._id) },
        payload: { from: 'PLANNED', to: 'ACTIVE' }
      },
      {
        _id: new ObjectId(),
        ts: new Date(now - 2000),
        type: 'milestones.scope.approved',
        actor,
        resource: { type: 'milestones.milestone', id: String(milestoneA._id), title: 'M1' },
        context: { bundleId: String(bundleA._id), milestoneId: String(milestoneA._id) },
        payload: { action: 'ADD_ITEMS', workItemIds: ['A-1', 'A-2'] }
      },
      {
        _id: new ObjectId(),
        ts: new Date(now - 3000),
        type: 'criticalpath.action.executed',
        actor,
        resource: { type: 'workitems.workitem', id: 'A-9', title: 'A-9' },
        context: { bundleId: String(bundleA._id), milestoneId: String(milestoneA._id) },
        payload: { actionType: 'REQUEST_ESTIMATE', reason: 'Estimate needed.' }
      },
      {
        _id: new ObjectId(),
        ts: new Date(now - 4000),
        type: 'integrations.jira.sync.completed',
        actor,
        resource: { type: 'integrations.jira', id: 'jira', title: 'Jira Sync' }
      },
      {
        _id: new ObjectId(),
        ts: new Date(now - 5000),
        type: 'milestones.milestone.statuschanged',
        actor,
        resource: { type: 'milestones.milestone', id: String(milestoneB._id), title: 'M2' },
        context: { bundleId: String(bundleB._id), milestoneId: String(milestoneB._id) },
        payload: { from: 'PLANNED', to: 'ACTIVE' }
      }
    ]);

    const resProgram = await callRoute(GET, 'http://localhost/api/feed?scopeType=PROGRAM&limit=2', { method: 'GET' });
    assert.strictEqual((resProgram as Response).status, 200);
    const dataProgram = await (resProgram as Response).json();
    assert.strictEqual(Array.isArray(dataProgram.items), true);
    assert.strictEqual(dataProgram.items.length, 2);
    assert.ok(dataProgram.nextCursor, 'Expected nextCursor for pagination');
    const idsFirstPage = dataProgram.items.map((i: any) => i.id);

    const resProgramNext = await callRoute(
      GET,
      `http://localhost/api/feed?scopeType=PROGRAM&limit=2&cursor=${encodeURIComponent(dataProgram.nextCursor)}`,
      { method: 'GET' }
    );
    const dataNext = await (resProgramNext as Response).json();
    const idsSecondPage = dataNext.items.map((i: any) => i.id);
    idsSecondPage.forEach((id: string) => assert.ok(!idsFirstPage.includes(id), 'Expected pagination to advance'));

    const resMilestone = await callRoute(
      GET,
      `http://localhost/api/feed?scopeType=MILESTONE&scopeId=${encodeURIComponent(String(milestoneA._id))}`,
      { method: 'GET' }
    );
    const dataMilestone = await (resMilestone as Response).json();
    assert.ok(dataMilestone.items.length >= 3, 'Expected milestone-scoped events');
    const milestoneTitles = dataMilestone.items.map((i: any) => i.title);
    assert.ok(milestoneTitles.some((t: string) => t.toLowerCase().includes('milestone started')), 'Expected milestone status transform');
    assert.ok(milestoneTitles.some((t: string) => t.toLowerCase().includes('scope change approved')), 'Expected scope transform');
    assert.ok(milestoneTitles.some((t: string) => t.toLowerCase().includes('requested estimate')), 'Expected critical path transform');

    const resIntegrations = await callRoute(
      GET,
      'http://localhost/api/feed?scopeType=PROGRAM&filters=integrations',
      { method: 'GET' }
    );
    const dataIntegrations = await (resIntegrations as Response).json();
    assert.ok(dataIntegrations.items.length >= 1, 'Expected integration events when filtered');
    assert.ok(dataIntegrations.items[0].rawType.startsWith('integrations.'), 'Expected integration type');
  });

  console.log('feed tests passed');
};

if (!process.env.TEST_API_RUNNER) {
  run();
}
