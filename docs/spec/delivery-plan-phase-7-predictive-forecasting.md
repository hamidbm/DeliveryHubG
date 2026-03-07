# DeliveryHub Spec: Phase 7 – Predictive Forecasting

## Document Purpose

This document defines the implementation instructions for **Phase 7: Predictive Forecasting** in DeliveryHub.

Phase 7 introduces **forecasting under uncertainty** so that DeliveryHub can estimate **likely delivery windows** for milestones rather than only deterministic dates.

This phase builds on:

- Phase 4: Milestone intelligence
- Phase 5: Simulation engine
- Phase 6: Portfolio analytics

Predictive forecasting will estimate **best-case, expected, and worst-case delivery outcomes** using signals already present in the system.

This document serves as:

- the **implementation guide for Codex**
- the **permanent spec stored in `docs/spec/`**

---

# Objectives

Phase 7 introduces the following capabilities:

1. Milestone forecast windows
2. Best / expected / worst case delivery dates
3. Slip likelihood indicators
4. Forecast overlays on roadmap views
5. Portfolio forecast aggregation

The goal is to give delivery managers **early warning signals** about potential delays.

---

# Non-Goals

Phase 7 intentionally does **not** include:

- Monte Carlo simulation
- AI/ML predictive models
- automatic schedule optimization
- resource rebalancing

Those will be introduced in later phases.

Phase 7 must remain **deterministic and explainable**.

---

# Forecasting Model Overview

Forecasts are derived from existing intelligence signals:

- milestone utilization
- milestone risk level
- dependency pressure
- blocked work items
- readiness level
- sprint count
- milestone duration

These signals will influence **forecast spread** around the planned milestone end date.

Example:

```
Milestone A
Planned End: June 1

Forecast:
Best Case: May 28
Expected: June 3
Worst Case: June 15
```

---

# Forecast Data Model

Add the following types to `src/types.ts`.

## Forecast Window

```ts
MilestoneForecast = {
  milestoneId: string

  plannedEndDate: string

  bestCaseDate: string
  expectedDate: string
  worstCaseDate: string

  forecastConfidence: 'LOW' | 'MEDIUM' | 'HIGH'

  slipRisk: 'LOW' | 'MEDIUM' | 'HIGH'
}
```

## Plan Forecast Summary

```ts
PlanForecastSummary = {
  planId: string

  milestonesAnalyzed: number
  highRiskMilestones: number

  averageSlipDays: number
  averageConfidence: 'LOW' | 'MEDIUM' | 'HIGH'
}
```

## Portfolio Forecast Summary

```ts
PortfolioForecastSummary = {
  plansAnalyzed: number

  totalMilestones: number
  highRiskMilestones: number

  expectedPortfolioSlipDays: number
}
```

---

# Forecasting Engine

Create a new forecasting service.

```
src/services/forecastingEngine.ts
```

## Responsibilities

- compute forecast windows for milestones
- aggregate plan-level forecasts
- aggregate portfolio-level forecasts

---

# Core Functions

## computeMilestoneForecast

```ts
function computeMilestoneForecast(
  milestone,
  intelligence
): MilestoneForecast
```

Inputs:

- milestone data
- milestone intelligence signals

Outputs:

- forecast window
- confidence
- slip risk

---

## computePlanForecast

```ts
function computePlanForecast(planPreview)
```

Aggregates milestone forecasts into plan summary metrics.

---

## computePortfolioForecast

```ts
function computePortfolioForecast(plans)
```

Aggregates plan forecasts into portfolio-level metrics.

---

# Forecast Heuristics

Forecast spread is determined by risk signals.

## Base spread

Start with a base uncertainty proportional to milestone duration.

Example:

```
baseSpread = milestoneDurationDays * 0.1
```

## Adjustments

Add spread when risk signals are present.

### Utilization

```
>100% utilization → +5 days
>120% utilization → +10 days
```

### Dependency Pressure

```
>3 inbound dependencies → +3 days
>6 inbound dependencies → +7 days
```

### Blocked Work

```
>5 blocked items → +4 days
```

### Readiness

```
NOT_READY → +6 days
PARTIAL → +3 days
```

---

## Forecast Window Calculation

```
bestCase = plannedEndDate - baseSpread
expected = plannedEndDate + riskSpread
worstCase = plannedEndDate + (riskSpread * 2)
```

---

# Confidence Calculation

Confidence is derived from milestone intelligence.

Example:

```
LOW confidence if:
- high risk
- utilization > 110%
- many inbound dependencies

MEDIUM otherwise

HIGH if:
- utilization < 80%
- few dependencies
- readiness READY
```

---

# Slip Risk Classification

Slip risk should be consistent with milestone intelligence.

```
LOW
MEDIUM
HIGH
```

These categories must align with existing risk signals.

---

# API Endpoints

Add forecasting APIs.

## Plan Forecast

```
GET /api/forecast/plan/{planId}
```

Response:

```
{
  milestoneForecasts: MilestoneForecast[]
  summary: PlanForecastSummary
}
```

---

## Portfolio Forecast

```
POST /api/forecast/portfolio
```

Request:

```
{
  planIds: string[]
}
```

Response:

```
{
  planForecasts: PlanForecastSummary[]
  portfolioSummary: PortfolioForecastSummary
}
```

---

# UI Integration

Forecast signals must appear in multiple places.

## Roadmap Views

Enhance the following components:

```
ExecutionBoardView.tsx
RoadmapTimelineView.tsx
RoadmapSwimlaneView.tsx
```

Add forecast badges such as:

```
Forecast: Jun 3 – Jun 15
Confidence: Medium
```

Timeline bars should include forecast shading beyond the planned end.

---

## Portfolio Dashboard

Add forecast summary metrics:

```
Expected Portfolio Slip
High Risk Milestones
Low Confidence Plans
```

Use existing portfolio views to surface these metrics.

---

# Forecast Visualization

Recommended UI patterns:

- shaded forecast range
- dashed extension beyond planned end
- risk badges

Example:

```
Planned: |====|
Forecast: |====~~~~|
```

Where `~~~~` represents forecast uncertainty.

---

# View Models

Extend roadmap and portfolio view models.

Add helpers:

```
buildForecastViewModel(...)
buildPortfolioForecastViewModel(...)
```

These helpers should combine milestone intelligence with forecast outputs.

---

# Testing

Add forecasting tests.

```
scripts/test-forecasting-engine.ts
scripts/test-forecast-api.ts
```

Tests must verify:

- forecast window generation
- risk adjustments
- plan aggregation
- portfolio aggregation

Ensure:

```
npm run test:api
```

still passes.

---

# Documentation

Create new spec:

```
docs/spec/delivery-plan-phase-7-predictive-forecasting.md
```

Update wiki:

```
docs/wiki/Roadmap.md
docs/wiki/Modules-WorkItems.md
```

Include:

- forecasting overview
- forecast signals
- UI changes

---

# Acceptance Criteria

Phase 7 is complete when:

1. Forecasting engine computes milestone forecasts
2. Plan forecast API works
3. Portfolio forecast API works
4. Forecast signals appear in roadmap views
5. Portfolio forecast summary appears in dashboard
6. Forecast heuristics implemented correctly
7. Tests pass
8. Documentation updated

---

# Out of Scope

Phase 7 does not include:

- Monte Carlo forecasting
- probability distributions
- automated schedule optimization

These are planned for future phases.

---

# Future Phases

Phase 8: Probabilistic Forecasting

- Monte Carlo simulations
- probability curves
- forecast confidence intervals

Phase 9: Schedule Optimization

- automated capacity balancing
- milestone reordering
- intelligent schedule recommendations

---

# Final Instruction to Codex

Implement Phase 7 predictive forecasting according to this specification by creating a forecasting engine, APIs, UI integrations, view models, tests, and documentation.