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
  };
  bundles: {
    total: number;
  };
  workItems: {
    total: number;
    overdue: number;
    blocked: number;
    unassigned: number;
    byStatus: Record<string, number>;
  };
  reviews: {
    open: number;
    overdue: number;
  };
  milestones: {
    total: number;
    overdue: number;
  };
}

export type PortfolioSummaryStatus = 'success' | 'error' | 'empty';
export type PortfolioHealthSignal = 'green' | 'amber' | 'red' | 'unknown';
export type PortfolioRiskSeverity = 'low' | 'medium' | 'high' | 'critical';
export type PortfolioReportProvenance = 'ai' | 'deterministic' | 'legacy';

export interface StructuredRiskItem {
  id: string;
  title: string;
  severity: PortfolioRiskSeverity;
  summary: string;
  evidence: string[];
  provenance: PortfolioReportProvenance;
}

export interface StructuredActionItem {
  id: string;
  title: string;
  urgency: 'now' | '7d' | '30d' | 'later';
  summary: string;
  ownerHint?: string;
  evidence?: string[];
  provenance: PortfolioReportProvenance;
}

export interface StructuredConcentrationSignal {
  id: string;
  title: string;
  summary: string;
  impact?: string;
  evidence?: string[];
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
}

export interface PortfolioQueryEvidenceItem {
  label: string;
  value: string;
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
  evidence: PortfolioQueryEvidenceItem[];
  followUps: string[];
}
