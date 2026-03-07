import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import ExecutionBoardView from '../src/components/roadmap/ExecutionBoardView';
import RoadmapTimelineView from '../src/components/roadmap/RoadmapTimelineView';
import RoadmapSwimlaneView from '../src/components/roadmap/RoadmapSwimlaneView';
import RoadmapDependencyView from '../src/components/roadmap/RoadmapDependencyView';

const snapshotPath = path.join(__dirname, '__snapshots__', 'roadmap-views.snap.json');

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

const snapshots: Record<string, string> = {
  execution: renderToStaticMarkup(<ExecutionBoardView {...executionProps} />),
  timeline: renderToStaticMarkup(<RoadmapTimelineView milestones={baseMilestones} />),
  swimlane: renderToStaticMarkup(<RoadmapSwimlaneView milestones={baseMilestones} />),
  dependency: renderToStaticMarkup(<RoadmapDependencyView milestones={baseMilestones} dependencies={baseDependencies} />)
};

export const run = async () => {
  if (!fs.existsSync(snapshotPath)) {
    throw new Error(`Missing snapshot file at ${snapshotPath}.`);
  }

  const stored = JSON.parse(fs.readFileSync(snapshotPath, 'utf-8'));

  Object.keys(snapshots).forEach((key) => {
    assert.strictEqual(snapshots[key], stored[key], `Snapshot mismatch for ${key}`);
  });

  console.log('roadmap view snapshots passed');
};

if (!process.env.TEST_API_RUNNER) {
  run();
}
