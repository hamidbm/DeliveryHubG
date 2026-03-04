# Next: Dashboards Integration v1 (Program Health Widget)

## Goal
Add a high-signal “Program Health” section to Dashboards that surfaces:
- overall program summary
- at-risk bundles (top N)
- top cross-bundle blockers (top N)
- at-risk milestones (top N)
with drilldowns linking to /program and /work-items roadmap.

Use /api/program/intel as the only data source.

---

## Part A — Identify Dashboard Entry Point
Locate the Dashboards module UI:
- likely `src/app/` route for dashboards and a component under `src/components/`
Find the component that renders the main dashboard page (portfolio-level rollups).

Add a new section titled:
- "Program Health"

Place it near the top, after any existing global filters.

---

## Part B — Data Fetching
On dashboard load:
- call `GET /api/program/intel?includeLists=false&limit=10`
Render from summary + listCounts (or use includeLists=true if you prefer, but keep it light).

Add a “View details” link that navigates to:
- `/program` (no filters)

For drilldowns within Dashboards:
- either:
  - add "View" buttons that fetch includeLists=true and open a modal
  - or keep Dashboard minimal: just show top counts + “Open Program” link
Prefer minimal first.

---

## Part C — UI Elements
Render:

### C1. Summary strip (same as Program page)
- bundles, milestones, workItems, blocked, high/critical risks, overdue

### C2. Top At-Risk Bundles (table)
Show top 5 bundles by lowest band/metrics:
- band
- blockedDerived
- high+critical
- overdue
- avg confidence
Row click: navigate to `/program?bundleIds=<id>`.

### C3. Top Cross-Bundle Blockers (list)
Show top 5 blockers:
- blocker key/title
- blockedCount
Click: navigate to `/program` and ideally open blockers modal (optional). At minimum link to /program.

### C4. Top At-Risk Milestones (list)
Show top 5 milestones:
- confidence score
- readiness band
- blocked
- risks
Click: navigate to `/work-items` roadmap view filtered to milestone (if supported), else `/program?milestoneIds=<id>`.

Keep it compact, no charts required.

---

## Part D — Optional Filters (If Dashboard already has filters)
If Dashboards already supports bundle/application filters:
- wire those filters to call `/api/program/intel` with bundleIds/milestoneIds accordingly.
If not present, skip for v1.

---

## Part E — Performance
- keep includeLists=false
- only load lists when user clicks into Program page
- do not add new heavy queries

---

## Part F — Tests
At minimum ensure:
- build passes
Optionally add a small API smoke test is already covered; no UI tests needed.

---

## Deliverables
- Program Health widget on Dashboards using /api/program/intel
- Deep links to /program filtered for bundles/milestones
- No new backend endpoints required
- Build passes