import fs from 'node:fs';
import path from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ExecutionBoardView from '../src/components/roadmap/ExecutionBoardView';
import RoadmapTimelineView from '../src/components/roadmap/RoadmapTimelineView';
import RoadmapSwimlaneView from '../src/components/roadmap/RoadmapSwimlaneView';
import RoadmapDependencyView from '../src/components/roadmap/RoadmapDependencyView';

const baseMilestones = [
  {
    id: 'm1',
    name: 'Milestone 1',
    startDate: '2026-01-01T00:00:00.000Z',
    endDate: '2026-01-20T00:00:00.000Z',
    sprintCount: 2,
    targetCapacity: 90,
    readinessBand: 'high',
    confidenceScore: 0.78
  },
  {
    id: 'm2',
    name: 'Milestone 2',
    startDate: '2026-01-21T00:00:00.000Z',
    endDate: '2026-02-10T00:00:00.000Z',
    sprintCount: 2,
    targetCapacity: 80,
    readinessBand: 'medium',
    confidenceScore: 0.64
  }
];

const baseDependencies = [
  { fromMilestoneId: 'm1', toMilestoneId: 'm2', count: 3, blockerCount: 3, blockedCount: 3 }
];

const noop = () => {};

const executionProps = {
  loading: true,
  items: [],
  milestones: [],
  bundles: [],
  applications: [],
  selBundleId: 'all',
  selAppId: 'all',
  intelLoading: false,
  intelError: null,
  expandedMilestones: {},
  includeExternalCritical: {},
  burnupCache: {},
  sprintCache: {},
  criticalCache: {},
  burnupStatus: {},
  sprintStatus: {},
  criticalStatus: {},
  commitPolicy: null,
  commitDrift: {},
  commitDriftStatus: {},
  currentUser: null,
  groupedItems: {},
  intelByMilestone: {},
  milestoneIntelligenceById: {},
  forecastByMilestone: {},
  forecastStatus: { loading: false },
  probabilisticForecastByMilestone: {},
  probabilisticForecastStatus: { loading: false },
  activeItem: null,
  staleModal: null,
  driftModal: null,
  dependencyModal: null,
  criticalModal: null,
  criticalModalMessage: null,
  linkToast: null,
  estimateDrafts: {},
  setActiveItem: noop,
  setStaleModal: noop,
  setDriftModal: noop,
  setDependencyModal: noop,
  setCriticalModal: noop,
  setCriticalModalMessage: noop,
  setLinkToast: noop,
  setEstimateDrafts: noop,
  setIncludeExternalCritical: noop,
  setCriticalCache: noop,
  fetchData: noop,
  loadIntel: noop,
  toggleMilestone: noop,
  fetchBurnup: noop,
  fetchSprintRollups: noop,
  fetchCriticalPath: noop,
  refreshCommitDrift: noop,
  invalidateCaches: noop,
  getBurnupTrend: () => null,
  getActiveSprint: () => null,
  getGithubActivity: () => null
};

const snapshots = {
  execution: renderToStaticMarkup(<ExecutionBoardView {...executionProps} />),
  timeline: renderToStaticMarkup(
    <RoadmapTimelineView
      milestones={baseMilestones}
      dependencies={baseDependencies}
      intelligenceByMilestone={{}}
      forecastByMilestone={{}}
      probabilisticForecastByMilestone={{}}
      environments={[]}
      goLiveDate="2026-02-10T00:00:00.000Z"
    />
  ),
  swimlane: renderToStaticMarkup(<RoadmapSwimlaneView milestones={baseMilestones} forecastByMilestone={{}} probabilisticForecastByMilestone={{}} />),
  dependency: renderToStaticMarkup(<RoadmapDependencyView milestones={baseMilestones} dependencies={baseDependencies} />)
};

const outputDir = path.join('scripts', '__snapshots__');
fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(path.join(outputDir, 'roadmap-views.snap.json'), JSON.stringify(snapshots, null, 2));
console.log('Wrote roadmap view snapshots.');
