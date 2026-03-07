import assert from 'node:assert';
import { applyScenarioOverrides, comparePreviews } from '../src/services/simulationEngine';
import type { DeliveryPlanInput, DeliveryPlanPreview } from '../src/types';

export const run = async () => {
  const baseline: DeliveryPlanInput = {
    scopeType: 'BUNDLE',
    scopeId: 'bundle-1',
    devStartDate: '2026-01-01T00:00:00.000Z',
    uatStartDate: '2026-01-10T00:00:00.000Z',
    goLiveDate: '2026-02-01T00:00:00.000Z',
    milestoneCount: 2,
    sprintDurationWeeks: 2,
    milestoneDurationStrategy: 'AUTO_DISTRIBUTE',
    deliveryPattern: 'STANDARD_PHASED',
    backlogShape: 'STANDARD'
  };

  const shifted = applyScenarioOverrides(baseline, [
    { type: 'DATE_SHIFT', params: { shiftDays: 5, milestoneId: '1' } }
  ]);
  // DATE_SHIFT is milestone-specific and applied during preview generation, not to the baseline input.
  assert.strictEqual(new Date(shifted.devStartDate).getTime(), new Date(baseline.devStartDate).getTime());

  const capacity = applyScenarioOverrides(baseline, [
    { type: 'CAPACITY_SHIFT', params: { deltaCapacity: 10 } }
  ]);
  assert.strictEqual(capacity.sprintVelocityPerTeam, 10);

  const scopeGrowthInput = { ...baseline, storiesPerFeatureTarget: 4, featuresPerMilestoneTarget: 2 };
  const scopeGrowth = applyScenarioOverrides(scopeGrowthInput, [
    { type: 'SCOPE_GROWTH', params: { percentIncrease: 50 } }
  ]);
  assert.strictEqual(scopeGrowth.storiesPerFeatureTarget, 6);
  assert.strictEqual(scopeGrowth.featuresPerMilestoneTarget, 3);

  const velocity = applyScenarioOverrides({ ...baseline, sprintVelocityPerTeam: 20 }, [
    { type: 'VELOCITY_ADJUSTMENT', params: { deltaVelocity: 5 } }
  ]);
  assert.strictEqual(velocity.sprintVelocityPerTeam, 25);

  const previewBase: DeliveryPlanPreview = {
    previewId: 'base',
    counts: { roadmapPhases: 0, milestones: 2, sprints: 0, epics: 0, features: 0, stories: 0, tasks: 0 },
    roadmap: [],
    milestones: [
      { index: 1, name: 'M1', startDate: '2026-01-01', endDate: '2026-01-10', themes: [], sprintCount: 0, targetCapacity: 100 },
      { index: 2, name: 'M2', startDate: '2026-01-11', endDate: '2026-01-20', themes: [], sprintCount: 0, targetCapacity: 100 }
    ],
    sprints: [],
    artifacts: [
      { milestoneIndex: 1, epicCount: 1, featureCount: 1, storyCount: 80, taskCount: 0, epics: [] as any[] },
      { milestoneIndex: 2, epicCount: 1, featureCount: 1, storyCount: 120, taskCount: 0, epics: [] as any[] }
    ],
    warnings: [],
    assumptions: []
  };

  const previewScenario: DeliveryPlanPreview = {
    ...previewBase,
    previewId: 'scenario',
    milestones: [
      { index: 1, name: 'M1', startDate: '2026-01-01', endDate: '2026-01-15', themes: [], sprintCount: 0, targetCapacity: 100 },
      { index: 2, name: 'M2', startDate: '2026-01-16', endDate: '2026-01-30', themes: [], sprintCount: 0, targetCapacity: 100 }
    ]
  };

  const comparison = comparePreviews(previewBase, previewScenario);
  assert.strictEqual(comparison.milestoneComparisons.length, 2);
  assert.ok(comparison.summary.milestonesSlipped > 0);

  console.log('simulation engine tests passed');
};

if (!process.env.TEST_API_RUNNER) {
  run();
}
