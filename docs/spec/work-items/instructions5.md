# Next: Milestone Governance UX v1 (Commit/Frozen UI + Warnings + Override)

## Goal
Make milestone governance usable from the UI by adding:
- ability to change milestone status (especially to COMMITTED) from the Milestone Planning view
- clear display of COMMITTED/Frozen state
- visible warnings for over-capacity and other rollup-driven issues
- an explicit, RBAC-gated override path (allowOverCapacity) when needed

Do not redesign roadmap yet.

---

## Part A — Show Milestone Status + Commit Control (UI)
In `src/components/WorkItemsMilestonePlanningView.tsx`:

1. Display milestone status next to the milestone name:
   - DRAFT / COMMITTED / IN_PROGRESS / DONE / ARCHIVED

2. Add an action control per milestone (or in milestone header) to set status:
   - at minimum support: DRAFT -> COMMITTED
   - optionally: COMMITTED -> IN_PROGRESS
   - DO NOT allow demotion from COMMITTED back to DRAFT unless admin override is explicitly supported (keep simple)

3. The control must:
   - call `PATCH /api/milestones/[id]` with `{ status: 'COMMITTED' }`
   - handle 403/401 and show a clear error if user lacks Admin/CMO role
   - refetch milestones + rollups after success

If you have a shared button/menu component, reuse it.

---

## Part B — Surface Capacity / Health Warnings in the UI
When rollups are fetched, compute and render warnings per milestone:

- Over capacity: `rollup.capacity.isOverCapacity === true`
- Low confidence: `rollup.confidence.band === 'low'`
- Blocked items: `rollup.totals.blockedDerived > 0`
- High/critical risks: `(high + critical) > 0`
- Late: `rollup.schedule.isLate === true`

Render as a compact warning row or warning chips under the milestone chips (do not clutter).

---

## Part C — Explicit Over-Capacity Override Flow (RBAC-Gated)
When a user tries to assign/move an item into a COMMITTED milestone and gets `409 OVER_CAPACITY`:

1. Show a modal or inline dialog:
   - explain the over-capacity numbers from the API response `details`
   - offer two actions:
     - Cancel
     - "Override and assign anyway" (only if the current user is Admin/CMO)

2. If override chosen:
   - retry the same API call but include `allowOverCapacity: true` in the request body
   - log/emit the same request path so server-side auditing can be added later if not already

If the user is not Admin/CMO:
- do not show override option

---

## Part D — Surface Missing Estimate Errors with a Fix Path
When assignment fails with `MISSING_ESTIMATE`:

- show a clear message: storyPoints required for COMMITTED milestones
- provide a quick action:
  - "Open item details" (navigate to /work-items/[id] or open existing details panel)
No need to implement inline storyPoints editing unless trivial.

---

## Part E — API Response Consistency
Ensure all relevant endpoints return:
- `error` codes exactly as used (`OVER_CAPACITY`, `MISSING_ESTIMATE`)
- `details` object on OVER_CAPACITY
Update handlers if needed for consistency between single PATCH and bulk PATCH.

---

## Part F — Tests
Add minimal UI-free tests to ensure:
- milestone PATCH status change rejects non-admin for COMMITTED
- allowOverCapacity works and bypasses over-capacity enforcement
- missing storyPoints returns error code consistently

---

## Deliverables
- Commit milestone status from UI (RBAC gated)
- Warnings visible per milestone using rollup data
- Override assignment flow (RBAC gated)
- Missing estimate guidance UX
- Response consistency + tests