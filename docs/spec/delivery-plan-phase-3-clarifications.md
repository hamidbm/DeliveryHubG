# Clarifications for Phase 3 Implementation

## 1. Snapshot Tests

Do **not** add a new test framework in this phase.

Use the existing repo testing style and keep Phase 3 testing lightweight.

### Accepted approach

Yes — it is acceptable to implement snapshot-style coverage using:

- `react-dom/server`
- a script such as:
  - `scripts/test-roadmap-views.ts`

### Recommended pattern

- render each roadmap view with a stable mock normalized dataset
- capture the HTML string output
- compare against stored inline or file-based snapshots already committed in the repo
- fail the script if the rendered output changes unexpectedly

### Important constraints

- keep the snapshots small and stable
- do not snapshot huge DOM trees
- snapshot only the meaningful structural output of:
  - Execution Board
  - Timeline View
  - Swimlane View
  - Dependency View

### Do not do this

- do not introduce Jest
- do not introduce a heavy UI testing framework
- do not redesign the test harness just for Phase 3

---

## 2. Dependency View Node Level

For **v1**, use **milestone-level nodes**.

### Decision

- nodes = milestones
- edges = milestone-to-milestone dependency relationships aggregated from underlying work item dependencies

### Why

This is the right scope for Phase 3 because:

- it keeps the graph simpler and more readable
- it is more aligned with roadmap-level planning
- it avoids visual overload
- it still provides useful blocker and sequencing insight

### Aggregation rule

If multiple work-item dependencies exist between items in milestone A and milestone B:

- render a single edge between milestone A and milestone B
- include aggregated counts/metadata on that edge, such as:
  - blocked item count
  - blocking item count
  - critical-path-related count if available

### Optional detail

You may expose drilldown content in a tooltip, popover, or side panel showing the underlying dependency pairs, but the primary graph should remain **milestone-level** in Phase 3.

### Do not do this in v1

- do not use sprint-level nodes as the default graph model
- do not build a full force-directed deep dependency network

---

## 3. Where to Mount the Tabs

Yes — mount the new tab strip **inside `WorkItemsRoadmapView`**.

### Decision

`WorkItemsRoadmapView` should become the **container** for the new multi-view roadmap experience.

### Expected role of `WorkItemsRoadmapView`

It should handle:

- existing roadmap data fetch/load behavior
- shared loading / error states
- creation of normalized roadmap view-model data
- tab state management
- rendering the selected roadmap view

### Expected structure

`WorkItemsRoadmapView` should become a container that renders:

- `RoadmapTabs`
- selected child view:
  - `ExecutionBoardView`
  - `RoadmapTimelineView`
  - `RoadmapSwimlaneView`
  - `RoadmapDependencyView`

### Important rule

Do not duplicate data-fetch logic across the per-view components.

The child view components should receive normalized data and remain mostly presentational.

---

## 4. Roadmap Documentation Updates

Update the roadmap/work-items docs that are already closest to this feature.

### Primary docs to update

Update these if they exist and are currently the relevant docs for roadmap/work-items behavior:

- `docs/wiki/WorkItems.md`
- `docs/wiki/Roadmap.md`

### If only one of them exists or is actively used

Update whichever is the canonical current doc for the roadmap/work-items UI.

### What to add

Add a short section describing:

- the roadmap now supports multiple views
- the four available tabs:
  - Execution Board
  - Timeline
  - Swimlane
  - Dependency
- that all tabs render the same underlying roadmap data
- that the feature is view-layer only and does not change planning data structures

### Also required

Add the implementation spec file for this phase:

- `docs/spec/delivery-plan-phase-3-roadmap-multi-view.md`

### Documentation priority order

1. `docs/spec/delivery-plan-phase-3-roadmap-multi-view.md`
2. `docs/wiki/WorkItems.md`
3. `docs/wiki/Roadmap.md`

If both wiki docs exist, update both.
If only one exists or only one is clearly canonical, update that one plus the Phase 3 spec.

---

## Summary of Decisions

1. Snapshot tests:
   - use `react-dom/server` in a script
   - do not add Jest or another framework

2. Dependency view:
   - use **milestone-level nodes** for v1
   - aggregate work-item dependencies into milestone edges

3. Tab mounting:
   - mount tabs inside `WorkItemsRoadmapView`
   - make that component the container

4. Documentation:
   - create/update `docs/spec/delivery-plan-phase-3-roadmap-multi-view.md`
   - update `docs/wiki/WorkItems.md`
   - update `docs/wiki/Roadmap.md` if present/relevant