# Roadmap

This section captures known gaps and likely next steps. The backbone is milestone readiness + rollups, with roadmap intelligence as the derived surface, and program coordination + notifications/audit as the operational layer.

## Work Items Roadmap

### Roadmap Views (UI)
The Work Items roadmap now supports multiple UI views over the same data set:
- Execution Board (default)
- Timeline
- Swimlane
- Dependency

All tabs render the same milestones, sprints, capacity, and dependency data; the views are purely presentational.
Each view now includes milestone health signals (utilization, risk, blocked count, readiness, confidence) computed from existing data.

### Advanced Timeline (Phase 9.3)
The Timeline view was upgraded to a professional-grade visualization:
- Zoom levels: Quarter / Month / Sprint / Week
- Committed bars + probabilistic forecast bands (P50–P90)
- Confidence/on-time/uncertainty indicators
- Capacity heat glow on milestones
- Milestone-to-milestone dependency arrows (from `BLOCKS`)
- Environment overlays from planning metadata with a distinct Go‑Live marker
- Grouping by Application, Bundle, Owner, or Theme
- Legend toggle and rich milestone tooltips

### Portfolio Analytics (Phase 6)
Portfolio analytics aggregate multiple delivery plans into a single dashboard view:
- Summary cards (plan count, milestone count, high risk, overload, avg utilization)
- Timeline comparison across plans
- Cross-plan dependency map (BLOCKS links only)
- Health summary table per plan

### Predictive Forecasting (Phase 7)
Forecasting adds best/expected/worst-case delivery windows for milestones:
- Forecast windows are derived from milestone intelligence (utilization, risk, readiness, dependency pressure, blocked items).
- Roadmap views display forecast ranges and confidence signals (Execution Board, Timeline, Swimlane).
- Portfolio dashboard includes expected portfolio slip and low-confidence plans.

Example (milestone forecast window):
```
Planned End: 2026-06-01
Forecast:
  Best Case: 2026-05-28
  Expected: 2026-06-03
  Worst Case: 2026-06-15
Confidence: MEDIUM
Slip Risk: MEDIUM
```

### Probabilistic Forecasting (Phase 8)
Probabilistic forecasting adds percentile-based delivery dates and on-time probability.
- Roadmap views show P50/P90 and on-time probability with uncertainty badges.
- Portfolio dashboard shows average on-time probability and high-uncertainty milestones.

Example (probabilistic forecast):
```
Planned End: 2026-06-01
P50: 2026-06-12
P90: 2026-06-21
On-Time: 62%
Uncertainty: MEDIUM
```

### Explainability UI (Phase 9.1)
Advanced metrics now include inline explainability:
- Roadmap views show explainability icons on utilization, risk, readiness, confidence, dependencies, and forecast signals.
- Simulation results and portfolio metrics include contextual explanations.
- Explainability is lightweight, dismissible, and action-oriented.

## Simulation (Phase 5)
The roadmap supports delivery simulations that compare baseline plan previews against scenario overrides (capacity, scope, dates, velocity). Results show milestone slippage, utilization changes, and risk shifts, with an explicit per‑milestone date delta.
DATE_SHIFT overrides apply to specific milestones (not global plan shifts).
Use the **Simulate** button in the Roadmap toolbar to open the Simulation Editor, select a baseline preview, add one or more overrides, and submit.

## Schedule Optimization (Phase 10)
The roadmap now supports objective-weighted schedule optimization for both preview and created plans.

- Use the **Optimize** button to open the optimization editor.
- Generate ranked variants using objective weights and constraints.
- Apply an accepted variant directly to the selected plan.
- Apply supports both plan id formats:
  - `preview:{id}`
  - `created:{id}`
- After apply, roadmap and forecast surfaces refresh.

APIs:
- `POST /api/optimize/plan/{planId}`
- `GET /api/optimize/plan/{planId}`
- `GET /api/optimize/portfolio`
- `POST /api/optimize/plan/{planId}/apply`

## Applied Optimization Summary (Phase 10C)
Roadmap header now includes an **Applied Optimization** summary panel.

- Shows latest applied variant for current roadmap scope (bundle/app).
- Includes variant name, apply timestamp/user, objective weights, change totals, and expected improvement deltas.
- Reads from:
  - `GET /api/optimize/applied/latest?scopeType=&scopeId=`
- Handles historical records without `expectedImpact` fields by showing fallback values.

## Applications APM (Phase 11)
Applications module now includes deeper APM capabilities used by planning and cross-system delivery analysis.

Implemented:
- application portfolios (`application_portfolios`)
- release trains (`release_trains`)
- cross-application dependencies (`application_dependencies`)
- lifecycle records (`application_lifecycle`)
- environment strategy (`application_environment_strategy`)
- application delivery impact endpoint for dependency + milestone/work-item context

Applications UI now includes:
- apps dashboard cards (count, lifecycle tracked, critical systems, dependencies)
- application detail tabs:
  - Overview
  - Environments
  - Dependencies
  - Lifecycle
  - Delivery Impact
- bundle profile tabs (Phase 11C):
  - Overview
  - Environments
  - Ownership
  - Dependencies
  - Lifecycle
  - Delivery Impact
  - Notes
- bundle rollup surfaces:
  - app dependency rollups (including cross-bundle context)
  - lifecycle distribution across apps
  - delivery impact rollups and at-risk app drilldowns

## AI Insights Stabilization (Phase 12A)
AI Insights portfolio reporting is now stabilized across reliability, UX, and export behavior.

Implemented:
- 12A: deterministic snapshot + structured response contract + cached fallback
- 12A.1: provider error normalization, attempted provider metadata preservation, duplicate-call mitigation
- 12A.2: markdown rendering in report panel + markdown/pdf export actions
- 12A.3: cache-first load semantics (`GET` read, `POST` manual regenerate), first-run empty state, 24h freshness policy
- 12A.4: styled PDF export pipeline aligned with in-app report presentation

Current behavior:
- revisits read cached persisted report first
- manual regenerate is the only live generation trigger
- stale reports still display with clear stale-state messaging
- exports are direct downloads with executive-readable formatting

## AI Insights Structured Intelligence (Phase 12B)
Structured intelligence reporting has progressed through the first three 12B subphases.

Implemented:
- 12B.1: structured report contract + deterministic signal grounding + normalization pipeline
- 12B.1.1: legacy cache normalization bugfix + full narrative fallback visibility
- 12B.2: UI refinement (section cards, badges, evidence readability, responsive empty states)
- 12B.3: evidence-backed enforcement and deterministic fallback enrichment:
  - risk/action/signal/question provenance (`ai | deterministic | legacy`)
  - ratio-based severity normalization
  - urgency normalization and stronger evidence linkage
  - section-level synthesis telemetry in normalization logs
- 12B.5: conversational portfolio query surface:
  - new endpoint `POST /api/ai/portfolio-query`
  - deterministic-first answering over cached structured portfolio report
  - evidence/follow-up response shape for explainable AI interaction
  - AI Insights “Ask DeliveryHub AI” panel with dynamic quick suggestions and follow-up re-query flow
- 12C.1: evidence exploration + entity drill-down:
  - typed evidence/entity contracts (`EvidenceItem`, `EntityReference`, `EntityType`) applied to structured sections and query answers
  - centralized entity mapping/link utility for evidence (`src/services/ai/evidenceEntities.ts`)
  - AI Insights evidence UI upgraded with clickable entity chips and grouped related-entity lists
  - graceful fallback preserved for evidence items without entity references
- 12C.2: contextual related-entity panels and metadata:
  - APIs now return `relatedEntitiesMeta` for summary and query responses
  - backend resolver (`src/services/entityMetaResolver.ts`) enriches entity refs with secondary metadata strings
  - grouped panel components (`EntityGroupPanel`, `RelatedEntitiesSection`) added to AI Insights cards
  - relevance ordering, per-group limits, and expand/collapse behavior applied for large related-entity lists
- 12C.3: expanded deterministic query intents and knowledge extraction:
  - query engine now covers operational and ranking investigations (work items, bundles, applications, milestones, reviews, owners, risk ranking)
  - new extractor module (`src/services/ai/knowledgeExtractors.ts`) provides reusable deterministic metrics
  - portfolio snapshot enriched with lightweight entity lists for list/ranking answers
  - query responses now expose richer evidence, contextual follow-ups, and optional top-level `entities[]`
  - deterministic-first query path remains primary, with AI refinement still optional
- 12C.4: saved investigations, history, and pinned insights:
  - persisted saved-query workspace backed by `ai_saved_queries`
  - new investigation APIs for list/save/pin-delete/refresh
  - deterministic refresh of saved investigations against current portfolio context
  - AI Insights now includes Pinned Insights, Saved Investigations, and Query History panels
  - owner-scoped access enforcement for investigation records
- 12D: portfolio trend analysis and temporal intelligence:
  - new snapshot history collection `portfolio_snapshots` with 90-day retention
  - trend analyzer service computes directional deltas across recent snapshots
  - structured report extended with `trendSignals[]`
  - AI Insights UI includes Portfolio Trends cards under Concentration Signals
  - deterministic query engine now supports trend questions (delivery/risk/blocked/backlog/milestones)
  - trend-aware quick suggestions integrated into Ask DeliveryHub AI
- 12E: early warning alerts, health scoring, and predictive risk:
  - deterministic portfolio health score (`0-100`) added to structured report
  - deterministic alerts added to structured report (`alerts[]`) with severity and evidence
  - predictive risk detection added (execution risk, milestone slip risk, review congestion, capacity pressure)
  - query engine extended for alert- and health-centric prompts
  - AI Insights UI now includes Portfolio Health and Alerts sections
  - alerts can be converted directly into saved investigations from the UI
- 12F.1: watcher subscriptions and in-app notification center:
  - watcher + notification data contracts added to AI types
  - new persistence collections: `ai_watchers`, `ai_notifications`
  - watcher evaluation engine added with condition checks and cooldown handling
  - watcher/notification APIs added for CRUD + read-state updates
  - evaluation trigger points integrated into report regeneration and investigation refresh
  - AI Insights now includes Notification Center and Watcher Management panels
  - contextual watcher creation available from alerts, trends, health score, and saved investigations
- 12F.2: external delivery dispatch and channel preferences:
  - first external channel support added for email delivery
  - centralized notification dispatcher + email channel adapter introduced
  - watcher-level delivery preferences added (in-app/email + email severity threshold)
  - per-channel delivery status tracking added on notifications (`pending|sent|failed|suppressed`)
  - cooldown suppression and severity filtering added to reduce notification noise
  - notification center now surfaces channel delivery state and email error details
- 12F.3: multi-channel delivery and digest scheduling:
  - Slack and Teams channel adapters added with webhook-mode dispatch
  - digest queue + scheduler added for hourly/daily watcher digests
  - watcher delivery preferences expanded with Slack/Teams thresholds and digest frequency
  - notification dispatcher now handles `email|slack|teams` and digest deferral centrally
  - notification center expanded with Slack/Teams delivery badges and digest-mode visibility
- 13A: executive portfolio summary:
  - deterministic executive summary generator added (`src/services/ai/executiveSummary.ts`)
  - new executive summary API added (`GET/POST /api/ai/executive-summary`)
  - executive summary cache persisted in `ai_analysis_cache` under `executive-summary`
  - new UI route `/ai/executive-insights` with text-first executive summary layout
  - sections include health label/score, observations, strategic concerns, top alerts, trend highlights, and recommendations
- 13B: portfolio forecasting and predictive delivery signals:
  - deterministic forecast engine added (`src/services/ai/forecastEngine.ts`)
  - new forecast API added (`GET/POST /api/ai/portfolio-forecast`)
  - forecast cache persisted in `ai_analysis_cache` under `portfolio-forecast`
  - executive insights page now includes forecast signal cards (severity, confidence, evidence, related entities)
  - deterministic query + suggestions now include forecast-aware intents/prompts
- 13C: cross-project risk propagation and dependency intelligence:
  - deterministic dependency extractor + propagation engine added (`dependencyExtractor.ts`, `riskPropagation.ts`)
  - new propagation API added (`GET/POST /api/ai/risk-propagation`)
  - propagation cache persisted in `ai_analysis_cache` under `risk-propagation`
  - executive insights page now includes cross-project propagation cards with paths/evidence/entity links
  - deterministic query + suggestions now include propagation-aware intents/prompts
- 13D: Strategic AI Advisor and high-level strategic Q&A:
  - strategic advisor service stack added (`strategicAdvisor.ts`, `strategicPromptBuilder.ts`, `strategicDeterministicEngine.ts`, `strategicResponseNormalizer.ts`)
  - new strategic APIs added:
    - `POST /api/ai/strategic-query`
    - `GET /api/ai/strategic-suggestions`
  - AI Insights now includes a dedicated Strategic AI Advisor panel with quick prompts, evidence-backed answers, related entities, and follow-up chips
  - strategic answers are cache-backed in `ai_analysis_cache` using `strategic-query:{queryHash}` with 24h freshness
  - `portfolio-query` now routes strategic-intent questions through strategic advisor
- 13E: AI-driven optimization and what-if scenario planning:
  - deterministic scenario engine added (`src/services/ai/scenarioEngine.ts`) for simulation over cloned portfolio snapshots
  - scenario APIs added:
    - `POST /api/ai/scenario`
    - `GET /api/ai/scenarios`
    - `POST /api/ai/scenarios`
    - `DELETE /api/ai/scenarios/:id`
  - Scenario Planner UI added under Strategic Advisor (`ScenarioPlannerPanel`, `ScenarioCard`, `ScenarioResultPanel`)
  - scenario runs now return health/forecast/propagation deltas plus optimization recommendations
  - scenario results are cache-backed in `ai_analysis_cache` using `scenario-result:{scenarioHash}` (`reportType: scenarioResult`)
  - strategic advisor context now ingests recent scenario outcomes for scenario-aware answers and comparisons
- 14: collaborative workflow automation and execution guidance:
  - new deterministic action recommendation engine added (`src/services/ai/actionRecommender.ts`)
  - new workflow rule engine added (`src/services/ai/workflowRuleEngine.ts`) with suggestion, persistence, and enforcement
  - new APIs:
    - `GET/POST /api/ai/action-plan`
    - `POST /api/ai/tasks/batch` and alias `POST /api/tasks/batch`
    - `GET/POST /api/ai/workflow-rules`
  - strategic advisor now returns action plan context (`StrategicQueryResponse.actionPlan`)
  - AI Insights Strategic panel now exposes:
    - prioritized action steps
    - single/batch task creation from suggestions
    - workflow rule toggles and manual run
  - workflow rule persistence uses `ai_workflow_rules`
  - action plan cache persists in `ai_analysis_cache` under `ai-action-plan`

Current 12B behavior:
- structured sections are primary in AI Insights UI
- legacy narrative remains accessible via collapsible section
- thin/malformed AI output is enriched deterministically before persistence/return

### Near-term (next 2–4 weeks)
1. Inline storyPoints edits in planning surfaces.
Problem: editing storyPoints requires opening the detail drawer. Value: faster planning and fewer context switches. Dependencies: existing milestone planning and roadmap views. Deliverables: inline edit controls in planning and roadmap rows, with optimistic update + validation. Verify: edit storyPoints inline and see rollups update without page reload.

2. Error and warning UX consistency across planning/roadmap/program.
Problem: governance errors surface inconsistently. Value: predictable resolution paths and fewer user errors. Dependencies: existing readiness/override error codes. Deliverables: shared error banner pattern and standardized messaging for readiness/capacity/override. Verify: readiness blocked and capacity override show the same UX treatment across views.

3. Data consistency and schema validation pass.
Problem: historical migrations left mixed shapes. Value: safer analytics and fewer edge-case bugs. Dependencies: current schema and migration scripts. Deliverables: explicit validation for core fields, migration checklist in docs. Verify: validation script passes against baseline + sample DB.

4. Performance sampling for heavy endpoints.
Problem: roadmap and rollup queries can be heavy at scale. Value: early detection of regressions. Dependencies: existing perf logging pattern. Deliverables: optional query explain sampling and timing logs. Verify: enable sampling and capture explain summaries without breaking API.

### Mid-term (next 1–3 months)
1. Sprint execution integration.
Problem: sprint execution is not tied to milestone scope. Value: alignment between team execution and milestone readiness. Dependencies: sprint data model and milestone rollups. Deliverables: sprint capacity tied to milestone scope and burn-up. Verify: sprint updates change milestone readiness signals.

2. Forecasting v1 (Monte Carlo).
Problem: single-point ETA misses distribution and hit probability. Value: P50/P80/P90 finish dates and probability of hitting endDate. Dependencies: historical throughput distribution. Deliverables: Monte Carlo ETA in rollups, roadmap, and capacity planning; Admin policy toggle. Verify: P80 chips render and policy can enable/disable.

3. Baseline + Scope Delta accounting.
Problem: drift lacks attribution. Value: explain drift via added/removed scope and estimate changes since commit. Dependencies: commitment review snapshots + scope tracking. Deliverables: baseline snapshots, delta computation, UI panels and drift attribution. Verify: delta panel shows added/removed/estimate changes and drift includes scope summary.

4. Watcher templates for broader domains.
Problem: watchers are currently created manually per context. Value: faster setup and broader operational coverage. Dependencies: 12F.3 dispatch + digest foundation. Deliverables: reusable watcher templates for bundle/milestone/application contexts. Verify: users can apply templates and receive routed notifications with expected suppression behavior.

### Long-term
1. External integrations.
Problem: manual sync with external tools. Value: reduce dual entry and stale data. Dependencies: stable API contracts and mapping rules. Deliverables: Jira sync and calendar release milestones. Verify: changes propagate between systems without drift.

2. Advanced governance.
Problem: COMMITTED scope changes are not formally approved. Value: enforce governance and auditability. Dependencies: existing readiness + override workflow. Deliverables: approval workflow for committed scope changes and policy-as-config thresholds. Verify: scope change requires approval and is fully auditable.

3. Advanced analytics.
Problem: limited critical path visibility. Value: improved program prioritization. Dependencies: accurate dependency graph and milestone rollups. Deliverables: critical path visualization and Monte Carlo forecasting (optional). Verify: critical path highlights matches actual blockers over time.

## Platform Roadmap

### Near-term
1. Expand repository pattern into per-domain repositories.
Problem: DB access is still centralized. Value: clearer ownership and safer changes. Dependencies: current services/db.ts. Deliverables: repo modules for work items, milestones, notifications. Verify: routes use repositories consistently.

2. Improve automated API tests coverage.
Problem: regression detection is limited. Value: safer releases. Dependencies: test harness. Deliverables: coverage for notifications policy + digest and audit console. Verify: `npm run test:api` passes with meaningful scenarios.

### Mid-term
1. Improve AI governance dashboards in Admin.
Problem: AI controls are not auditable enough. Value: better oversight. Dependencies: ai_settings + events. Deliverables: usage and policy dashboards with audit logs. Verify: admins can see usage trends and policy changes.

### Long-term
1. Multi-environment configuration.
Problem: env separation is manual. Value: safer deployments. Dependencies: environment config patterns. Deliverables: environment-aware config and seeded baselines. Verify: dev/stage/prod configs differ without code changes.
