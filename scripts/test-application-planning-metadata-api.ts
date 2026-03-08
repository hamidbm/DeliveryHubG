import assert from 'node:assert';
import { ObjectId } from 'mongodb';
import { runTest, callRoute } from './test-harness';
import { GET as GET_META, PUT as PUT_META } from '../src/app/api/applications/[id]/planning-metadata/route';
import { GET as GET_CONTEXT } from '../src/app/api/applications/[id]/planning-context/route';
import { GET as GET_SCOPED, PUT as PUT_SCOPED } from '../src/app/api/applications/planning-metadata/route';

export const run = async () => {
  await runTest('application-planning-metadata-api', async ({ db, createUser, setAuthToken }) => {
    const { token } = await createUser({ name: 'Planner', email: 'planner@demo.local', role: 'Engineering PM' });
    setAuthToken(token);

    const bundleId = new ObjectId();
    await db.collection('bundles').insertOne({ _id: bundleId, name: 'Bundle Delta' });

    const appId = new ObjectId();
    await db.collection('applications').insertOne({
      _id: appId,
      aid: 'APP-200',
      name: 'Beacon',
      bundleId: String(bundleId),
      isActive: true,
      status: { health: 'Healthy' }
    });

    const resEmpty = await callRoute(GET_META, 'http://localhost/api/applications/app/planning-metadata', {
      method: 'GET',
      params: { id: String(appId) }
    });
    assert.strictEqual((resEmpty as Response).status, 200);
    const emptyData = await (resEmpty as Response).json();
    assert.strictEqual(emptyData.applicationId, String(appId));
    assert.strictEqual(emptyData.bundleId, String(bundleId));

    const resPut = await callRoute(PUT_META, 'http://localhost/api/applications/app/planning-metadata', {
      method: 'PUT',
      params: { id: String(appId) },
      body: {
        planningMetadata: {
          scopeType: 'application',
          scopeId: String(appId),
          applicationId: String(appId),
          bundleId: String(bundleId),
          environments: [
            { name: 'DEV', startDate: '2026-04-01', durationDays: 4, endDate: '2026-04-05' }
          ],
          planningDefaults: {
            milestoneCount: 3,
            sprintDurationWeeks: 2
          },
          capacityDefaults: {
            capacityModel: 'TEAM_VELOCITY',
            deliveryTeams: 2
          }
        }
      }
    });
    assert.strictEqual((resPut as Response).status, 200);
    const putData = await (resPut as Response).json();
    assert.strictEqual(putData.planningMetadata?.planningDefaults?.milestoneCount, 3);

    const resContext = await callRoute(GET_CONTEXT, 'http://localhost/api/applications/app/planning-context', {
      method: 'GET',
      params: { id: String(appId) }
    });
    assert.strictEqual((resContext as Response).status, 200);
    const contextData = await (resContext as Response).json();
    assert.ok(contextData.resolvedMetadata);

    const resScopedPut = await callRoute(PUT_SCOPED, 'http://localhost/api/applications/planning-metadata', {
      method: 'PUT',
      body: {
        scopeType: 'bundle',
        scopeId: String(bundleId),
        bundleId: String(bundleId),
        environments: [
          { name: 'UAT', startDate: '2026-05-01', durationDays: 4, endDate: '2026-05-05' }
        ]
      }
    });
    assert.strictEqual((resScopedPut as Response).status, 200);

    const resScopedGet = await callRoute(GET_SCOPED, `http://localhost/api/applications/planning-metadata?scopeType=bundle&scopeId=${String(bundleId)}`, {
      method: 'GET'
    });
    assert.strictEqual((resScopedGet as Response).status, 200);
    const scopedData = await (resScopedGet as Response).json();
    assert.ok(scopedData.planningMetadata?.environments?.length);
  });

  console.log('application planning metadata api tests passed');
};

if (!process.env.TEST_API_RUNNER) {
  run();
}
