import assert from 'node:assert';
import { runTest, callRoute } from './test-harness';
import { POST as previewPost } from '../src/app/api/work-items/plan/preview/route';
import { POST as createPost } from '../src/app/api/work-items/plan/create/route';

export const run = async () => {
  await runTest('delivery-plan', async ({ db, createUser, createBundle, setAuthToken }) => {
    const { token } = await createUser({ name: 'Planner', email: 'planner@test.local', role: 'Admin' });
    setAuthToken(token);

    const bundle = await createBundle('Bundle Plan');
    await db.collection('bundle_capacity').insertOne({
      bundleId: String(bundle._id),
      unit: 'POINTS_PER_SPRINT',
      value: 20,
      updatedAt: new Date().toISOString(),
      updatedBy: 'system'
    });

    const today = new Date();
    const devStart = new Date(today.getTime() + 2 * 24 * 60 * 60 * 1000);
    const uatStart = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
    const goLive = new Date(today.getTime() + 60 * 24 * 60 * 60 * 1000);

    const previewPayload = {
      scopeType: 'BUNDLE',
      scopeId: String(bundle._id),
      devStartDate: devStart.toISOString(),
      uatStartDate: uatStart.toISOString(),
      goLiveDate: goLive.toISOString(),
      milestoneCount: 2,
      sprintDurationWeeks: 2,
      milestoneDurationStrategy: 'AUTO_DISTRIBUTE',
      deliveryPattern: 'STANDARD_PHASED',
      backlogShape: 'LIGHT',
      createTasksUnderStories: false,
      suggestMilestoneOwners: false,
      suggestWorkItemOwners: false,
      createDependencySkeleton: false,
      preallocateStoriesToSprints: false,
      autoLinkMilestonesToRoadmap: true,
      generateDraftOnly: true,
      themesByMilestone: [
        { milestoneIndex: 1, themes: ['Foundation'] },
        { milestoneIndex: 2, themes: ['Launch'] }
      ]
    };

    const previewRes = await callRoute(
      previewPost,
      'http://localhost/api/work-items/plan/preview',
      { method: 'POST', body: previewPayload }
    );
    assert.strictEqual((previewRes as Response).status, 200, 'Preview should succeed');
    const previewJson = await (previewRes as Response).json();
    const preview = previewJson.preview;
    assert.ok(preview.previewId, 'Preview should include previewId');
    assert.strictEqual(preview.counts.milestones, 2, 'Expected two milestones');

    const createRes = await callRoute(
      createPost,
      'http://localhost/api/work-items/plan/create',
      { method: 'POST', body: { previewId: preview.previewId } }
    );
    assert.strictEqual((createRes as Response).status, 200, 'Create should succeed');
    const createJson = await (createRes as Response).json();
    assert.ok(createJson.result?.runId, 'Create should return runId');

    const milestoneCount = await db.collection('milestones').countDocuments({ bundleId: String(bundle._id) });
    assert.strictEqual(milestoneCount, preview.counts.milestones, 'Milestones count should match preview');
    const milestones = await db.collection('milestones').find({ bundleId: String(bundle._id) }).toArray();
    milestones.forEach((m: any) => {
      const status = String(m.status || '').toUpperCase();
      assert.strictEqual(status, 'DRAFT', 'Generated milestones should be DRAFT');
    });

    const roadmapCount = await db.collection('work_roadmap_phases').countDocuments({ scopeId: String(bundle._id) });
    assert.strictEqual(roadmapCount, preview.counts.roadmapPhases, 'Roadmap phases should match preview');

    const sprintCount = await db.collection('workitems_sprints').countDocuments({ bundleId: String(bundle._id) });
    assert.strictEqual(sprintCount, preview.counts.sprints, 'Sprint count should match preview');

    const workItemCount = await db.collection('workitems').countDocuments({ bundleId: String(bundle._id) });
    const expectedWorkItems = preview.counts.epics + preview.counts.features + preview.counts.stories + preview.counts.tasks;
    assert.strictEqual(workItemCount, expectedWorkItems, 'Work items count should match preview');
  });

  console.log('delivery plan tests passed');
};

if (!process.env.TEST_API_RUNNER) {
  run();
}
