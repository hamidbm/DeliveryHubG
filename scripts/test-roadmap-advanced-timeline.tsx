import assert from 'node:assert';
import { renderToStaticMarkup } from 'react-dom/server';
import AdvancedTimelineView from '../src/components/roadmap/AdvancedTimelineView';

const milestones = [
  {
    id: 'm1',
    name: 'Milestone 1',
    startDate: '2026-01-01T00:00:00.000Z',
    endDate: '2026-01-15T00:00:00.000Z',
    sprintCount: 2,
    targetCapacity: 100,
    themeLabel: 'Payments',
    bundleId: 'b1',
    applicationId: 'a1'
  },
  {
    id: 'm2',
    name: 'Milestone 2',
    startDate: '2026-01-16T00:00:00.000Z',
    endDate: '2026-02-01T00:00:00.000Z',
    sprintCount: 2,
    targetCapacity: 80,
    themeLabel: 'Compliance',
    bundleId: 'b1',
    applicationId: 'a1'
  }
];

const dependencies = [
  { fromMilestoneId: 'm1', toMilestoneId: 'm2', count: 1, blockerCount: 1, blockedCount: 1 }
];

const probabilistic = {
  m1: {
    milestoneId: 'm1',
    planId: 'p1',
    scopeType: 'APPLICATION',
    scopeId: 'a1',
    p50Date: '2026-01-12T00:00:00.000Z',
    p75Date: '2026-01-14T00:00:00.000Z',
    p90Date: '2026-01-18T00:00:00.000Z',
    onTimeProbability: 0.68,
    uncertaintyLevel: 'MEDIUM',
    createdAt: '2026-01-01T00:00:00.000Z'
  }
};

export const run = async () => {
  const html = renderToStaticMarkup(
    <AdvancedTimelineView
      milestones={milestones}
      dependencies={dependencies}
      forecastByMilestone={{}}
      probabilisticForecastByMilestone={probabilistic as any}
      environments={[
        { name: 'DEV', startDate: '2026-01-01', durationDays: 10, endDate: '2026-01-10' },
        { name: 'UAT', startDate: '2026-01-11', durationDays: 10, endDate: '2026-01-20' },
        { name: 'PROD', startDate: '2026-01-21', durationDays: 1, endDate: '2026-01-22' }
      ]}
      goLiveDate="2026-01-21"
    />
  );

  assert.ok(html.includes('p50') || html.includes('P50'), 'Expected probabilistic band to render');
  assert.ok(html.includes('Go-Live / Business Cutover'), 'Expected go-live marker to render');
  assert.ok(html.includes('Dependency'), 'Expected dependency title to render');
  assert.ok(html.includes('On-Time'), 'Expected on-time indicator to render');
  assert.ok(html.includes('Uncertainty'), 'Expected uncertainty indicator to render');
  assert.ok(html.includes('Prod Deployment'), 'Expected environment overlay to render');
  console.log('advanced timeline tests passed');
};

if (!process.env.TEST_API_RUNNER) {
  run();
}
