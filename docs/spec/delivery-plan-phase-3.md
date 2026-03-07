# DeliveryHub Spec: Phase 3 – Roadmap Multi-View Rendering

## Document Purpose

This document defines the implementation instructions for **Phase 3** of the Delivery Plan enhancement in the **Work Items** module of DeliveryHub.

Phase 3 enhances the roadmap UI by introducing multiple graphical views of the same underlying roadmap data without changing the data model. It does *not* introduce new planning logic — it purely adds flexible UI representations of the existing roadmap/milestone/sprint dataset.

This spec is intended to be:

- the implementation brief for Codex
- a permanent engineering spec stored under `docs/spec/`

---

## Context

After completing Phase 1 (capacity awareness) and Phase 2 (planning engine refactor), DeliveryHub now has a stable backend planning platform:

- capacity and milestone duration are driven by intake
- planning logic is modular and pure
- preview and create flows are solid and tested
- milestone target capacity persists as intended

The next UX frontier is **roadmap visualization**, enabling users to see the same plan in multiple useful views.

---

## Objective

Deliver **multiple distinct roadmap views** over the same data set of:

- milestones
- sprints
- capacity data
- work items
- dependencies
- roadmap phases

The goal is *different views of the same data*, not separate datasets or different backends.

Phase 3 must introduce the following views:

1. **Execution Board View** (current default)
2. **Timeline View**
3. **Milestone Swimlane View**
4. **Dependency View**

Each view lives under a new tab on the roadmap page.

---

## Non-Goals for Phase 3

Do **not** implement the following in this phase:

- changes to planning logic
- changes to milestone, sprint, work item, or dependency model
- simulation engine
- Monte Carlo forecasting
- capacity rebalancing
- velocity inference
- new API routes unless necessary for view-specific data convenience
- roadmap history/snapshots

Those belong to later phases.

---

## Files and Components to Create

Create the following components:

```
src/components/roadmap/RoadmapTabs.tsx
src/components/roadmap/ExecutionBoardView.tsx
src/components/roadmap/RoadmapTimelineView.tsx
src/components/roadmap/RoadmapSwimlaneView.tsx
src/components/roadmap/RoadmapDependencyView.tsx
src/components/roadmap/roadmapViewModels.ts
```

Each file should contain a React component (except `roadmapViewModels.ts`, which contains shared view model helpers).

---

## High-Level Rendering Flow

1. **Roadmap container component** loads roadmap data from the existing API.
2. **RoadmapTabs** provides top-level tab navigation:
   - Execution Board (default)
   - Timeline
   - Swimlane
   - Dependency
3. **Shared data normalization** lives centrally in `roadmapViewModels.ts`.
4. Each view component receives normalized data and focuses solely on rendering.

---

## Data Model and View Model Principles

The data passed into all views must include:

- milestones with:
  - id
  - name
  - start and end dates
  - sprint count
  - capacity summary for that milestone
  - readiness/confidence flags
- sprints with:
  - id
  - name
  - start and end
  - parent milestone
- roadmap phases with:
  - id
  - name
  - date windows
- work items with:
  - filters for milestone, sprint, status
  - dependency information
- dependency relationships for:
  - blockers
  - blocking edges
  - cross-milestone links

Always render from normalized view model data, not raw API responses.

---

## Shared View Model Helpers (roadmapViewModels.ts)

This module centralizes:

- date normalization and sorting
- grouping milestones by date or by phase
- sprint → milestone link tables
- capacity aggregations
- dependency graph edges

Functions should include:

```
transformRawRoadmapData
groupMilestonesByPhase
groupItemsByMilestone
buildTimelineRows
buildSwimlaneRows
buildDependencyGraph
```

---

## View 1 – Execution Board View

### Purpose

Preserve the existing roadmap — milestone centric with sprint execution board details.

### Requirements

- keep the current behavior and layout
- show milestone columns horizontally
- under each milestone, show sprints + item rollups
- capacity indicators stay visible
- maintain existing color/label semantics

### Notes

This view serves as the **default tab**.

If existing roadmap rendering lives in a single large file, extract the render logic into `ExecutionBoardView.tsx` and have the current page render it under the first tab.

---

## View 2 – Timeline View

### Purpose

Provide a horizontal date-timeline representation of milestones and sprints.

### Requirements

- horizontal axis is **calendar time**
- milestones displayed as colored bars spanning start → end
- sprint boundaries demarcated
- capacity information can be shown as bar overlays (e.g., color heat)
- milestone readiness/confidence flags shown
- tooltips or drilldowns for milestone details

### Behavior

- not a grid — anchored by dates
- can use a date scale library like `d3-scale` or simple CSS grids
- no new API routes — use existing normalized data
- should be responsive

---

## View 3 – Milestone Swimlane View

### Purpose

Provide a two-axis grid with milestones as rows and phases or time buckets as columns.

### Requirements

- rows = milestone
- columns = roadmap phases OR time buckets (e.g., quarters, months)
- cells show:
  - number of items
  - blocked items
  - capacity utilization
  - status badges and risk indicators
- allow sorting by readiness, capacity status

### Behavior

- look like a swimlane heatmap
- focus on milestone sequences and phase progress
- preserve color semantics for readiness/risk

---

## View 4 – Dependency View

### Purpose

Highlight cross-milestone and cross-item dependencies.

### Requirements

- nodes = milestones or sprints
- edges = blocking relationships
- edges show type:
  - blocking
  - blocked
  - critical path
- highlight pressure points:
  - many blockers inbound
  - many blockers outbound
  - critical path points

### Behavior

- simple directed graph (no need for full force layout)
- static representation is acceptable for v1
- interactive tooltips or small modals encouraged
- does not require new APIs — all dependency data already exists

---

## UI / Interaction Requirements

### Tab Navigation

- use standard tab UI
- tab order:
  1. Execution Board
  2. Timeline
  3. Swimlane
  4. Dependency

### Loading State

- show a loading state while roadmap data is fetched
- do not re-fetch on tab switch if data already loaded

### Responsiveness

- UX should not break on narrow screens
- Timeline and Swimlane should collapse gracefully

---

## UX Appearance Guidelines

### Shared

- use consistent color palettes
- milestone readiness/confidence badges must be reused
- capacity indicators (e.g., bars, color heat) should look consistent
- charts and tables must be accessible (labels, text sizes)

### Execution Board

- layout should remain visually close to the previous roadmap

### Timeline

- milestones and sprints should align with calendar axes

### Swimlane

- grid lines, badges, heat indicators

### Dependency

- clear arrows and simple graph layout

---

## Testing Requirements

Codex must add tests to cover:

### Unit Tests

- view model helpers in `roadmapViewModels.ts`
  - transform logic
  - grouping functions
  - capacity aggregations

### Snapshot Tests

- ensure each view renders expected DOM tree given a mock normalized dataset

### Smoke / Integration Tests

- verify tab navigation does not break UI
- verify no console errors with real API data

Do **not** add tests for planning logic; that is out of Phase 3 scope.

---

## Documentation Requirements

Create a new spec:

```
docs/spec/delivery-plan-phase-3-roadmap-multi-view.md
```

This file should include:

- goals of Phase 3
- view definitions
- hierarchical file structure
- decisions and rationale
- data relationships
- component shapes
- testing plan

Also update any existing roadmap docs to reference the multi-view UI.

---

## Acceptance Criteria

Phase 3 is complete only if all are true:

### Execution & Stability

- roadmap data loads once and is shared across all views
- tab navigation is robust and performant
- no console errors or warnings specific to the new views

### View Functionality

- Execution Board still renders as before
- Timeline View accurately reflects dates and milestones
- Swimlane View groups milestones correctly
- Dependency View shows correct dependencies

### Behavioral Consistency

- same data is used across all views
- capacity and readiness indicators are consistent everywhere
- milestone details remain correct across views

### Tests

- unit tests for view models
- snapshot tests for views
- integration smoke tests

---

## Out of Scope for Phase 3

- simulation engine
- scenario analysis
- Monte Carlo forecasts
- capacity optimization views
- velocity inference
- new API routes for planning

---

## Future Extensions (for later phases)

After Phase 3, the roadmap will be ready for:

- rich capacity heatmaps
- milestone risk analytics
- scenario comparisons
- simulation overlays
- multi-project roadmap blending

---

## Final Instruction to Codex

Implement Phase 3 exactly as specified, creating new multi-view roadmap UI components that consume the existing normalized roadmap data and adhere to the acceptance criteria above. Macroscale behavior must remain consistent with the existing roadmap, with no changes to planning or persistence logic.
