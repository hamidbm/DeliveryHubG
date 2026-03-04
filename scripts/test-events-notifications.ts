import assert from 'node:assert';
import { NextRequest } from 'next/server';
import { runTest } from './test-harness';
import { SignJWT } from 'jose';

export const run = async () => {
  await runTest('events-notifications', async ({ db, createUser, createBundle, createMilestone, createWorkItem, setAuthToken }) => {
    const { user: admin, token: sessionToken } = await createUser({ name: 'Admin User', email: 'admin@test.local', role: 'Admin' });
    setAuthToken(sessionToken);

    const bundleA = await createBundle('Bundle A');
    const bundleB = await createBundle('Bundle B');

    const milestone = await createMilestone({
      name: 'M1',
      bundleId: String(bundleA._id),
      status: 'COMMITTED',
      targetCapacity: 5,
      startDate: new Date().toISOString(),
      endDate: new Date().toISOString()
    });
    const milestoneCap = await createMilestone({
      name: 'M2',
      bundleId: String(bundleA._id),
      status: 'COMMITTED',
      targetCapacity: 5,
      startDate: new Date().toISOString(),
      endDate: new Date().toISOString()
    });

    const workItem = await createWorkItem({
      key: 'A-1',
      title: 'Bundle A work',
      type: 'TASK',
      status: 'TODO',
      storyPoints: 10,
      bundleId: String(bundleA._id),
      milestoneIds: [String(milestone._id)],
      links: []
    });

    const { PATCH: PATCH_MILESTONE } = await import('../src/app/api/milestones/[id]/route');
    const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'nexus_super_secret_key_123');
    const testToken = await new SignJWT({
      id: String(admin._id),
      userId: String(admin._id),
      name: admin.name,
      email: admin.email,
      role: admin.role,
      team: admin.team
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('2h')
      .sign(secret);
    (globalThis as any).__testToken = testToken;
    const reqBlocked = new NextRequest(`http://localhost/api/milestones/${milestone._id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'IN_PROGRESS' })
    });
    const resBlocked = await PATCH_MILESTONE(reqBlocked, { params: Promise.resolve({ id: String(milestone._id) }) });
    if (resBlocked.status !== 409) {
      const body = await resBlocked.json().catch(() => ({}));
      console.error('[test:events] readiness blocked response', resBlocked.status, body);
      throw new Error(`Expected 409 readiness blocked; got ${resBlocked.status}. ${JSON.stringify(body)}`);
    }
    const readinessNotif = await db.collection('notifications').findOne({ type: 'milestone.readiness.blocked' });
    assert.ok(readinessNotif, 'Expected readiness blocked notification');

    const reqOverride = new NextRequest(`http://localhost/api/milestones/${milestone._id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: 'IN_PROGRESS',
        allowOverride: true,
        overrideReason: 'testing'
      })
    });
    const resOverride = await PATCH_MILESTONE(reqOverride, { params: Promise.resolve({ id: String(milestone._id) }) });
    assert.strictEqual(resOverride.status, 200, 'Expected override to succeed');
    const statusNotif = await db.collection('notifications').findOne({ type: 'milestone.status.changed' });
    const overrideNotif = await db.collection('notifications').findOne({ type: 'milestone.status.override' });
    assert.ok(statusNotif, 'Expected milestone status notification');
    assert.ok(overrideNotif, 'Expected milestone override notification');

    const statusEvent = await db.collection('events').findOne({ type: 'milestones.milestone.statuschanged' });
    assert.ok(statusEvent, 'Expected milestone status change event');

    const { PATCH: PATCH_WORKITEM } = await import('../src/app/api/work-items/[id]/route');
    (globalThis as any).__testToken = testToken;
    const reqCapacity = new NextRequest(`http://localhost/api/work-items/${workItem._id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        milestoneIds: [String(milestoneCap._id)],
        storyPoints: 10,
        allowOverCapacity: true
      })
    });
    const resCapacity = await PATCH_WORKITEM(reqCapacity, { params: Promise.resolve({ id: String(workItem._id) }) });
    assert.strictEqual(resCapacity.status, 200, 'Expected capacity override update');
    const capacityNotif = await db.collection('notifications').findOne({ type: 'milestone.capacity.override' });
    assert.ok(capacityNotif, 'Expected capacity override notification');

    const targetItem = await createWorkItem({
      key: 'B-1',
      title: 'Bundle B work',
      type: 'TASK',
      status: 'TODO',
      bundleId: String(bundleB._id),
      links: []
    });
    const reqBlocks = new NextRequest(`http://localhost/api/work-items/${workItem._id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        links: [{ type: 'BLOCKS', targetId: String(targetItem._id) }]
      })
    });
    const resBlocks = await PATCH_WORKITEM(reqBlocks, { params: Promise.resolve({ id: String(workItem._id) }) });
    assert.strictEqual(resBlocks.status, 200, 'Expected BLOCKS link update');
    const depNotif = await db.collection('notifications').findOne({ type: 'dependency.crossbundle.created' });
    assert.ok(depNotif, 'Expected cross-bundle dependency notification');

    const notifRecipient = await db.collection('notifications').findOne({ recipient: admin.name });
    assert.ok(notifRecipient, 'Expected notifications sent to actor/admin');
  });

  console.log('events + notifications tests passed');
};

if (!process.env.TEST_API_RUNNER) {
  run();
}
