import assert from 'node:assert';
import { runTest, callRoute } from './test-harness';
import { POST as previewPost } from '../src/app/api/work-items/plan/preview/route';

const basePayload = (bundleId: string) => ({
  scopeType: 'BUNDLE',
  scopeId: bundleId,
  devStartDate: '2026-01-01T00:00:00.000Z',
  uatStartDate: '2026-01-20T00:00:00.000Z',
  goLiveDate: '2026-02-12T00:00:00.000Z',
  milestoneCount: 3,
  sprintDurationWeeks: 1,
  milestoneDurationStrategy: 'FIXED_WEEKS',
  milestoneDurationWeeks: 2,
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
    { milestoneIndex: 2, themes: ['Build'] },
    { milestoneIndex: 3, themes: ['Launch'] }
  ]
});

const previewPlan = async (body: any) => {
  const res = await callRoute(
    previewPost,
    'http://localhost/api/work-items/plan/preview',
    { method: 'POST', body }
  );
  assert.strictEqual((res as Response).status, 200, 'Preview should succeed');
  const data = await (res as Response).json();
  return data.preview;
};

export const run = async () => {
  await runTest('delivery-plan-capacity', async ({ db, createUser, createBundle, setAuthToken }) => {
    const { token } = await createUser({ name: 'Capacity Planner', email: 'capacity@test.local', role: 'Admin' });
    setAuthToken(token);

    const bundleTeam = await createBundle('Bundle Team Velocity');
    const previewTeam = await previewPlan({
      ...basePayload(String(bundleTeam._id)),
      capacityMode: 'TEAM_VELOCITY',
      deliveryTeams: 3,
      sprintVelocityPerTeam: 30
    });
    assert.strictEqual(previewTeam.capacitySummary.mode, 'TEAM_VELOCITY');
    assert.strictEqual(previewTeam.capacitySummary.sprintCapacity, 90);
    assert.strictEqual(previewTeam.capacitySummary.milestoneCapacities[0].sprintCount, 2);
    assert.strictEqual(previewTeam.capacitySummary.milestoneCapacities[0].targetCapacity, 180);

    const bundleDirect = await createBundle('Bundle Direct Capacity');
    const previewDirect = await previewPlan({
      ...basePayload(String(bundleDirect._id)),
      capacityMode: 'DIRECT_SPRINT_CAPACITY',
      directSprintCapacity: 120
    });
    assert.strictEqual(previewDirect.capacitySummary.mode, 'DIRECT_SPRINT_CAPACITY');
    assert.strictEqual(previewDirect.capacitySummary.sprintCapacity, 120);

    const bundleFallback = await createBundle('Bundle Fallback');
    await db.collection('bundle_capacity').insertOne({
      bundleId: String(bundleFallback._id),
      unit: 'POINTS_PER_SPRINT',
      value: 45,
      updatedAt: new Date().toISOString(),
      updatedBy: 'system'
    });
    const previewFallback = await previewPlan({
      ...basePayload(String(bundleFallback._id)),
      capacityMode: 'TEAM_VELOCITY'
    });
    assert.strictEqual(previewFallback.capacitySummary.mode, 'BUNDLE_CAPACITY_FALLBACK');
    assert.strictEqual(previewFallback.capacitySummary.sprintCapacity, 45);

    const bundleNone = await createBundle('Bundle No Capacity');
    const previewNone = await previewPlan({
      ...basePayload(String(bundleNone._id)),
      capacityMode: 'TEAM_VELOCITY'
    });
    assert.strictEqual(previewNone.capacitySummary.mode, 'NONE');
    assert.strictEqual(previewNone.capacitySummary.sprintCapacity, null);

    const bundleDerived = await createBundle('Bundle Derived Duration');
    const previewDerived = await previewPlan({
      scopeType: 'BUNDLE',
      scopeId: String(bundleDerived._id),
      devStartDate: '2026-01-01T00:00:00.000Z',
      uatStartDate: '2026-02-01T00:00:00.000Z',
      goLiveDate: '2026-02-26T00:00:00.000Z',
      milestoneCount: 4,
      sprintDurationWeeks: 2,
      milestoneDurationStrategy: 'AUTO_DISTRIBUTE',
      deliveryPattern: 'STANDARD_PHASED',
      backlogShape: 'LIGHT',
      capacityMode: 'TEAM_VELOCITY',
      deliveryTeams: 1,
      sprintVelocityPerTeam: 10,
      createTasksUnderStories: false,
      suggestMilestoneOwners: false,
      suggestWorkItemOwners: false,
      createDependencySkeleton: false,
      preallocateStoriesToSprints: false,
      autoLinkMilestonesToRoadmap: true,
      generateDraftOnly: true,
      themesByMilestone: [
        { milestoneIndex: 1, themes: ['Foundation'] },
        { milestoneIndex: 2, themes: ['Build'] },
        { milestoneIndex: 3, themes: ['Test'] },
        { milestoneIndex: 4, themes: ['Launch'] }
      ]
    });
    assert.strictEqual(previewDerived.derived.milestoneDurationWeeks, 2);

    const bundleTasks = await createBundle('Bundle Task Targets');
    const previewTasks = await previewPlan({
      scopeType: 'BUNDLE',
      scopeId: String(bundleTasks._id),
      devStartDate: '2026-01-01T00:00:00.000Z',
      uatStartDate: '2026-01-10T00:00:00.000Z',
      goLiveDate: '2026-01-20T00:00:00.000Z',
      milestoneCount: 1,
      sprintDurationWeeks: 1,
      milestoneDurationStrategy: 'FIXED_WEEKS',
      milestoneDurationWeeks: 2,
      deliveryPattern: 'STANDARD_PHASED',
      backlogShape: 'STANDARD',
      capacityMode: 'TEAM_VELOCITY',
      deliveryTeams: 1,
      sprintVelocityPerTeam: 10,
      createTasksUnderStories: true,
      tasksPerStoryTarget: 3,
      storiesPerFeatureTarget: 2,
      featuresPerMilestoneTarget: 1,
      suggestMilestoneOwners: false,
      suggestWorkItemOwners: false,
      createDependencySkeleton: false,
      preallocateStoriesToSprints: false,
      autoLinkMilestonesToRoadmap: true,
      generateDraftOnly: true,
      themesByMilestone: [{ milestoneIndex: 1, themes: ['Scope'] }]
    });
    assert.strictEqual(previewTasks.counts.tasks, previewTasks.counts.stories * 3);
  });

  console.log('delivery plan capacity tests passed');
};

if (!process.env.TEST_API_RUNNER) {
  run();
}
