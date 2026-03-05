import assert from 'node:assert';
import { ObjectId } from 'mongodb';
import { runTest, callRoute } from './test-harness';

export const run = async () => {
  await runTest('onboarding', async ({ db, createUser, setAuthToken }) => {
    const { user: adminUser, token: adminToken } = await createUser({
      name: 'Admin User',
      email: 'admin@test.local',
      role: 'CMO Member'
    });

    const { user: ownerUser, token: ownerToken } = await createUser({
      name: 'Owner User',
      email: 'owner@test.local',
      role: 'Engineering'
    });

    await db.collection('bundle_assignments').insertOne({
      _id: new ObjectId(),
      bundleId: 'B1',
      userId: String(ownerUser._id),
      assignmentType: 'bundle_owner',
      active: true
    });

    const { user: engUser, token: engToken } = await createUser({
      name: 'Engineer',
      email: 'eng@test.local',
      role: 'Engineering'
    });

    const { GET, PATCH } = await import('../src/app/api/user/onboarding/route');

    setAuthToken(adminToken);
    (globalThis as any).__testToken = adminToken;
    const adminRes = await callRoute(GET, 'http://localhost/api/user/onboarding', { method: 'GET' });
    assert.strictEqual(adminRes.status, 200, 'Expected admin onboarding fetch');
    const adminBody = await adminRes.json();
    assert.strictEqual(adminBody.onboarding.role, 'ADMIN', 'Expected ADMIN role inference');

    setAuthToken(ownerToken);
    (globalThis as any).__testToken = ownerToken;
    const ownerRes = await callRoute(GET, 'http://localhost/api/user/onboarding', { method: 'GET' });
    const ownerBody = await ownerRes.json();
    assert.strictEqual(ownerBody.onboarding.role, 'PM', 'Expected PM role inference for bundle owner');

    setAuthToken(engToken);
    (globalThis as any).__testToken = engToken;
    const engRes = await callRoute(GET, 'http://localhost/api/user/onboarding', { method: 'GET' });
    const engBody = await engRes.json();
    assert.strictEqual(engBody.onboarding.role, 'ENGINEER', 'Expected ENGINEER default role');

    const patchRes = await callRoute(PATCH, 'http://localhost/api/user/onboarding', {
      method: 'PATCH',
      body: { completeStepId: 'digest_prefs', dismissTipId: 'p80_hit' }
    });
    assert.strictEqual(patchRes.status, 200, 'Expected onboarding patch');
    const patchBody = await patchRes.json();
    assert.ok(patchBody.onboarding.completedSteps.includes('digest_prefs'), 'Expected step completion');
    assert.ok(patchBody.onboarding.dismissedTips.includes('p80_hit'), 'Expected tip dismissal');

    const roleRes = await callRoute(PATCH, 'http://localhost/api/user/onboarding', {
      method: 'PATCH',
      body: { role: 'EXEC' }
    });
    const roleBody = await roleRes.json();
    assert.strictEqual(roleBody.onboarding.role, 'EXEC', 'Expected role update');

    setAuthToken(adminToken);
    (globalThis as any).__testToken = adminToken;
    await callRoute(PATCH, 'http://localhost/api/user/onboarding', {
      method: 'PATCH',
      body: { role: 'ADMIN' }
    });
    const ownerAfter = await db.collection('user_onboarding').findOne({ userId: String(ownerUser._id) });
    assert.strictEqual(ownerAfter?.role, 'PM', 'Expected patch to only affect self');
  });

  console.log('onboarding tests passed');
};

if (!process.env.TEST_API_RUNNER) {
  run();
}
