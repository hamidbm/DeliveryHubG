import assert from 'node:assert';
import { runTest, callRoute } from './test-harness';

export const run = async () => {
  await runTest('github-integration', async ({ db, createUser, createWorkItem, setAuthToken }) => {
    process.env.GITHUB_TOKEN = 'test-token';
    process.env.GITHUB_REPOS = 'owner/repo';

    const { token } = await createUser({
      name: 'Admin User',
      email: 'admin@github.local',
      role: 'Admin'
    });
    setAuthToken(token);
    (globalThis as any).__testToken = token;

    await createWorkItem({
      key: 'ABC-1',
      title: 'GitHub linked work',
      bundleId: 'bundle-1',
      status: 'TODO',
      type: 'STORY'
    });

    const prBase = {
      number: 101,
      title: 'ABC-1 Implement GitHub sync',
      body: 'Fixes ABC-1',
      state: 'open',
      mergedAt: null,
      updatedAt: new Date().toISOString(),
      url: 'https://github.com/owner/repo/pull/101',
      author: 'octo',
      headRef: 'feature/ABC-1'
    };

    (globalThis as any).__githubMock = {
      listPullRequests: async () => [prBase]
    };

    const { POST } = await import('../src/app/api/admin/integrations/github/sync/route');
    const res = await callRoute(POST, 'http://localhost/api/admin/integrations/github/sync', {
      method: 'POST',
      body: { repo: 'owner/repo', limit: 10 }
    });
    assert.strictEqual(res.status, 200, 'Expected github sync to succeed');

    const link = await db.collection('github_links').findOne({ repo: 'owner/repo', prNumber: 101 });
    assert.ok(link, 'Expected github link to be created');
    const item = await db.collection('workitems').findOne({ key: 'ABC-1' });
    assert.ok(item?.github?.prs?.length === 1, 'Expected work item to include github PR');

    const linkedEvent = await db.collection('events').findOne({ type: 'workitem.github.linked' });
    assert.ok(linkedEvent, 'Expected linked event to be emitted');

    (globalThis as any).__githubMock = {
      listPullRequests: async () => [{ ...prBase, state: 'closed', mergedAt: new Date().toISOString() }]
    };

    await callRoute(POST, 'http://localhost/api/admin/integrations/github/sync', {
      method: 'POST',
      body: { repo: 'owner/repo', limit: 10 }
    });

    const mergedEvent = await db.collection('events').findOne({ type: 'workitem.github.merged' });
    assert.ok(mergedEvent, 'Expected merged event to be emitted');

    const linkCount = await db.collection('github_links').countDocuments({ repo: 'owner/repo', prNumber: 101 });
    assert.strictEqual(linkCount, 1, 'Expected github links to dedupe');
  });

  console.log('github integration tests passed');
};

if (!process.env.TEST_API_RUNNER) {
  run();
}
