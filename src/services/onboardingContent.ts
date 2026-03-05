import { isAdminOrCmo, getBundleOwnership } from './authz';

export type OnboardingRole = 'PM' | 'ENGINEER' | 'EXEC' | 'ADMIN';

export type OnboardingStep = {
  id: string;
  title: string;
  why: string;
  cta: {
    label: string;
    href: string;
  };
};

export type OnboardingTip = {
  id: string;
  title: string;
  body: string;
};

export type ProgramHelpContent = {
  title: string;
  subtitle: string;
  bullets: string[];
};

export type OnboardingContent = {
  roles: OnboardingRole[];
  steps: Record<OnboardingRole, OnboardingStep[]>;
  tips: OnboardingTip[];
  programHelp: ProgramHelpContent;
};

const STEP_DEFINITIONS: Record<string, OnboardingStep> = {
  digest_prefs: {
    id: 'digest_prefs',
    title: 'Set your digest preferences',
    why: 'Tune what gets surfaced in daily summaries so you only see signals that matter.',
    cta: { label: 'Open profile', href: '/profile' }
  },
  watch_bundle: {
    id: 'watch_bundle',
    title: 'Watch a bundle you care about',
    why: 'Watching a bundle keeps you in the loop on drift, risk, and milestone movement.',
    cta: { label: 'Open applications', href: '/applications' }
  },
  review_program: {
    id: 'review_program',
    title: 'Open Program page and review at-risk bundles',
    why: 'The Program page aggregates risk signals so you know where to intervene first.',
    cta: { label: 'Open program', href: '/program' }
  },
  fix_data_quality: {
    id: 'fix_data_quality',
    title: 'Fix data quality for a milestone',
    why: 'Forecasts only work if plan data is complete and current.',
    cta: { label: 'Review milestones', href: '/?tab=work-items&view=milestone-plan' }
  },
  run_commit_review: {
    id: 'run_commit_review',
    title: 'Run commit review for a draft milestone',
    why: 'Commit review checks P80, drift, and readiness before locking dates.',
    cta: { label: 'Open milestone plan', href: '/?tab=work-items&view=milestone-plan' }
  },
  resolve_critical: {
    id: 'resolve_critical',
    title: 'Resolve a critical path action',
    why: 'Critical path actions are the fastest way to move delivery dates.',
    cta: { label: 'Open roadmap', href: '/?tab=work-items&view=roadmap' }
  }
};

const ROLE_STEPS: Record<OnboardingRole, string[]> = {
  PM: ['digest_prefs', 'watch_bundle', 'review_program', 'fix_data_quality', 'run_commit_review', 'resolve_critical'],
  ENGINEER: ['digest_prefs', 'watch_bundle', 'fix_data_quality', 'resolve_critical'],
  EXEC: ['digest_prefs', 'watch_bundle', 'review_program'],
  ADMIN: ['digest_prefs', 'review_program', 'run_commit_review']
};

const TIP_DEFINITIONS: OnboardingTip[] = [
  {
    id: 'p80_hit',
    title: 'P80 + Hit Probability',
    body: 'P80 is the date we expect to finish with ~80% confidence. Hit % shows how likely the current plan meets its target date.'
  },
  {
    id: 'drift',
    title: 'Commitment Drift',
    body: 'Drift compares the latest forecast to the last committed snapshot. It highlights when plans are slipping beyond tolerance.'
  },
  {
    id: 'data_quality',
    title: 'Data Quality',
    body: 'Quality scores reflect missing owners, estimates, dates, or dependencies. Low quality weakens forecasts and readiness.'
  },
  {
    id: 'critical_path',
    title: 'Critical Path',
    body: 'The critical path is the dependency chain that drives milestone ETA. Unblocking it yields the biggest schedule impact.'
  },
  {
    id: 'overcommit',
    title: 'Capacity Overcommit',
    body: 'Overcommit flags weeks where demand exceeds planned capacity. Reduce scope or add capacity to close the gap.'
  },
  {
    id: 'staleness',
    title: 'Staleness',
    body: 'Stale items have not been updated recently. Critical stale items should be refreshed to keep forecasts accurate.'
  }
];

const PROGRAM_HELP: ProgramHelpContent = {
  title: 'How to use this page',
  subtitle: 'Use Program Coordination to prioritize attention across bundles.',
  bullets: [
    'Start with Overview to spot at-risk bundles and milestones.',
    'Check Capacity to see weeks that are overcommitted.',
    'Use the brief and decisions panels to align leadership quickly.'
  ]
};

export const getOnboardingContent = (): OnboardingContent => ({
  roles: ['PM', 'ENGINEER', 'EXEC', 'ADMIN'],
  steps: {
    PM: ROLE_STEPS.PM.map((id) => STEP_DEFINITIONS[id]),
    ENGINEER: ROLE_STEPS.ENGINEER.map((id) => STEP_DEFINITIONS[id]),
    EXEC: ROLE_STEPS.EXEC.map((id) => STEP_DEFINITIONS[id]),
    ADMIN: ROLE_STEPS.ADMIN.map((id) => STEP_DEFINITIONS[id])
  },
  tips: TIP_DEFINITIONS,
  programHelp: PROGRAM_HELP
});

export const inferOnboardingRole = async (user: { userId?: string; id?: string; role?: string }) => {
  if (await isAdminOrCmo(user)) return 'ADMIN' as OnboardingRole;
  const userId = String(user?.userId || user?.id || '');
  if (userId) {
    const ownership = await getBundleOwnership(userId);
    if (ownership.length > 0) return 'PM' as OnboardingRole;
  }
  return 'ENGINEER' as OnboardingRole;
};

export const isOnboardingRole = (value?: string): value is OnboardingRole => {
  return ['PM', 'ENGINEER', 'EXEC', 'ADMIN'].includes(String(value || '').toUpperCase());
};
