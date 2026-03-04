# Next: Minimal UI Surfacing for Milestone Rollups (No Roadmap Redesign)

## Goal
Expose milestone rollups in the UI so milestone intelligence is visible and testable, without redesigning roadmap UI.

Use the existing GET /api/milestones/rollups endpoint you added.

---

## Where to implement
Primary:
- Work Items planning surface (the view that already deals with milestones), likely:
  - `src/app/work-items/...` and/or components under `src/components/` that render milestone selection / planning.

Secondary (optional if easy):
- Roadmap view header summary when a milestone is selected.

Do NOT do a full roadmap redesign.

---

## UI Requirements (Minimal)
For each milestone in the list (or the selected milestone summary panel), show:

1. Confidence:
   - `rollup.confidence.score` and `rollup.confidence.band`

2. Capacity:
   - If `targetCapacity` exists: show `committedPoints / targetCapacity` and utilization percent
   - Else: show committedPoints only

3. Execution health:
   - blocked derived count: `rollup.totals.blockedDerived`
   - overdue open: `rollup.totals.overdueOpen`

4. Risk signal:
   - open high + critical risks:
     - `rollup.risks.openBySeverity.high + rollup.risks.openBySeverity.critical`

5. Schedule signal:
   - if `rollup.schedule.isLate` show slipDays

Make it compact and consistent with current UI style (small stat chips or a single-row summary).

---

## Data Fetching
- Add a small client fetcher:
  - when milestones are loaded, request rollups for the visible milestone ids via:
    - `/api/milestones/rollups?milestoneIds=id1,id2,...`
- Cache in component state; avoid refetching repeatedly unless milestone list changes.
- Handle partial failure gracefully:
  - show placeholders and keep the rest of UI usable.

---

## API Compatibility
- Do not remove existing `/api/milestones` usage.
- Keep rollups as optional enhancement.
- If there are many milestones, batch milestoneIds and/or add pagination later; for now assume reasonable count.

---

## No Styling Overreach
- No large redesign
- No new navigation
- No charting required
- Just small summary blocks next to milestone names or in a milestone detail header.

---

## Acceptance Criteria
- Milestone list renders with rollups without breaking any existing views.
- Confidence/capacity/blocked/risk indicators update correctly when data changes.
- No new build errors.