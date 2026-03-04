# Next Implementation: Milestone Engine v1 (Rollups + Capacity + Confidence)

## Goal
Implement milestone intelligence that the roadmap and portfolio views can depend on:
- milestone rollups (work counts, done vs remaining, blocked, risks)
- capacity math (targetCapacity vs committed workload)
- confidence scoring (simple but consistent)
- expose via API and minimal UI surfaces

This must build on the new canonical dependency model and derived `isBlocked`.

---

## Part A — Lint Stability (Quick Fix)
Add a deterministic lint script to avoid env-specific `next lint` directory issues.

### Changes
1. In `package.json` add:
   - `"lint:ci": "next lint ."`

2. Update README/dev docs to use `npm run lint:ci` for consistency.

(Keep existing `lint` script as-is.)

---

## Part B — Milestone Rollups (Server-side Foundation)

### Data Inputs
- `milestones` collection: `_id`, `startDate`, `endDate`, `status`, `targetCapacity`
- `workitems` collection: `milestoneIds`, `storyPoints`, `timeEstimate`, `status`, `type`, `isArchived`
- dependency system: derived `isBlocked` and blockers from canonical `BLOCKS`

### Work Scope Rules
Work items included in milestone rollup:
- Include: EPIC, FEATURE, STORY, TASK, BUG, SUBTASK, DEPENDENCY, RISK (for risk counts)
- Exclude archived: `isArchived !== true`

Capacity workload calculation:
- Primary metric: `storyPoints` (sum where defined)
- Fallback metric: `timeEstimate` (hours) when storyPoints is missing
- For v1, compute both:
  - `committedPoints`
  - `committedHours`
Do not mix them; keep separate totals.

Done/Remaining:
- DONE is terminal for rollups.
- `completedPoints` sum of storyPoints where status == DONE
- `remainingPoints = committedPoints - completedPoints` (clamp at >= 0)

Blocked:
- `blockedDerivedCount`: count of items where derived `isBlocked === true`
- `blockedStatusCount`: count of items where status === BLOCKED
- Return both.

Risks:
- only for `type === RISK` and status != DONE
- use `risk.severity` (already computed on save) or compute if missing
- counts by severity: low/medium/high/critical

Dependencies:
- count open DEPENDENCY items where `dependency.blocking !== false` and status != DONE

Overdue:
- count open items with `dueAt < now`

Schedule slip:
- if milestone.endDate exists and today > endDate and remainingPoints > 0 (or remainingHours > 0) then `isLate = true` and `slipDays`

### Implement in DB Layer
In `src/services/db.ts`:
1. Add:
   - `computeMilestoneRollup(milestoneId: string)`
   - `computeMilestoneRollups(milestoneIds: string[])`

Implementation notes:
- Query all workitems for milestoneIds in one pass.
- Compute derived isBlocked in batch using the canonical BLOCKS inverse query (same approach used in list views).
- Keep computations pure and deterministic.

### Rollup Shape (API)
Return:

```ts
type MilestoneRollup = {
  milestoneId: string;
  totals: {
    items: number;
    openItems: number;
    doneItems: number;
    blockedDerived: number;
    blockedStatus: number;
    overdueOpen: number;
  };
  capacity: {
    targetCapacity?: number;           // from milestone.targetCapacity
    committedPoints: number;
    completedPoints: number;
    remainingPoints: number;
    committedHours: number;
    completedHours: number;
    remainingHours: number;
    isOverCapacity: boolean;           // if targetCapacity defined and committedPoints > targetCapacity (v1 uses points)
    capacityUtilization: number | null;// committedPoints/targetCapacity if targetCapacity else null
  };
  risks: {
    openBySeverity: { low: number; medium: number; high: number; critical: number };
    openTotal: number;
  };
  dependencies: {
    openBlockingDependencies: number;
  };
  schedule: {
    startDate?: string;
    endDate?: string;
    isLate: boolean;
    slipDays: number;
  };
  confidence: {
    score: number;                     // 0..100
    band: 'high' | 'medium' | 'low';
    drivers: Array<{ key: string; detail: string }>;
  };
};