import assert from 'node:assert';
import { ObjectId } from 'mongodb';
import { runTest, callRoute } from './test-harness';
import { computeMilestoneRollup, computeSprintRollups } from '../src/services/db';

export const run = async () => {
  await runTest('data-quality', async ({ db, createUser, createBundle, createMilestone, createWorkItem, setAuthToken }) => {
    const { user: admin, token: adminToken } = await createUser({
      name: 'Admin User',
      email: 'admin@quality.local',
      role: 'Admin'
    });

    const bundle = await createBundle('Quality Bundle');
    const milestone = await createMilestone({
      name: 'Quality M1',
      bundleId: String(bundle._id),
      status: 'COMMITTED',
      startDate: new Date().toISOString(),
      endDate: new Date().toISOString()
    });

    const sprintId = new ObjectId();
    await db.collection('workitems_sprints').insertOne({
      _id: sprintId,
      name: 'Sprint Q1',
      status: 'ACTIVE',
      bundleId: String(bundle._id),
      startDate: new Date().toISOString(),
      endDate: new Date().toISOString()
    });

    for (let i = 0; i < 5; i += 1) {
      await createWorkItem({
        key: `Q-${i + 1}`,
        title: `Missing fields ${i + 1}`,
        bundleId: String(bundle._id),
        milestoneIds: [String(milestone._id)],
        status: 'TODO',
        type: 'STORY'
      });
    }

    await createWorkItem({
      key: 'Q-R1',
      title: 'Risk missing severity',
      bundleId: String(bundle._id),
      milestoneIds: [String(milestone._id)],
      status: 'TODO',
      type: 'RISK'
    });

    const rollup = await computeMilestoneRollup(String(milestone._id));
    assert.ok(rollup?.dataQuality, 'Expected dataQuality');
    assert.ok(rollup.dataQuality.score < 50, 'Expected low data quality');
    const issueKeys = rollup.dataQuality.issues.map((i: any) => i.key);
    assert.ok(issueKeys.includes('missingStoryPoints'), 'Expected missingStoryPoints issue');
    assert.ok(issueKeys.includes('missingAssignee'), 'Expected missingAssignee issue');

    const sprintRollups = await computeSprintRollups({ sprintIds: [String(sprintId)] });
    assert.ok(sprintRollups[0]?.dataQuality, 'Expected sprint dataQuality');

    const { PATCH: PATCH_MILESTONE } = await import('../src/app/api/milestones/[id]/route');
    setAuthToken(adminToken);
    (globalThis as any).__testToken = adminToken;
    const blockedRes = await callRoute(PATCH_MILESTONE, 'http://localhost/api/milestones/quality', {
      method: 'PATCH',
      params: { id: String(milestone._id) },
      body: { status: 'IN_PROGRESS' }
    });
    assert.strictEqual(blockedRes.status, 409, 'Expected readiness block on low data quality');

    const overrideRes = await callRoute(PATCH_MILESTONE, 'http://localhost/api/milestones/quality', {
      method: 'PATCH',
      params: { id: String(milestone._id) },
      body: { status: 'IN_PROGRESS', allowOverride: true, overrideReason: 'Proceed' }
    });
    assert.strictEqual(overrideRes.status, 200, 'Expected override to succeed');

    const { PATCH: PATCH_BULK } = await import('../src/app/api/work-items/bulk/route');
    const ids = (await db.collection('workitems').find({ milestoneIds: String(milestone._id) }).toArray()).map((i: any) => String(i._id));
    const bulkRes = await callRoute(PATCH_BULK, 'http://localhost/api/work-items/bulk', {
      method: 'PATCH',
      body: { ids, updates: { storyPoints: 3, dueAt: new Date().toISOString() } }
    });
    const bulkBody = await bulkRes.json();
    assert.strictEqual(bulkRes.status, 200, `Expected bulk fix to succeed (${JSON.stringify(bulkBody)})`);

    const improved = await computeMilestoneRollup(String(milestone._id));
    assert.ok(improved?.dataQuality?.score >= rollup.dataQuality.score, 'Expected data quality to improve');
  });

  console.log('data quality tests passed');
};

if (!process.env.TEST_API_RUNNER) {
  run();
}
