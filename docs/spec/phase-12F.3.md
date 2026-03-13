Phase 12F.3 Specification
Slack / Teams Delivery Channels and Digest Notifications
1. Purpose
Phase 12F.3 expands the DeliveryHub notification system with:
Slack delivery channel
Microsoft Teams delivery channel
Digest notification workflows
This phase enables organizations to receive DeliveryHub intelligence notifications within their collaboration tools and optionally receive batched summaries instead of immediate alerts.
The design builds on the dispatch pipeline from Phase 12F.2, ensuring new channels can be added without modifying the watcher engine.
2. Goals
Functional Goals
Add Slack as an external notification channel.
Add Microsoft Teams as an external notification channel.
Add optional digest notification mode for watchers.
Extend dispatcher to support multiple channel adapters.
Allow users to configure channel delivery preferences.
Provide digest summary generation.
Non-Functional Goals
Maintain backward compatibility with 12F.1 and 12F.2.
Keep channel adapters modular.
Ensure notification dispatch remains deterministic.
Prevent notification spam via batching/digest.
3. Scope
In Scope
Slack webhook integration
Microsoft Teams webhook integration
Channel adapters for both
Digest notification mode
User delivery preferences UI updates
Dispatcher updates
Out of Scope
OAuth Slack apps
Teams Graph API integration
mobile push notifications
enterprise notification governance
scheduled background workers beyond simple cron
4. Updated Delivery Channel Model
Extend delivery channels:
in_app
email
slack
teams
5. Updated Notification Delivery Structure
Extend notification delivery model in ai.ts:
interface NotificationDeliveryStatus {
  status: "pending" | "sent" | "failed" | "suppressed"
  lastAttemptedAt?: string
  lastErrorMessage?: string
}

interface NotificationDelivery {
  in_app: {
    status: "sent"
    deliveredAt: string
  }
  email?: NotificationDeliveryStatus
  slack?: NotificationDeliveryStatus
  teams?: NotificationDeliveryStatus
}
Notifications will now track delivery status per channel.
6. Updated Watcher Delivery Preferences
Extend watcher delivery preferences:
interface WatcherDeliveryPreferences {
  in_app?: { enabled: boolean }

  email?: {
    enabled: boolean
    severityMin?: "low" | "medium" | "high" | "critical"
  }

  slack?: {
    enabled: boolean
    webhookUrl?: string
    severityMin?: "medium" | "high" | "critical"
  }

  teams?: {
    enabled: boolean
    webhookUrl?: string
    severityMin?: "medium" | "high" | "critical"
  }

  digest?: {
    enabled: boolean
    frequency: "hourly" | "daily"
  }
}
7. Slack Channel Adapter
Create:
src/services/ai/slackChannel.ts
Responsibilities
Send notification payload to Slack webhook URL.
Format message using Slack message blocks.
Payload Format
Example Slack message:
DeliveryHub Alert

Title: Blocked Work Rising
Severity: High

Summary:
Blocked tasks increased by 5 in the past week.

View in DeliveryHub:
https://app/ai-insights
Slack Adapter Interface
async function sendSlackNotification(
  webhookUrl: string,
  notification: Notification
): Promise<boolean>
Return true if success, otherwise throw error.
8. Microsoft Teams Channel Adapter
Create:
src/services/ai/teamsChannel.ts
Responsibilities
Send notification payload to Teams webhook URL.
Teams Message Format
Use Adaptive Card JSON.
Example content:
DeliveryHub Notification

Title: Blocked Work Rising
Severity: High
Summary: Blocked tasks increased by 5.

Open DeliveryHub
Teams Adapter Interface
async function sendTeamsNotification(
  webhookUrl: string,
  notification: Notification
): Promise<boolean>
9. Dispatcher Updates
Update:
notificationDispatcher.ts
Dispatcher must:
Inspect watcher deliveryPreferences.
Determine which channels are enabled.
Evaluate severity filters.
Dispatch to channel adapters.
Pseudo-flow:
create notification
→ dispatch pipeline

for each channel:
  check preference enabled
  check severityMin
  check cooldown
  call channel adapter
  update delivery status
Add Slack + Teams logic alongside email.
10. Digest Notification Mode
Digest mode allows watchers to accumulate notifications and receive them in a batched summary.
Behavior
If digest.enabled == true:
immediate external delivery is suppressed
notification stored normally
added to digest queue
Digest generation will send a summary message instead of individual notifications.
11. Digest Data Model
Add new collection:
ai_notification_digest_queue
Example schema:
interface NotificationDigestItem {
  id: string
  userId: string
  notificationId: string
  createdAt: string
}
12. Digest Generation Service
Create:
src/services/ai/digestService.ts
Responsibilities
aggregate queued notifications
group by user
group by watcher or alert category
generate digest message
Example Digest Message
DeliveryHub Daily Digest

Alerts:
- Blocked Work Rising
- Milestone Risk Increasing

Trend Changes:
- Unassigned Workload Rising

Investigations Updated:
- "Which bundles have the most unassigned work?"

Open AI Insights:
https://app/ai-insights
13. Digest Scheduler
Simple scheduled execution.
Options:
setInterval scheduler
or cron via environment scheduler
Config:
DIGEST_INTERVAL_MINUTES
Digest service should:
fetch queued notifications
group by user
send summary via preferred channel
clear queue entries
14. UI Updates
Update:
WatcherConfigForm.tsx
Add options:
Slack delivery
Teams delivery
Digest mode
Example UI:
Delivery Channels

☑ In-App
☑ Email
☑ Slack
☐ Microsoft Teams

Digest Options

☐ Send as digest
Frequency: Daily
15. Notification Center Updates
Update:
NotificationCenter.tsx
Display delivery status chips:
In-App ✔
Email ✔
Slack ✔
Teams Pending
For digest notifications:
Delivery Mode: Digest
16. Configuration Environment Variables
Add support for:
NOTIFICATION_SLACK_MODE=webhook|disabled
NOTIFICATION_TEAMS_MODE=webhook|disabled
NOTIFICATION_DIGEST_ENABLED=true|false
DIGEST_INTERVAL_MINUTES=60
17. Acceptance Criteria
Slack channel adapter sends notifications via webhook.
Teams channel adapter sends notifications via webhook.
Dispatcher properly routes notifications to Slack and Teams when enabled.
Severity filtering works for new channels.
Digest mode queues notifications instead of sending immediately.
Digest scheduler sends grouped messages.
UI supports configuring Slack, Teams, and digest preferences.
Notification center shows channel delivery status.
No regressions to existing email or in-app delivery.
TypeScript compilation passes (npx tsc --noEmit).
18. Files to Create or Modify
Backend
src/services/ai/slackChannel.ts
src/services/ai/teamsChannel.ts
src/services/ai/digestService.ts
src/services/ai/notificationDispatcher.ts
src/types/ai.ts
Frontend
src/components/ai/WatcherConfigForm.tsx
src/components/ai/NotificationCenter.tsx
19. Deliverable Summary
Phase 12F.3 adds:
Slack notification delivery
Microsoft Teams notification delivery
digest notification workflows
expanded watcher delivery preferences
dispatch pipeline supporting multiple channels
This transforms DeliveryHub notifications into a multi-channel operational intelligence system.