import assert from 'node:assert';
import { runTest, callRoute } from './test-harness';
import { normalizeEventType } from '../src/services/eventsTaxonomy';
import { emitEvent } from '../src/services/db';

export const run = async () => {
  await runTest('event-taxonomy', async ({ db, createUser, setAuthToken }) => {
    const { token } = await createUser({
      name: 'Admin User',
      email: 'admin@events.local',
      role: 'Admin'
    });
    setAuthToken(token);
    (globalThis as any).__testToken = token;

    const normalized = normalizeEventType('workitem.github.linked');
    assert.strictEqual(normalized.canonicalType, 'workitem.github.pr.linked');
    assert.strictEqual(normalized.category, 'integrations');
    assert.strictEqual(normalized.modulePrefix, 'workitem');

    await emitEvent({
      ts: new Date().toISOString(),
      type: 'workitem.github.linked',
      actor: { userId: 'tester', displayName: 'Tester' },
      resource: { type: 'workitems.item', id: 'WI-1', title: 'Sample' },
      payload: { prNumber: 12, prTitle: 'Add feature', prUrl: 'https://github.com/owner/repo/pull/12' }
    });

    const { GET: feedGet } = await import('../src/app/api/feed/route');
    const feedRes = await callRoute(feedGet, 'http://localhost/api/feed?filters=integrations&limit=10', {
      method: 'GET'
    });
    assert.strictEqual(feedRes.status, 200, 'Expected feed request to succeed');
    const feedData = await feedRes.json();
    const feedItem = Array.isArray(feedData?.items) ? feedData.items[0] : null;
    assert.ok(feedItem?.canonicalType === 'workitem.github.pr.linked', 'Expected feed to expose canonicalType');
    assert.ok(feedItem?.category === 'integrations', 'Expected feed to expose category');

    const { GET: adminGet } = await import('../src/app/api/admin/events/route');
    const adminRes = await callRoute(adminGet, 'http://localhost/api/admin/events?limit=1', {
      method: 'GET'
    });
    assert.strictEqual(adminRes.status, 200, 'Expected admin events to succeed');
    const adminData = await adminRes.json();
    const adminItem = Array.isArray(adminData?.items) ? adminData.items[0] : null;
    assert.ok(adminItem?.canonicalType, 'Expected admin events to include canonicalType');
    assert.ok(adminItem?.category, 'Expected admin events to include category');
  });

  console.log('event taxonomy tests passed');
};

if (!process.env.TEST_API_RUNNER) {
  run();
}
