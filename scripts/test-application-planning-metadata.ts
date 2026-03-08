import assert from 'node:assert';
import { ObjectId } from 'mongodb';
import { runTest } from './test-harness';
import { getApplicationPlanningMetadata, upsertPlanningMetadata } from '../src/services/applicationPlanningMetadata';

export const run = async () => {
  await runTest('application-planning-metadata', async ({ db }) => {
    const appId = new ObjectId();
    await db.collection('applications').insertOne({
      _id: appId,
      aid: 'APP-100',
      name: 'Atlas',
      bundleId: 'bundle-1',
      isActive: true,
      status: { health: 'Healthy' }
    });

    const initial = await getApplicationPlanningMetadata(String(appId));
    assert.strictEqual(initial, null);

    await upsertPlanningMetadata('application', String(appId), {
      scopeType: 'application',
      scopeId: String(appId),
      applicationId: String(appId),
      bundleId: 'bundle-1',
      environments: [
        { name: 'UAT', startDate: '2026-03-01', durationDays: 9, endDate: '2026-03-10' }
      ],
      planningDefaults: {
        milestoneCount: 4,
        sprintDurationWeeks: 2
      }
    });

    const created = await getApplicationPlanningMetadata(String(appId));
    assert.ok(created);
    assert.strictEqual(created?.scopeType, 'application');
    assert.strictEqual(created?.scopeId, String(appId));

    await upsertPlanningMetadata('application', String(appId), {
      scopeType: 'application',
      scopeId: String(appId),
      applicationId: String(appId),
      bundleId: 'bundle-1',
      environments: [
        { name: 'UAT', startDate: '2026-03-02', durationDays: 10, endDate: '2026-03-12' }
      ],
      planningDefaults: {
        milestoneCount: 5,
        sprintDurationWeeks: 3
      }
    });

    const updated = await getApplicationPlanningMetadata(String(appId));
    assert.ok(updated);
    assert.strictEqual(updated?.planningDefaults?.milestoneCount, 5);

    const count = await db.collection('application_planning_metadata').countDocuments({ scopeType: 'application', scopeId: String(appId) });
    assert.strictEqual(count, 1);
  });

  console.log('application planning metadata tests passed');
};

if (!process.env.TEST_API_RUNNER) {
  run();
}
