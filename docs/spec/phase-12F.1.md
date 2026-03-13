Phase 12F.1 Specification
=========================

Watchers & In-App Notification Center
-------------------------------------

* * * * *

1. Purpose
----------

Phase **12F.1** establishes the foundational infrastructure for **watcher subscriptions** and an **in-app notification center**.

This phase enables users to:

-   subscribe (watch) portfolio conditions (alerts, health score, saved investigations, trends)

-   have those subscriptions evaluated when data/state changes

-   see notifications in a dedicated UI panel when watched conditions trigger

This phase **excludes external delivery (email, Slack, SMS)** and advanced scheduling rules, which will come in later subphases.

* * * * *

2. Goals
--------

### Functional Goals

1.  Create APIs to manage watchers (create, list, update, delete).

2.  Detect watcher conditions during normal AI Insights operations.

3.  Create stored notifications when watcher conditions occur.

4.  Provide APIs to list notifications and mark them as read.

5.  Provide a UI "Notifications Center" that shows unread and read notifications.

6.  Provide UI controls to manage watcher subscriptions.

### Non-Functional Goals

-   Minimize new backend query paths

-   Integrate cleanly with existing snapshot/trend/alert pipeline

-   Ensure notifications are actionable and link back to AI Insights context

* * * * *

3. Scope
--------

### In Scope

-   watcher subscription data model

-   notifications data model

-   backend APIs for watchers & notifications

-   in-app notification center UI

-   watcher evaluation on relevant triggers:

    -   after report regeneration

    -   after saved investigation refresh

    -   after trend signals computed

### Out of Scope (for 12F.1)

-   external notification delivery (email/Slack)

-   cross-user notification sharing

-   scheduled / background polling

-   complex rules builders

* * * * *

4. Data Models
--------------

### 4.1 Watcher

Add to type definitions in:

src/types/ai.ts

export type WatcherType =\
  | "alert"\
  | "investigation"\
  | "trend"\
  | "health";

export interface Watcher {\
  id: string;\
  userId: string;\
  type: WatcherType;\
  targetId: string; // e.g., alert id, investigation id, trend key, health metric\
  condition: Record<string, any>; // typed per watcher type\
  enabled: boolean;\
  createdAt: string;\
  lastTriggeredAt?: string;\
}

### 4.2 Notification

Add:

export interface Notification {\
  id: string;\
  watcherId: string;\
  userId: string;\
  title: string;\
  message: string;\
  relatedEntities?: EntityReference[];\
  relatedInvestigationId?: string;\
  createdAt: string;\
  read: boolean;\
}

* * * * *

5. Database Changes
-------------------

Add new collections:

ai_watchers\
ai_notifications

Indexes:

-   `ai_watchers`: userId, type

-   `ai_notifications`: userId, watcherId, read

* * * * *

6. Watcher Types & Conditions
-----------------------------

### 6.1 Alert Watcher

-   targetId: `alertType` or `alertId`

-   condition: empty or matching specifics

-   triggers when a new alert of that type appears or severity escalates

### 6.2 Investigation Watcher

-   targetId: saved investigation ID

-   condition: semantic descriptor, e.g., metric change direction

    { "metric": "overdueWorkItems", "change": "increase" }

### 6.3 Trend Watcher

-   targetId: trend signal key (e.g., `"unassignedWorkItems"`)

-   condition:

    { "direction": "rising" }

### 6.4 Health Watcher

-   targetId: `"healthScore"`

-   condition:

    { "operator": "<=", "threshold": 60 }

* * * * *

7. Backend API Endpoints
------------------------

### 7.1 List Watchers

GET /api/ai/watchers

Response:

{\
  "status": "success",\
  "watchers": Watcher[]\
}

* * * * *

### 7.2 Create Watcher

POST /api/ai/watchers

Request:

{\
  "type": "alert",\
  "targetId": "blocked-work-rising",\
  "condition": {}\
}

Response:

{\
  "status": "success",\
  "watcherId": "..."\
}

* * * * *

### 7.3 Update Watcher

PATCH /api/ai/watchers/:id

Payload:

{ "enabled": true }

Response:

{ "status": "success" }

* * * * *

### 7.4 Delete Watcher

DELETE /api/ai/watchers/:id

Response:

{ "status": "success" }

* * * * *

### 7.5 List Notifications

GET /api/ai/notifications

Response:

{\
  "status": "success",\
  "notifications": Notification[]\
}

* * * * *

### 7.6 Mark Notification Read

PATCH /api/ai/notifications/:id

Request:

{ "read": true }

Response:

{ "status": "success" }

* * * * *

8. Notification Engine
----------------------

### File

src/services/ai/notificationEngine.ts

### Responsibilities

-   Evaluate watcher conditions

-   Produce notifications when watchers trigger

-   Update watcher.lastTriggeredAt

### Entry Points

Evaluate after:

1.  AI Insights summary generation (`/api/ai/portfolio-summary`)

2.  Saved investigation refresh (`/api/ai/investigations/:id/refresh`)

3.  Potentially trend recompute points

### Core Function

function evaluateWatchersForUser(userId: string, context: {\
  report: StructuredPortfolioReport;\
  trendSignals?: PortfolioTrendSignal[];\
  healthScore?: HealthScore;\
  alerts?: PortfolioAlert[];\
  investigationSnapshots?: any; // optional\
});

It should:

-   load watchers for user

-   for each watcher:

    -   if enabled

    -   evaluate condition against context

    -   if condition met and not already triggered recently

        -   create Notification

        -   update lastTriggeredAt

* * * * *

9. Watcher Condition Logic
--------------------------

### 9.1 Alert Watcher

Trigger if:

-   current `alerts` contains an alert with matching `targetId`

-   optionally severity increases compared to lastTriggeredAt

### 9.2 Saved Investigation Watcher

Trigger if:

-   detected change in metrics from previous execution

-   e.g., overdueWorkItems increased since lastTriggeredAt

### 9.3 Trend Watcher

Trigger if:

-   trendSignals contains a signal with direction matching condition

-   e.g., "rising"

### 9.4 Health Watcher

Trigger if:

-   healthScore overall meets condition

-   e.g., <= threshold

* * * * *

10. UI: Notifications Center
----------------------------

### Location

Integrate into AI Insights page, e.g., top-right header icon or sidebar.

### Component

src/components/ai/NotificationCenter.tsx

### Behavior

-   shows unread count badge

-   displays list of notifications

-   click expands details

-   click drill-down to:

    -   related investigation

    -   related entity

    -   AI Insights section

### UI Elements

-   list grouped by unread vs read

-   each item shows:

    -   title

    -   message/summary

    -   timestamp

    -   link

### Mark as Read

-   button/icon per item

* * * * *

11. UI: Watcher Management
--------------------------

### Location

Add under AI Insights settings or notifications center.

### Components

src/components/ai/WatcherList.tsx\
src/components/ai/WatcherConfigForm.tsx

### Behavior

-   list existing watchers

-   show type, target, conditions

-   buttons to edit/enable/disable/delete

-   start new watcher from:

    -   alert card

    -   saved investigation

    -   trend signal

    -   health score threshold input

* * * * *

12. Interaction Flows
---------------------

### 12.1 Create Watcher from Alert

1.  User clicks "Watch this alert"

2.  Open WatcherConfigForm prefilled

3.  Submit → backend

4.  If condition already true, immediate notification

* * * * *

### 12.2 Create Watcher from Trend

1.  User sees trend card

2.  Click "Watch this trend"

3.  Submit watcher

* * * * *

### 12.3 Create Watcher for Health Threshold

1.  User selects threshold (e.g., <= 60)

2.  Submit watcher

* * * * *

### 12.4 View Notifications

1.  User opens notification center

2.  Sees unread notifications

3.  Click item → drill down

* * * * *

13. Acceptance Criteria
-----------------------

1.  Watchers can be created, listed, updated, deleted via API.

2.  Notifications are generated only when watcher conditions are met.

3.  Notifications appear in UI with correct drill-downs.

4.  Users can mark notifications as read.

5.  Watcher lifecycle is persisted (lastTriggeredAt).

6.  No regression in AI Insights features.

7.  UI is intuitive and performant.

8.  `npx tsc --noEmit` passes.

* * * * *

14. Implementation Files & Modifications
----------------------------------------

### Backend add / modify

src/types/ai.ts\
src/services/ai/notificationEngine.ts\
src/app/api/ai/watchers/route.ts\
src/app/api/ai/notifications/route.ts\
src/services/db.ts (add CRUD helpers)

### Frontend

src/components/ai/NotificationCenter.tsx\
src/components/ai/WatcherList.tsx\
src/components/ai/WatcherConfigForm.tsx\
src/components/AIInsights.tsx (hook into header/toolbar)

* * * * *

15. Deliverable Summary
-----------------------

Phase **12F.1** delivers:

-   watcher subscription capability

-   backend watcher engine

-   persistent notification store

-   in-app notification center with read/dismiss

-   watcher management UI

This forms the foundation for future extensions in Phase 12F.2 and beyond (external channels, scheduling, threshold automation, cross-user dashboards).

* * * * *