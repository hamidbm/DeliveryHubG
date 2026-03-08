# DeliveryHub Spec: Phase 9.1 – Explainability UI
## Document Purpose
This document defines the implementation instructions for **Phase 9.1: Explainability UI** in DeliveryHub. Phase 9.1 introduces a reusable explainability layer across the product so users can understand: - what advanced delivery metrics mean - how they are derived - why they matter - how to act on them This phase is focused on **user understanding and adoption**, not new planning algorithms. This document serves as: - the **implementation guide for Codex** - the **permanent specification stored in `docs/spec/`** ---
# Context
After Phases 1–8, DeliveryHub now includes advanced capabilities such as: - capacity-aware planning - milestone intelligence - simulation - deterministic forecasting - probabilistic forecasting - portfolio analytics These capabilities are powerful, but they now create a usability challenge: - users may not understand what a metric means - users may not know how to interpret a forecast - users may not know what action to take - users may distrust sophisticated outputs without explanation Phase 9.1 solves this by introducing **Explainability UI** across key surfaces. ---
# Goals
Phase 9.1 must introduce a reusable and consistent explainability system that: 1. Explains advanced metrics and concepts inline 2. Supports dismissible and discoverable help 3. Works across roadmap, forecasting, simulation, and portfolio views 4. Remains lightweight and non-intrusive 5. Is easy to extend as new features are added --- # Non-Goals Phase 9.1 does **not** include: - intake auto-population - Applications module persistence work - new forecasting or planning logic - AI-generated narrative insights - chatbot-style help experiences - full product onboarding tours Those belong to later phases. ---
# Product Design Principles
The explainability UI must follow these principles.
## 1. Contextual, not overwhelming
Explanations should appear where users need them:
  - near a metric
  - near a forecast
  - near a simulation result
  - near a dashboard summary Do not create large static walls of explanatory text.
## 2. Progressive disclosure
Users should see a compact hint first, then optionally expand for more detail.
## 3. Action-oriented
Each explanation should help users answer:
  - what is this?
  - why is it high/low?
  - what can I do about it?
## 4. Reusable
The system should support adding future explainable metrics without redesigning the UI.
---
# Scope of Phase 9.1
Phase 9.1 covers explainability for the following feature areas:
1. **Roadmap milestone intelligence**
2. **Deterministic forecasting**
3. **Probabilistic forecasting**
4. **Simulation**
5. **Portfolio analytics** This phase should not attempt to explain every field in the application. Focus on the advanced decision-support features first.
---
# Explainability Content Model
Each explainable concept should support structured content.
## New Type in `src/types.ts`
Add a reusable type such as:
```ts
ExplainabilityContent = { id: string title: string shortText: string detailText?: string whyItMatters?: string howToUse?: string actions?: string[] }
```
### Notes -
`shortText` is the compact explanation shown in tooltip/popover form - `detailText` is the fuller explanation shown when expanded - `whyItMatters` explains business relevance - `howToUse` explains interpretation - `actions` provides practical follow-up suggestions This model should remain simple and static for now. ---
# Explainability Registry
Create a centralized registry of explainable concepts.
## New File
```text
src/lib/explainabilityRegistry.ts
```
This file should export a dictionary of explainability content for known metrics and concepts.
### Initial concepts to include
At minimum, define explainability entries for:
- `capacity_utilization`
- `risk_level`
- `readiness`
- `confidence`
- `blocked_items`
- `dependency_pressure`
- `forecast_window`
- `on_time_probability`
- `uncertainty_level`
- `p50_date`
- `p90_date`
- `simulation_scenario`
- `scenario_delta`
- `portfolio_health`
- `high_risk_milestones`
- `average_utilization`
- `expected_portfolio_slip`
### Example structure
```ts
export const EXPLAINABILITY_REGISTRY: Record<string, ExplainabilityContent> = { on_time_probability: { id: 'on_time_probability', title: 'On-Time Probability', shortText: 'Estimates the likelihood that a milestone will finish on or before its planned end date.', detailText: 'This metric is derived from milestone utilization, dependency pressure, blocked work, readiness, and forecast spread.', whyItMatters: 'It helps delivery managers see which milestones are likely to slip before delays become visible in schedule dates alone.', howToUse: 'Lower values indicate higher schedule risk. Review dependencies, capacity pressure, and blocked work first.', actions: [ 'Reduce scope in the milestone', 'Shift work into a later milestone', 'Investigate inbound blockers', 'Review whether capacity assumptions are realistic' ] } }
```
---
# UI Components to Create
Create a small reusable explainability component set.
## New Components
```text
src/components/explainability/ExplainabilityIcon.tsx src/components/explainability/ExplainabilityPopover.tsx src/components/explainability/ExplainableMetric.tsx src/components/explainability/ExplainabilityDrawer.tsx
```
### Component responsibilities
## `ExplainabilityIcon.tsx`
A compact trigger component placed next to a metric label or value. Behavior:
- subtle and lightweight
- opens a tooltip or popover
- consistent across the app

## `ExplainabilityPopover.tsx`
The default inline explanation UI. Should display:
- title
- short explanation
- optional `Why it matters`
- optional `How to use`
- optional `Show more`
## `ExplainableMetric.tsx`
A wrapper around a metric label/value pair that attaches explainability content by key. Example usage:
```tsx
<ExplainableMetric label="On-Time Probability" value="62%" explainabilityKey="on_time_probability" />
```
## `ExplainabilityDrawer.tsx`
An optional larger detail panel used when a user clicks `Show more`. This is useful for longer guidance and action-oriented explanations.
---
# Interaction Design
## Default behavior For most metrics:
- show a small explainability icon next to the label
- clicking it opens a compact popover
- popover includes a `Show more` action if detail text exists
## Dismissibility Popover and drawer must be easy to dismiss. Support:
- click outside to close
- explicit close button for larger panel/drawer
- keyboard accessibility
## Persistence of dismissal
Do **not** build cross-session persisted dismissals in Phase 9.1. Dismissals only need to be session-local / interaction-local for now.
---
# Placement Strategy
Add explainability only where it provides strong value.
## Required placements
### 1. Roadmap Views
Add explainability support in:
```text
src/components/roadmap/ExecutionBoardView.tsx src/components/roadmap/RoadmapTimelineView.tsx src/components/roadmap/RoadmapSwimlaneView.tsx src/components/roadmap/RoadmapDependencyView.tsx
```
At minimum, add explainability for:
- utilization - risk
- readiness
- confidence
- dependency pressure
- blocked items
- forecast range / forecast window
- on-time probability
- uncertainty
### 2. Portfolio Dashboard Add explainability for:
- average utilization
- high-risk milestones
- expected portfolio slip
- low confidence plans
- average on-time probability
- high uncertainty milestones Primary file:
```text
src/components/portfolio/PortfolioDashboard.tsx
```
### 3. Simulation Results
Add explainability for:
- scenario
- scenario delta
- milestone slippage
- utilization changes
- risk changes Primary file:
```text
src/components/SimulationResults.tsx
```
### 4. Delivery Plan Preview (optional but recommended in this phase)
If practical, add explainability to the preview summary for: - sprint capacity
- milestone target capacity
- derived milestone duration Primary file:
```text
src/components/GenerateDeliveryPlanWizard.tsx
```
This item is recommended but may be treated as a secondary target if scope needs to stay tight.
---
# UX Content Requirements
Explanations must be:
- plain-language
- concise
- non-technical where possible
- action-oriented Avoid:
- raw formulas without context
- internal implementation jargon
- vague statements like “this is calculated by the model” Prefer language like:
  - “This shows how full the milestone is relative to its target capacity.”
  - “Higher inbound dependency pressure means more outside work must complete before this milestone can finish.”
  - “P90 is the date the milestone is expected to finish by in a high-confidence scenario.”
---
# Content Standards for Key Concepts
Below are the minimum content expectations for important metrics.
## Capacity Utilization Must explain:
- what percentage is being compared
- what healthy vs overloaded means
- what actions reduce overload
## Risk Level
Must explain:
- that risk is derived from multiple signals
- that it is not a manual label only
- which kinds of issues raise it
## Readiness Must explain:
- that readiness reflects planning completeness / execution preparedness
- that low readiness increases delivery uncertainty
## Forecast Window
Must explain:
- planned vs best / expected / worst case
- that forecast range reflects delivery uncertainty
## On-Time Probability
Must explain:
- probability of finishing on or before planned end date
- that it is heuristic and evidence-based, not a guarantee ## P50 / P90
Must explain:
- P50 = midpoint likely outcome
- P90 = higher-confidence late bound - why users should watch the gap between them
## Simulation Scenario
Must explain:
- that scenarios are what-if analyses
- baseline is unchanged
- scenario outputs help compare impact before committing changes
## Portfolio Health
Must explain:
- that values are aggregated from plan/milestone intelligence
- that portfolio metrics help identify concentration of risk, not just isolated issues
---
# Visual Design Guidance
## Icon style
Use a subtle, consistent help affordance. Accepted approaches:
- small `i` / info icon - outlined help icon
- muted icon next to labels Do not make the interface noisy with oversized icons.
## Popover styling
The popover should feel lightweight but professional. Recommended sections:
- title - short explanation
- divider - why it matters
- how to use
- actions Do not require all sections to be present for every metric.
---
# Accessibility Requirements
Explainability UI must be accessible. Required:
- keyboard focusable triggers
- popover/drawer dismissible via keyboard
- accessible labels for explainability icons
- no hover-only interactions required for usability
---
# Implementation Architecture
## Explainability registry is the source of truth
All content should be managed from the registry file, not hardcoded separately inside each component.
## UI components consume registry keys
Views should pass only a key such as:
```ts
explainabilityKey="on_time_probability"
```
The component resolves content from the registry.
## Keep logic separate from explanations
Do not compute metrics in explainability components. They only explain already-computed values.
---
# Files to Create
```text
src/lib/explainabilityRegistry.ts src/components/explainability/ExplainabilityIcon.tsx src/components/explainability/ExplainabilityPopover.tsx src/components/explainability/ExplainableMetric.tsx src/components/explainability/ExplainabilityDrawer.tsx
```
---
# Files to Modify
At minimum, expect to update:
```
text src/types.ts src/components/roadmap/ExecutionBoardView.tsx src/components/roadmap/RoadmapTimelineView.tsx src/components/roadmap/RoadmapSwimlaneView.tsx src/components/roadmap/RoadmapDependencyView.tsx src/components/portfolio/PortfolioDashboard.tsx src/components/SimulationResults.tsx
```
Optional but recommended:
```text
src/components/GenerateDeliveryPlanWizard.tsx
```
Documentation:
```text
docs/spec/delivery-plan-phase-9-1-explainability-ui.md docs/wiki/Roadmap.md docs/wiki/Modules-WorkItems.md
```
If the Delivery module docs already contain dashboard/insight explanations, update those later, not in this phase.
---
# Testing Requirements
Add lightweight tests for explainability behavior.
## New tests
```text
scripts/test-explainability-ui.ts
```
### Required test coverage
- registry lookup works for known keys
- `ExplainableMetric` renders without crashing for valid keys
- missing/unknown keys fail gracefully
- popover content includes expected sections for a sample metric
- views using explainability still render in snapshot/test harnesses
### Regression requirement
Ensure:
```text
npm run test:api
```
continues to pass. If roadmap snapshot tests need updates because explainability icons are added, regenerate them in the normal repo pattern and keep snapshots stable.
---
# Documentation Requirements Create:
```text
docs/spec/delivery-plan-phase-9-1-explainability-ui.md
```
This spec should document:
- explainability purpose
- registry design
- reusable UI components
- supported explainability keys
- initial placements Update wiki docs:
```text
docs/wiki/Roadmap.md docs/wiki/Modules-WorkItems.md
```
Add concise sections explaining:
  - roadmap now includes explainable metrics
  - simulation and portfolio metrics can be explored inline
  - advanced metrics include contextual explanations

### Required implementation status section
At the end of implementation, Codex should add:
```md
## Implementation Status
Status: Completed Validation:
- explainability UI components added
- explainability registry added
- explainability tests added
- `npm run test:api` passes Notes:
- explainability is currently focused on roadmap, simulation, and portfolio metrics
- dismissals are interaction-local and not persisted across sessions
```
---
# Acceptance Criteria
Phase 9.1 is complete only when all of the following are true.
## Core system
- explainability registry exists
- reusable explainability components exist
- metrics can be rendered with explainability by key
## UI integration
- roadmap views include explainability for major intelligence/forecast metrics
- portfolio dashboard includes explainability for major summary metrics
- simulation results includes explainability for major scenario/result metrics ## UX behavior
- explanations are discoverable but not intrusive
- explanations can be dismissed easily
- unknown/missing keys fail gracefully
- no obvious UI clutter or metric overflow
## Testing
- explainability tests exist
- snapshot/test harnesses remain stable
- `npm run test:api` passes
## Documentation
- Phase 9.1 spec exists and is accurate
- wiki docs are updated
---
# Out of Scope
Phase 9.1 does not include:
- onboarding tours
- persisted help preferences
- AI-generated explanations
- Applications module metadata persistence
- intake auto-population
- chatbot help assistant
Those will come in later phases.
---
# Next Planned Phase
After Phase 9.1, the next planned work is:
## Phase 9.2
– Intake Auto-Population via Applications Metadata Before implementing that phase, we will temporarily switch to the **Applications** module to create:
  - a separate metadata persistence model/collection
  - APIs for planning context retrieval
  - a clean boundary so the `applications` collection remains simple and canonical
That work is intentionally **not included** in this spec.
---
# Final Instruction to Codex
Implement Phase 9.1 Explainability UI according to this specification by creating a centralized explainability registry, reusable explainability components, and contextual explanations across roadmap, simulation, and portfolio views, while preserving existing planning, simulation, forecasting, and portfolio functionality.