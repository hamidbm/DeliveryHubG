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

export interface PortfolioSuggestion {
  id: string;
  label: string;
  prompt: string;
  category: 'risk' | 'delivery' | 'capacity' | 'review';
  provenance: 'deterministic' | 'ai';
}

export interface PortfolioQueryResponse {
  answer: string;
  explanation: string;
  evidence: EvidenceItem[];
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
