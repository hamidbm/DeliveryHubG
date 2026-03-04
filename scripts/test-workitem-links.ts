import assert from 'node:assert';
import { execSync } from 'node:child_process';
import { ObjectId } from 'mongodb';
import { runTest } from './test-harness';

export const run = async () => {
  await runTest('workitem-links', async ({ db, uri, createUser, setAuthToken }) => {
    const workitems = db.collection('workitems');
    await workitems.deleteMany({});

    const aId = new ObjectId();
    const bId = new ObjectId();
    const cId = new ObjectId();

    await workitems.insertMany([
      { _id: aId, key: 'A-1', title: 'A', status: 'TODO', links: [{ type: 'BLOCKS', targetId: String(bId) }] },
      { _id: bId, key: 'B-1', title: 'B', status: 'TODO', links: [{ type: 'BLOCKS', targetId: String(cId) }] },
      { _id: cId, key: 'C-1', title: 'C', status: 'TODO', links: [] }
    ]);

    const { detectBlocksCycle, fetchWorkItemById } = await import('../src/services/db');
    const { GET } = await import('../src/app/api/work-items/[id]/route');

    const hasCycle = await detectBlocksCycle(String(cId), String(aId));
    assert.strictEqual(hasCycle, true, 'Expected BLOCKS cycle detection to return true');

    const blockedItem = await fetchWorkItemById(String(bId));
    assert.strictEqual(blockedItem?.isBlocked, true, 'Expected derived isBlocked to be true');

    const { token } = await createUser({ name: 'Tester', email: 'tester@test.local', role: 'Admin' });
    setAuthToken(token);
    (globalThis as any).__testToken = token;

    const apiRes = await GET(new Request(`http://localhost/api/work-items/${bId}`), { params: Promise.resolve({ id: String(bId) }) });
    const apiItem = await apiRes.json();
    assert.strictEqual(typeof apiItem.isBlocked, 'boolean', 'Expected isBlocked boolean in API response');
    assert.ok(apiItem.linkSummary, 'Expected linkSummary in API response');
    assert.ok(Array.isArray(apiItem.linkSummary.blockedBy), 'Expected blockedBy list in linkSummary');

    const legacySourceId = new ObjectId();
    const legacyTargetId = new ObjectId();
    await workitems.insertMany([
      { _id: legacySourceId, key: 'L-1', title: 'Legacy Source', status: 'TODO', links: [{ type: 'IS_BLOCKED_BY', targetId: String(legacyTargetId) }] },
      { _id: legacyTargetId, key: 'L-2', title: 'Legacy Target', status: 'TODO', links: [] }
    ]);

    execSync('node scripts/migrate-workitem-links-canonical.js', { stdio: 'ignore', env: { ...process.env, MONGODB_URI: uri } });
    execSync('node scripts/migrate-workitem-links-canonical.js', { stdio: 'ignore', env: { ...process.env, MONGODB_URI: uri } });

    const legacySource = await workitems.findOne({ _id: legacySourceId });
    const legacyTarget = await workitems.findOne({ _id: legacyTargetId });

    assert.ok(!legacySource?.links?.some((l: any) => l.type === 'IS_BLOCKED_BY'), 'Expected legacy inverse link to be removed');
    const canonicalLinks = (legacyTarget?.links || []).filter((l: any) => l.type === 'BLOCKS' && String(l.targetId) === String(legacySourceId));
    assert.strictEqual(canonicalLinks.length, 1, 'Expected canonical BLOCKS link to be present exactly once');
  });

  console.log('workitem link tests passed');
};

if (!process.env.TEST_API_RUNNER) {
  run();
}
