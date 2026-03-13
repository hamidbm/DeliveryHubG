Phase 12E Specification
Early Warning Alerts, Portfolio Health Scoring, and Predictive Risk
1. Purpose
Phase 12E extends DeliveryHub AI Insights from descriptive and investigational reporting into proactive portfolio intelligence. It introduces:
Early warning alerts based on risk and trend signals
Deterministic health scores summarizing portfolio state
Predictive risk analysis for near-term execution threats
An alert-to-investigation workflow connecting alerts to deep dives
These capabilities help stakeholders detect emerging issues before they become critical and act with context.
2. High-Level Goals
Functional Goals
Detect and surface trend-based alerts (e.g., worsening workload, blocked tasks, overdue milestones).
Compute portfolio health scores from deterministic signals.
Identify predictive execution risks (e.g., likely milestone slips).
Tie alerts to drill-down entity panels and recommended follow–ups.
Allow converting alerts into saved investigations.
Non-Functional Goals
Maintain deterministic explainability
Preserve existing caching, export, query, and investigation behavior
Avoid new AI provider call patterns except when beneficial
Keep UI performant and responsive
3. Scope
In Scope
Early warning alert generation and surfaces
Portfolio health scoring
Predictive milestone risk detection
Alert UI integration in AI Insights
Optional alert persistence
Suggested follow-up investigations from alerts
Integration with saved investigations system
Out of Scope (for this phase)
Background task scheduling (deferred to 12E.x+)
Push notifications to email/Slack
Cross-user alert sharing/dashboard
ML-based statistical forecasting
External analytics dashboard integration
4. Key Concepts & Definitions
Term	Meaning
Alert	A proactive sign of deteriorating delivery health or emerging risk; surfaced in AI Insights
Health Score	A deterministic composite metric summarizing portfolio health (0–100)
Predictive Risk	A risk signal that may impact future delivery outcomes
Alert Investigation	A saved investigation derived from an alert’s context
5. Alert Types
Define core alert categories:
5.1 Trend-Based Alerts
Triggered when a trend signal shows meaningful deterioration:
Rising Unassigned Workload
Increasing Blocked Tasks
Growing Overdue Work
Milestone Threat Rising
Review Backlog Increasing
Critical Apps Increasing
5.2 Threshold-Based Alerts
Triggered when a metric crosses a deterministic threshold:
Unassigned ratio ≥ X%
Blocked ratio ≥ Y%
Overdue ratio ≥ Z%
Critical application count ≥ threshold
Milestone overdue count > 0
Threshold values must be configurable defaults.
5.3 Predictive Alerts
Use combinatorial rules on current and trend signals:
If overdue UWs + rising blocked tasks → Execution Risk Alert
If milestone exposure + rising overdue work → Milestone Slip Risk
If low active throughput + rising backlog → Capacity Pressure Alert
6. Portfolio Health Scoring
6.1 Health Score Definition
Compute a deterministic composite score (0–100) using weighted signals:
Component	Weight
Unassigned ratio	20%
Blocked ratio	20%
Overdue ratio	20%
Active work ratio	15%
Critical app count	15%
Milestone overdue count	10%
Score direction:
higher score = healthier portfolio
lower score = more stressed
6.2 Component Normalization
For each ratio metric:
normalized = 100 – clamp(ratio * 100, 0, 100)
Critical app count and overdue count normalized against configurable max.
Produce:
interface HealthScore {
  overall: number;
  components: {
    unassigned: number;
    blocked: number;
    overdue: number;
    active: number;
    criticalApps: number;
    milestoneOverdue: number;
  }
}
7. Predictive Risk Detection
7.1 Predictive Criteria
Define deterministic rules:
Execution Risk:
Rising blocked & unassigned ratios above thresholds
Milestone Slip Risk:
Milestone target near and rising overdue work
Review Congestion Risk:
Rising overdue reviews & growing backlog
Capacity Pressure:
Low active work plus rising unassigned backlog
Produce:
interface PredictiveRisk {
  id: string;
  title: string;
  severity: "critical" | "high" | "medium" | "low";
  summary: string;
  evidence: EvidenceItem[];
  entities: EntityReference[];
  provenance: "deterministic" | "legacy";
}
8. Alert Object Contract
Add new type:
export interface PortfolioAlert {
  id: string;
  title: string;
  severity: "critical" | "high" | "medium" | "low";
  summary: string;
  rationale: string;
  evidence: EvidenceItem[];
  entities: EntityReference[];
  resultOf: "trend" | "threshold" | "predictive";
  timestamp: string;
}
Extended report model:
interface StructuredPortfolioReport {
  trendSignals: PortfolioTrendSignal[];
  alerts?: PortfolioAlert[];
  healthScore?: HealthScore;
}
9. Backend Components
9.1 Alert Detection Service
Create:
src/services/ai/alertDetector.ts
Responsibility:
Accept snapshot, trend signals, health score
Evaluate against alert rules
Return PortfolioAlert[]
9.2 Health Scoring Service
Create:
src/services/ai/healthScorer.ts
Responsibility:
Compute component scores
Compute overall score
9.3 Predictive Risk Engine
Part of alertDetector or separate file:
src/services/ai/predictiveRisk.ts
Responsibility:
Ingest snapshot + trend signals
Apply deterministic rules for predictive risks
10. Report Normalization
Update:
normalizePortfolioReport.ts
Integrate:
trendSignals
healthScore
alerts
Normalization steps:
run health scoring
run alert detection
merge predictive risks
Add fallback defaults (no alerts if none qualify).
11. Query Engine Integration
Extend queryEngine.ts to support trend & predictive queries such as:
“Show me emerging portfolio risks”
“Is delivery risk increasing in the next 7 days?”
“What alerts are active now?”
Deterministic logic should prioritize:
alerts
trend signals
health score
Return:
{
  answer: string;
  explanation: string;
  evidence: EvidenceItem[];
  alerts?: PortfolioAlert[];
  followUps: string[];
  entities?: EntityReference[];
}
12. Quick Suggestion Enhancements
Update:
suggestionGenerator.ts
Add suggestions based on alerts and health score:
Examples:
“Explore rising blocked work trend”
“Investigate cause of unassigned backlog increase”
“Examine milestones with emerging risk”
“Check delivery execution health”
Suggestions include:
{
  id: string;
  label: string;
  prompt: string;
  category: "alert" | "trend" | "risk" | "health";
  provenance: "deterministic";
}
13. UI Integration
Modify:
AIInsights.tsx and new components.
13.1 Portfolio Health Section
Add above Trends section:
Portfolio Health
-------------------------
Health Score: 73 / 100
Component breakdown:
  - Unassigned ratio: 80/100
  - Blocked ratio: 70/100
  ...
Use a styled card with component bars or badges (simple text if needed).
13.2 Alerts Panel
Add new section:
Alerts
---------
[Critical] Blocked Work Rising
Summary: Blocked work has increased significantly over the last 7 days.
Rationale: Rising trend in blocked tasks over multiple snapshots.
Related Entities:
- WI-xxxxx
- MS-yyy
View Drill-Down
Display alerts:
sorted by severity (critical → low)
show title, summary, rationale, evidence list, drill-down entities
13.3 UI Components
Create:
src/components/ui/HealthScoreCard.tsx
src/components/ui/AlertCard.tsx
AlertCard should:
highlight severity
show summary
show evidence (using EntityEvidenceList)
link to entity drill-downs
optionally offer “Save Investigation” directly from alert
14. Alert Investigation Workflow
14.1 Save Alert as Investigation
Under each alert card, show:
[Save as Investigation]
This triggers:
saving a query whose question is effectively the alert’s title
answer snapshot includes this alert and context
pinned investigation can be used
Use existing saved investigation API.
15. Acceptance Criteria
Health scoring is computed deterministically and displayed.
Alerts appear correctly when threshold or trend conditions are met.
Predictive risks surface logically with evidence and entities.
Query engine supports alert-related questions.
Quick suggestions surface alert contexts.
Saved investigation from an alert works.
No regressions in caching, export, trend, or query systems.
TypeScript builds cleanly (npx tsc --noEmit).
16. Files to Create or Modify
Backend
src/services/ai/alertDetector.ts
src/services/ai/healthScorer.ts
src/services/ai/predictiveRisk.ts
src/services/ai/normalizePortfolioReport.ts
src/services/ai/queryEngine.ts
src/services/ai/suggestionGenerator.ts
src/app/api/ai/portfolio-summary/route.ts
src/app/api/ai/portfolio-query/route.ts
Types
src/types/ai.ts
Frontend
src/components/AIInsights.tsx
src/components/ui/HealthScoreCard.tsx
src/components/ui/AlertCard.tsx
17. Deliverable Summary
Phase 12E transforms the AI Insights feature into a proactive intelligence system by introducing:
deterministic health scoring
early warning alerts
predictive risk signals
alert-to-investigation workflows
alert-aware quick suggestions
This moves AI Insights toward continuous portfolio risk monitoring — equipping DeliveryHub customers to detect and act on emerging delivery threats.