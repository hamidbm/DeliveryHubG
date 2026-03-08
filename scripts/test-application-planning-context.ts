import assert from 'node:assert';
import { ObjectId } from 'mongodb';
import { runTest, callRoute } from './test-harness';
import { GET as GET_CONTEXT } from '../src/app/api/applications/[id]/planning-context/route';

export const run = async () => {
  await runTest('application-planning-context', async ({ db, createUser, setAuthToken }) => {
    const { token } = await createUser({ name: 'Planner', email: 'planner@demo.local', role: 'Engineering PM' });
    setAuthToken(token);

    const bundleId = new ObjectId();
    await db.collection('bundles').insertOne({ _id: bundleId, name: 'Bundle Echo' });

    const appId = new ObjectId();
    await db.collection('applications').insertOne({
      _id: appId,
      aid: 'APP-300',
      name: 'Comet',
      bundleId: String(bundleId),
      isActive: true,
      status: { health: 'Healthy' }
    });

    await db.collection('application_planning_metadata').insertOne({
      scopeType: 'bundle',
      scopeId: String(bundleId),
      bundleId: String(bundleId),
      environments: [
        { name: 'UAT', startDate: '2026-06-01', durationDays: 4, endDate: '2026-06-05' }
      ],
      goLive: { planned: '2026-06-10' },
      planningDefaults: { milestoneCount: 4 }
    });

    await db.collection('application_planning_metadata').insertOne({
      scopeType: 'application',
      scopeId: String(appId),
      applicationId: String(appId),
      bundleId: String(bundleId),
      environments: [
        { name: 'UAT', startDate: '2026-06-03' }
      ]
    });

    const res = await callRoute(GET_CONTEXT, 'http://localhost/api/applications/app/planning-context', {
      method: 'GET',
      params: { id: String(appId) }
    });
    assert.strictEqual((res as Response).status, 200);
    const data = await (res as Response).json();
    const resolved = data.resolvedMetadata;
    assert.ok(resolved);
    const uat = (resolved.environments || []).find((row: any) => row.name === 'UAT');
    assert.strictEqual(uat?.startDate, '2026-06-03');
  });

  console.log('application planning context tests passed');
};

if (!process.env.TEST_API_RUNNER) {
  run();
}
