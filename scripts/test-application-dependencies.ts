import assert from 'node:assert';
import { ObjectId } from 'mongodb';
import { runTest, callRoute } from './test-harness';
import { GET as GET_DEPS, POST as POST_DEPS } from '../src/app/api/application-dependencies/route';
import { DELETE as DELETE_DEP } from '../src/app/api/application-dependencies/[id]/route';
import { GET as GET_APP_DEPS } from '../src/app/api/applications/[id]/dependencies/route';
import { GET as GET_IMPACT } from '../src/app/api/applications/[id]/delivery-impact/route';

export const run = async () => {
  await runTest('application-dependencies', async ({ createUser, setAuthToken, db, createWorkItem }) => {
    const { token } = await createUser({ name: 'APM Engineer', email: 'apm.engineer@demo.local', role: 'Engineering Architect' });
    setAuthToken(token);
    (globalThis as any).__testToken = token;

    const appA = new ObjectId();
    const appB = new ObjectId();
    await db.collection('applications').insertMany([
      { _id: appA, aid: 'APP-A', id: 'app-a', name: 'Customer Portal', bundleId: 'B-1', status: { health: 'Healthy' }, isActive: true, releaseTrain: 'Q1' },
      { _id: appB, aid: 'APP-B', id: 'app-b', name: 'Identity Service', bundleId: 'B-1', status: { health: 'Healthy' }, isActive: true, releaseTrain: 'Q1' }
    ]);

    const milestoneId = new ObjectId();
    await db.collection('milestones').insertOne({ _id: milestoneId, name: 'M1' });
    await createWorkItem({ key: 'WI-1', title: 'Integration task', bundleId: 'B-1', applicationId: String(appA), milestoneIds: [String(milestoneId)] });

    const createRes = await callRoute(POST_DEPS, 'http://localhost/api/application-dependencies', {
      method: 'POST',
      body: {
        sourceApplicationId: String(appA),
        targetApplicationId: String(appB),
        dependencyType: 'API',
        criticality: 'HIGH'
      }
    });
    assert.strictEqual((createRes as Response).status, 201);
    const created = await (createRes as Response).json();
    assert.ok(created?.item?._id, 'Expected dependency id');

    const listRes = await callRoute(GET_DEPS, 'http://localhost/api/application-dependencies', { method: 'GET' });
    assert.strictEqual((listRes as Response).status, 200);
    const listBody = await (listRes as Response).json();
    assert.ok(Array.isArray(listBody?.items) && listBody.items.length === 1, 'Expected one dependency');

    const appDepsRes = await callRoute(GET_APP_DEPS, 'http://localhost/api/applications/id/dependencies', {
      method: 'GET',
      params: { id: String(appA) }
    });
    assert.strictEqual((appDepsRes as Response).status, 200);
    const appDeps = await (appDepsRes as Response).json();
    assert.strictEqual((appDeps?.items || []).length, 1);

    const impactRes = await callRoute(GET_IMPACT, 'http://localhost/api/applications/id/delivery-impact', {
      method: 'GET',
      params: { id: String(appA) }
    });
    assert.strictEqual((impactRes as Response).status, 200);
    const impact = await (impactRes as Response).json();
    assert.strictEqual(impact?.summary?.outboundDependencies, 1);
    assert.ok(impact?.summary?.impactedMilestones >= 1);

    const deleteRes = await callRoute(DELETE_DEP, 'http://localhost/api/application-dependencies/id', {
      method: 'DELETE',
      params: { id: String(created.item._id) }
    });
    assert.strictEqual((deleteRes as Response).status, 200);

    const listAfterRes = await callRoute(GET_DEPS, 'http://localhost/api/application-dependencies', { method: 'GET' });
    const listAfter = await (listAfterRes as Response).json();
    assert.strictEqual((listAfter?.items || []).length, 0);
  });
  (globalThis as any).__testToken = null;

  console.log('application dependencies tests passed');
};

if (!process.env.TEST_API_RUNNER) {
  run();
}
