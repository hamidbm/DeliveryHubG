# DeliveryHub Spec: Phase 4 – Milestone and Roadmap Intelligence Hardening

## Document Purpose

This document defines the implementation instructions for **Phase 4** of the Delivery Plan and Roadmap enhancement in the **Work Items** module of DeliveryHub.

Phase 4 builds on the multi-view roadmap introduced in Phase 3 by adding **delivery intelligence** to milestones and roadmap views.

This phase focuses on:

- milestone health indicators
- capacity utilization signals
- roadmap heatmaps
- dependency pressure analysis
- standardized view-model intelligence

This phase does **not** change planning generation logic. It enhances the **analytics and signals** derived from existing roadmap and milestone data.

This spec is intended to be:

- the implementation brief for Codex
- permanent documentation stored in `docs/spec/`

---

# Context

After Phase 3, DeliveryHub now has:

- a capacity-aware planning engine
- modular planning services
- roadmap multi-view UI (Execution, Timeline, Swimlane, Dependency)

However, roadmap views currently display **structure**, not **health**.

Phase 4 introduces **delivery intelligence signals** so users can quickly identify:

- overloaded milestones
- blocked milestones
- dependency pressure
- potential slippage
- delivery confidence

---

# Objectives

Phase 4 must introduce standardized roadmap intelligence across all views.

The following signals must be implemented:

1. **Milestone Health Indicators**
2. **Capacity Utilization Metrics**
3. **Roadmap Heatmaps**
4. **Dependency Pressure Indicators**
5. **Centralized Intelligence in View Models**

These signals must appear consistently across:

- Execution Board
- Timeline View
- Swimlane View
- Dependency View

---

# Non-Goals

Phase 4 must **not** implement:

- simulation engine
- Monte Carlo forecasting
- delivery probability models
- resource optimization
- velocity inference
- planning changes
- new roadmap entities
- major UI redesign

These belong to later phases.

---

# High-Level Design

## Intelligence Source

All roadmap intelligence should derive from existing data:

- milestone target capacity
- work item assignments
- dependency relationships
- sprint assignment
- milestone dates

Do not introduce new persistence models in Phase 4.

All intelligence must be computed dynamically via view models.

---

# Files to Modify

Primary logic will live in view-model helpers.

Modify or extend:

```
src/components/roadmap/roadmapViewModels.ts
```

Update rendering components:

```
src/components/roadmap/ExecutionBoardView.tsx
src/components/roadmap/RoadmapTimelineView.tsx
src/components/roadmap/RoadmapSwimlaneView.tsx
src/components/roadmap/RoadmapDependencyView.tsx
```

Documentation updates:

```
docs/spec/delivery-plan-phase-4-roadmap-intelligence.md
docs/wiki/Roadmap.md
docs/wiki/Modules-WorkItems.md
```

---

# Milestone Intelligence Model

Each milestone must compute the following intelligence fields:

```
MilestoneIntelligence {
  milestoneId: string

  readiness: 'NOT_READY' | 'PARTIAL' | 'READY'
  confidence: 'LOW' | 'MEDIUM' | 'HIGH'

  targetCapacity: number | null
  committedLoad: number
  remainingLoad: number

  utilizationPercent: number | null

  blockedItemCount: number
  dependencyInbound: number
  dependencyOutbound: number

  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH'
  overflow: boolean
}
```

These fields should be derived in `roadmapViewModels.ts`.

---

# Capacity Utilization Logic

Milestone capacity utilization must be calculated.

### Inputs

- `targetCapacity` (from milestone)
- `committedLoad` (estimated points of assigned items)

### Calculation

```
utilizationPercent = committedLoad / targetCapacity
```

### Utilization states

```
< 70% → UNDERFILLED
70% - 100% → HEALTHY
100% - 120% → AT_RISK
> 120% → OVERLOADED
```

These states must drive visual indicators.

---

# Risk Level Calculation

Milestone risk should derive from multiple factors.

Suggested logic:

```
riskScore = 0

if utilizationPercent > 1.1 → +2
if blockedItemCount > threshold → +2
if dependencyInbound > threshold → +1
if milestone near start date but readiness low → +2
```

Final classification:

```
0-1 → LOW
2-3 → MEDIUM
4+ → HIGH
```

This logic should remain configurable and isolated in `roadmapViewModels.ts`.

---

# Readiness and Confidence

### Readiness

Derived from planning completeness:

```
READY
PARTIAL
NOT_READY
```

Example signals:

- number of unestimated items
- dependency completeness
- sprint assignment completeness

### Confidence

Derived from:

- risk score
- dependency pressure
- capacity overflow

Confidence values:

```
HIGH
MEDIUM
LOW
```

---

# Dependency Pressure Indicators

Dependency View must highlight milestone pressure.

For each milestone compute:

```
dependencyInbound
dependencyOutbound
```

Definitions:

```
dependencyInbound = number of dependencies blocking items in this milestone
dependencyOutbound = number of dependencies where items in this milestone block others
```

Milestones with high inbound blockers should be highlighted as **blocked pressure points**.

Milestones with high outbound blockers should be highlighted as **delivery bottlenecks**.

---

# Roadmap Heatmaps

Timeline and Swimlane views must visually reflect milestone health.

Color scheme:

```
Green → Healthy
Yellow → At Risk
Red → Overloaded / Blocked
Gray → Not Ready
```

Heatmaps should appear in:

- milestone bars (timeline)
- swimlane cells
- execution board milestone headers

---

# Execution Board Enhancements

Enhance milestone headers to display:

- utilization %
- risk badge
- blocked item count
- readiness badge
- confidence badge

Example display:

```
Milestone A
Capacity: 85%
Risk: MEDIUM
Blocked: 3
Confidence: MEDIUM
```

---

# Timeline View Enhancements

Milestone bars should display:

- color-coded health state
- utilization overlay
- risk indicator icon
- readiness badge

Tooltip should include full milestone intelligence.

---

# Swimlane View Enhancements

Each swimlane cell should display:

- item counts
- blocked item counts
- capacity status
- milestone risk indicator

Cells should also use heatmap coloring.

---

# Dependency View Enhancements

Enhance the graph with milestone pressure indicators.

Nodes should display:

- milestone name
- inbound dependency count
- outbound dependency count
- risk level

Edges should display aggregated dependency counts.

Nodes with many inbound edges should be visually emphasized.

---

# View Model Implementation

Extend `roadmapViewModels.ts`.

Add new helpers:

```
computeMilestoneIntelligence(...)
computeCapacityUtilization(...)
computeRiskScore(...)
computeDependencyPressure(...)
buildRoadmapIntelligence(...)
```

All views must consume this shared intelligence object.

---

# Performance Requirements

Phase 4 must not introduce expensive recalculations.

Use memoization or cached transforms where possible.

Example approach:

```
const roadmapIntelligence = useMemo(
  () => buildRoadmapIntelligence(rawData),
  [rawData]
)
```

---

# Testing Requirements

Add tests for intelligence logic.

Recommended file:

```
scripts/test-roadmap-intelligence.ts
```

Tests should validate:

- utilization calculations
- risk scoring logic
- dependency pressure detection
- readiness classification

Snapshot tests from Phase 3 should remain unchanged.

---

# Documentation Updates

Create new spec:

```
docs/spec/delivery-plan-phase-4-roadmap-intelligence.md
```

Document:

- milestone intelligence model
- utilization logic
- risk scoring
- dependency pressure signals
- heatmap rules

Update wiki:

```
docs/wiki/Roadmap.md
docs/wiki/Modules-WorkItems.md
```

Add explanation of roadmap health indicators.

---

# Acceptance Criteria

Phase 4 is complete when all conditions are satisfied.

### Intelligence Model

- milestone intelligence fields exist
- utilization calculated correctly
- risk scoring works
- dependency pressure computed

### UI

- execution board displays milestone health
- timeline view shows heatmaps
- swimlane view shows milestone status
- dependency view highlights pressure nodes

### Consistency

- all views use the same intelligence calculations
- color semantics consistent
- tooltips show milestone health details

### Testing

- intelligence logic tested
- existing snapshot tests pass
- no regression in roadmap rendering

---

# Out of Scope

Phase 4 does not include:

- simulation or scenario modeling
- forecast probabilities
- automatic milestone rebalancing
- resource optimization
- predictive delivery analytics

These will be addressed in future phases.

---

# Future Phases

Phase 4 prepares the roadmap for:

Phase 5: Delivery Simulation Engine

- scenario planning
- milestone slip modeling
- capacity adjustments
- what-if forecasting

Phase 6: Portfolio Intelligence

- cross-project roadmap overlays
- program-level analytics
- enterprise delivery dashboards

---

# Final Instruction to Codex

Implement Phase 4 according to this specification by adding milestone intelligence signals, capacity utilization indicators, roadmap heatmaps, and dependency pressure analytics while preserving all existing planning logic and roadmap views introduced in previous phases.