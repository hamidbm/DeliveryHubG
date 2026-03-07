# DeliveryHub Spec: Phase 5 – Delivery Simulation Engine

## Document Purpose

This document defines the implementation instructions for **Phase 5** of the Delivery Plan enhancement in the **Work Items** module of DeliveryHub.

Phase 5 expands DeliveryHub’s planning capabilities by introducing a **Delivery Simulation Engine** that allows users to run “what-if” scenarios against an existing delivery plan. The goal is to give actionable insight into how changes in capacity, scope, and schedule impact milestone delivery, risk, and confidence.

This spec is intended to be:

- the implementation brief for Codex
- a permanent specification stored under `docs/spec/`

---

# Context

After Phases 1–4:

- capacity-aware planning works
- planning logic is modular
- multiple roadmap views exist
- milestone health and delivery intelligence are computed

Planning is stable and richly instrumented. The next logical enhancement is **simulation and scenario analysis** to allow delivery forecasting and sensitivity testing.

---

# Phase 5 Scope

Phase 5 introduces:

1. Simulation input modeling
2. Baseline vs scenario plan comparison
3. Scenario preview and reporting
4. UI for scenario creation and results interpretation

This phase **does not** change the baseline planning engine. It adds a simulation abstraction on top of existing planning logic using the same core engine.

---

## Non-Goals

Phase 5 does **not** include:

- automatic optimization or recommendations
- Monte Carlo forecasting with probability distribution sampling
- AI-driven scheduling
- real-time collaborative editing
- resource leveling across multiple portfolios

These will be considered in later phases.

---

# Architectural Overview

Simulations should run by:

1. Accept a baseline plan input and scenario overrides
2. Call the existing planning engine (`buildDeliveryPlanPreview(...)`) with modified inputs
3. Capture the results
4. Produce a comparison payload showing differences

Key benefits:

- leverage the modular planning engine from Phase 2
- reuse all existing planning logic
- produce deterministic scenario results

---

# Simulation Concepts

## Terminology

- **Baseline Plan**
  The original delivery plan generated via the normal intake workflow.

- **Scenario**
  A variation on the baseline with specific overrides, such as capacity changes or date shifts.

- **Scenario Input**
  A data structure defining overrides to the baseline.

- **Scenario Result**
  A new delivery plan preview generated with scenario overrides.

- **Comparison Delta**
  The difference between baseline and scenario results.

---

# Simulation Input Model

Add new simulation scenario types in `src/types.ts`:

### Scenario Override Types

```ts
SimulationOverride = {
  type: 'CAPACITY_SHIFT' | 'SCOPE_GROWTH' | 'DATE_SHIFT' | 'VELOCITY_ADJUSTMENT';
  params: Record<string, any>;
}
```

### Simulation Scenario

```ts
SimulationScenario = {
  id?: string;
  name: string;
  description?: string;
  overrides: SimulationOverride[];
}
```

### Simulation Payload

```ts
SimulationRequest = {
  baselineInput: DeliveryPlanInput;
  scenario: SimulationScenario;
}
```

### Simulation Result

```ts
SimulationResult = {
  scenario: SimulationScenario;
  baselinePreview: DeliveryPlanPreview;
  scenarioPreview: DeliveryPlanPreview;
  comparison: SimulationComparison;
}
```

### Simulation Comparison Per Milestone

```ts
SimulationComparison = {
  milestoneComparisons: MilestoneComparison[];
  summary: SimulationSummary;
}
```

```ts
MilestoneComparison = {
  milestoneId: string;
  baselineEndDate: string;
  scenarioEndDate: string;
  baselineCapacityUtilization: number | null;
  scenarioCapacityUtilization: number | null;
  baselineRisk: string;
  scenarioRisk: string;
}
```

```ts
SimulationSummary = {
  totalMilestones: number;
  milestonesSlipped: number;
  riskIncreaseCount: number;
  averageUtilizationDiff: number | null;
}
```

---

# Supported Simulation Override Types

Below are the initial supported simulation types.

## 1. CAPACITY_SHIFT

Change sprint capacity for a simulation.

Parameters:

```ts
{ deltaCapacity: number; }
```

Effect:

- increases or decreases sprint capacity by a fixed delta for all teams.

## 2. SCOPE_GROWTH

Increase story count or story effort.

Parameters:

```ts
{ percentIncrease: number; }
```

Effect:

- multiplies story effort estimates by `1 + percentIncrease / 100`.

## 3. DATE_SHIFT

Delay milestones by shifting start or end date.

Parameters:

```ts
{ milestoneId: string; shiftDays: number; }
```

Effect:

- pushes milestone start and end forward by `shiftDays`.

## 4. VELOCITY_ADJUSTMENT

Change team velocity.

Parameters:

```ts
{ deltaVelocity: number; }
```

Effect:

- adds/subtracts points per sprint per team.

---

# Backend Implementation – Simulation Engine

## Files to Create

```
src/services/simulationEngine.ts
```

This module should contain pure simulation logic.

## Primary Functions

### 1. applyScenarioOverrides

```ts
function applyScenarioOverrides(
  baselineInput: DeliveryPlanInput,
  overrides: SimulationOverride[]
): DeliveryPlanInput
```

Return a modified plan input reflecting scenario overrides. Never mutate the baseline object.

### 2. runSimulation

```ts
async function runSimulation(
  simulationRequest: SimulationRequest
): Promise<SimulationResult>
```

This function should:

1. Call `applyScenarioOverrides`
2. Generate `baselinePreview` via existing planning engine
3. Generate `scenarioPreview` via planning engine with overridden input
4. Compare previews
5. Return a `SimulationResult`

### 3. comparePreviews

```ts
function comparePreviews(
  baseline: DeliveryPlanPreview,
  scenario: DeliveryPlanPreview
): SimulationComparison
```

Compute deltas for:

- milestone end dates
- capacity utilization
- risk level changes
- milestone slippage
- summary metrics

---

# API Routes

Add new routes to support simulation:

### POST /api/work-items/plan/simulate

**Request Body**

```json
SimulationRequest
```

**Response Body**

```json
SimulationResult
```

### Implementation Files

```
src/app/api/work-items/plan/simulate/route.ts
```

This route should:

1. Validate the incoming simulation request
2. Call `runSimulation(...)`
3. Return the result

---

# UI Requirements

## Simulation Editor UI

Integrate simulation inputs into the Work Items UI.

### Files to Modify/Create

```
src/components/SimulationEditor.tsx
src/components/SimulationResults.tsx
Modify existing Work Items UI to include simulation entry points
```

### UI Behavior

1. User opens a simulation modal from a button on the roadmap page
2. They select a baseline plan (from existing plan preview)
3. They choose one or more scenario overrides
4. They submit to run simulation
5. UI displays comparison results

The scenario editor should allow multiple override entries with labels and descriptions.

---

## Simulation Results UI

A new component should render:

- baseline vs scenario comparison summary
- milestone comparisons
- risk differences
- capacity utilization differences
- date slippage for individual milestones

### Example

```
Simulation Results: “Velocity -20%”
Milestones slipped: 3 out of 8
Average utilization change: +12%

Detailed Table:
| Milestone | Baseline End | Scenario End | Baseline Util | Scenario Util | Risk Change |
```

---

# View Model Helpers

Extend `roadmapViewModels.ts` with simulation helpers:

```
generateSimulationViewModel(baselinePreview, scenarioPreview)
```

This must compute:

- deltas
- tables for UI rendering
- flagged changes (slipped, overloaded, risk rise)

---

# Testing Requirements

Add tests for simulation logic:

### Simulation Logic Tests

```
scripts/test-simulation-engine.ts
```

Cover:

- applyScenarioOverrides correctness
- each override type individually
- vector of overrides
- comparePreviews returns expected deltas

### API Route Tests

Add to `scripts/test-api.ts`:

- POST simulate with baseline + capacity shift
- verify comparison results

### UI Basic Tests

Verify rendering of Simulation Results component with a mock comparison.

---

# Documentation Updates

Create:

```
docs/spec/delivery-plan-phase-5-simulation-engine.md
```

Update wiki:

```
docs/wiki/Roadmap.md
docs/wiki/Modules-WorkItems.md
```

Documentation must include:

- simulation concepts
- available override types
- UI behavior
- API route specs

---

# Performance Considerations

Simulations run planning logic twice.

Use caching where possible:

- avoid re-fetching static data
- memoize parts of preview calculation that do not change

Simulation runs should be reasonably fast for interactive usage.

---

# Acceptance Criteria

Phase 5 is complete when:

1. Simulation engine exists and works for all override types
2. API route `/plan/simulate` returns SimulationResult
3. Simulation UI allows creation and execution of scenarios
4. Results UI displays comparison correctly
5. Tests cover simulation logic and API
6. Documentation is in place
7. No regression introduced in Phases 1–4 functionality

---

# Out of Scope

Does **not** include:

- optimization suggestions
- automatic capacity rebalancing
- resource leveling
- portfolio-wide simulation
- machine learning forecasts

---

# Future Extensions

Phase 6: Portfolio Analytics

- project blending
- multi-plan comparisons
- executive dashboards
- cross-team capacity optimization

Phase 7: Predictive Forecasting

- Monte Carlo
- confidence bands
- risk probability trees

---

# Final Instruction to Codex

Implement Phase 5 according to this spec by adding simulation engine backend, API route, UI components, view models, tests, and documentation as specified above.

## Implementation Status

Status: Completed

Validation:
- simulation engine tests added
- simulation API tests added
- `npm run test:api` passes

Notes:
- `DATE_SHIFT` is milestone-specific
- multiple overrides per scenario are supported
