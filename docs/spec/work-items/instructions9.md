# Next: Cross-Bundle Coordination v1 (Program-Level Blockers/Risks/Confidence)

## Goal
Add a program-level coordination view and API that answers:
- Which bundles are most at risk?
- What are the top cross-bundle blockers?
- Which milestones are most likely to slip?
- Where are high/critical risks concentrated?

This must work across bundles and milestones, using existing rollups + dependency model.

---

## Part A — Program Intel API (New Endpoint)

### Add endpoint
`GET /api/program/intel`

Query params:
- `milestoneIds` (optional)
- `bundleIds` (optional)
- `includeLists=true|false` (default false)
- `limit` (default 10)

### Response shape
```ts
type ProgramIntelResponse = {
  summary: {
    bundles: number;
    milestones: number;
    workItems: number;
    blockedDerived: number;
    highCriticalRisks: number;
    overdueOpen: number;
  };
  bundleRollups: Array<{
    bundleId: string;
    bundleName?: string;
    milestones: Array<{
      milestoneId: string;
      rollup: MilestoneRollup;
      readiness: MilestoneReadiness;
    }>;
    aggregated: {
      confidenceAvg: number;
      readinessAvg: number;
      blockedDerived: number;
      highCriticalRisks: number;
      overdueOpen: number;
      isLateCount: number;
    };
    band: 'high'|'medium'|'low'; // derived from aggregated
  }>;
  listCounts: {
    topCrossBundleBlockers: number;
    topAtRiskBundles: number;
    topAtRiskMilestones: number;
  };
  lists?: {
    topCrossBundleBlockers: Array<{
      blockerId; blockerKey; blockerTitle; blockerStatus;
      blockerBundleId; blockerMilestoneId;
      blockedCount: number;                 // number of open dependents across other bundles
      sampleBlocked: Array<{ id; key; title; bundleId; milestoneId }>;
    }>;
    topAtRiskBundles: Array<{
      bundleId; bundleName?;
      blockedDerived: number;
      highCriticalRisks: number;
      overdueOpen: number;
      confidenceAvg: number;
      readinessAvg: number;
      band: 'high'|'medium'|'low';
    }>;
    topAtRiskMilestones: Array<{
      milestoneId; milestoneName?;
      blockedDerived: number;
      highCriticalRisks: number;
      overdueOpen: number;
      confidenceScore: number;
      readinessBand: 'high'|'medium'|'low';
      isLate: boolean;
      slipDays: number;
    }>;
  };
};