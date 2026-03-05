import assert from 'node:assert';
import { ObjectId } from 'mongodb';
import { runTest, callRoute } from './test-harness';

export const run = async () => {
  await runTest('ops-metrics', async ({ db, createUser, setAuthToken }) => {
    const { user: admin, token: adminToken } = await createUser({ name: 'Ops Admin', email: 'ops@local', role: 'Admin' });
    const { user: standard, token: standardToken } = await createUser({ name: 'Ops User', email: 'ops-user@local', role: 'Engineering' });

    const now = new Date();
    const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    await db.collection('events').insertMany([
      {
        _id: new ObjectId(),
        ts: now,
        type: 'perf.commitdrift.run',
        payload: { name: 'job.commitdrift', at: now.toISOString(), durationMs: 1200, ok: true, counts: { scanned: 10 } }
      },
      {
        _id: new ObjectId(),
        ts: now,
        type: 'perf.digest.run',
        payload: { name: 'job.digest', at: now.toISOString(), durationMs: 800, ok: false, error: { message: 'fail' } }
      },
      {
        _id: new ObjectId(),
        ts: hourAgo,
        type: 'perf.roadmap.intel',
        payload: { name: 'api.work-items.roadmap-intel', at: hourAgo.toISOString(), durationMs: 150, ok: true, cacheByName: { policy: { hits: 3, misses: 1 } } }
      },
      {
        _id: new ObjectId(),
        ts: now,
        type: 'perf.roadmap.intel',
        payload: { name: 'api.work-items.roadmap-intel', at: now.toISOString(), durationMs: 250, ok: true }
      },
      {
        _id: new ObjectId(),
        ts: now,
        type: 'perf.program.intel',
        payload: { name: 'api.program.intel', at: now.toISOString(), durationMs: 300, ok: true }
      },
      {
        _id: new ObjectId(),
        ts: now,
        type: 'perf.capacity.plan',
        payload: { name: 'api.capacity.plan', at: now.toISOString(), durationMs: 400, ok: true }
      },
      {
        _id: new ObjectId(),
        ts: now,
        type: 'integrations.github.sync.completed',
        payload: { name: 'job.github.sync', at: now.toISOString(), durationMs: 500, ok: true }
      }
    ]);

    await db.collection('notifications').insertMany([
      {
        _id: new ObjectId(),
        recipient: 'Ops Admin',
        sender: 'System',
        type: 'milestone.status.changed',
        title: 'Status changed',
        body: 'Test',
        severity: 'info',
        read: false,
        createdAt: now.toISOString()
      },
      {
        _id: new ObjectId(),
        recipient: 'Ops Admin',
        sender: 'System',
        type: 'milestone.capacity.override',
        title: 'Override',
        body: 'Test',
        severity: 'warn',
        read: false,
        createdAt: now.toISOString()
      }
    ]);

    const { GET } = await import('../src/app/api/admin/ops/metrics/route');

    setAuthToken(standardToken);
    (globalThis as any).__testToken = standardToken;
    const denied = await callRoute(GET, 'http://localhost/api/admin/ops/metrics', { method: 'GET' });
    assert.strictEqual(denied.status, 403, 'Expected non-admin denied');

    setAuthToken(adminToken);
    (globalThis as any).__testToken = adminToken;
    const res = await callRoute(GET, 'http://localhost/api/admin/ops/metrics?windowDays=7', { method: 'GET' });
    assert.strictEqual(res.status, 200, 'Expected ops metrics');
    const body = await res.json();

    const commitJob = (body.jobs || []).find((j: any) => j.type === 'perf.commitdrift.run');
    assert.ok(commitJob, 'Expected commit drift job summary');
    assert.strictEqual(commitJob.lastOk, true);

    const apiRow = (body.apis || []).find((a: any) => a.name === 'api.work-items.roadmap-intel');
    assert.ok(apiRow, 'Expected roadmap intel api metrics');
    assert.strictEqual(apiRow.count, 2);

    const cacheRow = (body.cache || []).find((c: any) => c.name === 'policy');
    assert.ok(cacheRow, 'Expected cache stats');

    const notifTotals = body.notifications?.totalsByType || {};
    assert.ok(notifTotals['milestone.status.changed'] >= 1, 'Expected notification count');
  });

  console.log('ops metrics tests passed');
};

if (!process.env.TEST_API_RUNNER) {
  run();
}
