# Next: Milestone Capacity + Estimation Enforcement v1 (Governance)

## Goal
Make milestones drive planning behavior by enforcing:
- required estimation for milestone-scoped work
- capacity guardrails when assigning work to milestones
- a lightweight "commit/freeze" mechanism (RBAC-gated) to prevent scope creep

Do NOT redesign roadmap yet. This is milestone governance.

---

## Part A — Add Estimation Fields to Work Items (if missing)
Verify WorkItem schema in `src/types.ts` and DB writes support:
- `storyPoints?: number`
- `timeEstimateHours?: number`
- `dueAt?: string` (already used for overdue logic)

If fields already exist, skip adding. If not:
- add to `src/types.ts`
- ensure create/update work-item endpoints persist them safely

---

## Part B — Milestone Status Model Upgrade (Minimal)
Milestones currently have status; extend statuses (if not already) to support governance:

- `DRAFT` (default)
- `COMMITTED` (scope is frozen, capacity enforced)
- `IN_PROGRESS`
- `DONE`
- `ARCHIVED`

Rules:
- Only Admin/CMO (or privileged roles) can move a milestone to `COMMITTED`
- Once COMMITTED:
  - adding/removing milestone assignment to work items must be validated (below)
  - optionally allow privileged override with explicit flag

Implementation:
- Update `src/app/api/milestones/[id]/route.ts` PATCH to validate transitions
- Ensure DB stores status as string and existing statuses remain compatible.

---

## Part C — Capacity Enforcement on Milestone Assignment
When a work item is assigned to a milestone (or moved between milestones), enforce:

### Inputs
- milestone.targetCapacity (points)
- computed committedPoints from rollups
- workItem.storyPoints (required for COMMITTED milestones)

### Rules
1. If milestone is `COMMITTED`:
   - Require `storyPoints` on the work item (reject if missing)
   - Reject assignment if it would exceed `targetCapacity` by more than a configurable threshold:
     - default threshold: 0 (strict)
     - allow privileged override via request flag: `{ allowOverCapacity: true }`
2. If milestone is not COMMITTED:
   - Allow assignment even if over capacity, but return warning metadata.

### Where to enforce
You likely have an endpoint that assigns milestones:
- check `src/app/api/work-items/...` routes (e.g., /status, /plan, /bulk, /[id] PATCH)
Identify the exact code path used by Milestone Planning UI to assign/move work items between milestones.
Enforce validation in that API handler (server-side).

### API error shape
Return `409 Conflict` with:
```json
{
  "error": "OVER_CAPACITY",
  "message": "...",
  "details": {
    "milestoneId": "...",
    "targetCapacity": 40,
    "currentCommittedPoints": 39,
    "incomingItemPoints": 5,
    "wouldBeCommittedPoints": 44
  }
}