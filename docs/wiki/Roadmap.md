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

## Simulation (Phase 5)
The roadmap supports delivery simulations that compare baseline plan previews against scenario overrides (capacity, scope, dates, velocity). Results show milestone slippage, utilization changes, and risk shifts, with an explicit per‑milestone date delta.
DATE_SHIFT overrides apply to specific milestones (not global plan shifts).
Use the **Simulate** button in the Roadmap toolbar to open the Simulation Editor, select a baseline preview, add one or more overrides, and submit.

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

4. Notification routing v2.
Problem: no watcher/subscription model. Value: targeted delivery of notifications. Dependencies: current notification policy and prefs. Deliverables: watchers for bundles/milestones and cron-ready digest automation. Verify: watcher receives targeted notifications; digest can be scheduled.

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
