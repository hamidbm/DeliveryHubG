# DeliveryHub Executive Dashboard Spec for Codex

## Objective

Redesign and deepen the **Dashboards** experience so it becomes genuinely useful to upper management, program leadership, delivery managers, and steering committees.

The dashboard must evolve from a mostly descriptive status page into an **executive decision dashboard** that answers the following questions immediately:

1. Are we on track?
2. Where are the biggest risks?
3. Which bundles, milestones, applications, or teams need intervention?
4. Are we trending toward or away from delivery success?
5. What is the forecast for go-live and milestone completion?
6. Where are dependencies, blockers, and capacity imbalances creating delivery drag?

This spec covers:

- dashboard goals
- information architecture
- UX behavior
- chart and widget definitions
- KPI calculations
- API requirements
- backend aggregation requirements
- data model extensions if needed
- drill-down behavior
- AI Insight integration
- performance and caching requirements
- acceptance criteria

---

## 1. Product Intent

### 1.1 Current problem

The current dashboard is visually clean, but it is not yet deeply useful for senior stakeholders because it emphasizes mostly static counts and distributions:

- total apps
- active bundles
- average migration
- open risks
- application distribution
- health pulse
- at-risk bundles

These widgets provide some situational awareness, but they do not yet provide enough:

- trend analysis
- predictive forecast
- intervention guidance
- execution efficiency visibility
- team/capacity insight
- dependency visibility
- milestone health detail

### 1.2 New target state

The dashboard must become an executive command surface with three layers:

#### Layer 1: Executive summary
High-level snapshot of overall program health.

#### Layer 2: Decision visuals
Charts that explain progress, forecast, blockers, risk, and capacity.

#### Layer 3: Drill-down pathways
Fast navigation from portfolio-level issues into bundle-level and milestone-level detail.

---

## 2. Dashboard Personas

### 2.1 Executive / upper management

Needs:

- high-level health
- forecast confidence
- at-risk areas
- trend direction
- intervention priorities

### 2.2 Program director / PMO leader

Needs:

- bundle-by-bundle risk
- milestone drift
- blockers and dependencies
- team capacity balance
- overdue and aging work

### 2.3 Delivery manager / release manager

Needs:

- sprint velocity trends
- milestone burn-down
- blocked work
- assignment and workload signals
- dependency bottlenecks

---

## 3. Dashboard Scope

Implement the dashboard as a hierarchical dashboard experience with at least these views:

### 3.1 Portfolio / executive dashboard
Cross-bundle view across the full tenant or selected portfolio.

### 3.2 Bundle dashboard
Focused dashboard for one selected bundle.

### 3.3 Milestone dashboard
Focused dashboard for one selected milestone within a bundle.

Milestone dashboard can be phase 2 if needed, but the executive dashboard must be designed so drill-down can reach this level.

---

## 4. Dashboard Information Architecture

### 4.1 Top-level tabs

Preserve the top nav style already present:

- Dashboards
- Program
- Activities
- AI Insights

The redesigned dashboard lives under **Dashboards**.

### 4.2 Dashboard sections

The executive dashboard should have the following sections in order:

#### A. Program health summary strip
Compact KPI cards.

#### B. Delivery progress and forecast row
Two major charts:
- delivery progress trend
- go-live / milestone forecast

#### C. Risk and execution row
Three major widgets:
- at-risk bundles
- blocker heatmap
- risk trend

#### D. Delivery mechanics row
Two or three visuals:
- velocity trend
- milestone burn-down
- capacity utilization

#### E. Structural health row
Two visuals:
- dependency risk map
- work item aging

#### F. Distribution / composition row
Two visuals:
- application distribution
- health pulse

#### G. AI summary panel
High-value AI-generated recommendations with drill-down links.

---

## 5. Executive Dashboard Layout

Use a responsive card-and-chart grid. Preferred desktop structure:

### 5.1 Row 1: Program Health Summary
6 KPI cards:

- Bundles
- Milestones
- Work Items
- Blocked
- High/Critical Risks
- Overdue

These already exist conceptually and should remain.

Each KPI card must show:

- current value
- directional change vs prior comparison period
- sparkline or trend hint if feasible
- click-through to detail view

### Example card
- Title: `Blocked Work`
- Value: `11`
- Delta: `+3 vs last week`
- Status tone: warning

### 5.2 Row 2: Delivery Progress + Forecast
Two large charts side by side:

- Delivery Progress Trend
- Delivery Forecast

### 5.3 Row 3: At-Risk and Risk Signals
Three medium widgets:

- At-Risk Bundles
- Blocker Heatmap
- Risk Trend

### 5.4 Row 4: Execution Performance
Three widgets:

- Velocity Trend
- Milestone Burn-Down
- Capacity Utilization

### 5.5 Row 5: Structural Risks
Two widgets:

- Dependency Risk Map
- Work Item Aging

### 5.6 Row 6: Composition and Health
Two widgets:

- Application Distribution
- Health Pulse

### 5.7 Row 7: AI Summary
One full-width AI summary panel with recommended interventions.

---

## 6. Global Dashboard Controls

At the top of the dashboard add global filters and controls.

### 6.1 Required global filters

- Portfolio scope or all bundles
- Bundle filter
- Application filter
- Team filter
- Environment or phase filter
- Time window selector
- Comparison period selector

### 6.2 Time windows

Support:

- last 7 days
- last 30 days
- last 90 days
- current quarter
- custom range

### 6.3 Comparison modes

Support:

- vs previous week
- vs previous month
- vs previous quarter

### 6.4 View mode selector

Support:

- Executive
- Delivery
- Risk

This can simply show/hide chart groups in phase 2; not required in phase 1 if it slows delivery.

---

## 7. Widget and Chart Specifications

### 7.1 Program Health Summary Strip

#### Purpose
Give executives a one-line health snapshot of the portfolio.

#### Required cards

- Bundles
- Milestones
- Work Items
- Blocked
- High/Critical Risks
- Overdue

#### KPI definitions

##### Bundles
Count active bundles in current filter context.

##### Milestones
Count milestones in current filter context.

##### Work Items
Count epics + features + stories + tasks in current filter context.

##### Blocked
Count work items or milestones marked blocked.

##### High/Critical Risks
Count risks marked high or critical, or if no risk collection exists yet, derive from flagged risky entities.

##### Overdue
Count milestones or work items past due date and not completed.

#### Interaction
Each card is clickable and opens the corresponding filtered Program view.

### 7.2 Delivery Progress Trend

#### Purpose
Show whether delivery is advancing according to plan.

#### Chart type
Dual-line chart.

#### X-axis
Time buckets:
- week
- sprint
- month

Use week by default.

#### Y-axis
Progress percentage from 0 to 100.

#### Series
- Planned Progress
- Actual Progress

#### Calculation

##### Planned Progress
Compute from milestone plan and target date progression.

At minimum:
- use date-based expected completion relative to planned start and go-live
- optionally weight by milestones if milestone weighting exists

##### Actual Progress
Compute from completed work relative to total planned work.

Recommended formula:
- use weighted completion across epics/features/stories/tasks
- phase 1 acceptable fallback: percent of stories/tasks completed

#### Tooltip
Show:
- planned %
- actual %
- variance %
- total completed work items
- total planned work items

#### Status rules
Show variance badge:
- On track: variance >= -5%
- Warning: variance < -5% and >= -10%
- At risk: variance < -10%

#### Drill-down
Clicking any point or legend item should navigate to Program view filtered to that period or selected bundle.

### 7.3 Delivery Forecast

#### Purpose
Show expected delivery dates and schedule risk.

#### Chart type
Timeline / forecast bar chart.

#### Rows
Each row is a bundle.

#### Columns or visual segments
- Planned go-live
- Forecast go-live
- Variance
- Confidence
- Risk level

#### Forecast calculation
Use current completion trend and remaining scope to estimate likely finish.

Phase 1 acceptable method:
- derive forecast by comparing planned progress vs actual progress and projecting slip
- if actual progress lags planned by X%, push forecast date proportionally

If velocity data exists:
- use recent story/task completion rate to project remaining duration

#### Confidence score
Provide a low/medium/high confidence score based on:
- existence of recent completion data
- blocker count
- open dependencies
- risk count
- overdue items

#### Visual treatment
- green for on time or early
- amber for moderate slip
- red for significant slip

#### Drill-down
Click row to open bundle dashboard.

### 7.4 At-Risk Bundles

#### Purpose
Surface the bundles most needing executive attention.

#### Widget type
Ranked list with compact cards.

#### Each row shows
- bundle name
- risk score
- blocked count
- overdue count
- high/critical risk count
- forecast variance
- badge: low / medium / high

#### Risk scoring model
Use a composite risk score from:
- blocked items
- overdue milestones
- completion variance
- open critical risks
- dependency exposure
- aging work items

#### Suggested formula
Start with weighted normalized score:
- 25% completion variance
- 20% blocked ratio
- 20% overdue ratio
- 15% high/critical risks
- 10% dependency exposure
- 10% aging work items

This formula can be tuned later.

#### Interaction
Click bundle -> bundle dashboard.

### 7.5 Blocker Heatmap

#### Purpose
Show where blockers are concentrated.

#### Chart type
Heatmap or grouped bar chart.

#### Dimensions
Allow switch between:
- blockers by bundle
- blockers by team
- blockers by application

#### Default
Blockers by bundle.

#### Data
Count blocked work items and optionally blocked milestones.

#### Color intensity
- light = low blocker density
- dark = high blocker density

#### Drill-down
Click a cell or bar -> Program view filtered to blocked items in that dimension.

### 7.6 Risk Trend

#### Purpose
Show whether risk is improving or worsening.

#### Chart type
Line chart or stacked area chart.

#### X-axis
Time buckets by week.

#### Y-axis
Risk count.

#### Series
- Open risks
- Closed risks
- High/Critical risks

If no explicit risk-closure history exists yet:
- derive trend from status snapshots or event history where possible
- otherwise start with open count trend only

#### Interaction
Click week -> Activities or AI Insights filtered to risk-related items.

### 7.7 Velocity Trend

#### Purpose
Show execution throughput over time.

#### Chart type
Line chart or bar chart.

#### X-axis
Sprint or week.

#### Y-axis
Completed work units.

#### Metric
Default to:
- stories completed per sprint

Optional toggles:
- tasks completed
- story points completed
- weighted completion units

#### Additional series
- committed vs completed
- average cycle time if available

#### Status interpretation
Highlight downward trend beyond threshold.

#### Drill-down
Click a sprint -> bundle or milestone view for that sprint.

### 7.8 Milestone Burn-Down

#### Purpose
Show whether a selected milestone is burning down properly.

#### Chart type
Burn-down line chart.

#### Scope
In executive view, show the most at-risk milestone by default.
Allow dropdown to switch milestone.

#### X-axis
Time or sprint.

#### Y-axis
Remaining work.

#### Series
- ideal burn-down
- actual burn-down

#### Remaining work definition
Use:
- remaining stories
- remaining tasks
- weighted remaining scope

#### Drill-down
Click -> milestone dashboard.

### 7.9 Capacity Utilization

#### Purpose
Show whether teams are overloaded or underutilized.

#### Chart type
Horizontal bar chart or stacked bar.

#### Rows
Teams.

#### Metrics
- available capacity
- allocated capacity
- utilization %

#### Source
Use planning metadata:
- delivery teams
- sprint velocity per team
- direct sprint capacity
- assigned work counts
- optionally story points if available

#### Status thresholds
- under 80%: underutilized
- 80% to 100%: healthy
- 100% to 115%: watch
- over 115%: overloaded

#### Drill-down
Click team -> Program view filtered to team assignments.

### 7.10 Dependency Risk Map

#### Purpose
Show cross-bundle or cross-application dependencies that can create systemic delivery risk.

#### Chart type
Network graph or adjacency panel.

#### Phase 1 fallback
If graph visualization is too complex initially, use a ranked dependency table:
- source
- target
- type
- blocked?
- risk score
- affected milestones

#### Minimum required fields
- dependency source bundle/app/work item
- dependency target
- dependency status
- impact severity

#### Highlight
Dependencies that:
- block multiple bundles
- are overdue
- affect go-live paths

#### Drill-down
Click dependency -> Program view or dedicated dependency detail pane.

### 7.11 Work Item Aging

#### Purpose
Show stalled work and execution drag.

#### Chart type
Bucketed bar chart.

#### Buckets
- 0 to 7 days
- 8 to 14 days
- 15 to 30 days
- 31+ days

#### Scope
Stories and tasks by default.

#### Optional dimension switch
- all active work
- blocked work only
- unassigned work only

#### Drill-down
Click aging bucket -> Program view filtered to those items.

### 7.12 Application Distribution

#### Purpose
Show how assets are distributed across the portfolio.

#### Chart type
Bar chart.

#### Data
Count applications by domain, bundle, or category.

#### Improvement over current version
Make the axis labels clearer and allow toggles:
- by bundle
- by business domain
- by health
- by phase

This chart is secondary, not a leadership priority, but useful for portfolio context.

### 7.13 Health Pulse

#### Purpose
Give a quick portfolio health composition summary.

#### Chart type
Donut chart.

#### Segments
- healthy
- watch
- at risk
- critical

#### Scope
Can apply to:
- applications
- bundles
- milestones

Default to bundles in executive view.

#### Drill-down
Click segment -> Program view filtered to that health state.

### 7.14 AI Insight Summary Panel

#### Purpose
Turn AI into executive guidance, not just a separate feature area.

#### Panel contents
Show top 3 to 5 AI-generated insights such as:
- 3 milestones at risk of slipping
- Payments Platform forecast now exceeds target by 18 days
- Risk & Compliance bundle has overload in Team B
- Contact Center dependency is blocking two downstream bundles
- Unassigned aging stories are accumulating in UAT phase

#### Structure
Each insight card should show:
- headline
- concise explanation
- confidence label
- recommended action
- deep link

#### Example fields
- severity
- confidence
- entityType
- entityId
- recommendation
- generatedAt

#### Interaction
Click insight -> relevant bundle, milestone, or Program view.

---

## 8. Bundle Dashboard Specification

### 8.1 Purpose
Provide a focused operational dashboard after executive drill-down.

### 8.2 Required sections

#### A. Bundle summary strip
- applications
- milestones
- stories/tasks
- blocked
- overdue
- risk score

#### B. Bundle progress trend
- planned vs actual

#### C. Milestone status table
- milestone name
- target date
- forecast date
- completion %
- blocker count
- status

#### D. Team capacity and velocity
- utilization by team
- stories completed per sprint

#### E. Dependency and blocker panel
- top dependencies
- top blockers

#### F. Aging and unassigned work
- aging chart
- unassigned story/task counts

#### G. AI recommendations
- bundle-specific recommendations

---

## 9. Milestone Dashboard Specification

### 9.1 Purpose
Provide milestone-specific execution health.

### 9.2 Required sections

- milestone metadata
- planned vs actual progress
- burn-down
- blocked work list
- overdue work list
- assigned vs unassigned work
- dependency list
- AI summary

This can be phase 2 if necessary.

---

## 10. Drill-Down Behavior

### 10.1 Drill-down rules
Every dashboard widget must have a meaningful click path.

#### From executive dashboard
- bundle row -> bundle dashboard
- risk card -> Program view filtered
- blocked card -> Program view blocked items
- chart point -> filtered Program or Activities view

#### From bundle dashboard
- milestone row -> milestone dashboard
- team bar -> Program view filtered by team
- blocker entry -> Program filtered blocked items

### 10.2 Avoid dead widgets
No chart should be purely decorative if it represents actionable information.

---

## 11. Data Model and Aggregation Requirements

### 11.1 Existing likely sources
Codex should reuse existing collections/services where available, likely including:
- bundles
- applications
- workitems
- milestones
- sprints
- bundle assignments
- risk-like data if present
- dependency data if present
- activity/event logs if present
- AI insights or wiki/AI-related collections if available

### 11.2 If missing, add dashboard aggregation service
Create:

- `src/services/dashboardService.ts`

This service should centralize all dashboard aggregation.

Do not compute heavy dashboard aggregations directly in route files.

---

## 12. Backend Service Design

Create or refactor into:

- `src/services/dashboardService.ts`

This service should expose at least:

### 12.1 `getExecutiveDashboard(filters)`
Returns all portfolio dashboard data.

### 12.2 `getBundleDashboard(bundleId, filters)`
Returns all bundle-level dashboard data.

### 12.3 `getMilestoneDashboard(milestoneId, filters)`
Returns all milestone-level dashboard data.

### 12.4 `getDashboardKpis(filters)`
Reusable helper for KPI cards.

### 12.5 `getDeliveryProgressTrend(filters)`
Returns planned vs actual trend.

### 12.6 `getDeliveryForecast(filters)`
Returns bundle forecast rows.

### 12.7 `getBlockerHeatmap(filters)`
Returns blocker aggregations.

### 12.8 `getVelocityTrend(filters)`
Returns sprint or weekly throughput.

### 12.9 `getCapacityUtilization(filters)`
Returns utilization by team.

### 12.10 `getDependencyRiskMap(filters)`
Returns dependency graph or table model.

### 12.11 `getWorkItemAging(filters)`
Returns aging buckets.

### 12.12 `getAiDashboardSummary(filters)`
Returns the AI summary cards.

---

## 13. API Endpoints

Add or refactor API routes to support the new dashboard.

### 13.1 Executive dashboard endpoint
- `GET /api/dashboard/executive`

#### Query params
- bundleId
- applicationId
- teamId
- timeWindow
- compareTo
- environment
- quickFilter

#### Response
Return a structured JSON payload containing all widget models.

### 13.2 Bundle dashboard endpoint
- `GET /api/dashboard/bundle/:bundleId`

### 13.3 Milestone dashboard endpoint
- `GET /api/dashboard/milestone/:milestoneId`

### 13.4 Optional supporting endpoints
If needed, provide smaller endpoints per chart, but prefer one aggregated dashboard endpoint per view to avoid excessive network chatter.

---

## 14. Response Contract Shape

Use one aggregated payload per dashboard view.

### 14.1 Executive response shape example

```ts
type ExecutiveDashboardResponse = {
  filters: {
    bundleId?: string;
    applicationId?: string;
    timeWindow: string;
    compareTo?: string;
  };
  summary: {
    bundles: MetricCard;
    milestones: MetricCard;
    workItems: MetricCard;
    blocked: MetricCard;
    highCriticalRisks: MetricCard;
    overdue: MetricCard;
  };
  progressTrend: ProgressTrendModel;
  forecast: ForecastModel;
  atRiskBundles: AtRiskBundleModel[];
  blockerHeatmap: BlockerHeatmapModel;
  riskTrend: RiskTrendModel;
  velocityTrend: VelocityTrendModel;
  milestoneBurndown: MilestoneBurnDownModel | null;
  capacityUtilization: CapacityUtilizationModel;
  dependencyRiskMap: DependencyRiskMapModel;
  workItemAging: WorkItemAgingModel;
  applicationDistribution: ApplicationDistributionModel;
  healthPulse: HealthPulseModel;
  aiSummary: AiDashboardSummaryModel;
};
```

Codex should define the concrete TypeScript models in a dedicated dashboard type file.

---

## 15. KPI Calculation Guidance

### 15.1 Progress percent
Use weighted completion rather than raw item counts if practical.

Preferred weighting:
- epic = 10
- feature = 5
- story = 2
- task = 1

If weighting is too artificial and actual story/task completion is more reliable, use stories/tasks only.

### 15.2 Forecast slip
Compute:
- planned end date
- forecast end date
- variance days

If insufficient historical data exists, use a simple heuristic and clearly annotate confidence.

### 15.3 Risk score
Risk score should be composite and bounded, for example 0 to 100.

Recommended inputs:
- overdue %
- blocked %
- completion variance
- dependency count
- high/critical count
- aging backlog

### 15.4 Capacity utilization
Derive from planned capacity vs assigned/remaining work.

If exact points are unavailable, use proxy unit counts and label clearly.

---

## 16. AI Insight Integration

### 16.1 Design principle
AI Insights must not be isolated in a separate tab only. The dashboard should surface the highest-value AI signals directly.

### 16.2 Source
Reuse existing AI insight generation if present.

If no current structured AI insight service exists, phase 1 may use rule-derived insights formatted similarly.

### 16.3 Required insight structure

```ts
type DashboardAiInsight = {
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
```

### 16.4 Minimum phase 1 insights
Implement at least:
- milestone slip risk
- overloaded team
- blocked dependency hotspot
- aging unassigned work accumulation
- bundle with worsening progress variance

---

## 17. UX and Interaction Rules

### 17.1 Use charts only where they add meaning
Do not add charts merely to make the dashboard look busy.

### 17.2 Prioritize scanability
Each widget should answer one clear question.

### 17.3 Avoid overloading the page
Target 7 to 10 strong visuals/widgets, not dozens of tiny cards.

### 17.4 Empty states
Every widget must have a good empty state.

Examples:
- `No blockers detected in selected scope.`
- `Not enough historical data yet to forecast go-live.`
- `No active dependencies found.`

### 17.5 Tooltips
Every chart must have useful tooltips and concise legend explanations.

### 17.6 Export
Phase 2 optional:
- export dashboard snapshot to PDF or slides
- export underlying data to CSV

---

## 18. Frontend Component Architecture

Create a modular dashboard component structure.

Suggested files:

- `src/components/dashboard/ExecutiveDashboard.tsx`
- `src/components/dashboard/BundleDashboard.tsx`
- `src/components/dashboard/MilestoneDashboard.tsx`
- `src/components/dashboard/MetricCard.tsx`
- `src/components/dashboard/DeliveryProgressChart.tsx`
- `src/components/dashboard/ForecastTimeline.tsx`
- `src/components/dashboard/AtRiskBundlesPanel.tsx`
- `src/components/dashboard/BlockerHeatmap.tsx`
- `src/components/dashboard/RiskTrendChart.tsx`
- `src/components/dashboard/VelocityTrendChart.tsx`
- `src/components/dashboard/MilestoneBurnDownChart.tsx`
- `src/components/dashboard/CapacityUtilizationChart.tsx`
- `src/components/dashboard/DependencyRiskMap.tsx`
- `src/components/dashboard/WorkItemAgingChart.tsx`
- `src/components/dashboard/ApplicationDistributionChart.tsx`
- `src/components/dashboard/HealthPulseChart.tsx`
- `src/components/dashboard/AiSummaryPanel.tsx`

If the project uses a different structure, keep consistency, but maintain separation by widget.

---

## 19. Performance Requirements

### 19.1 Aggregation strategy
Dashboard data can be aggregation-heavy. The backend must avoid issuing many small sequential queries.

Prefer:
- batched aggregation
- reusable aggregation helpers
- server-side caching for expensive dashboard payloads

### 19.2 Dashboard cache
Implement server-side cache for executive dashboard responses.

Recommended:
- cache key based on dashboard filter context
- short TTL such as 30 to 60 seconds
- explicit invalidation after major write operations where feasible

### 19.3 Bundle dashboard cache
Also cache bundle dashboard payloads with similar TTL and invalidation rules.

### 19.4 Avoid widget-level chattiness
Prefer a single API call per dashboard view rather than one API call per widget.

---

## 20. Incremental Delivery Plan

Implement in phases.

### Phase 1: High-value executive dashboard
Required:
- summary strip
- delivery progress trend
- delivery forecast
- at-risk bundles
- blocker heatmap
- risk trend
- velocity trend
- capacity utilization
- application distribution
- health pulse
- AI summary panel
- drill-down to bundle dashboard

### Phase 2: Bundle dashboard + deeper diagnostics
Required:
- bundle dashboard
- milestone status table
- milestone burn-down
- dependency risk map
- work item aging
- more AI recommendations

### Phase 3: Milestone dashboard + export
Optional:
- milestone dashboard
- export support
- more predictive insights
- richer dependency graph visualization

---

## 21. Data Gaps and Fallback Rules

Codex must implement graceful fallback behavior if some deeper data is not yet available.

### 21.1 If no explicit risk history exists
Show current open risk counts and begin trend accumulation from now on.

### 21.2 If no dependency graph exists yet
Render a dependency table or `No dependency data available yet.`

### 21.3 If no accurate capacity points exist
Use assignment counts or story counts as proxy, but label the metric clearly.

### 21.4 If insufficient historical data for forecast
Return forecast as low confidence and show a helpful explanation.

---

## 22. Visual Language

### 22.1 Color semantics
Use consistent status colors:

- healthy / on track = green
- watch / moderate risk = amber
- at risk = red
- informational = blue or neutral

### 22.2 Consistency
All charts and cards should use the same status vocabulary:
- On Track
- Watch
- At Risk
- Critical

Avoid mixing unrelated labels.

### 22.3 Executive readability
Large numbers, clear labels, and concise explanations matter more than decorative visuals.

---

## 23. Acceptance Criteria

The implementation is complete only if all of the following are true.

### 23.1 Executive usefulness
A senior stakeholder can answer within one screen:
- are we on track?
- which bundles are most at risk?
- are blockers rising or falling?
- are we likely to miss target go-live?
- which teams are overloaded?

### 23.2 Technical completeness
- executive dashboard endpoint exists
- bundle dashboard endpoint exists
- frontend renders required widgets
- widgets drill down properly
- AI summary panel is integrated

### 23.3 UX quality
- dashboard is visually organized and easy to scan
- every chart has meaningful tooltip and empty state
- no dead decorative widgets
- no excessive widget sprawl

### 23.4 Performance
- dashboard loads in a performant way
- avoids many parallel widget-specific API calls
- uses aggregation and caching appropriately

---

## 24. Testing Requirements

Codex should validate:

### 24.1 Functional tests
- summary KPIs render correctly
- charts respond to filters
- bundle drill-down works
- milestone drill-down works if milestone dashboard implemented
- AI summary items link correctly

### 24.2 Data correctness tests
- blocked counts match underlying records
- overdue counts match due date logic
- forecast returns expected structure
- risk score ordering is stable and sensible
- velocity trend reflects completion history correctly

### 24.3 Empty-state tests
- dashboard handles empty tenant
- dashboard handles no blockers
- dashboard handles no risks
- dashboard handles no forecastable data

### 24.4 Performance tests
- executive dashboard uses one aggregated API call
- repeated visits benefit from cache
- large sample-data scenarios remain responsive

---

## 25. Final Instruction to Codex

Implement the dashboard redesign as a meaningful **executive decision dashboard**, not just a visual refresh.

Prioritize:

1. delivery progress trend
2. delivery forecast
3. at-risk bundles
4. blocker heatmap
5. risk trend
6. velocity trend
7. capacity utilization
8. AI summary integration
9. drill-down to bundle dashboard

Do not add charts merely for visual density. Every widget must answer a clear leadership question and provide a drill-down path for action.
