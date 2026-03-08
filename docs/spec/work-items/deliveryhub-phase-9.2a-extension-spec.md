# DeliveryHub Spec
# Phase 9.2A Extension — Application & Bundle Schedule Metadata Redesign

## Objective

Improve the **Applications → Schedule** screen and underlying metadata model to:

1. Support **metadata defined at both bundle and application levels**
2. Allow **application-level override of bundle metadata**
3. Provide a **dense, environment-based schedule editor**
4. Support **multiple environments** (Dev, SIT, Integration, UAT, Prod, etc.)
5. Replace the current vertical form layout with a **compact table layout**

This phase updates both:

- the **data model**
- the **Applications Schedule UI**

---

# 1. Metadata Scope Model

Schedule metadata must support two scopes.

## Bundle-level metadata

Applies to **all applications within a bundle**.

Typical case:  
All apps follow the same delivery schedule.

## Application-level metadata

Overrides bundle schedule **only for that specific application**.

Rare case but necessary.

---

# 2. Data Model Changes

## Collection

Continue using the planning metadata collection but extend it.

```
application_planning_metadata
```

## New Schema

```json
{
  "_id": "...",

  "scopeType": "bundle | application",
  "scopeId": "string",

  "environments": [
    {
      "name": "DEV | SIT | INT | UAT | PROD",

      "plannedStart": "date",
      "plannedEnd": "date",

      "actualStart": "date",
      "actualEnd": "date"
    }
  ],

  "goLive": {
    "planned": "date",
    "actual": "date"
  },

  "planningDefaults": {
    "milestoneCount": 4,
    "sprintDurationWeeks": 2,
    "milestoneDurationWeeks": 3
  },

  "capacityDefaults": {
    "capacityModel": "TEAM_VELOCITY",
    "deliveryTeams": 3,
    "sprintVelocityPerTeam": 30,
    "directSprintCapacity": 90
  },

  "notes": "string",

  "createdAt": "timestamp",
  "updatedAt": "timestamp"
}
```

---

# 3. Metadata Resolution Logic

When loading planning context:

```
1. Load bundle metadata
2. Load application metadata (if exists)
3. Merge with application values overriding bundle values
```

## Example

```
bundle:
  UAT planned start = Mar 1

application override:
  UAT planned start = Mar 5

result:
  Mar 5
```

---

# 4. Schedule UI Redesign

## Current Problem

The current screen:

- wastes vertical space
- shows only UAT and Prod
- does not scale to multiple environments
- is not aligned with release planning workflows

---

# 5. New Layout

Replace the layout with an **environment schedule grid**.

Example:

```
ENVIRONMENT | PLANNED START | PLANNED END | ACTUAL START | ACTUAL END
---------------------------------------------------------------------
DEV         | 03/01/2026    | 03/10/2026  |              |
SIT         | 03/11/2026    | 03/18/2026  |              |
INT         | 03/19/2026    | 03/24/2026  |              |
UAT         | 03/25/2026    | 04/02/2026  |              |
PROD        | 04/05/2026    |             |              |
```

This allows **multiple environments in a compact layout**.

---

# 6. Supported Environment Types

Default environments:

```
DEV
SIT
INT
UAT
PROD
```

Future phases may allow configurable environment sets.

---

# 7. Scope Toggle

Add a scope selector at the top of the Schedule tab.

Example:

```
Schedule Scope

● Bundle (Claims)
○ Application (MES)
```

## Behavior

### Bundle Mode

Editing changes **bundle-level metadata**.

### Application Mode

Editing creates or updates an **application override**.

---

# 8. Inheritance Indicator

If an application inherits bundle metadata:

```
UAT planned start: 03/25/2026
(inherited from bundle)
```

If overridden:

```
UAT planned start: 03/28/2026
(application override)
```

---

# 9. Edit Mode

Edit mode converts grid fields into inputs.

Example:

```
ENVIRONMENT | PLANNED START | PLANNED END | ACTUAL START | ACTUAL END
---------------------------------------------------------------------
DEV         | [ date ]      | [ date ]    | [ date ]     | [ date ]
SIT         | [ date ]      | [ date ]    | [ date ]     | [ date ]
```

Controls:

```
Edit
Save
Cancel
```

---

# 10. Additional Planning Defaults Section

Below the grid:

```
Planning Defaults

Milestones: [ 4 ]
Sprint Duration: [ 2 weeks ]
Milestone Duration: [ auto ]
```

---

# 11. Capacity Defaults Section

Compact layout:

```
Capacity Defaults

Capacity Model: [ Team Velocity ]

Teams: [ 3 ]
Velocity / Team: [ 30 ]
Direct Sprint Capacity: [ 90 ]
```

---

# 12. UI Component Structure

New components:

```
src/components/applications/
    ScheduleEnvironmentGrid.tsx
    ScheduleScopeSelector.tsx
    ScheduleDefaultsPanel.tsx
```

---

# 13. APIs

Update metadata save API.

## Save Metadata

```
PUT /api/applications/planning-metadata
```

### Bundle-level example

```json
{
  "scopeType": "bundle",
  "scopeId": "bundleId",
  "environments": [],
  "planningDefaults": {},
  "capacityDefaults": {}
}
```

### Application-level example

```json
{
  "scopeType": "application",
  "scopeId": "applicationId",
  "environments": []
}
```

---

# 14. Planning Context API

Ensure planning context merges correctly.

```
GET /api/applications/[applicationId]/planning-context
```

Returns:

```json
{
  "bundleMetadata": {},
  "applicationMetadata": {},
  "resolvedMetadata": {}
}
```

---

# 15. Tests

Add tests.

## Metadata merge logic

```
scripts/test-application-planning-context.ts
```

## Bundle vs application override

Cases:

```
bundle only
application override
partial override
```

---

# 16. Migration

Existing records without `scopeType` default to:

```
scopeType = "application"
```

---

# Acceptance Criteria

Phase 9.2A extension is complete when:

1. Metadata supports **bundle + application scope**
2. UI displays **environment grid layout**
3. Scope selector functions correctly
4. Application metadata overrides bundle metadata
5. Multiple environments are supported
6. Save persists correct scope
7. Planning context API returns merged metadata
8. `npm run test:api` passes

---

# Next Phase

After this redesign:

Proceed to

**Phase 9.2B — Work Items Intake Auto-Population**

using:

```
GET /api/applications/[applicationId]/planning-context
```

## Implementation Status

Status: Completed

Validation:
- bundle + application scope metadata supported
- scope-aware APIs added (including scoped PUT)
- Schedule UI uses environment grid + scope selector
- bundle overrides + application overrides merge correctly
- `npm run test:api` passes
