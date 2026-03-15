export interface PortfolioSnapshot {
  generatedAt: string;
  applications: {
    total: number;
    byHealth: {
      healthy: number;
      warning: number;
      critical: number;
      unknown: number;
    };
    items?: Array<{
      id: string;
      name: string;
      health: 'healthy' | 'warning' | 'critical' | 'unknown';
      bundleId?: string;
    }>;
  };
  bundles: {
    total: number;
    items?: Array<{
      id: string;
      name: string;
    }>;
  };
  workItems: {
    total: number;
    overdue: number;
    blocked: number;
    unassigned: number;
    byStatus: Record<string, number>;
    items?: Array<{
      id: string;
      key?: string;
      title: string;
      status: string;
      blocked: boolean;
      assignee?: string;
      dueDate?: string;
      bundleId?: string;
      applicationId?: string;
      milestoneIds?: string[];
      priority?: string;
      links?: Array<{
        type?: string;
        targetId?: string;
        workItemId?: string;
        itemId?: string;
        title?: string;
      }>;
      dependency?: {
        blocking?: boolean;
        dependsOn?: {
          id?: string;
          name?: string;
          type?: string;
        };
      };
    }>;
  };
  reviews: {
    open: number;
    overdue: number;
    items?: Array<{
      id: string;
      status: string;
      dueDate?: string;
      applicationId?: string;
      bundleId?: string;
      title?: string;
    }>;
  };
  milestones: {
    total: number;
    overdue: number;
    items?: Array<{
      id: string;
      name: string;
      status: string;
      targetDate?: string;
      bundleId?: string;
    }>;
  };
}

export interface PortfolioSnapshotHistory {
  id?: string;
  createdAt: string;
  totalApplications: number;
  criticalApplications: number;
  totalWorkItems: number;
  unassignedWorkItems: number;
  blockedWorkItems: number;
  overdueWorkItems: number;
  activeWorkItems: number;
  openReviews: number;
  overdueMilestones: number;
}

export interface PortfolioTrendSignal {
  metric: 'unassignedWorkItems' | 'blockedWorkItems' | 'overdueWorkItems' | 'activeWorkItems' | 'criticalApplications' | 'overdueMilestones';
  direction: 'rising' | 'falling' | 'stable';
  delta: number;
  timeframeDays: number;
  summary?: string;
}

export interface HealthScore {
  overall: number;
  components: {
    unassigned: number;
    blocked: number;
    overdue: number;
    active: number;
    criticalApps: number;
    milestoneOverdue: number;
  };
}

export interface PredictiveRisk {
  id: string;
  title: string;
  severity: PortfolioRiskSeverity;
  summary: string;
  evidence: EvidenceItem[];
  entities: EntityReference[];
  provenance: 'deterministic' | 'legacy';
}

export interface PortfolioAlert {
  id: string;
  title: string;
  severity: PortfolioRiskSeverity;
  summary: string;
  rationale: string;
  evidence: EvidenceItem[];
  entities: EntityReference[];
  resultOf: 'trend' | 'threshold' | 'predictive';
  timestamp: string;
}

export type PortfolioSummaryStatus = 'success' | 'error' | 'empty';
export type PortfolioHealthSignal = 'green' | 'amber' | 'red' | 'unknown';
export type PortfolioRiskSeverity = 'low' | 'medium' | 'high' | 'critical';
export type PortfolioReportProvenance = 'ai' | 'deterministic' | 'legacy';
export type EntityType = 'workitem' | 'application' | 'bundle' | 'milestone' | 'review';

export interface EntityReference {
  type: EntityType;
  id: string;
  label: string;
  secondary?: string;
}

export interface EvidenceItem {
  text: string;
  entities: EntityReference[];
  provenance?: PortfolioReportProvenance;
}

export type RelatedEntitiesMeta = Partial<Record<EntityType, Record<string, string>>>;

export interface StructuredRiskItem {
  id: string;
  title: string;
  severity: PortfolioRiskSeverity;
  summary: string;
  evidence: EvidenceItem[];
  provenance: PortfolioReportProvenance;
}

export interface StructuredActionItem {
  id: string;
  title: string;
  urgency: 'now' | '7d' | '30d' | 'later';
  summary: string;
  ownerHint?: string;
  evidence?: EvidenceItem[];
  provenance: PortfolioReportProvenance;
}

export interface StructuredConcentrationSignal {
  id: string;
  title: string;
  summary: string;
  impact?: string;
  evidence?: EvidenceItem[];
  provenance: PortfolioReportProvenance;
}

export interface StructuredQuestionItem {
  id: string;
  question: string;
  rationale?: string;
  provenance: PortfolioReportProvenance;
}

export interface StructuredPortfolioReport {
  overallHealth: PortfolioHealthSignal;
  executiveSummary: string;
  topRisks: StructuredRiskItem[];
  recommendedActions: StructuredActionItem[];
  concentrationSignals: StructuredConcentrationSignal[];
  trendSignals?: PortfolioTrendSignal[];
  alerts?: PortfolioAlert[];
  healthScore?: HealthScore;
  questionsToAsk: StructuredQuestionItem[];
  markdownReport?: string;
}

export interface PortfolioSummaryMetadata {
  generatedAt: string;
  provider: string;
  model: string;
  cached?: boolean;
  freshnessStatus?: 'fresh' | 'stale';
  snapshotHash?: string;
  legacyCacheNormalized?: boolean;
  lastAttemptedProvider?: string;
  lastAttemptedModel?: string;
  attemptedProviders?: Array<{
    provider: string;
    model: string;
  }>;
}

export interface PortfolioSummaryResponse {
  status: PortfolioSummaryStatus;
  error?: {
    code: string;
    message: string;
  };
  message?: string;
  metadata?: PortfolioSummaryMetadata;
  snapshot?: PortfolioSnapshot;
  report?: StructuredPortfolioReport;
  relatedEntitiesMeta?: RelatedEntitiesMeta;
}

export interface ExecutiveSummary {
  portfolioHealth: {
    overallScore: number;
    components: Record<string, number>;
    healthLabel: 'healthy' | 'moderate_risk' | 'high_risk';
  };
  keyObservations: string[];
  strategicConcerns: string[];
  topAlerts: PortfolioAlert[];
  trendHighlights: PortfolioTrendSignal[];
  recommendations: string[];
  generatedAt: string;
}

export interface ForecastSignal {
  id: string;
  title: string;
  category:
    | 'milestone_risk'
    | 'execution_slowdown'
    | 'backlog_growth'
    | 'ownership_risk'
    | 'review_bottleneck';
  severity: 'low' | 'medium' | 'high';
  confidence: number;
  summary: string;
  evidence: EvidenceItem[];
  relatedEntities?: EntityReference[];
}

export interface ActionStep {
  id: string;
  description: string;
  relatedEntities: EntityReference[];
  priority: 'critical' | 'high' | 'medium' | 'low';
  suggestedBy: 'deterministic' | 'AI';
  evidence: EvidenceItem[];
}

export interface TaskSuggestion {
  id: string;
  title: string;
  description: string;
  relatedEntities: EntityReference[];
  priority: 'critical' | 'high' | 'medium' | 'low';
  evidence: EvidenceItem[];
}

export interface WorkflowRule {
  id: string;
  description: string;
  condition: string;
  recommendedAction: string;
  enabled?: boolean;
  suggestedBy?: 'deterministic' | 'AI';
}

export interface ActionPlan {
  generatedAt: string;
  summary: string;
  steps: ActionStep[];
  suggestTasks: TaskSuggestion[];
  relatedSignals: {
    alerts: PortfolioAlert[];
    forecast: ForecastSignal[];
    propagation: RiskPropagationSignal[];
  };
}

export interface PropagationPath {
  from: EntityReference;
  to: EntityReference;
  linkType: 'dependency' | 'shared_resource' | 'milestone_sequence';
}

export interface RiskPropagationSignal {
  id: string;
  title: string;
  severity: 'low' | 'medium' | 'high';
  summary: string;
  paths: PropagationPath[];
  evidence: EvidenceItem[];
  relatedEntities: EntityReference[];
}

export interface PortfolioSuggestion {
  id: string;
  label: string;
  prompt: string;
  category: 'risk' | 'delivery' | 'capacity' | 'review' | 'alert' | 'trend' | 'health' | 'strategic';
  provenance: 'deterministic' | 'ai';
}

export interface StrategicQueryResponse {
  answer: string;
  explanation: string;
  evidence: EvidenceItem[];
  relatedEntities: EntityReference[];
  followUps: string[];
  actionPlan?: ActionPlan;
  success: boolean;
  errorMessage?: string;
  warning?: string;
}

export type ScenarioChange =
  | { type: 'reassignWorkItems'; workItemIds: string[]; toOwner: string }
  | { type: 'adjustMilestoneDate'; milestoneId: string; newDate: string }
  | { type: 'adjustPriority'; workItemIds: string[]; newPriority: number }
  | { type: 'bundleResourceShift'; fromBundleId: string; toBundleId: string; count: number };

export interface ScenarioDefinition {
  id: string;
  description: string;
  changes: ScenarioChange[];
}

export interface ScenarioResult {
  scenarioId: string;
  description: string;
  simulatedSnapshot: Partial<PortfolioSnapshot>;
  forecastSignals: ForecastSignal[];
  riskPropagationSignals: RiskPropagationSignal[];
  healthScore: HealthScore;
  metricDeltas: {
    [metric: string]: number;
  };
  recommendations: string[];
}

export interface PortfolioQueryResponse {
  answer: string;
  explanation: string;
  evidence: EvidenceItem[];
  alerts?: PortfolioAlert[];
  followUps: string[];
  relatedEntitiesMeta?: RelatedEntitiesMeta;
  entities?: EntityReference[];
}

export interface SavedInvestigation {
  id: string;
  userId: string;
  question: string;
  normalizedIntent?: string;
  answer: string;
  explanation: string;
  evidence: EvidenceItem[];
  entities: EntityReference[];
  followUps: string[];
  pinned: boolean;
  relatedEntitiesMeta?: RelatedEntitiesMeta;
  createdAt: string;
  updatedAt: string;
}

export type WatcherType =
  | 'alert'
  | 'investigation'
  | 'trend'
  | 'health';

export type NotificationDeliveryStatus = {
  status: 'pending' | 'sent' | 'failed' | 'suppressed';
  lastAttemptedAt?: string;
  lastErrorMessage?: string;
  attempts?: number;
  nextRetryAt?: string;
};

export type WatcherDeliveryPreferences = {
  in_app?: {
    enabled: boolean;
  };
  email?: {
    enabled: boolean;
    severityMin?: PortfolioRiskSeverity;
  };
  slack?: {
    enabled: boolean;
    webhookUrl?: string;
    severityMin?: 'medium' | 'high' | 'critical';
  };
  teams?: {
    enabled: boolean;
    webhookUrl?: string;
    severityMin?: 'medium' | 'high' | 'critical';
  };
  digest?: {
    enabled: boolean;
    frequency: 'hourly' | 'daily';
  };
};

export interface Watcher {
  id: string;
  userId: string;
  type: WatcherType;
  targetId: string;
  condition: Record<string, any>;
  deliveryPreferences?: WatcherDeliveryPreferences;
  enabled: boolean;
  createdAt: string;
  lastTriggeredAt?: string;
}

export interface Notification {
  id: string;
  watcherId: string;
  userId: string;
  title: string;
  message: string;
  severity?: PortfolioRiskSeverity;
  relatedEntities?: EntityReference[];
  relatedInvestigationId?: string;
  createdAt: string;
  read: boolean;
  deliveryMode?: 'immediate' | 'digest';
  delivery?: {
    email?: NotificationDeliveryStatus;
    slack?: NotificationDeliveryStatus;
    teams?: NotificationDeliveryStatus;
    in_app?: {
      status: 'sent';
      deliveredAt: string;
    };
  };
}

export interface NotificationDigestItem {
  id: string;
  userId: string;
  notificationId: string;
  watcherId?: string;
  digestFrequency?: 'hourly' | 'daily';
  processedAt?: string;
  createdAt: string;
}
