process.env.TEST_API_RUNNER = '1';

const tests = [
  () => import('./test-milestone-governance').then((m) => m.run()),
  () => import('./test-milestone-readiness').then((m) => m.run()),
  () => import('./test-workitem-links').then((m) => m.run()),
  () => import('./test-rollup-warnings').then((m) => m.run()),
  () => import('./test-roadmap-intel').then((m) => m.run()),
  () => import('./test-staleness').then((m) => m.run()),
  () => import('./test-staleness-policy').then((m) => m.run()),
  () => import('./test-backup').then((m) => m.run()),
  () => import('./test-monte-carlo').then((m) => m.run()),
  () => import('./test-commit-review').then((m) => m.run()),
  () => import('./test-commit-drift').then((m) => m.run()),
  () => import('./test-drift-scheduler').then((m) => m.run()),
  () => import('./test-baseline-delta').then((m) => m.run()),
  () => import('./test-weekly-brief').then((m) => m.run()),
  () => import('./test-decision-log').then((m) => m.run()),
  () => import('./test-capacity-plan').then((m) => m.run()),
  () => import('./test-program-intel').then((m) => m.run()),
  () => import('./test-rbac-critical-actions').then((m) => m.run()),
  () => import('./test-events-notifications').then((m) => m.run()),
  () => import('./test-admin-audit').then((m) => m.run()),
  () => import('./test-ops-metrics').then((m) => m.run()),
  () => import('./test-onboarding').then((m) => m.run()),
  () => import('./test-notification-prefs').then((m) => m.run()),
  () => import('./test-forecasting').then((m) => m.run()),
  () => import('./test-watchers').then((m) => m.run()),
  () => import('./test-digest-cron').then((m) => m.run()),
  () => import('./test-sprint-rollups').then((m) => m.run()),
  () => import('./test-sprint-governance').then((m) => m.run()),
  () => import('./test-burnup').then((m) => m.run()),
  () => import('./test-scope-requests').then((m) => m.run()),
  () => import('./test-jira-mapping').then((m) => m.run()),
  () => import('./test-critical-path').then((m) => m.run()),
  () => import('./test-critical-path-actions').then((m) => m.run()),
  () => import('./test-policy').then((m) => m.run()),
  () => import('./test-policy-overrides').then((m) => m.run()),
  () => import('./test-github-integration').then((m) => m.run()),
  () => import('./test-event-taxonomy').then((m) => m.run()),
  () => import('./test-ownership').then((m) => m.run()),
  () => import('./test-feed').then((m) => m.run()),
  () => import('./test-visibility').then((m) => m.run()),
  () => import('./test-data-quality').then((m) => m.run())
];

const runAll = async () => {
  for (const run of tests) {
    await run();
  }
};

runAll().catch((err) => {
  console.error('[test:api] failed', err);
  process.exit(1);
});
