# DeliveryHub Spec: Phase 9.3B – Roadmap Intelligence Overlay

## Objective
Finish the advanced timeline by adding the missing intelligence overlays and polishing the interaction layer without changing planning logic.

## Scope
- Target: **Work Items → Roadmap → Timeline**
- Do not redesign Execution, Swimlane, or Dependency views in this phase.
- Use existing backend intelligence and forecasting outputs as source of truth.

## Delivered Features
- Probabilistic forecast bands (P50–P90) overlayed on committed milestone bars.
- Confidence, on-time probability, and uncertainty indicators visible on milestone rows.
- Environment overlay bands derived from planning metadata.
- Go-Live marker rendered as a distinct timeline marker.
- Milestone-to-milestone dependency arrows derived from explicit `BLOCKS` links.
- Capacity heat overlays based on milestone intelligence.
- Rich milestone tooltips with forecast + intelligence data.
- Grouping (None / Application / Bundle / Owner / Theme).
- Quarter / Month / Sprint / Week zoom controls with adaptive timeline grid.

## Data Sources
- Probabilistic forecasts: `probabilisticForecastByMilestone` (P50/P75/P90 + on-time probability + uncertainty).
- Capacity/risk/readiness: milestone intelligence (roadmap view model).
- Dependencies: aggregated milestone edges from explicit `BLOCKS` links.
- Environment overlay: planning metadata (bundle scope → bundle; application scope → resolved application metadata).

## Components
- `src/components/roadmap/AdvancedTimelineView.tsx`
- `src/components/roadmap/TimelineGrid.tsx`
- `src/components/roadmap/MilestoneBar.tsx`
- `src/components/roadmap/DependencyLayer.tsx`
- `src/components/roadmap/EnvironmentOverlay.tsx`
- `src/components/roadmap/TimelineZoomControls.tsx`
- `src/components/roadmap/MilestoneTooltip.tsx`

## Testing
- `scripts/test-roadmap-advanced-timeline.tsx`
- Snapshot updates via `scripts/gen-roadmap-views-snapshots.tsx`
- `npm run test:api`

## Implementation Status
Status: Completed

Validation:
- advanced timeline overlay components added
- dependency arrows implemented
- environment overlays implemented
- probabilistic forecast bands implemented
- timeline tests added
- `npm run test:api` passes

Notes:
- this phase upgrades the Work Items Timeline view only
- execution board, swimlane, and dependency tabs remain in place
- portfolio timeline reuse is a future extension
