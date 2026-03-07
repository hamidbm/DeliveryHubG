# DeliveryHub Spec: Phase 6 – Portfolio Analytics

## Document Purpose

This document defines the implementation instructions for **Phase 6** of the DeliveryHub planning platform: **Portfolio Analytics**.

Phase 6 introduces **cross-plan insights and portfolio-level analytics** that allow users to analyze multiple delivery plans together rather than viewing plans in isolation.

The purpose of this phase is to surface:

- cross-plan milestone pressure
- cross-team capacity conflicts
- portfolio-level delivery risk
- dependency choke points across projects
- executive-level delivery summaries

This specification serves both as:

- the **implementation brief for Codex**
- a **permanent engineering document stored in `docs/spec/`**

---

# Context

After Phases 1–5, DeliveryHub supports:

- capacity-aware delivery planning
- modular planning engine
- multi-view roadmap visualization
- milestone intelligence signals
- scenario simulation

However, all analysis is currently **plan-scoped**.

Organizations running multiple programs need **portfolio-level insights**, including:

- overlapping milestones across projects
- shared team capacity pressure
- cross-plan dependencies
- portfolio health dashboards

Phase 6 addresses this need.

---

# Objectives

Phase 6 introduces **portfolio-level visibility and analytics** across delivery plans.

The phase includes:

1. Portfolio Plan Registry
2. Portfolio Dashboard
3. Multi-Plan Timeline Comparison
4. Cross-Plan Dependency Mapping
5. Portfolio Health Metrics

These features allow leadership and program managers to understand delivery risk across multiple initiatives.

---

# Non-Goals

Phase 6 does **not** include:

- predictive forecasting
- Monte Carlo simulation
- automated schedule optimization
- resource rebalancing
- financial portfolio management

Those will be addressed in later phases.

---

# Core Concepts

## Delivery Plan

A delivery plan is the output of the planning engine and contains:

- milestones
- sprints
- roadmap phases
- milestone intelligence
- capacity signals

## Portfolio

A **portfolio** represents a collection of delivery plans analyzed together.

Example:

```
Portfolio: FY25 Product Delivery

Plans:
- Mobile App Revamp
- Payments Infrastructure Upgrade
- Data Platform Expansion
```

## Portfolio Insight

Derived analytics across plans, such as:

- overlapping milestones
- capacity conflicts
- cross-plan dependencies
- aggregated risk signals

---

# Architecture Overview

Phase 6 introduces a **portfolio analytics layer**.

This layer:

- aggregates data from multiple delivery plans
- computes portfolio metrics
- feeds new UI views

### New Backend Service

```
src/services/portfolioAnalytics.ts
```

### New UI Components

```
src/components/portfolio/PortfolioDashboard.tsx
src/components/portfolio/PortfolioTimelineView.tsx
src/components/portfolio/PortfolioDependencyView.tsx
src/components/portfolio/PortfolioHealthSummary.tsx
```

### New View Models

```
src/components/portfolio/portfolioViewModels.ts
```

---

# Portfolio Plan Registry

The portfolio system must be able to retrieve existing delivery plans.

Add a registry service to list plans.

### API

```
GET /api/portfolio/plans
```

Returns:

```ts
PortfolioPlanSummary = {
  id: string
  name: string
  createdAt: string
  milestoneCount: number
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH'
}
```

The data should be derived from existing delivery plan storage (work plan previews or stored plans).

---

# Portfolio Dashboard

Create a dashboard that summarizes portfolio delivery health.

### Component

```
PortfolioDashboard.tsx
```

### Metrics to display

- total delivery plans
- total milestones
- high-risk milestone count
- overloaded milestone count
- plans with simulation scenarios
- average capacity utilization across plans

Example dashboard:

```
Portfolio Summary

Plans: 6
Milestones: 42
High Risk Milestones: 5
Overloaded Milestones: 3
Average Capacity Utilization: 92%
```

These metrics should derive from milestone intelligence data.

---

# Multi-Plan Timeline Comparison

Create a timeline view that overlays milestones across multiple delivery plans.

### Component

```
PortfolioTimelineView.tsx
```

### Behavior

- horizontal time axis
- milestones grouped by plan
- overlapping milestone bars visible
- milestone health color indicators applied

Example layout:

```
Plan A | ---Milestone A1-----|
Plan B | -----Milestone B1---|
Plan C | ---Milestone C1-----|
```

### Use Cases

- detect schedule overlaps
- identify stacked release windows
- visualize program sequencing

---

# Cross-Plan Dependency Mapping

Create a dependency visualization showing relationships across plans.

### Component

```
PortfolioDependencyView.tsx
```

### Nodes

Nodes represent milestones across plans.

Example:

```
Plan A – Milestone 2
Plan B – Milestone 4
```

### Edges

Edges represent dependencies derived from:

- work-item dependencies
- milestone relationships

### Indicators

Nodes should display:

- plan name
- milestone name
- dependency counts
- risk level

Highlight nodes with:

- many inbound dependencies
- many outbound dependencies

---

# Portfolio Health Summary

Create a component summarizing risk across plans.

### Component

```
PortfolioHealthSummary.tsx
```

### Example metrics

| Plan | Milestones | High Risk | Overloaded | Avg Utilization |
|-----|-----|-----|-----|-----|
| Payments | 8 | 2 | 1 | 95% |
| Mobile | 6 | 1 | 0 | 88% |
| Data Platform | 7 | 2 | 1 | 102% |

This allows quick identification of risky programs.

---

# Portfolio View Models

Create view model helpers to transform raw plan data.

### File

```
src/components/portfolio/portfolioViewModels.ts
```

### Required functions

```
buildPortfolioOverview(...)
buildPortfolioTimelineRows(...)
buildPortfolioDependencyGraph(...)
computePortfolioHealthMetrics(...)
```

These helpers should aggregate milestone intelligence from multiple plans.

---

# Backend Portfolio Analytics Service

Create:

```
src/services/portfolioAnalytics.ts
```

### Responsibilities

- fetch delivery plans
- aggregate milestone intelligence
- compute portfolio metrics
- produce data structures for UI views

### Key Functions

```
getPortfolioPlans(...)
getPortfolioOverview(...)
buildPortfolioComparison(...)
```

---

# API Endpoints

### List Plans

```
GET /api/portfolio/plans
```

Returns plan summaries.

### Portfolio Overview

```
GET /api/portfolio/overview
```

Returns aggregated portfolio metrics.

### Portfolio Comparison

```
POST /api/portfolio/compare
```

Request body:

```ts
{
  planIds: string[]
}
```

Response includes:

- timeline comparison data
- dependency graph
- health metrics

---

# UI Navigation

Add a **Portfolio** entry point to the UI.

Possible placement:

- top-level navigation
- Work Items module sub-navigation

Example:

```
Work Items
   ├ Roadmap
   ├ Simulation
   └ Portfolio
```

---

# Testing Requirements

Add new tests for portfolio logic.

### Files

```
scripts/test-portfolio-analytics.ts
scripts/test-portfolio-api.ts
```

### Tests should cover

- plan aggregation
- health metric calculations
- timeline overlap detection
- dependency graph construction

Ensure `npm run test:api` still passes.

---

# Documentation Updates

Create new spec:

```
docs/spec/delivery-plan-phase-6-portfolio-analytics.md
```

Update wiki:

```
docs/wiki/Roadmap.md
docs/wiki/Modules-WorkItems.md
```

Documentation must include:

- explanation of portfolio analytics
- portfolio dashboard overview
- supported portfolio APIs
- UI screenshots (if available)

---

# Acceptance Criteria

Phase 6 is complete when:

1. Portfolio dashboard renders with aggregated metrics
2. Multiple plans can be compared on a timeline
3. Cross-plan dependency graph works
4. Portfolio health summary table displays correctly
5. APIs return correct portfolio data
6. Portfolio view models normalize data correctly
7. Tests for portfolio analytics pass
8. Documentation is updated

---

# Out of Scope

Phase 6 does not include:

- financial portfolio analysis
- automatic scheduling recommendations
- Monte Carlo forecasting
- resource optimization across portfolios

---

# Future Phases

Phase 7: Predictive Forecasting

- probabilistic milestone delivery
- confidence bands
- risk modeling

Phase 8: Delivery Optimization

- automated milestone rebalancing
- team capacity optimization
- schedule optimization

---

# Final Instruction to Codex

Implement Phase 6 according to this specification by introducing portfolio analytics services, APIs, view models, and UI components that aggregate delivery plan insights across multiple plans.