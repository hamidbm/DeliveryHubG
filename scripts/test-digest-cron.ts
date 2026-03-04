import assert from 'node:assert';
import { ObjectId } from 'mongodb';
import { runTest, callRoute } from './test-harness';

export const run = async () => {
  await runTest('digest-cron', async ({ db, createUser }) => {
    process.env.DIGEST_CRON_SECRET = 'test-secret';

    const { user: userA } = await createUser({ name: 'Digest A', email: 'a@test.local', role: 'Engineering' });
    const { user: userB } = await createUser({ name: 'Digest B', email: 'b@test.local', role: 'Engineering' });

    await db.collection('notification_user_prefs').insertMany([
      { userId: String(userA._id), mutedTypes: [], digestOptIn: true },
      { userId: String(userB._id), mutedTypes: [], digestOptIn: true }
    ]);

    await db.collection('notification_digest_queue').insertMany([
      { _id: new ObjectId(), userId: String(userA._id), type: 'milestone.status.changed', title: 'M1 updated', body: 'M1', createdAt: new Date().toISOString() },
      { _id: new ObjectId(), userId: String(userB._id), type: 'dependency.crossbundle.created', title: 'Cross bundle', body: 'Blocker', createdAt: new Date().toISOString() }
    ]);

    const { POST: POST_CRON } = await import('../src/app/api/admin/notifications/digest/run/route');

    // Inject header manually
    const resWithHeader = await POST_CRON(new Request('http://localhost/api/admin/notifications/digest/run', {
      method: 'POST',
      headers: { 'X-Cron-Secret': 'test-secret' }
    }));

    assert.strictEqual(resWithHeader.status, 200, 'Expected cron to run');
    const data = await resWithHeader.json();
    assert.strictEqual(data.digestsSent, 2, 'Expected two digests sent');

    const notifCount = await db.collection('notifications').countDocuments({ type: 'digest.daily' });
    assert.strictEqual(notifCount, 2, 'Expected two digest notifications');

    const secondRun = await POST_CRON(new Request('http://localhost/api/admin/notifications/digest/run', {
      method: 'POST',
      headers: { 'X-Cron-Secret': 'test-secret' }
    }));
    const secondData = await secondRun.json();
    assert.strictEqual(secondData.digestsSent, 0, 'Expected idempotent run to send none');

    await db.collection('notification_digest_queue').insertOne({
      _id: new ObjectId(),
      userId: String(userA._id),
      type: 'milestone.status.changed',
      title: 'M2 updated',
      body: 'M2',
      createdAt: new Date().toISOString()
    });

    const dryRun = await POST_CRON(new Request('http://localhost/api/admin/notifications/digest/run?dryRun=true', {
      method: 'POST',
      headers: { 'X-Cron-Secret': 'test-secret' }
    }));
    const dryData = await dryRun.json();
    assert.strictEqual(dryData.digestsSent, 1, 'Expected dry run count');

    const notifCountAfterDry = await db.collection('notifications').countDocuments({ type: 'digest.daily' });
    assert.strictEqual(notifCountAfterDry, 2, 'Dry run should not write notifications');
  });

  console.log('digest cron tests passed');
};

if (!process.env.TEST_API_RUNNER) {
  run();
}
