export type DashboardTimeWindow = '7d' | '30d' | '90d' | 'quarter';
export type DashboardCompareTo = 'prev_week' | 'prev_month' | 'prev_quarter';
export type DashboardViewMode = 'executive' | 'delivery' | 'risk';

export type DashboardFilters = {
  bundleId?: string;
  applicationId?: string;
  teamId?: string;
  environment?: string;
  quickFilter?: string;
  timeWindow?: DashboardTimeWindow;
  compareTo?: DashboardCompareTo;
  viewMode?: DashboardViewMode;
};

export type MetricCard = {
  id: string;
  label: string;
  value: number;
  delta: number;
  deltaLabel: string;
  status: 'on_track' | 'watch' | 'at_risk' | 'critical';
  href?: string;
  sparkline?: number[];
};

export type ProgressTrendPoint = {
  bucket: string;
  planned: number;
  actual: number;
  variance: number;
  completed: number;
  total: number;
};

export type ForecastRow = {
  bundleId: string;
  bundleName: string;
  plannedGoLive?: string;
  forecastGoLive?: string;
  varianceDays: number;
  confidence: 'LOW' | 'MEDIUM' | 'HIGH';
  riskLevel: 'ON_TRACK' | 'WATCH' | 'AT_RISK';
  completionPercent: number;
};

export type AtRiskBundleModel = {
  bundleId: string;
  bundleName: string;
  riskScore: number;
  blocked: number;
  overdue: number;
  highCriticalRisks: number;
  forecastVarianceDays: number;
  band: 'low' | 'medium' | 'high';
};

export type BlockerHeatmapCell = {
  key: string;
  label: string;
  blockers: number;
};

export type RiskTrendPoint = {
  bucket: string;
  openRisks: number;
  highCriticalRisks: number;
  blockedProxy: number;
};

export type VelocityPoint = {
  bucket: string;
  completed: number;
  committed: number;
};

export type CapacityRow = {
  team: string;
  available: number;
  allocated: number;
  utilizationPercent: number;
  status: 'UNDERUTILIZED' | 'HEALTHY' | 'WATCH' | 'OVERLOADED';
};

export type DependencyRiskItem = {
  sourceId: string;
  sourceLabel: string;
  sourceBundleId?: string;
  targetId: string;
  targetLabel: string;
  targetBundleId?: string;
  type: string;
  blocked: boolean;
  impactSeverity: 'LOW' | 'MEDIUM' | 'HIGH';
  affectedMilestones: string[];
  riskScore: number;
};

export type WorkItemAgingBucket = {
  bucket: '0-7' | '8-14' | '15-30' | '31+';
  count: number;
};

export type ApplicationDistributionItem = {
  key: string;
  label: string;
  count: number;
};

export type HealthPulseItem = {
  key: 'healthy' | 'watch' | 'at_risk' | 'critical';
  label: string;
  count: number;
};

export type DashboardAiInsight = {
  id: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  confidence: 'LOW' | 'MEDIUM' | 'HIGH';
  entityType: 'BUNDLE' | 'MILESTONE' | 'TEAM' | 'DEPENDENCY';
  entityId: string;
  title: string;
  summary: string;
  recommendation: string;
  href?: string;
  generatedAt: string;
};

export type ExecutiveDashboardResponse = {
  filters: DashboardFilters & { timeWindow: DashboardTimeWindow };
  summary: {
    bundles: MetricCard;
    milestones: MetricCard;
    workItems: MetricCard;
    blocked: MetricCard;
    highCriticalRisks: MetricCard;
    overdue: MetricCard;
  };
  progressTrend: ProgressTrendPoint[];
  forecast: ForecastRow[];
  atRiskBundles: AtRiskBundleModel[];
  blockerHeatmap: {
    dimension: 'bundle' | 'team' | 'application';
    cells: BlockerHeatmapCell[];
  };
  riskTrend: RiskTrendPoint[];
  velocityTrend: VelocityPoint[];
  milestoneBurndown: {
    milestoneId: string;
    milestoneName: string;
    points: Array<{ bucket: string; ideal: number; actual: number }>;
  } | null;
  capacityUtilization: CapacityRow[];
  dependencyRiskMap: DependencyRiskItem[];
  workItemAging: WorkItemAgingBucket[];
  applicationDistribution: {
    dimension: 'bundle' | 'health';
    items: ApplicationDistributionItem[];
  };
  healthPulse: HealthPulseItem[];
  aiSummary: DashboardAiInsight[];
};

export type BundleDashboardResponse = {
  bundleId: string;
  bundleName: string;
  executive: ExecutiveDashboardResponse;
};

export type MilestoneDashboardResponse = {
  milestoneId: string;
  milestoneName: string;
  metadata: {
    bundleId?: string;
    targetDate?: string;
    startDate?: string;
    status?: string;
  };
  progressTrend: ProgressTrendPoint[];
  burndown: Array<{ bucket: string; ideal: number; actual: number }>;
  blockedItems: number;
  overdueItems: number;
  unassignedItems: number;
  dependencies: DependencyRiskItem[];
  aiSummary: DashboardAiInsight[];
};
