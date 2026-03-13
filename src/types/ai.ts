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

export interface PortfolioSummaryResponse {
  status: 'success' | 'error' | 'empty';
  error?: {
    code: string;
    message: string;
  };
  message?: string;
  metadata?: {
    generatedAt: string;
    provider: string;
    model: string;
    cached?: boolean;
    freshnessStatus?: 'fresh' | 'stale';
    snapshotHash?: string;
    attemptedProviders?: Array<{
      provider: string;
      model: string;
    }>;
  };
  snapshot?: PortfolioSnapshot;
  report?: {
    executiveSummary: string;
  };
}
