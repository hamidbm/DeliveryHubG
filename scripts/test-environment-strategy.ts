import assert from 'node:assert';
import { ObjectId } from 'mongodb';
import { runTest, callRoute } from './test-harness';
import { GET as GET_ENV, PUT as PUT_ENV } from '../src/app/api/applications/[id]/environment-strategy/route';
import { GET as GET_LIFECYCLE, PUT as PUT_LIFECYCLE } from '../src/app/api/applications/[id]/lifecycle/route';

export const run = async () => {
  await runTest('environment-strategy', async ({ createUser, setAuthToken, db }) => {
    const { token } = await createUser({ name: 'Lifecycle Owner', email: 'lifecycle@demo.local', role: 'VP' });
    setAuthToken(token);
    (globalThis as any).__testToken = token;

    const appId = new ObjectId();
    await db.collection('applications').insertOne({
      _id: appId,
      aid: 'APP-ENV-1',
      name: 'Claims API',
      bundleId: 'B-9',
      status: { health: 'Healthy' },
      isActive: true
    });

    const emptyRes = await callRoute(GET_ENV, 'http://localhost/api/applications/id/environment-strategy', {
      method: 'GET',
      params: { id: String(appId) }
    });
    assert.strictEqual((emptyRes as Response).status, 200);
    const emptyBody = await (emptyRes as Response).json();
    assert.ok(Array.isArray(emptyBody?.strategy?.environments), 'Expected default strategy environments');

    const putRes = await callRoute(PUT_ENV, 'http://localhost/api/applications/id/environment-strategy', {
      method: 'PUT',
      params: { id: String(appId) },
      body: {
        environments: [
          { name: 'DEV', order: 1, description: 'Development' },
          { name: 'QA', order: 2, description: 'Quality' },
          { name: 'PROD', order: 3, description: 'Production' }
        ]
      }
    });
    assert.strictEqual((putRes as Response).status, 200);
    const putBody = await (putRes as Response).json();
    assert.strictEqual((putBody?.strategy?.environments || []).length, 3);

    const lifePutRes = await callRoute(PUT_LIFECYCLE, 'http://localhost/api/applications/id/lifecycle', {
      method: 'PUT',
      params: { id: String(appId) },
      body: {
        lifecycleStage: 'MAINTENANCE',
        lifecycleOwner: 'Lifecycle Council',
        lifecycleNotes: 'Stabilization period'
      }
    });
    assert.strictEqual((lifePutRes as Response).status, 200);
    const lifeBody = await (lifePutRes as Response).json();
    assert.strictEqual(lifeBody?.lifecycle?.lifecycleStage, 'MAINTENANCE');

    const lifeGetRes = await callRoute(GET_LIFECYCLE, 'http://localhost/api/applications/id/lifecycle', {
      method: 'GET',
      params: { id: String(appId) }
    });
    assert.strictEqual((lifeGetRes as Response).status, 200);
    const lifeGet = await (lifeGetRes as Response).json();
    assert.strictEqual(lifeGet?.lifecycle?.lifecycleStage, 'MAINTENANCE');

    const updatedApp = await db.collection('applications').findOne({ _id: appId });
    assert.strictEqual(updatedApp?.lifecycleStatus, 'MAINTENANCE');
  });
  (globalThis as any).__testToken = null;

  console.log('environment strategy tests passed');
};

if (!process.env.TEST_API_RUNNER) {
  run();
}
