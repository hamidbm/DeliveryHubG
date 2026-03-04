# Next: Observability v1 (Admin Audit Console for Events + Notifications)

## Goal
Add an Admin UI that lets Admin/CMO users:
- browse and filter events (governance, perf, security)
- browse notifications (what was sent to whom, and why)
- drill into event payloads (readiness snapshot, override reason, perf timings)
This improves supportability and makes governance behavior explainable.

No new planning features; this is ops/observability.

---

## Part A — Confirm Existing Data + APIs
You already have:
- /api/events
- /api/events/unread-count
- /api/notifications
- /api/notifications/[id]/read

Extend/adjust APIs only if needed for Admin queries:
1. /api/events should support filters:
   - type prefix (e.g., perf., milestones., security., dependency.)
   - actor email/userId
   - date range (start/end)
   - resource id (milestoneId/workItemId)
   - limit + pagination cursor
2. /api/notifications should support Admin browsing:
   - by userId/email
   - by type
   - unreadOnly
   - date range
   - limit + pagination cursor

If current endpoints are user-scoped, add Admin-only variants:
- GET /api/admin/events
- GET /api/admin/notifications
Prefer adding admin routes over weakening user routes.

---

## Part B — Admin UI Pages
Add under Admin module navigation (Admin-only):
1. Admin → Audit → Events
2. Admin → Audit → Notifications

Implement UI pages:
- `src/app/admin/audit/events/page.tsx`
- `src/app/admin/audit/notifications/page.tsx`
(or match your existing Admin routing structure)

---

## Part C — Events Page UX (Minimal but useful)
Features:
- Filter bar:
  - type prefix dropdown (All, milestones, perf, security, dependency, reviews)
  - text search (actor, resourceId)
  - date range (optional simple: last 24h, 7d, 30d)
- Table columns:
  - time
  - type
  - actor
  - resource summary
  - short “context” excerpt
- Row click opens a side panel/modal showing:
  - full JSON payload (pretty printed)
  - readiness snapshot if present
  - perf timings if present
  - links to the referenced milestone/work item where possible

---

## Part D — Notifications Page UX
Features:
- Filter bar:
  - recipient (email/userId)
  - type
  - unreadOnly
  - date range presets
- Table columns:
  - time
  - recipient
  - type
  - title
  - severity
  - read/unread
- Row click shows full payload and link target.
Do NOT allow Admin to mark user notifications as read unless explicitly required; default view-only.

---

## Part E — RBAC Enforcement
- Only Admin/CMO can access these pages and endpoints.
- Use centralized policy from authz.ts.

Return 403 with clear code if non-admin hits the endpoints.

---

## Part F — Performance
- Pagination required (cursor or page+limit).
- Default limit 50.
- Do not load huge payloads by default; fetch full event payload on row click if needed.

---

## Part G — Tests
Add API-level tests to ensure:
- non-admin cannot access admin audit routes
- admin can filter by type and date
- pagination works (at least basic)

No UI tests required.

---

## Deliverables
- admin audit API routes (events + notifications) with filters + pagination
- admin UI pages with filterable tables + JSON detail view
- RBAC enforced
- tests + docs update (where to find audit console)