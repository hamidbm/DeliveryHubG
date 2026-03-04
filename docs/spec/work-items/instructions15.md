# Next: API Regression Test Harness v1 (Automated, Repeatable)

## Goal
Turn the current script-style tests into a repeatable regression suite for critical API handlers.
Focus on correctness and preventing governance regressions.

Do not add new product features; this is quality infrastructure.

---

## Part A — Create a Shared Test Harness Utility
Create `scripts/test-harness.ts` that provides:

- spin up a dedicated test DB name (unique suffix)
- connect helpers (MongoClient)
- seed helpers:
  - createUser(role, bundleAssignments?)
  - login helper or direct JWT creation (match app auth)
  - createBundle/createMilestone/createWorkItem
  - createLink (BLOCKS) through the API
- HTTP client helper for Next API routes:
  - simple fetch wrapper with baseUrl and cookie injection

Ensure the harness:
- drops the DB at the end even on failure (try/finally)
- prints structured output for failures

---

## Part B — Consolidate Existing Tests Under One Command
Move/adjust existing scripts to use the harness:

- test:workitem-links
- test:milestone-governance
- test:milestone-readiness
- test:roadmap-intel
- test:rollup-warnings
- test:program-intel
- test:rbac

Make each test:
- deterministic (seed fixed data)
- isolated (fresh DB)
- fast (avoid large seed sets)

Add `npm run test:api` that runs them all sequentially:
- `tsx scripts/test-api.ts` (or similar)
- exits non-zero on first failure

---

## Part C — Add Coverage for Event/Notification Side Effects
Add regression asserts for:
- events created on:
  - milestone status changes
  - readiness blocked attempts
  - overrides
  - perf events (optional)
- notifications created for:
  - over-capacity override
  - cross-bundle blocks
  - readiness blocks

These are high-value because side effects can silently regress.

---

## Part D — Add Basic Contract Checks (Schema Drift Protection)
For key endpoints, validate response shapes minimally:

- /api/work-items/[id] includes:
  - isBlocked boolean
  - linkSummary grouping fields

- /api/milestones/rollups returns MilestoneRollup with:
  - confidence + schedule + warnings

- /api/work-items/roadmap-intel returns:
  - listCounts always
  - lists only when includeLists=true

- /api/program/intel returns:
  - bundleRollups + aggregated + band

Keep these checks light; focus on breaking changes.

---

## Part E — Docs + CI Hint
Update `docs/wiki/Development.md`:
- how to run: `npm run test:api`
- expected env vars / requirements

If you have a CI pipeline, add a note on running this suite.

---

## Deliverables
- shared test harness utility
- consolidated deterministic API tests
- single command: npm run test:api
- added asserts for event/notification side effects
- updated dev docs