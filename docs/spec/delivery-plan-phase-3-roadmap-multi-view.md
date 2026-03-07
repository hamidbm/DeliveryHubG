# Delivery Plan Phase 3: Roadmap Multi-View UI

## Purpose

Phase 3 introduces multiple visual views of the same roadmap data (milestones, sprints, capacity, dependencies) without changing the planning data model.

## Goals

- Provide four roadmap views under a shared tab strip:
  - Execution Board (default)
  - Timeline
  - Swimlane
  - Dependency
- Ensure all views render the same normalized dataset.
- Keep planning logic unchanged.

## Non-Goals

- No changes to planning or capacity logic
- No new persistence model
- No new forecasting / simulation logic

## Component Structure

```
src/components/roadmap/
  RoadmapTabs.tsx
  ExecutionBoardView.tsx
  RoadmapTimelineView.tsx
  RoadmapSwimlaneView.tsx
  RoadmapDependencyView.tsx
  roadmapViewModels.ts
```

`WorkItemsRoadmapView` becomes the container that:
- fetches data once
- builds normalized view model
- owns tab state
- renders the selected view

## View Models

`roadmapViewModels.ts` provides:
- `transformRawRoadmapData`
- `groupMilestonesByPhase`
- `groupItemsByMilestone`
- `buildTimelineRows`
- `buildSwimlaneRows`
- `buildDependencyGraph`

## View Definitions

### 1) Execution Board

- Preserves existing roadmap execution board behavior
- Milestones render as stacked sections
- Sprints, readiness, capacity, and work items remain intact

### 2) Timeline

- Horizontal time-based bars for milestones
- Uses normalized date range
- Displays readiness, capacity, and sprint counts per milestone

### 3) Swimlane

- Milestones grouped by time buckets (quarters)
- Displays readiness, capacity, sprint count, confidence

### 4) Dependency

- Milestone-level nodes only
- Aggregated edges from underlying work-item dependencies
- Simple list/graph representation for v1

## Data Consistency

- Single data fetch in `WorkItemsRoadmapView`
- No re-fetch on tab switch
- Shared normalized dataset passed into all views

## Testing

- `scripts/test-roadmap-views.ts` uses `react-dom/server` snapshots
- Snapshot file: `scripts/__snapshots__/roadmap-views.snap.json`
- No new test frameworks introduced

## Documentation Updates

- `docs/wiki/Modules-WorkItems.md` updated with multi-view roadmap details
- `docs/wiki/Roadmap.md` updated with the tabbed view description

## Acceptance Criteria

- All four views render without console errors
- Execution Board remains the default view
- Timeline and Swimlane use shared data
- Dependency view uses milestone-level nodes
