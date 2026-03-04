import assert from 'node:assert';
import { ObjectId } from 'mongodb';
import { runTest, callRoute } from './test-harness';

export const run = async () => {
  await runTest('jira-mapping', async ({ db, createUser, createBundle, createWorkItem, setAuthToken }) => {
    process.env.JIRA_HOST = 'https://jira.example.com';
    process.env.JIRA_EMAIL = 'admin@example.com';
    process.env.JIRA_API_TOKEN = 'token';
    process.env.JIRA_PROJECT_KEYS = 'ABC';

    const bundle = await createBundle('ABC');
    await db.collection('bundles').updateOne({ _id: bundle._id }, { $set: { key: 'ABC' } });

    const { user: admin, token: adminToken } = await createUser({
      name: 'Admin User',
      email: 'admin@jira.local',
      role: 'Admin'
    });

    const existing = await createWorkItem({
      key: 'ABC-1',
      title: 'Existing',
      status: 'TODO',
      storyPoints: 1,
      bundleId: String(bundle._id),
      milestoneIds: ['M1'],
      jira: { host: 'https://jira.example.com', key: 'ABC-1', issueId: '10001' }
    });

    (globalThis as any).__jiraMock = {
      searchIssues: async () => ({
        total: 2,
        issues: [
          {
            id: '10001',
            key: 'ABC-1',
            fields: {
              summary: 'Updated title',
              status: { name: 'In Progress' },
              assignee: { displayName: 'User A' },
              project: { key: 'ABC' },
              customfield_10026: 5
            }
          },
          {
            id: '10002',
            key: 'ABC-2',
            fields: {
              summary: 'New issue',
              status: { name: 'To Do' },
              assignee: { displayName: 'User B' },
              project: { key: 'ABC' },
              customfield_10026: 3
            }
          }
        ]
      })
    };

    const { POST: POST_SYNC } = await import('../src/app/api/admin/integrations/jira/sync/route');

    setAuthToken(adminToken);
    (globalThis as any).__testToken = adminToken;
    const syncRes = await callRoute(POST_SYNC, 'http://localhost/api/admin/integrations/jira/sync', {
      method: 'POST',
      body: { mode: 'UPSERT', limit: 10 }
    });
    assert.strictEqual(syncRes.status, 200, 'Expected sync to succeed');
    const body = await syncRes.json();
    assert.strictEqual(body.created, 1);
    assert.strictEqual(body.updated, 1);

    const updatedExisting = await db.collection('workitems').findOne({ _id: existing._id });
    assert.strictEqual(updatedExisting?.title, 'Updated title');
    assert.strictEqual(updatedExisting?.status, 'IN_PROGRESS');
    assert.strictEqual(updatedExisting?.storyPoints, 5);
    assert.strictEqual(updatedExisting?.assignedTo, 'User A');
    assert.deepStrictEqual(updatedExisting?.milestoneIds, ['M1'], 'MilestoneIds should remain unchanged');
    assert.strictEqual(String(updatedExisting?.bundleId), String(bundle._id), 'BundleId should remain unchanged');

    const newItem = await db.collection('workitems').findOne({ key: 'ABC-2' });
    assert.ok(newItem, 'Expected new item to be created');
    assert.strictEqual(newItem?.jira?.key, 'ABC-2');

    const syncRes2 = await callRoute(POST_SYNC, 'http://localhost/api/admin/integrations/jira/sync', {
      method: 'POST',
      body: { mode: 'IMPORT_ONLY', limit: 10 }
    });
    const body2 = await syncRes2.json();
    assert.strictEqual(body2.created, 0);
  });

  console.log('jira mapping tests passed');
};

if (!process.env.TEST_API_RUNNER) {
  run();
}
