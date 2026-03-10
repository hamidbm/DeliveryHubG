import assert from 'node:assert';
import { ObjectId } from 'mongodb';
import { runTest, callRoute } from './test-harness';
import { GET as GET_PLAN, POST as POST_PLAN } from '../src/app/api/optimize/plan/[planId]/route';
import { POST as POST_APPLY } from '../src/app/api/optimize/plan/[planId]/apply/route';

export const run = async () => {
  await runTest('optimize-apply', async ({ db, createUser, setAuthToken }) => {
    const { user, token } = await createUser({ name: 'Optimize Apply User', email: 'optimize-apply@demo.local', role: 'Admin' });
    setAuthToken(token);

    // Preview apply flow
    const previewId = new ObjectId();
    await db.collection('work_plan_previews').insertOne({
      _id: previewId,
      createdAt: new Date().toISOString(),
      createdBy: String(user._id),
      scopeType: 'BUNDLE',
      scopeId: 'bundle-opt-apply-preview',
      preview: {
        milestones: [
          { index: 1, name: 'M1', startDate: '2026-07-01T00:00:00.000Z', endDate: '2026-07-14T00:00:00.000Z', targetCapacity: 10 },
          { index: 2, name: 'M2', startDate: '2026-07-15T00:00:00.000Z', endDate: '2026-07-28T00:00:00.000Z', targetCapacity: 25 }
        ],
        artifacts: [
          { milestoneIndex: 1, storyCount: 20 },
          { milestoneIndex: 2, storyCount: 6 }
        ]
      }
    });

    const previewPlanId = `preview:${String(previewId)}`;
    const previewOptimizeRes = await callRoute(
      GET_PLAN,
      `http://localhost/api/optimize/plan/${encodeURIComponent(previewPlanId)}?maxVariants=2`,
      { method: 'GET', params: { planId: previewPlanId } }
    );
    assert.strictEqual((previewOptimizeRes as Response).status, 200);
    const previewOptimize = await (previewOptimizeRes as Response).json();
    assert.ok(previewOptimize.optimizedVariants?.length > 0, 'Expected preview optimization variants');

    const previewVariantId = previewOptimize.optimizedVariants[0].variantId;
    const previewApplyRes = await callRoute(
      POST_APPLY,
      `http://localhost/api/optimize/plan/${encodeURIComponent(previewPlanId)}/apply`,
      {
        method: 'POST',
        params: { planId: previewPlanId },
        body: {
          variantId: previewVariantId,
          objectiveWeights: previewOptimize.objectiveWeights,
          constraints: previewOptimize.constraints,
          options: { maxVariants: 2 }
        }
      }
    );
    assert.strictEqual((previewApplyRes as Response).status, 200);
    const previewApply = await (previewApplyRes as Response).json();
    assert.strictEqual(previewApply.applied, true);

    const previewDoc = await db.collection('work_plan_previews').findOne({ _id: previewId });
    assert.ok(previewDoc?.preview?.milestones?.length >= 1, 'Expected preview milestones to persist after apply');

    // Created-plan apply flow
    const bundleId = new ObjectId();
    await db.collection('bundles').insertOne({ _id: bundleId, key: 'OPTB', name: 'Optimization Bundle', isActive: true });

    const milestoneId = new ObjectId();
    await db.collection('milestones').insertOne({
      _id: milestoneId,
      name: 'Created M1',
      bundleId: String(bundleId),
      startDate: '2026-08-01T00:00:00.000Z',
      endDate: '2026-08-15T00:00:00.000Z',
      targetCapacity: 8,
      status: 'Committed'
    });

    const workItemId = new ObjectId();
    await db.collection('workitems').insertOne({
      _id: workItemId,
      key: 'OPT-1',
      title: 'Overloaded Item',
      type: 'STORY',
      status: 'TODO',
      priority: 'HIGH',
      bundleId: String(bundleId),
      milestoneIds: [String(milestoneId)],
      storyPoints: 21,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    const runId = new ObjectId();
    await db.collection('work_delivery_plan_runs').insertOne({
      _id: runId,
      createdAt: new Date().toISOString(),
      createdBy: String(user._id),
      scopeType: 'BUNDLE',
      scopeId: String(bundleId),
      milestoneIds: [String(milestoneId)],
      workItemIds: [String(workItemId)],
      sprintIds: [],
      roadmapPhaseIds: []
    });

    const createdPlanId = `created:${String(runId)}`;
    const createdOptimizeRes = await callRoute(
      POST_PLAN,
      `http://localhost/api/optimize/plan/${encodeURIComponent(createdPlanId)}`,
      {
        method: 'POST',
        params: { planId: createdPlanId },
        body: {
          objectiveWeights: { onTime: 0.6, riskReduction: 0.2, capacityBalance: 0.1, slippageMinimization: 0.1 },
          options: { maxVariants: 3 }
        }
      }
    );
    assert.strictEqual((createdOptimizeRes as Response).status, 200);
    const createdOptimize = await (createdOptimizeRes as Response).json();
    assert.ok(createdOptimize.optimizedVariants?.length > 0, 'Expected created-plan optimization variants');

    const createdVariantId = createdOptimize.optimizedVariants[0].variantId;
    const createdApplyRes = await callRoute(
      POST_APPLY,
      `http://localhost/api/optimize/plan/${encodeURIComponent(createdPlanId)}/apply`,
      {
        method: 'POST',
        params: { planId: createdPlanId },
        body: {
          variantId: createdVariantId,
          objectiveWeights: createdOptimize.objectiveWeights,
          constraints: createdOptimize.constraints,
          options: { maxVariants: 3 }
        }
      }
    );
    assert.strictEqual((createdApplyRes as Response).status, 200);
    const createdApply = await (createdApplyRes as Response).json();
    assert.strictEqual(createdApply.applied, true);

    const updatedMilestone = await db.collection('milestones').findOne({ _id: milestoneId });
    assert.ok(updatedMilestone?.updatedAt, 'Expected milestone updates on apply');

    // Auditability
    const audits = await db.collection('optimization_applied_runs').find({ planId: { $in: [previewPlanId, createdPlanId] } }).toArray();
    assert.ok(audits.length >= 2, 'Expected optimization audit records');
  });

  console.log('optimize apply tests passed');
};

if (!process.env.TEST_API_RUNNER) {
  run();
}
