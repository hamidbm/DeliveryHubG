# Delivery Plan Phase 2: Planning Engine Refactor

## Purpose

Phase 2 extracts the pure planning logic out of `deliveryPlanGenerator.ts` into focused, reusable modules. The generator becomes a thin orchestration + persistence layer, while planning logic becomes testable and reusable.

## Background

Phase 1 introduced capacity-aware intake, derived milestone duration, and configurable tasks-per-story. These additions increased the size and responsibility of `deliveryPlanGenerator.ts`. Phase 2 refactors the planning logic into dedicated modules to reduce coupling and enable future enhancements.

## Decision: Canonical Types Location (Deviation)

The original Phase 2 proposal suggested `src/services/planningEngine/types.ts`.  
We instead place the canonical planning types in `src/types.ts`.

Rationale:
- Avoid duplicate type definitions and import churn.
- Keep a single source of truth for planning types across UI, API, and services.
- Prevent circular dependencies by centralizing types.

This is an intentional deviation and should remain stable unless a future architectural shift requires otherwise.

## Refactor Scope

### 1. Milestone Planning
Owned by `src/services/milestonePlanner.ts`:
- timeline normalization
- milestone duration derivation
- milestone date slicing
- milestone generation
- shared date helpers

### 2. Sprint Planning
Owned by `src/services/sprintPlanner.ts`:
- sprint generation
- sprint sequencing / naming
- assignment to milestones
- milestone sprint count summaries

### 3. Capacity Logic
Owned by `src/services/capacityPlanner.ts`:
- intake-first capacity resolution
- bundle fallback handling
- milestone target capacity calculation
- capacity summary construction

### 4. Backlog Generation
Owned by `src/services/backlogPlanner.ts`:
- project size defaults
- backlog shape defaults
- epic / feature / story / task generation
- tasks-per-story targeting

### 5. Dependency Skeleton
Owned by `src/services/dependencyPlanner.ts`:
- pure dependency skeleton structure helpers

### 6. Pure Planning Orchestration
Owned by `src/services/planningEngine.ts`:
- assembles preview output using the above modules
- no DB writes; accepts injected helpers for capacity and owner suggestions

## API / Persistence Responsibilities

`src/services/deliveryPlanGenerator.ts` is responsible for:
- auth / scope resolution
- preview persistence (`work_plan_previews`)
- artifact creation (`milestones`, `sprints`, `workitems`, `work_roadmap_phases`)
- dependency link persistence
- event emission

## Acceptance Criteria

- `deliveryPlanGenerator.ts` no longer contains core planning logic.
- All planning logic lives in dedicated modules.
- Canonical types are in `src/types.ts`.
- No circular imports introduced.
- Preview output remains equivalent to Phase 1 behavior.

## Manual Test Checklist

- Create a plan preview from the UI and confirm capacity summary + derived duration.
- Create a draft plan and confirm milestones + sprints + work items are created.
- Enable dependency skeleton option and confirm a simple dependency link is created.
