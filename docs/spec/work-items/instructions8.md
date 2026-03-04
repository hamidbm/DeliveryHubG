# Next: Performance + Data Quality Hardening v1 (Milestones/Roadmap Scale)

## Goal
Ensure roadmap-intel and milestone rollups remain fast and correct at enterprise scale by:
- lazy-loading heavy lists
- adding the right indexes
- adding guardrails for missing/invalid planning data
- adding query performance instrumentation

No functional redesigns; this is reliability and scale.

---

## Part A — Lazy Fetch Lists (includeLists=false default)
Change `/api/work-items/roadmap-intel` behavior:

1. Default `includeLists=false`
   - Only return milestones + rollup + readiness + summary counts needed for chips:
     - topBlockersCount, blockedItemsCount, highRisksCount, overdueOpenCount, crossMilestoneBlocksCount
2. Add a second endpoint for lists:
   - `GET /api/work-items/roadmap-intel/lists`
   - params: `milestoneId` (required) + same filters (bundleId/applicationId)
   - returns lists for that milestone only:
     - topBlockers, blockedItems, highRisks, overdueOpen, crossMilestoneBlocks (filtered to that milestone)

3. Update Roadmap UI:
   - initial load calls roadmap-intel (no lists)
   - when user clicks a drilldown button, fetch lists for that milestone and open modal
   - cache lists per milestone in component state (avoid refetching on repeated opens)

Acceptance: roadmap loads quickly even with many milestones; drilldowns fetch only on demand.

---

## Part B — Index Review + Add Missing Indexes
In the DB bootstrap/index creation (where you currently ensure indexes), add/verify:

### Work Items
- `{ milestoneIds: 1, status: 1 }`
- `{ milestoneIds: 1, type: 1, status: 1 }`
- `{ dueAt: 1, status: 1 }` (for overdue queries)
- `{ 'links.type': 1, 'links.targetId': 1 }` (already likely)
- Optional for blockers:
  - `{ 'links.type': 1, milestoneIds: 1 }` (only if queries show benefit)

### Milestones
- `{ status: 1, startDate: 1, endDate: 1 }`

Add a small comment in code explaining which queries each index supports.

---

## Part C — Planning Data Quality Guardrails
Add server-side validation + warnings:

### Work Item validation (on create/update)
- storyPoints:
  - must be non-negative number if provided
  - required when assigning to COMMITTED milestone (already enforced)
- timeEstimateHours:
  - must be non-negative number if provided

### Milestone rollup warnings
Add `rollup.warnings: string[]` for common data issues:
- "N items missing storyPoints in this milestone"
- "N items missing due dates"
- "N risks missing severity"

Expose warning count in UI chips (optional) and show full warnings in drilldown modal.

---

## Part D — Query Performance Instrumentation (Server-side)
For heavy endpoints:
- `/api/work-items/roadmap-intel`
- `/api/milestones/rollups`

Add simple timing instrumentation:
- measure DB query durations and total request time
- log to server console and/or insert into `events` with type:
  - `perf.roadmapIntel`
  - `perf.milestoneRollups`

Include:
- actor (if available)
- params (bundleId/applicationId/milestoneIds count)
- durations
- result sizes (milestones count, items scanned if known)

This is not full APM, just visibility.

---

## Part E — Tests
Update scripts/tests:
- ensure roadmap-intel works with includeLists omitted (defaults false)
- ensure lists endpoint returns expected lists for a seeded dataset
- ensure rollup warnings appear when storyPoints missing in scoped milestone

---

## Deliverables
- roadmap-intel defaults to light payload
- lists endpoint + UI lazy fetch + caching
- indexes added/verified
- rollup warnings for missing planning data
- perf logging events
- updated tests and npm scripts