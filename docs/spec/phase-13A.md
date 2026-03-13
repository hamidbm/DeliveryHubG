Phase 13A Specification
Executive Portfolio Summary
1. Purpose
Phase 13A delivers the first strategic intelligence capability: a comprehensive executive-level summary of DeliveryHub portfolio state.
The Executive Portfolio Summary synthesizes key signals, trends, risks, and recommendations into a structured, human-friendly narrative. It helps leadership quickly understand the state of delivery performance and make informed decisions.
This feature is independent of forecasting, cross-project risk, and strategic queries — those will come in later Phase 13 subphases.
2. Goals
Functional Goals
Compute a strategic summary object from the structured portfolio report.
Surface summary data via a backend API.
Render summary in a new Executive Insights UI page.
Include actionable recommendations and insights based on deterministic + trend signals.
Non-Functional Goals
Reuse existing structured report, trend signals, and alert outputs.
Keep summary generation deterministic where possible.
Support caching for performance.
Avoid heavy AI reliance unless optional refinement is added later.
3. Inputs
Executive Portfolio Summary must be generated based on:
most recent portfolio snapshot
structured portfolio report
trend signals (from Phase 12D)
active alerts (from Phase 12E)
4. Executive Summary Output Contract
Define a new structured output type in src/types/ai.ts:
export interface ExecutiveSummary {
  portfolioHealth: {
    overallScore: number;
    components: Record<string, number>;
    healthLabel: "healthy" | "moderate_risk" | "high_risk";
  };
  keyObservations: string[];
  strategicConcerns: string[];
  topAlerts: PortfolioAlert[]; // from 12E
  trendHighlights: PortfolioTrendSignal[]; // from 12D
  recommendations: string[];
  generatedAt: string;
}
5. Backend: Executive Summary Generator
File
src/services/ai/executiveSummary.ts
Main Function
async function buildExecutiveSummary(
  report: StructuredPortfolioReport
): Promise<ExecutiveSummary>
Responsibilities
Portfolio Health Interpretation
Use existing healthScore fields.
Produce a healthLabel:
>= 80 → “healthy”
60–79 → “moderate_risk”
< 60 → “high_risk”
Key Observations
Extract top signals with direction and magnitude:
rising unassigned work
growing backlog
blocked work trends
overdue task changes
Translate each into clear text.
Strategic Concerns
Use active high-severity alerts
e.g., blocked work rising
milestone exposure
health score falling
Summarize concerns in concise text.
Top Alerts
Include the top N active alerts sorted by severity.
Trend Highlights
Include trending signals with significant direction and delta
Recommendations
Based on concerns/observations:
identify key areas requiring action
avoid generic recommendations
map back to measurable data (e.g., ratios, counts)
Timestamp
Set generatedAt to current ISO timestamp.
6. RGB (Recommendation Generation Behavior)
Define a simple mapping from data signals to recommendations.
Examples:
Condition	Recommendation
high unassigned ratio	“Reassign unowned tasks in bundles with the largest unassigned backlog.”
rising overdue work	“Prioritize overdue work items to stabilize delivery cadence.”
blocked work high	“Investigate blocking issues and escalate removal.”
low health score	“Focus on reducing overall delivery risk.”
Optionally, add AI refinement later (not required in 13A).
7. API Endpoint
Route
GET /api/ai/executive-summary
Behavior
Require authentication.
Load latest cached structured report (ai_analysis_cache).
Call buildExecutiveSummary.
Return:
{
  "status": "success",
  "executiveSummary": { ... }
}
Error handling:
404 if no report exists
500 on internal error
8. Caching Strategy
Executive summaries should be cached similarly to portfolio summaries:
store under ai_analysis_cache using:
reportType: executiveSummary
snapshotHash
generatedAt
Cache freshness:
consider reports stale after 24h
regeneration only on explicit request (POST or force refresh)
9. UI: Executive Insights Page
URL
/ai/executive-insights
Layout
Executive Insights
----------------------------

Portfolio Health (HealthScoreCard)

Executive Summary (text + highlights)
- keyObservations
- strategicConcerns

Active Alerts (alert cards)

Trend Highlights (TrendSignalCard)

Recommendations (actionable list)
10. UI Components
10.1 ExecutiveSummaryCard.tsx
Props:
{
  summary: ExecutiveSummary
}
Sections:
portfolioHealth
keyObservations
strategicConcerns
recommendations
Design:
health label + score badge
list items with clear text
optionally collapse long lists
10.2 ExecutiveInsightsPage.tsx
Fetch data from API:
GET /api/ai/executive-summary
State transitions:
loading
success
error
Render:
ExecutiveSummaryCard
graph-free, text-first layout
11. Acceptance Criteria
Backend generates structured executive summaries.
API returns the correct shape.
UI displays the summary coherently.
KeyObservations reflect trend direction and magnitude.
StrategicConcerns list active, high-risk alerts.
Recommendations state clear next steps.
No regressions in AI Insights, caching, trends, alerts, notifications.
UI is responsive and accessible.
TypeScript builds successfully (npx tsc --noEmit).
12. Files to Create or Modify
Backend
src/services/ai/executiveSummary.ts
src/app/api/ai/executive-summary/route.ts
Types
src/types/ai.ts
Frontend
src/components/ai/ExecutiveInsightsPage.tsx
src/components/ai/ExecutiveSummaryCard.tsx
13. Example JSON Output
{
  "portfolioHealth": {
    "overallScore": 72,
    "components": {
      "unassigned": 80,
      "blocked": 70,
      "overdue": 65,
      "criticalApps": 60,
      "milestoneOverdue": 75
    },
    "healthLabel": "moderate_risk"
  },
  "keyObservations": [
    "Unassigned work increased by 14 items over the last 7 days.",
    "Overdue work trending upward for second consecutive snapshot."
  ],
  "strategicConcerns": [
    "Blocked work remains high.",
    "Two key milestones show increasing delivery risk."
  ],
  "topAlerts": [
    { "id": "alert-blocked-rising", "title": "Blocked Work Rising", ... },
    { "id": "alert-milestone-risk", "title": "Milestone Exposure Increasing", ... }
  ],
  "trendHighlights": [
    { "metric": "unassignedWorkItems", "direction": "rising", "delta": 14, "timeframeDays": 7 },
    { "metric": "overdueWorkItems", "direction": "rising", "delta": 10, "timeframeDays": 7 }
  ],
  "recommendations": [
    "Reassign unowned tasks in bundles with the largest unassigned backlog.",
    "Prioritize overdue work items to stabilize delivery cadence."
  ],
  "generatedAt": "2026-03-16T10:32:12.345Z"
}
14. Deliverable Summary
Phase 13A implements:
backend executive summary generator
executive summary API
UI for executive insights
structured summary output
integration with existing AI Insights infrastructure
This phase gives leadership a clear portfolio snapshot with strategic context and recommended actions, forming the foundation for deeper strategic intelligence in later phases.