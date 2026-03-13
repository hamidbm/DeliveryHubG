Phase 12F.2 Specification
=========================

External Notification Delivery & Delivery Preferences
-----------------------------------------------------

* * * * *

1. Purpose
----------

Phase **12F.2** extends the in-app watcher notifications from Phase 12F.1 to support **external delivery channels** (starting with email), **delivery preferences**, and a **dispatch system** that cleanly separates notification generation from notification delivery.

This allows users to be notified *outside the application* when important portfolio conditions occur (e.g., alerts, watcher triggers, trend changes, health score thresholds).

* * * * *

2. Goals
--------

### Functional

1.  Add support for **email notifications** as the first external delivery channel.

2.  Enable users to configure **delivery preferences** for watchers and notifications.

3.  Implement a **notification dispatch pipeline** that delivers via configured channels.

4.  Track **delivery status** per channel for observability and troubleshooting.

5.  Add UI for delivery preferences.

6.  Apply **anti-spam and cooldown controls** to prevent noisy deliveries.

### Non-Functional

-   Maintain deterministic explainability and minimize unnecessary AI cost.

-   Integrate cleanly with 12F.1's watcher/notification engine.

-   Keep delivery logic decoupled (dispatch system).

-   Preserve backward compatibility with existing in-app notifications.

* * * * *

3. Scope
--------

### In Scope

-   Email notification delivery (external channel)

-   User delivery preferences

-   Dispatch pipeline with retry/delivery status

-   UI for preferences per watcher and global defaults

### Out of Scope for 12F.2

-   Slack/Teams/Messaging integrations (deferred to 12F.3)

-   Daily digest emails (deferred to 12F.4)

-   Cross-user sharing or organization-wide policies

-   Complex alert rule builders

-   Push notifications

* * * * *

4. New Concepts
---------------

### Delivery Channel

A medium through which notifications are sent:

-   `in_app` (default)

-   `email`

(Channels like Slack/Teams will be added later.)

### Delivery Preference

User or watcher-level settings such as:

-   channels to notify on

-   severity thresholds

-   immediate vs digest preferences (digest deferred)

### Delivery Status

State per channel after dispatch:

-   `pending`

-   `sent`

-   `failed`

-   `suppressed`

* * * * *

5. Data Models
--------------

### 5.1 Database Collections / Fields

**Watcher Delivery Preferences**

Extend `ai_watchers`:

interface Watcher {\
  id: string;\
  userId: string;\
  type: string;\
  targetId: string;\
  condition: object;\
  enabled: boolean;\
  deliveryPreferences: {\
    email?: { enabled: boolean; severityMin?: string };\
    in_app?: { enabled: boolean };\
  };\
  createdAt: string;\
  lastTriggeredAt?: string;\
}

**Notification Delivery Tracking**

Add to `ai_notifications`:

interface Notification {\
  id: string;\
  watcherId: string;\
  userId: string;\
  title: string;\
  message: string;\
  relatedEntities?: EntityReference[];\
  relatedInvestigationId?: string;\
  createdAt: string;\
  read: boolean;

  // delivery status per channel\
  delivery: {\
    email?: {\
      status: "pending" | "sent" | "failed" | "suppressed";\
      lastAttemptedAt?: string;\
      lastErrorMessage?: string;\
    };\
    in_app: {\
      status: "sent"; // in_app always delivered by default\
      deliveredAt: string;\
    };\
  };\
}

* * * * *

6. Backend API Changes
----------------------

### 6.1 Update Watcher Endpoints

**PATCH /api/ai/watchers/:id**

Allow updating `deliveryPreferences`.

Request example:

{\
  "deliveryPreferences": {\
    "email": { "enabled": true, "severityMin": "high" },\
    "in_app": { "enabled": true }\
  }\
}

Response:

{ "status": "success" }

* * * * *

7. Notification Dispatch Pipeline
---------------------------------

Add a centralized dispatch manager:

src/services/ai/notificationDispatcher.ts

### Responsibilities

-   Accept newly created notifications

-   For each configured channel, check preferences

-   Apply anti-spam/cooldown logic

-   Dispatch via channel adapters

-   Update `notification.delivery` statuses

* * * * *

### Dispatch Flow

1.  Watcher engine **creates** a notification in `ai_notifications` with delivery.email.status = `pending`.

2.  After creation, push the notification into dispatch pipeline.

3.  Dispatcher loads watcher's preferences.

4.  For each channel:

    -   Check if enabled

    -   Check severityMin (if applicable)

    -   Check cooldown suppression

    -   Call channel adapter

    -   Update status and lastAttemptedAt / lastErrorMessage if failed

    -   Mark `sent` if delivery succeeds

5.  If suppressed due to cooldown, mark as `suppressed`.

* * * * *

8. Anti-Spam and Cooldown Controls
----------------------------------

### Recommendations

-   Do not send duplicate emails for the **same watcher trigger** within a short time frame (e.g., 30 minutes).

-   Do not resend email if previous status is `sent` and the state hasn't changed.

-   Reset cooldown when:

    -   watcher condition has materially changed

    -   severity escalated

    -   user reconfigures preferences

### Implementation

Store watcher `lastTriggeredAt` and track last email dispatch per notification.

Example:

cooldownWindowMs = 30 * 60 * 1000 // 30 minutes

Before sending email:

if (now - lastAttemptedAt < cooldownWindowMs && status === "sent") {\
  mark suppressed\
}

* * * * *

9. Email Channel Adapter
------------------------

Create:

src/services/ai/emailChannel.ts

### Responsibilities

-   Send email using configured SMTP / transactional provider

-   Accept:

    -   to (user email)

    -   subject

    -   body (plain or simple HTML)

-   Return success/failure

### Email Structure

**Subject:**\
`DeliveryHub Notification: <alert or watcher title>`

**Body:**

Hello <user name>,

You have a new DeliveryHub alert:

Title: <title>\
Summary: <message>

See details: <app link to AI Insights or Investigation>

Regards,\
DeliveryHub Intelligence

Include entity links optionally.

* * * * *

10. Backend Delivery Hooks
--------------------------

In dispatcher pipeline, after status update, do:

if (channelAdapter returns  success) {\
  update notification.delivery.email.status = "sent"\
} else {\
  update notification.delivery.email.status = "failed"\
}

Log lastAttemptedAt and lastErrorMessage.

* * * * *

11. User Email Lookup
---------------------

Dispatcher must be able to resolve:

-   user email

-   user display name

from session/profile service.

If email is missing, mark email delivery as `failed` with error.

* * * * *

12. UI: Delivery Preferences
----------------------------

Add UI slice under watcher configuration:

Watcher Delivery Preferences\
---------------------------\
☐ Send email notifications\
Severity (min):\
  [Low] [Medium] [High] [Critical]

-   Email toggle

-   Optional severity filter

-   In-app toggle (on/off)

Integrate into:

WatcherConfigForm.tsx

Allow editing delivery settings alongside watcher conditions.

* * * * *

13. UI: Notification Status Indicator
-------------------------------------

In NotificationCenter:

-   Show icon/status for each channel:

    -   in-app (always shown)

    -   email (pending/sent/failed/suppressed)

-   For email failure status, provide tooltip with brief error info.

Example:

🔔 Blocked Work Rising  - Email: failed

* * * * *

14. Acceptance Criteria
-----------------------

1.  Email can be toggled on/off per watcher.

2.  Notifications are dispatched via email when preferences allow and conditions satisfy watcher logic.

3.  Email dispatch respects severityMin preference.

4.  Dispatch pipeline updates delivery status correctly.

5.  Cooldown logic hides repeated sends within configured window.

6.  Users can edit delivery preferences via UI.

7.  NotificationCenter displays channel statuses.

8.  No regression in existing watcher/notification behavior.

9.  TypeScript builds cleanly (`npx tsc --noEmit`).

* * * * *

15. Files to Create / Modify
----------------------------

### Backend

src/services/ai/notificationDispatcher.ts\
src/services/ai/emailChannel.ts\
src/app/api/ai/watchers/[id]/route.ts (handle deliveryPreferences)\
src/app/api/ai/notifications/route.ts (read statuses)

### Frontend

src/components/ai/WatcherConfigForm.tsx (delivery section)\
src/components/ai/NotificationCenter.tsx (display channel status)

* * * * *

16. Deliverable Summary
-----------------------

Phase **12F.2** adds the first external delivery channel (email) to the notification system, along with user-configurable delivery preferences, a dispatch pipeline with status tracking, and anti-spam safeguards.

This enables users to receive important DeliveryHub AI Intelligence notifications even when not actively using the app.