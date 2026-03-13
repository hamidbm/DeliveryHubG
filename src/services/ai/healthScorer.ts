import { HealthScore, PortfolioSnapshot } from '../../types/ai';
import { PortfolioSignalSummary } from './portfolioSignals';

export type HealthScoreConfig = {
  maxCriticalApplications: number;
  maxOverdueMilestones: number;
  weights: {
    unassigned: number;
    blocked: number;
    overdue: number;
    active: number;
    criticalApps: number;
    milestoneOverdue: number;
  };
};

const DEFAULT_CONFIG: HealthScoreConfig = {
  maxCriticalApplications: 15,
  maxOverdueMilestones: 10,
  weights: {
    unassigned: 0.20,
    blocked: 0.20,
    overdue: 0.20,
    active: 0.15,
    criticalApps: 0.15,
    milestoneOverdue: 0.10
  }
};

const clamp = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, value));

const normalizedNegativeRatio = (ratio: number) => clamp(100 - clamp(ratio * 100));
const normalizedPositiveRatio = (ratio: number) => clamp(ratio * 100);
const normalizedCount = (count: number, maxCount: number) => clamp(100 - clamp((count / Math.max(1, maxCount)) * 100));

const round = (value: number) => Math.round(value);

export const computePortfolioHealthScore = (
  signals: PortfolioSignalSummary,
  snapshot?: PortfolioSnapshot,
  config: Partial<HealthScoreConfig> = {}
): HealthScore => {
  const merged: HealthScoreConfig = {
    ...DEFAULT_CONFIG,
    ...config,
    weights: {
      ...DEFAULT_CONFIG.weights,
      ...(config.weights || {})
    }
  };

  const components = {
    unassigned: round(normalizedNegativeRatio(signals.unassignedRatio)),
    blocked: round(normalizedNegativeRatio(signals.blockedRatio)),
    overdue: round(normalizedNegativeRatio(signals.overdueRatio)),
    active: round(normalizedPositiveRatio(signals.activeWorkRatio)),
    criticalApps: round(normalizedCount(signals.criticalApplications, merged.maxCriticalApplications)),
    milestoneOverdue: round(normalizedCount(signals.milestonesOverdue, merged.maxOverdueMilestones))
  };

  // Snapshot can inform future tuning; currently scoring is signal-driven for determinism and speed.
  void snapshot;

  const overall = round(
    components.unassigned * merged.weights.unassigned
    + components.blocked * merged.weights.blocked
    + components.overdue * merged.weights.overdue
    + components.active * merged.weights.active
    + components.criticalApps * merged.weights.criticalApps
    + components.milestoneOverdue * merged.weights.milestoneOverdue
  );

  return {
    overall: clamp(overall),
    components
  };
};
