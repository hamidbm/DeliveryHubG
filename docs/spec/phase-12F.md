Phase 12F Specification
=======================

Watchers, Notifications, and Proactive Monitoring
-------------------------------------------------

* * * * *

1. Purpose
----------

Phase **12F** extends the AI Insights feature by adding **monitoring and notifications**, enabling DeliveryHub to:

-   let users **watch** alerts, trend conditions, and investigations

-   detect **material changes** in portfolio status

-   notify users **proactively** via in-app notifications

-   optionally support external notification channels (email, Slack/Teams) later

This phase turns AI Insights into a **persistent monitoring system** rather than a reactive investigation tool.

* * * * *

2. Goals
--------

### Functional Goals

1.  Enable users to subscribe to **watch conditions** including alerts, saved investigations, and trend triggers.

2.  Detect **significant changes** and generate notifications.

3.  Provide an **in-app notifications center** with read/dismiss behavior.

4.  Provide UI controls to manage watchers.

5.  Support notification delivery via backend.

### Non-Functional Goals

-   Minimize unnecessary API calls or database scans.

-   Reuse existing deterministic signals and trend engine.

-   Keep notification system responsive and debuggable.

-   Avoid spam by triggering notifications only on meaningful changes.

* * * * *

3. Scope
--------

### In Scope

-   Watcher subscription model

-   Notification center UI and API

-   Material-change detection for watcher triggers

-   Backend storage for watchers and notifications

-   Integration with alerts, health score, saved investigations, trend signals

### Out of Scope

-   Email delivery (pushed to 12F.2)

-   SMS/Slack integrations (future phases)

-   Cross-user sharing and public dashboards

-   Complex rule builders or DSL for watchers

* * * * *

4. Concepts and Definitions
---------------------------

| Term | Definition |
| --- | --- |
| **Watcher** | A user subscription to changes in a condition |
| **Notification** | A generated signal sent to UI that a watcher condition occurred |
| **Material-change** | A significant change compared to previous state |
| **Notification Center** | UI panel listing notifications |

* * * * *

5. Watcher Types
----------------

### 5.1 Alert Watcher

Triggered when a specific alert appears or changes severity.

Example:

-   "Notify me when a blocked work alert becomes critical."

### 5.2 Saved Investigation Watcher

Triggered when the refreshed result of a saved investigation changes materially.

Example:

-   "Notify me if the count of overdue work in this investigation increases."

### 5.3 Trend Watcher

Triggered when trend signals meet criteria.

Examples:

-   Unassigned workload rising

-   Blocked tasks trending upward

### 5.4 Health Score Watcher

Triggered when overall health crosses thresholds.

Examples:

-   Health score drops below 60

-   Health score improves above 80

* * * * *

6. Watcher Data Model
---------------------

### Collection

ai_watchers

### Document Schema

interface Watcher {\
  id: string\
  userId: string\
  type: "alert" | "investigation" | "trend" | "health"\
  targetId: string        // e.g., alert type, investigation id\
  condition: object       // typed condition descriptor\
  createdAt: string\
  lastTriggeredAt?: string\
  enabled: boolean\
}

### Example Watcher Instances

#### Alert Watcher

{\
  "type": "alert",\
  "targetId": "blocked-work-rising",\
  "condition": { }\
}

#### Saved Investigation Watcher

{\
  "type": "investigation",\
  "targetId": "inv-123",\
  "condition": {\
    "metric": "overdueWorkCount",\
    "change": "increase"\
  }\
}

#### Trend Watcher

{\
  "type": "trend",\
  "targetId": "unassignedWorkRising",\
  "condition": {\
    "direction": "rising"\
  }\
}

#### Health Watcher

{\
  "type": "health",\
  "targetId": "healthScore",\
  "condition": {\
    "operator": "<=",\
    "threshold": 60\
  }\
}

* * * * *

7. Notification Model
---------------------

### Collection

ai_notifications

### Document Schema

interface Notification {\
  id: string\
  watcherId: string\
  userId: string\
  title: string\
  message: string\
  relatedEntities?: EntityReference[]\
  relatedInvestigationId?: string\
  createdAt: string\
  read: boolean\
}

* * * * *

8. Detection Engine
-------------------

### Trigger Points

Notifications are checked and possibly generated when:

-   a new AI Insights report is generated

-   a saved investigation is refreshed

-   snapshot history changes (trend context)

-   user explicitly requests a check

Material-change detection logic considers:

-   alert additions

-   alert severity changes

-   trend direction changes

-   health score threshold crossing

-   saved investigation answer deltas

* * * * *

9. Backend API
--------------

### 9.1 List Watchers

GET /api/ai/watchers

Response:

{\
  "watchers": Watcher[]\
}

* * * * *

### 9.2 Create Watcher

POST /api/ai/watchers

Request:

{\
  "type": "...",\
  "targetId": "...",\
  "condition": { ... }\
}

Response:

{ "watcherId": "..." }

* * * * *

### 9.3 Update Watcher

PATCH /api/ai/watchers/:id

Request:

{ "enabled": boolean }

* * * * *

### 9.4 Delete Watcher

DELETE /api/ai/watchers/:id

* * * * *

### 9.5 List Notifications

GET /api/ai/notifications

Response:

{\
  "notifications": Notification[]\
}

* * * * *

### 9.6 Mark Notification as Read

PATCH /api/ai/notifications/:id

Request:

{ "read": true }

* * * * *

10. Detection Logic
-------------------

Implement an evaluation engine in:

src/services/ai/notificationEngine.ts

### Core function

evaluateWatchers(portfolioReport: StructuredPortfolioReport, snapshotContext)

This should:

-   load watchers for user

-   compare current state to lastTriggered state

-   detect if conditions are true

-   create notifications if appropriate

-   update lastTriggeredAt

* * * * *

11. Notification Conditions
---------------------------

### 11.1 Alert Watcher

Trigger if:

-   a new alert of that type appears

-   severity of existing alert increases

### 11.2 Saved Investigation Watcher

Trigger if:

-   stored saved investigation answer changes significantly

-   evidence count increases

-   summary metric changes direction

### 11.3 Health Score Watcher

Trigger if:

-   health score satisfies comparative condition\
    (<= threshold, >= threshold)

### 11.4 Trend Watcher

Trigger if:

-   trend direction matches watcher condition

Example:

{\
  "direction": "rising"\
}

* * * * *

12. UI Integration
------------------

### 12.1 Notifications Center

Add new panel under existing AI Insights layout:

Notifications\
-------------\
[Unread Badge Count]\
List of notifications\
- title\
- message\
- timestamp\
- clickable drill-down

### 12.2 Watcher Management UI

Within AI Insights or a new section:

-   List existing watchers

-   Create new watcher from:

    -   alerts

    -   saved investigations

    -   trend signals

    -   health score

-   Edit watcher (enable/disable/delete)

Example creation flow:

[Watch this alert for changes]\
[Watch health score falling below X]

* * * * *

13. UI Components
-----------------

Create:

src/components/ai/NotificationCenter.tsx\
src/components/ai/WatcherList.tsx\
src/components/ai/WatcherConfigForm.tsx

### NotificationCenter Props

-   notifications[]

-   onMarkAsRead

-   onClickNotification (drill-down)

### WatcherList Props

-   watchers[]

-   onDelete

-   onEnableToggle

### WatcherConfigForm Props

-   type

-   targetId

-   condition fields

-   onSave

* * * * *

14. Workflows
-------------

### 14.1 Alert Turned On

User marks watcher for an alert:

1.  Create watcher

2.  Evaluate immediately

3.  If condition is satisfied, generate notification

4.  Notification appears in center

* * * * *

### 14.2 Health Score Change

User watches health score <= threshold:

1.  Save watcher

2.  On each report/regenerate

3.  If health score crosses threshold, notify

* * * * *

### 14.3 Saved Investigation Delta

User watches saved investigation:

1.  After refresh

2.  If key metric changed (e.g., overdue count increased)

3.  Generate notification

* * * * *

### 14.4 Trend Trigger

User watches trend direction:

1.  After trend signals computed

2.  If direction matches condition

3.  Notify

* * * * *

15. Acceptance Criteria
-----------------------

1.  Users can create, update, list, and delete watchers.

2.  Watchers trigger notifications when conditions are met.

3.  Notification center shows unread count and list.

4.  Notifications link to relevant entities or investigations.

5.  Watcher conditions logically map to alert/trend/health changes.

6.  No regressions in AI Insights, trending, query engine, or saved investigations.

7.  TypeScript compilation passes (`npx tsc --noEmit`).

* * * * *

16. Files to Create / Modify
----------------------------

### Backend

src/services/ai/notificationEngine.ts\
src/services/ai/alertDetector.ts (if needed)\
src/services/ai/trendAnalyzer.ts (for watcher integration)\
src/app/api/ai/watchers/route.ts\
src/app/api/ai/notifications/route.ts

### Frontend

src/components/ai/NotificationCenter.tsx\
src/components/ai/WatcherList.tsx\
src/components/ai/WatcherConfigForm.tsx\
src/components/AIInsights.tsx (add entry points)\
src/types/ai.ts (types for watcher & notification)

* * * * *

17. Deliverable Outcome
-----------------------

After Phase **12F**, DeliveryHub AI Insights becomes a **proactive monitoring system** that:

-   lets users watch for evolving portfolio issues

-   alerts users to emerging risks

-   links notifications to investigations and drill-downs

-   gives users fine-grained control over what to monitor

This transitions AI Insights from *reactive reporting* to **continuous portfolio intelligence**.

* * * * *