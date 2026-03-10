# DeliveryHub Spec — Phase 10: Schedule Optimization Engine (DeliveryAI Optimize)

## Overview
Phase 10 introduces a Schedule Optimization Engine that analyzes the current delivery plan and proposes adjustments to improve outcomes by reducing risk, minimizing slippage, and balancing capacity constraints.

Unlike simulation (Phase 5) and forecasting (Phases 7-8), this phase automatically proposes optimized schedule recommendations:
- milestone start/end adjustments
- capacity rebalancing
- dependency smoothing
- risk/readiness trade-offs

The engine supports both individual plans and portfolios.

---

## High-Level Goals
1. Provide actionable, AI-assisted schedule recommendations.
2. Allow users to apply suggestions automatically, accept/reject manually, or generate alternative variants.
3. Maintain explainability for every recommendation.
4. Integrate optimization outputs into existing UI and API flows.

---

## Definitions
- Optimization Objective: Quantified improvement target (for example, minimize slippage, minimize risk, improve on-time probability).
- Optimization Variant: Candidate plan produced by the optimizer.
- Baseline Plan: Current plan before optimization.
- Optimized Plan: Candidate plan returned by the optimizer.

---

## Inputs
The optimization engine takes:

1. Normalized Plan Input:
- scope (bundle/app)
- plan start/end and environment schedules
- milestones, durations, dependencies
- capacity defaults and actuals
- work items and effort estimates
- forecast outputs (P50/P90/confidence)

2. Optimization Parameters:
- objective weights (for example, on-time probability vs capacity balance)
- hard constraints (for example, do not move milestones beyond environment windows)
- soft constraints (for example, risk reduction, sprint load leveling)

---

## Outputs
1. Optimized Plan Variants:
- milestone adjustments (start/end)
- capacity shifts
- rebalanced sprint allocation
- reduced dependency slip points
- improved on-time probability

2. Delta Report:
- baseline vs optimized changes
- expected improvement (confidence, risk, duration/slippage)

3. Explainability Artifacts:
- what changed
- why the change was recommended
- expected benefit and trade-offs

4. APIs:
- `GET /api/optimize/plan/{planId}?params...`
- `POST /api/optimize/plan/{planId}`
- `GET /api/optimize/portfolio`
- `GET /api/optimize/applied/latest?scopeType=...&scopeId=...` (latest applied run for current roadmap scope)

---

## Optimization Model
The engine uses a blend of:
1. constraint-aware scheduling
2. heuristic/meta-heuristic search (for example, genetic algorithms or simulated annealing)
3. optional CP-SAT/constraint programming
4. forecast feedback loops

Model interpretation:
- milestones and dependencies are a directed graph
- capacity constraints are sprint/environment bounds
- risk/readiness contribute to objective penalties

Derived objective shape:
- minimize: makespan + forecast slippage + risk penalties
- maximize: on-time probability x readiness score
- balance: sprint capacity loads

The optimizer should return candidate variants within bounded runtime.

Note: schedule optimization is NP-hard in general; practical implementations should prefer bounded heuristic/meta-heuristic approaches for real plans.

---

## API Specification
### 1) Optimize Plan
`POST /api/optimize/plan/{planId}`

Request:
```json
{
  "objectiveWeights": {
    "onTime": 0.4,
    "riskReduction": 0.3,
    "capacityBalance": 0.2,
    "slippageMinimization": 0.1
  },
  "constraints": {
    "noChangeBeforeDate": "2026-03-15",
    "environmentBounds": true
  },
  "options": {
    "maxVariants": 5,
    "timeoutMs": 3000
  }
}
```

Response:
```json
{
  "baselinePlan": {},
  "optimizedVariants": [
    {
      "variantId": "opt1",
      "changes": {},
      "metrics": {
        "onTimeProbability": 0.62,
        "expectedSlippageDays": 3,
        "riskScore": 1.8
      },
      "explanations": []
    }
  ]
}
```

### 2) Get Plan Optimization Results
`GET /api/optimize/plan/{planId}?params...`

Purpose:
- retrieve optimization summaries/results for a plan (or recompute using query params, depending on implementation mode)

### 3) Portfolio Optimization
`GET /api/optimize/portfolio`

Purpose:
- aggregate optimization insights across plans/portfolio scope

### 4) Latest Applied Optimization Summary
`GET /api/optimize/applied/latest`

Query options:
- `scopeType` + `scopeId` to fetch latest applied optimization for the current roadmap scope
- `planId` to fetch latest applied optimization for a specific plan

Purpose:
- support roadmap header summary panel with the latest applied optimization details

---

## Explainability Contract
Optimization output should include machine-readable reasoning entries:

```json
{
  "reasoning": [
    {
      "type": "DependencySlip",
      "description": "Milestone X moved earlier by 2 days to reduce dependency pressure on Milestone Y",
      "impact": {
        "onTimeProbability": 0.07
      }
    }
  ]
}
```

Explainability must tie each recommendation to measurable metric deltas and trade-offs.

These artifacts should feed existing explainability surfaces:
- `ExplainabilityPopover`
- `ExplainabilityDrawer`
- milestone tooltips

---

## UI Integration
### Optimization Panel
In plan preview UI, add a primary action:
`[ Optimize Plan ]`

When clicked:
- open optimization modal
- show objective weight controls (for example, sliders)
- allow constraint selection
- show progress, timeout, and cancellation states
- render optimization results

### Results View
After optimization:
- show candidate variants list
- show each variant as a mini-timeline/summary card
- allow selecting a variant to inspect deltas
- allow accepting a variant and promoting it to current plan

### UX Rules
Each suggestion must answer:
- what changed?
- why changed?
- expected benefit?

UI must remain responsive while optimizer runs (timeouts/cancel supported).

---

## Workflow
1. User opens optimization modal.
2. Engine runs and returns variants.
3. UI displays variant list.
4. User inspects variants with explainability.
5. User picks a variant.
6. User applies changes.
7. System syncs internal preview state.
8. System writes an audit record to `optimization_applied_runs`.
9. System emits `workitems.optimization.applied`.
10. Roadmap + forecast surfaces refresh.

---

## Cross-Module Sync
If optimization changes:
- milestone dates
- environment schedule windows
- sprint durations/capacity participation

Then:
- sync back to `application_planning_metadata` when relevant
- update plan preview so simulation/forecasting consume latest state

Target closed loop:
optimization -> plan -> simulation -> forecast

---

## Testing
Add:
- `scripts/test-optimization-engine.ts`
- `scripts/test-optimize-api.ts`
- `scripts/test-optimize-apply.ts`

Cover at minimum:
- single-objective optimization
- multi-objective optimization
- hard constraint enforcement
- portfolio optimization behavior

Add UI harness coverage for:
- optimization interaction flow
- variant selection
- explainability drill-down

---

## Acceptance Criteria
- optimization engine returns valid improvements within configured timeout
- objective weights materially influence results
- hard constraints are enforced
- optimization UI works end-to-end
- variants show meaningful measurable improvements
- explanations map to concrete deltas
- existing simulation/forecast flows are not regressed

---

## Documentation Updates
Update:
- `docs/spec/work-items/phase-10.md`
- `docs/wiki/Roadmap.md`
- `docs/wiki/Modules-WorkItems.md`

Include:
- optimization UI screens
- objective weight controls
- sample API requests/responses
- explainability examples

---

## What Comes After Phase 10
Potential follow-on phases:
- Phase 11: Application Portfolio Management deep enhancements
- Phase 12: AI Delivery Insights and prescriptive actions
- Phase 13: Team capability learning and autonomous planning

---

## Notes for Codex
- Use objective-weighted optimization (heuristic search or constraint solver).
- Keep optimization explainable through metric deltas.
- Ensure UI responsiveness while optimization runs.
- Do not regress forecasting/simulation behavior.

---

## Implementation Alignment (Current Behavior)

### Apply Event Name
When an optimization variant is applied, the event type is:
- `workitems.optimization.applied`

### Optimization Audit Collection
Applied runs are stored in:
- `optimization_applied_runs`

Audit record includes:
- `planId`
- `source` (`CREATED_PLAN` or `PREVIEW`)
- `scopeType`
- `scopeId`
- `acceptedVariantId`
- `acceptedVariantName`
- `acceptedVariantScore`
- `objectiveWeights`
- `expectedImpact`
- `appliedBy`
- `appliedAt`
- `summary`
- `changes`

`expectedImpact` shape:
```json
{
  "onTimeProbabilityDelta": 0.07,
  "expectedSlippageDaysDelta": -3,
  "riskScoreDelta": -0.8,
  "readinessScoreDelta": 0.12
}
```

Indexes:
- `planId + appliedAt`
- `appliedBy + appliedAt`
- `scopeType + scopeId + appliedAt`

### Applied Optimization Summary Panel
Roadmap header shows the latest applied optimization for current scope.

Panel content:
- latest accepted variant
- when/by whom it was applied
- objective weights used
- headline change counts
- expected improvement deltas

Data source:
- `GET /api/optimize/applied/latest`

Refresh behavior:
- panel reloads after a variant is successfully applied
- roadmap/forecast views also refresh after apply

### Backward-Compatibility Note
Historical audit entries created before this alignment may not contain `expectedImpact`.
UI should handle missing fields gracefully (for example, show `N/A`).

### Implementation Status
Status: Completed

Validation checklist:
- optimization engine generates ranked variants
- optimization API supports plan and portfolio optimization
- users can apply optimized variants
- plan changes persist to preview and created plans
- optimization runs are audited in `optimization_applied_runs`
- latest optimization summary appears in roadmap header
- `workitems.optimization.applied` emitted on apply
- forecasting and roadmap refresh after apply
- tests exist for engine/API/apply flow

---

## Appendix A: Transfer Context (Preserved)
This appendix preserves the unique transfer/context content that was previously embedded in this file, cleaned and structured.

### A1. Product/System Overview
DeliveryHub is an enterprise delivery intelligence platform (Next.js + MongoDB) with major modules:
- Applications
- Work Items (Jira-like hierarchy)
- Architecture
- Wiki
- Reviews/CMO governance
- Roadmap and Milestones
- Admin and seeding

Primary goal: executive-grade delivery visibility/governance, not only task tracking.

### A2. Architecture and Platform
- Next.js App Router
- TypeScript strict mode
- MongoDB
- Docker + docker-compose
- target cloud: Railway
- seed system implemented

### A3. Data Model Concepts
Portfolio layer:
- Bundle = deployable unit (vendor-owned)
- Application = app within bundle

Work hierarchy expectation:
Epic (bundle baseline)
- Feature
- User Story
- Risk
- Dependency

Important: risk/dependency are not standalone roots.

### A4. Roles/Personas (Context)
- CMO Architect (review authority)
- SVP Architect (vendor)
- Engineering Manager
- Product Manager

### A5. Seeding Context
Two-tier seeding model:
- Tier A baseline (auto): taxonomy categories/types, wiki themes/templates, diagram templates, bundles, applications, ai_settings
  - behavior: `$setOnInsert`, non-overwrite, distributed lock, tracked in `system_bootstrap`
- Tier B sample (optional): users, bundle assignments, wiki pages, workitems, architecture diagrams, reviews/comments
  - behavior: `$set`, `demoTag: "sample-v1"`, reset supported

### A6. Historical Issues Noted as Solved
- Next route typing changes
- build-time Mongo dependency
- docker COPY redirection bug
- router typing errors
- D3 typing issues
- strict TypeScript mismatches
- secret scanning failure due to leaked key

### A7. Sample Data Note
Prior sample had structural issue: some items appeared as root nodes and should be under epic/feature (for example, dependency and vendor capacity risk under GPS Epic).

Recommended feature grouping label:
- GPS Platform Readiness and Risk Management

### A8. Roadmap/Milestone Context
Key insight captured: roadmap quality depends on milestone maturity.

Recommended milestone hardening:
1. Health model (green/yellow/red + confidence 0-100)
2. Capacity intelligence (planned points, utilization, overflow)
3. Scope semantics (milestone type, primary bundle, cross-bundle flag)
4. Readiness signals (risk/dependency/blocked/late counts)

Near-term sequence captured:
1. Harden milestone model
2. Fix sample hierarchy
3. Add milestone health computation
4. Upgrade roadmap intelligence

### A9. Deployment/Demo Context
- Target: Railway
- baseline auto-seed + optional sample
- executive demo timeline pressure

Known demo gaps captured:
- orphaned work items
- roadmap not decision-grade
- milestone model thin
- demo narrative needs strengthening
- sample dataset in progress

Likely upcoming asks captured:
- milestone schema hardening
- roadmap intelligence
- executive demo storyline
- Railway hardening
- sample realism improvements
