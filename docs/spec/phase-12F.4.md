Phase 12F.4 Specification
Notification Governance, Operational Controls & System Reliability
1. Purpose
Phase 12F.4 enhances the watcher & notification system by introducing governance, rate limits, quiet hours, delivery controls, observability, and administrative tooling. After this phase, DeliveryHub notifications will be stable, manageable, and suitable for production environments with many watchers and users.
This phase does not add new notification channels or forecasting intelligence—those belong in future phases. It ensures the monitoring workflows implemented in 12F.1–12F.3 operate reliably and within configurable policies.
2. Goals
Functional Goals
Define and enforce notification and watcher policies (rate limits, quotas).
Support quiet hours and delivery suppression windows.
Add delivery retry and failure handling with backoff.
Add observability (tracking, logs, metrics).
Add basic admin dashboard for notification operations.
Support notification replay/retry workflows.
Non-Functional Goals
Integrate with existing dispatcher and notification engine.
Avoid changes to core intelligence logic.
Ensure performance and operational safety.
Maintain TypeScript correctness.
3. Scope
In Scope
Policy enforcement (max watchers, max notifications, channel limits).
Quiet hours management.
Delivery retry logic and backoff.
Observability via structured logs and metrics.
Admin tools for notification monitoring and retries.
Out of Scope
External integrations beyond Slack/Teams/email.
Machine-learning based prediction of notification priority.
SSO or enterprise permission governance.
4. Configuration & Policy
4.1 System Configuration
Add the following environment variables (defaults shown):
MAX_WATCHERS_PER_USER = 100
MAX_NOTIFICATIONS_PER_USER_PER_HOUR = 200
MAX_DIGEST_ITEMS = 50
NOTIFICATION_RETRY_MAX_ATTEMPTS = 3
NOTIFICATION_RETRY_BACKOFF_MS = 60000   # 1 minute
QUIET_HOURS_START = "22:00"
QUIET_HOURS_END = "07:00"
4.2 Policy Definitions
Watcher Limits
A user may not create more than MAX_WATCHERS_PER_USER.
Attempting to create beyond the limit returns:
{ "error": "Watcher quota exceeded" }
Notification Rate Limits
A user should not receive more than MAX_NOTIFICATIONS_PER_USER_PER_HOUR.
Excess notifications are:
suppressed
stored for digest if digest mode enabled
Return status in notification delivery:
delivery[channel].status = "suppressed"
5. Quiet Hours
Purpose
Quiet hours suppress immediate external notifications during configured window.
Behavior
If current time is between QUIET_HOURS_START and QUIET_HOURS_END:
email/slack/teams immediate deliveries are suppressed
notifications are queued for digest if digest is enabled
in-app notifications continue normally
Implement quiet hours evaluation at dispatch time in:
notificationDispatcher.ts
6. Delivery Retry & Backoff
Implement retry logic in dispatcher:
For channels with failure and status "failed":
retry up to NOTIFICATION_RETRY_MAX_ATTEMPTS
exponential backoff based on NOTIFICATION_RETRY_BACKOFF_MS
Add fields to track retry attempts:
In ai_notifications.delivery.<channel>:
attempts: number
nextRetryAt?: string
Dispatcher logic pseudocode:
if status == "failed" and attempts < max:
  schedule retry at now + backoff
  increment attempts
else if attempts >= max:
  mark permanently failed
7. Observability & Metrics
Structured Logs
Add structured log events in:
src/services/ai/notificationDispatcher.ts
Examples:
notification_dispatch_attempt
notification_dispatch_success
notification_dispatch_failure
notification_suppressed
notification_rate_limited
notification_quiet_hours
digest_generated
digest_sent
Each log includes:
userId
watcherId
notificationId
channel
timestamp
status
errorMessage (if applicable)
Metrics Collection
Emit counters/counters such as:
notifications.sent.{channel}
notifications.failed.{channel}
notifications.suppressed
notifications.retried
watchers.created
watchers.deleted
Metrics should be exposed via whatever metrics system exists or logged for later ingestion.
8. Admin Dashboard – Notification Operations
Create an Admin UI Panel for observability and control.
File
src/components/admin/NotificationAdminPanel.tsx
Features
Notification Log Table
columns:
notificationId
userId
watcherId
title
channel statuses (in_app/email/slack/teams)
last delivery attempt
current status
createdAt
Filter & Search
filter by channel, status, time range, user
Retry Failed Notifications
action button per row:
Retry
Bulk Retry
select multiple and retry
Force Send Suppressed
optionally force a suppressed notification to send (e.g., tests)
9. Notification Replay / Retry Endpoints
Add backend APIs for admin usage:
9.1 Retry Notification
POST /api/admin/notifications/:id/retry
Behavior:
Only retries channels in failure status
Uses dispatch logic with current preferences
Response:
{ status: "success" }
9.2 Force Deliver
POST /api/admin/notifications/:id/force-deliver
Force delivery even if suppressed due to rate/quiet hours.
10. Updating Dispatcher
Modify:
notificationDispatcher.ts
Responsibilities:
Enforce watcher limits
Enforce notification rate limits per user
Implement quiet hours check
Implement retry logic and backoff
Log structured events
Update delivery status fields
Pseudo structure:
for channel in enabledChannels:
  if within quiet hours:
    suppress or queue
  else if rate limited:
    suppress
  else:
    attempt dispatch
    on failure:
      if attempts < max:
        schedule retry
      else:
        permanent failure
11. UI Enhancements
11.1 Watcher Panel Updates
In:
WatcherList.tsx
WatcherConfigForm.tsx
Add:
show watcher usage counts (e.g., “3/100 watchers used”)
validation preventing creation beyond quota
11.2 Admin Panel Link
Preview count badges in header linking to admin panel (if user is admin).
12. Acceptance Criteria
Watcher quota enforced per user.
Notification rate limits enforced per user/hour.
Quiet hours correctly suppress external delivery.
Retry/backoff works and permanent failures marked.
Observability logs emitted in structured form.
Admin dashboard displays notification table and allows retries.
Notification replay APIs function as expected.
No regression in previous watch/dispatch channels (in_app/email/slack/teams/digest).
UI prevents watcher creation above quota.
TypeScript build (npx tsc --noEmit) passes.
13. Files to Create or Modify
Backend
src/services/ai/notificationDispatcher.ts
src/services/ai/notificationPolicy.ts
src/services/ai/notificationRetryScheduler.ts
src/app/api/admin/notifications/route.ts
src/app/api/admin/notifications/[id]/retry/route.ts
src/app/api/admin/notifications/[id]/force-deliver/route.ts
src/types/ai.ts
Frontend
src/components/admin/NotificationAdminPanel.tsx
src/components/ai/WatcherList.tsx
src/components/ai/WatcherConfigForm.tsx
src/components/ai/NotificationCenter.tsx
14. Deliverable Summary
Phase 12F.4 completes the operational readiness of the notification system by providing governance, rate limits, quiet hours, retry logic, observability, and admin tooling.
After this phase DeliveryHub notifications will be:
reliable
manageable
controllable
observable
suitable for enterprise usage