# Next: Notifications v1 (Governance + Readiness Alerts)

## Goal
Implement event-driven notifications so program governance issues are pushed to users instead of discovered manually:
- milestone status changes and overrides
- milestone readiness blocked attempts
- over-capacity overrides on committed milestones
- new cross-bundle blocker creation (BLOCKS edge across bundles/milestones)

Use existing events + notifications routes/collections if present. Keep it minimal but real.

---

## Part A — Confirm Current Notification Infrastructure
From build output there are routes:
- `/api/notifications`
- `/api/notifications/[id]/read`

Find existing code and data model:
- notification storage collection name (create `notifications` if none exists)
- fields currently used (id, userId, type, title, body, createdAt, readAt, link, severity)

If notifications are stubbed, implement the missing persistence.

---

## Part B — Notification Types (v1)
Define types and payloads:

1. `milestone.status.changed`
- when milestone transitions (COMMITTED/IN_PROGRESS/DONE)
- recipients:
  - Admin/CMO
  - bundle owners (from bundle assignments) for bundles impacted by milestone scope (if determinable)
- include:
  - milestone name/id
  - oldStatus -> newStatus
  - link to milestone planning view or roadmap

2. `milestone.status.override`
- when allowOverride is used (readiness override)
- recipients:
  - Admin/CMO
- include:
  - overrideReason
  - readiness snapshot band/score
  - link to milestone

3. `milestone.readiness.blocked`
- when user attempts transition and gets blocked (409)
- recipients:
  - the actor (so they see it)
  - Admin/CMO
- include:
  - blockers list summary (top 3)
  - link back to milestone planning view

4. `milestone.capacity.override`
- when allowOverCapacity is used to assign into COMMITTED milestone
- recipients:
  - Admin/CMO
  - bundle owner (if bundleId on work item)
- include:
  - milestone
  - item key/title
  - capacity numbers from API details

5. `dependency.crossbundle.created`
- when a BLOCKS edge is created and blocker.bundleId != blocked.bundleId (or blocker milestone differs)
- recipients:
  - Admin/CMO
  - both bundle owners (blocker bundle + blocked bundle) if available
- include:
  - blocker item key/title
  - blocked item key/title
  - link to Program page filtered by bundleIds (or to Work Item details)

Keep payloads short: title, body, link.

---

## Part C — Event → Notification Pipeline
Implement server-side conversion in one place.

Option 1 (preferred for MVP):
- When writing events, also write notifications synchronously in the same request.

Where to hook:
- milestone PATCH handler (already emits milestone statuschanged)
- work-item PATCH/bulk handlers where allowOverCapacity is accepted
- link creation endpoint when BLOCKS edge is created

Implementation steps:
1. Add helper in `src/services/notifications.ts`:
   - `createNotificationsForEvent(eventType, payload, actor, db)`
   - resolves recipients and inserts notifications

2. Add recipient resolution:
   - Admin/CMO: query users by role
   - Bundle owners: use `bundle_assignments` with role OWNER (or equivalent)
   - Actor: from auth context

3. Insert into `notifications` collection:
```ts
{
  _id,
  userId,
  type,
  title,
  body,
  link,
  severity: 'info'|'warn'|'critical',
  createdAt,
  readAt?: string
}