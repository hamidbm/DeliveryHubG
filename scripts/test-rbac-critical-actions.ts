import assert from 'node:assert';
import { ObjectId } from 'mongodb';
import {
  canCommitMilestone,
  canStartMilestone,
  canCompleteMilestone,
  canOverrideMilestoneReadiness,
  canOverrideCapacity,
  canEditCommittedMilestoneScope,
  canCreateBlocksDependency
} from '../src/services/authz';
import { runTest } from './test-harness';

export const run = async () => {
  await runTest('rbac-critical-actions', async ({ db }) => {
    await db.collection('bundle_assignments').deleteMany({});

    const bundleId = new ObjectId().toString();
    const adminUser = { userId: 'admin-1', role: 'Admin' };
    const cmoUser = { userId: 'cmo-1', role: 'CMO Architect' };
    const ownerUser = { userId: 'owner-1', role: 'Engineering' };
    const regularUser = { userId: 'user-1', role: 'Engineering' };

    await db.collection('bundle_assignments').insertOne({
      bundleId,
      userId: ownerUser.userId,
      assignmentType: 'bundle_owner',
      active: true,
      createdAt: new Date().toISOString()
    });

    const milestone = { _id: new ObjectId(), bundleId };
    const sourceItem = { _id: new ObjectId(), bundleId };
    const targetItemSame = { _id: new ObjectId(), bundleId };
    const targetItemOther = { _id: new ObjectId(), bundleId: new ObjectId().toString() };

    assert.equal(await canCommitMilestone(adminUser), true);
    assert.equal(await canCommitMilestone(cmoUser), true);
    assert.equal(await canCommitMilestone(regularUser), false);

    assert.equal(await canStartMilestone(adminUser), true);
    assert.equal(await canCompleteMilestone(cmoUser), true);
    assert.equal(await canOverrideMilestoneReadiness(regularUser), false);

    assert.equal(await canOverrideCapacity(adminUser), true);
    assert.equal(await canOverrideCapacity(ownerUser), false);

    assert.equal(await canEditCommittedMilestoneScope(ownerUser, milestone), true);
    assert.equal(await canEditCommittedMilestoneScope(regularUser, milestone), false);

    assert.equal(await canCreateBlocksDependency(ownerUser, sourceItem, targetItemSame), true);
    assert.equal(await canCreateBlocksDependency(ownerUser, sourceItem, targetItemOther), false);
  });

  console.log('rbac critical action tests passed');
};

if (!process.env.TEST_API_RUNNER) {
  run();
}
