import assert from 'node:assert';
import { ObjectId } from 'mongodb';
import { runTest, callRoute } from './test-harness';

export const run = async () => {
  await runTest('backup', async ({ db, createUser, createBundle, createMilestone, setAuthToken }) => {
    const { user: adminUser, token: adminToken } = await createUser({
      name: 'Admin User',
      email: 'admin@backup.local',
      role: 'Admin'
    });
    const { user: standardUser, token: standardToken } = await createUser({
      name: 'Standard User',
      email: 'user@backup.local',
      role: 'Engineering'
    });

    const bundle = await createBundle('Backup Bundle');
    const bundleId = String(bundle._id);
    await db.collection('bundle_assignments').insertOne({
      _id: new ObjectId(),
      bundleId,
      userId: String(adminUser._id),
      assignmentType: 'bundle_owner',
      active: true,
      createdAt: new Date().toISOString()
    });
    const milestone = await createMilestone({
      name: 'Backup M1',
      bundleId,
      status: 'PLANNED',
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    });

    await db.collection('delivery_policies').insertOne({
      _id: 'global',
      version: 1,
      updatedAt: new Date().toISOString(),
      updatedBy: 'system',
      readiness: { milestone: { warnScoreBelow: 70, blockScoreBelow: 50, blockOnBlockedItems: true, blockOnHighCriticalRisks: true }, sprint: { warnScoreBelow: 70, blockScoreBelow: 50, blockOnBlockedItems: true, blockOnHighCriticalRisks: true } },
      dataQuality: { weights: { missingStoryPoints: 1, missingAssignee: 1, missingDueAt: 1, missingRiskSeverity: 1 }, caps: { missingStoryPoints: 10, missingAssignee: 10, missingDueAt: 10, missingRiskSeverity: 10 } },
      forecasting: { atRiskPct: 0.1, offTrackPct: 0.2, minSampleSize: 2 },
      criticalPath: { nearCriticalSlackPct: 0.1, defaultIncludeExternal: false, defaultExternalDepth: 3 },
      staleness: {
        thresholdsDays: { workItemStale: 7, criticalStale: 3, blockedStale: 5, unassignedStale: 2, githubStale: 5, inProgressNoPrStale: 5 },
        nudges: { enabled: true, allowedRoles: ['ADMIN'], cooldownHoursPerItem: 24, maxNudgesPerUserPerDay: 10 },
        digest: { includeStaleSummary: true, minCriticalStaleToInclude: 1 }
      }
    });

    const { GET: GET_EXPORT } = await import('../src/app/api/admin/backup/export/route');
    const { POST: POST_IMPORT } = await import('../src/app/api/admin/backup/import/route');

    setAuthToken(standardToken);
    (globalThis as any).__testToken = standardToken;
    const denied = await callRoute(GET_EXPORT, 'http://localhost/api/admin/backup/export', { method: 'GET' });
    assert.strictEqual(denied.status, 403, 'Expected non-admin denied');

    setAuthToken(adminToken);
    (globalThis as any).__testToken = adminToken;
    const exportRes = await callRoute(GET_EXPORT, 'http://localhost/api/admin/backup/export?include=policies,bundles,assignments,milestones', { method: 'GET' });
    assert.strictEqual(exportRes.status, 200, 'Expected export success');
    const bundleExport = await exportRes.json();
    assert.ok(bundleExport.collections?.bundles?.length >= 1, 'Expected bundles exported');
    assert.ok(bundleExport.counts?.bundles >= 1, 'Expected bundle count');

    const modified = {
      ...bundleExport,
      collections: {
        ...bundleExport.collections,
        bundles: bundleExport.collections.bundles.map((b: any) => b.name === 'Backup Bundle' ? { ...b, name: 'Backup Bundle Updated' } : b)
      }
    };

    const dryRes = await callRoute(POST_IMPORT, 'http://localhost/api/admin/backup/import', {
      method: 'POST',
      body: { bundle: modified, mode: 'DRY_RUN', options: { allowUpsert: true, overwritePolicies: false, overwriteOverrides: false } }
    });
    assert.strictEqual(dryRes.status, 200, 'Expected dry run success');
    const dryBody = await dryRes.json();
    assert.ok(dryBody.collections?.bundles, 'Expected bundles in dry run');

    const applyRes = await callRoute(POST_IMPORT, 'http://localhost/api/admin/backup/import', {
      method: 'POST',
      body: { bundle: modified, mode: 'APPLY', options: { allowUpsert: true, overwritePolicies: false, overwriteOverrides: false }, confirmation: { phrase: 'IMPORT_BACKUP' } }
    });
    assert.strictEqual(applyRes.status, 200, 'Expected apply success');
    const updated = await db.collection('bundles').findOne({ _id: new ObjectId(bundleId) });
    assert.strictEqual(updated?.name, 'Backup Bundle Updated', 'Expected bundle updated');

    const event = await db.collection('events').findOne({ type: 'admin.backup.completed' });
    assert.ok(event, 'Expected import completed event');
  });

  console.log('backup tests passed');
};

if (!process.env.TEST_API_RUNNER) {
  run();
}
