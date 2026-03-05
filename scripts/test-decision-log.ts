import assert from 'node:assert';
import { ObjectId } from 'mongodb';
import { runTest, callRoute } from './test-harness';
import { getDeliveryPolicy, saveDeliveryPolicy } from '../src/services/policy';

export const run = async () => {
  await runTest('decision-log', async ({ db, createUser, createBundle, createMilestone, createWorkItem, setAuthToken }) => {
    const { user: adminUser, token: adminToken } = await createUser({
      name: 'Admin User',
      email: 'admin@decision.local',
      role: 'Admin'
    });
    const { user: ownerUser, token: ownerToken } = await createUser({
      name: 'Bundle Owner',
      email: 'owner@decision.local',
      role: 'SVP PM'
    });
    const { user: outsiderUser, token: outsiderToken } = await createUser({
      name: 'Outsider',
      email: 'outsider@decision.local',
      role: 'Engineering'
    });

    const bundle = await createBundle('Decision Bundle');
    const bundleId = String(bundle._id);
    await db.collection('bundles').updateOne({ _id: bundle._id }, { $set: { visibility: 'PRIVATE' } });
    await db.collection('bundle_assignments').insertOne({
      _id: new ObjectId(),
      bundleId,
      userId: String(ownerUser._id),
      assignmentType: 'bundle_owner',
      active: true,
      createdAt: new Date().toISOString()
    });

    const milestone = await createMilestone({
      name: 'Decision M1',
      bundleId,
      status: 'Planned',
      startDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      endDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()
    });

    setAuthToken(ownerToken);
    (globalThis as any).__testToken = ownerToken;
    const { POST: createDecision } = await import('../src/app/api/decisions/route');
    const createRes = await callRoute(createDecision, 'http://localhost/api/decisions', {
      method: 'POST',
      body: {
        scopeType: 'MILESTONE',
        scopeId: String(milestone._id),
        decisionType: 'RISK_ACCEPTED',
        title: 'Accept vendor risk',
        rationale: 'Vendor dependency accepted for week 2 to unblock scope.',
        outcome: 'APPROVED',
        severity: 'warn',
        related: {
          milestoneId: String(milestone._id),
          bundleId
        }
      }
    });
    assert.strictEqual(createRes.status, 200, 'Expected decision create');
    const createBody = await createRes.json();
    assert.ok(createBody?.decision?._id, 'Expected decision created');

    setAuthToken(outsiderToken);
    (globalThis as any).__testToken = outsiderToken;
    const { GET: listDecisions } = await import('../src/app/api/decisions/route');
    const listRes = await callRoute(listDecisions, `http://localhost/api/decisions?scopeType=MILESTONE&scopeId=${milestone._id}`, {
      method: 'GET'
    });
    assert.strictEqual(listRes.status, 403, 'Expected visibility enforcement');

    const basePolicy = await getDeliveryPolicy();
    await saveDeliveryPolicy({
      ...basePolicy,
      commitReview: {
        ...basePolicy.commitReview,
        enabled: true,
        minHitProbability: 0,
        blockIfP80AfterEndDate: false,
        maxCriticalStale: 10,
        maxHighRisks: 10,
        capacityOvercommitThreshold: 1000
      }
    });

    await createWorkItem({
      key: 'DEC-1',
      title: 'Decision scope seed',
      bundleId,
      milestoneIds: [String(milestone._id)],
      type: 'STORY',
      storyPoints: 3,
      status: 'TODO'
    });

    setAuthToken(adminToken);
    (globalThis as any).__testToken = adminToken;
    const { POST: submitCommit } = await import('../src/app/api/milestones/[id]/commit-review/submit/route');
    const commitRes = await callRoute(submitCommit, `http://localhost/api/milestones/${milestone._id}/commit-review/submit`, {
      method: 'POST',
      body: { decision: 'OVERRIDE', overrideReason: 'Override readiness for dependency window' },
      params: { id: String(milestone._id) }
    });
    assert.strictEqual(commitRes.status, 200, 'Expected commit override');

    const overrideDecision = await db.collection('decision_log').findOne({
      decisionType: 'COMMIT_OVERRIDE',
      'related.milestoneId': String(milestone._id)
    });
    assert.ok(overrideDecision, 'Expected auto-created decision for commit override');

    const { GET: briefGet } = await import('../src/app/api/briefs/weekly/route');
    const briefRes = await callRoute(briefGet, `http://localhost/api/briefs/weekly?scopeType=MILESTONE&scopeId=${milestone._id}`, {
      method: 'GET'
    });
    const briefBody = await briefRes.json();
    const bullets: string[] = briefBody?.brief?.summary?.bullets || [];
    const hasDecisions = bullets.some((b) => String(b).toLowerCase().includes('decisions'));
    assert.ok(hasDecisions, 'Expected decisions in weekly brief');
  });

  console.log('decision log tests passed');
};

if (!process.env.TEST_API_RUNNER) {
  run();
}
