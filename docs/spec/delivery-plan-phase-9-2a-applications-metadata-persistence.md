# DeliveryHub Spec: Phase 9.2A – Applications Metadata Persistence

## Document Purpose
This document defines the implementation instructions for **Phase 9.2A: Applications Metadata Persistence** in DeliveryHub. This phase establishes the **data persistence and editing model for application planning metadata** inside the **Applications** module. The goal is to make the Applications module the canonical place to maintain planning-relevant metadata that can later be consumed by the **Work Items** module to auto-populate the **Generate Delivery Plan** intake form. This document serves as:

- the **implementation guide for Codex**
- the **permanent specification stored in `docs/spec/`**

---

# Context
The Applications module currently displays an application/bundle profile with tabs such as:

- Overview
- Schedule
- Ownership
- Risks & Dependencies
- Notes

The **Schedule** tab already visually suggests that an application should carry schedule metadata such as:

- UAT planned/actual start and end
- Go-live planned/actual

However, this screen is currently too shallow for DeliveryHub’s long-term planning model. The **Work Items → Generate Delivery Plan** intake flow requires many values that should not be manually re-entered every time. Much of that information belongs naturally to the application’s planning context and should be maintained in the Applications module.

You explicitly want this metadata to be stored in a **separate collection**, not in the core `applications` collection, so the `applications` collection remains simple, canonical, and focused on the application record itself. That is the correct direction, and this phase implements that foundation.

---

# Goals
Phase 9.2A must deliver all of the following:

1. A separate **application planning metadata persistence model**
2. An **Edit** experience on the Applications → Schedule tab
3. Save/load support for planning-relevant application metadata
4. A clean API boundary for reading and updating that metadata
5. A future-proof schema that supports Work Items intake auto-population in Phase 9.2B
6. A design that keeps the base `applications` collection simple and untouched except for reference use

---

# Non-Goals
Phase 9.2A does **not** include:

- auto-populating the Work Items intake form yet
- changing the Generate Delivery Plan wizard yet
- complex approval workflows
- metadata versioning/history
- audit trail beyond existing app conventions
- AI recommendations
- schedule optimization
- dependency graph redesign

Those belong to later phases.

---

# Product Decision Summary
These decisions must be followed exactly unless a strong implementation constraint forces a small adjustment.

## 1. Use a separate collection
Do **not** store planning metadata inside the main `applications` collection. Use a dedicated collection for application planning metadata.

## 2. One metadata document per application
The primary storage model should be:

- one planning metadata document per application

This keeps lookup simple and predictable.

## 3. Schedule tab becomes editable
The Applications → Schedule tab must support:

- viewing metadata
- entering/editing metadata
- saving metadata

## 4. Metadata should extend beyond just UAT/go-live dates
Although the current UI screenshot shows UAT and go-live fields, the stored model should already be broad enough to support future Work Items intake auto-population.

## 5. The Applications module becomes the source of truth for planning context
Later phases may still allow overrides inside Work Items, but the default values should originate here.

---

# Data Model

## New Collection
Create a dedicated collection:

```text
application_planning_metadata
```

This collection stores planning-related metadata for an application.

### Why this collection name
It is explicit, domain-accurate, and avoids overloading the meaning of the base `applications` collection.

---

## Document Shape
Create a new type in `src/types.ts` such as:

```ts
ApplicationPlanningMetadata = {
  _id?: string
  applicationId: string
  bundleId?: string | null
  planningContext?: {
    deliveryPattern?: string | null
    releaseType?: string | null
    environmentFlow?: string | null
    defaultMilestoneCount?: number | null
    defaultSprintDurationWeeks?: number | null
    defaultMilestoneStrategy?: 'AUTO_DISTRIBUTE' | 'FIXED_WEEKS' | null
    defaultMilestoneDurationWeeks?: number | null
    defaultBacklogShape?: string | null
    defaultCreateTasksUnderStories?: boolean | null
    defaultStoriesPerFeature?: number | null
    defaultFeaturesPerMilestone?: number | null
    defaultTasksPerStory?: number | null
  }
  environments?: {
    dev?: {
      plannedStart?: string | null
      plannedEnd?: string | null
      actualStart?: string | null
      actualEnd?: string | null
    }
    integration?: {
      plannedStart?: string | null
      plannedEnd?: string | null
      actualStart?: string | null
      actualEnd?: string | null
    }
    uat?: {
      plannedStart?: string | null
      plannedEnd?: string | null
      actualStart?: string | null
      actualEnd?: string | null
    }
    prod?: {
      plannedStart?: string | null
      plannedEnd?: string | null
      actualStart?: string | null
      actualEnd?: string | null
    }
    goLive?: {
      plannedDate?: string | null
      actualDate?: string | null
    }
    stabilization?: {
      plannedStart?: string | null
      plannedEnd?: string | null
      actualStart?: string | null
      actualEnd?: string | null
    }
  }
  planningDefaults?: {
    capacityMode?: 'TEAM_VELOCITY' | 'DIRECT_SPRINT_CAPACITY' | null
    deliveryTeams?: number | null
    sprintVelocityPerTeam?: number | null
    directSprintCapacity?: number | null
    teamSize?: number | null
    projectSize?: 'SMALL' | 'MEDIUM' | 'LARGE' | 'ENTERPRISE' | null
  }
  ownershipDefaults?: {
    milestoneOwnerIds?: string[]
    workItemOwnerIds?: string[]
  }
  dependencyContext?: {
    upstreamApplicationIds?: string[]
    downstreamApplicationIds?: string[]
    notes?: string | null
  }
  notes?: {
    scheduleNotes?: string | null
    planningNotes?: string | null
  }
  createdAt?: string
  updatedAt?: string
}
```

---

# Important Modeling Decisions

## Keep dates as ISO strings
Store date values as ISO date strings in the metadata document. Use consistent serialization in API responses.

## Allow null/empty values
This metadata is intentionally partial and will mature over time. Do not require all fields to be present in Phase 9.2A.

## Include future-facing planning defaults now
Even if the Schedule tab does not surface every field immediately, the persistence model should already support the future planning defaults needed by Work Items.

## `teamSize` is allowed here
Unlike earlier Work Items guidance where we intentionally kept team size out of the intake UI, here it is acceptable to persist `teamSize` as planning metadata because:

- it may be useful later
- it belongs more naturally to application/team context
- it does not have to be shown everywhere immediately

---

# Database and Indexing

## Collection creation
Codex should add creation/usage support for:

```text
application_planning_metadata
```

using the existing DB utilities and conventions in the codebase.

## Required indexes
Add at minimum:

### Unique index by application
```ts
{ applicationId: 1 } unique
```

This ensures one planning metadata document per application.

### Optional helpful index by bundle
```ts
{ bundleId: 1 }
```

This helps future bundle-level lookups but is secondary.

---

# API Surface
Create APIs for retrieving and updating application planning metadata.

## 1. Get planning metadata

### Route
```text
GET /api/applications/[applicationId]/planning-metadata
```

### Behavior
- fetch the application
- fetch the corresponding `application_planning_metadata` document if it exists
- if none exists, return a default empty shape plus application identity context

### Response example
```json
{
  "applicationId": "app_123",
  "bundleId": "bundle_456",
  "planningMetadata": { ... }
}
```

---

## 2. Upsert planning metadata

### Route
```text
PUT /api/applications/[applicationId]/planning-metadata
```

### Behavior
- validate payload
- upsert a single metadata document by `applicationId`
- update `updatedAt`
- set `createdAt` on first insert

### Required behavior
This must be an **upsert**, not create-only, because this screen is fundamentally an edit surface.

---

## 3. Planning context API for future Work Items integration
Although Phase 9.2B will consume it, create the API now if it is easy and clean.

### Route
```text
GET /api/applications/[applicationId]/planning-context
```

### Purpose
Return a reduced/normalized payload intended for Work Items intake auto-population.

### Example response
```json
{
  "applicationId": "app_123",
  "bundleId": "bundle_456",
  "environmentDates": {
    "devStart": "...",
    "integrationStart": "...",
    "uatStart": "...",
    "goLive": "..."
  },
  "planningDefaults": {
    "deliveryPattern": "Standard phased",
    "releaseType": "Phased rollout",
    "environmentFlow": "Dev → UAT → Prod",
    "defaultMilestoneCount": 4,
    "defaultSprintDurationWeeks": 2
  }
}
```

### Note
If Codex prefers to delay this route until 9.2B, that is acceptable, but the metadata persistence APIs are mandatory in 9.2A.

---

# UI Work in Applications Module

## Primary target screen
Applications → open app → Schedule tab

The current screen needs to support editing.

---

## Required UX changes

### Add an Edit button
On the Schedule tab, add an **Edit** button. When clicked:

- fields become editable inline, or
- the screen enters edit mode with Save/Cancel controls

### Recommended mode
Use inline edit mode on the Schedule tab rather than a modal. Reason:

- the Schedule tab is already a form-like page
- users should see the full planning context while editing

---

## Edit mode behavior

### In read mode
- fields appear as current values
- empty fields show placeholder or muted empty state
- no inputs are active

### In edit mode
- fields become inputs/date pickers/selects as appropriate
- show:
  - Save
  - Cancel

### Cancel
- discards unsaved changes
- returns to read mode

### Save
- validates input
- calls the `PUT` API
- exits edit mode on success
- refreshes displayed metadata

---

# Initial Fields to Surface on the Schedule Tab
The screenshot already shows UAT/go-live fields. Expand the tab modestly so it becomes useful for planning metadata persistence.

## Section 1: Environment Schedule
Surface these fields visibly in Phase 9.2A.

### Dev
- Dev Planned Start
- Dev Planned End
- Dev Actual Start
- Dev Actual End

### Integration
- Integration Planned Start
- Integration Planned End
- Integration Actual Start
- Integration Actual End

### UAT
- UAT Planned Start
- UAT Planned End
- UAT Actual Start
- UAT Actual End

### Go-Live / Prod
- Go-Live Planned
- Go-Live Actual
- Prod Planned Start
- Prod Planned End
- Prod Actual Start
- Prod Actual End

### Stabilization
- Stabilization Planned Start
- Stabilization Planned End
- Stabilization Actual Start
- Stabilization Actual End

---

## Section 2: Planning Defaults
Add a compact section below environment schedule for planning defaults. At minimum, surface these fields in Phase 9.2A:

- Delivery Pattern
- Release Type
- Environment Flow
- Default Milestone Count
- Default Sprint Duration (weeks)
- Default Milestone Strategy
- Default Milestone Duration (weeks)
- Default Backlog Shape

### Optional in initial UI but recommended
- Default Create Tasks Under Stories
- Default Stories per Feature
- Default Features per Milestone
- Default Tasks per Story

If this makes the Schedule tab too large, it is acceptable to split these into a second subsection on the same page.

---

## Section 3: Capacity Defaults
Surface these fields in Phase 9.2A, but keep them clearly framed as defaults, not per-plan commitments.

- Capacity Mode
- Delivery Teams
- Sprint Velocity per Team
- Direct Sprint Capacity
- Team Size
- Project Size

### Important note
These are saved as defaults so that a user can later override them in Work Items when generating a specific plan.

---

## Section 4: Notes
Add lightweight notes fields:

- Schedule Notes
- Planning Notes

These can be simple textareas.

---

# UI Design Guidance

## Preserve the current visual language
Use the existing DeliveryHub form styling and layout patterns already used in:

- Schedule tab
- Generate Delivery Plan wizard
- other module forms

## Keep the tab readable
Do not overload the page with too much density. Recommended layout:

- Environment Schedule
- Planning Defaults
- Capacity Defaults
- Notes

Use cards/sections with clear headings.

---

# Validation Rules
Validation should be practical and non-blocking.

## Date validation
Where paired dates exist, validate:

- start <= end

Examples:

- UAT Planned Start <= UAT Planned End
- Stabilization Planned Start <= Stabilization Planned End

## Capacity defaults
If populated:

- deliveryTeams must be positive
- sprintVelocityPerTeam must be positive
- directSprintCapacity must be positive
- teamSize must be positive
- defaultMilestoneCount must be at least 1
- defaultSprintDurationWeeks must be at least 1
- defaultMilestoneDurationWeeks must be at least 1 when used

## Non-required fields
Do not force users to complete every field. This is metadata persistence, not a strict gating workflow.

---

# Error Handling

## Read behavior
If no metadata exists yet:

- show empty/default state
- allow user to click Edit and Save

## Save behavior
If save fails:

- keep edit mode active
- show a visible error message
- do not wipe entered values

---

# Implementation Structure

## Types
Add `ApplicationPlanningMetadata` and any helper types to:

```text
src/types.ts
```

## DB utilities
Add collection access helpers in the same style as the current codebase. If the app uses `src/services/db.ts` or equivalent utilities, follow those conventions.

## Service layer
Create a small service file if helpful:

```text
src/services/applicationPlanningMetadata.ts
```

Suggested responsibilities:

- getApplicationPlanningMetadata(applicationId)
- upsertApplicationPlanningMetadata(applicationId, payload)
- buildApplicationPlanningContext(applicationId)

This is recommended to keep API routes thin.

---

# Files to Create

Likely new files:

```text
src/services/applicationPlanningMetadata.ts
src/app/api/applications/[applicationId]/planning-metadata/route.ts
```

Optional now or in preparation for 9.2B:

```text
src/app/api/applications/[applicationId]/planning-context/route.ts
```

---

# Files to Modify

Likely files to update:

```text
src/types.ts
src/components/Applications.tsx or the specific application profile/schedule tab component(s)
src/services/db.ts or equivalent DB helper files if collection/index setup lives there
```

Also update the relevant screen component for the Applications Schedule tab. If the Schedule tab is broken into subcomponents, Codex should update those rather than forcing everything into one large file.

---

# Testing Requirements
Add tests for the new persistence layer and APIs.

## New tests

```text
scripts/test-application-planning-metadata.ts
scripts/test-application-planning-metadata-api.ts
```

### Required coverage

- upsert creates a new metadata document
- second save updates the same metadata document
- unique-by-application behavior is preserved
- GET returns empty/default structure when no metadata exists
- PUT persists environment schedule fields
- PUT persists planning defaults
- PUT persists capacity defaults

### Regression requirement
Ensure:

```text
npm run test:api
```

continues to pass.

---

# Documentation Requirements

Create a new spec:

```text
docs/spec/delivery-plan-phase-9-2a-applications-metadata-persistence.md
```

Update wiki docs:

```text
docs/wiki/Modules-Applications.md
docs/wiki/Modules-WorkItems.md
```

### Applications wiki update should explain

- applications now support persisted planning metadata
- metadata is stored separately from core application records
- Schedule tab supports editing and persistence
- this metadata will later drive Work Items intake defaults

### Work Items wiki update should explain

- Work Items intake auto-population is planned to consume application planning context
- Phase 9.2A establishes the metadata source

### Required implementation status section
At the end of implementation, Codex should add:

```md
## Implementation Status
Status: Completed

Validation:
- application planning metadata collection added
- planning metadata APIs added
- Applications Schedule tab supports edit/save
- metadata persistence tests added
- `npm run test:api` passes

Notes:
- planning metadata is stored separately from the core applications collection
- this metadata is intended to feed Work Items intake auto-population in Phase 9.2B
```

---

# Acceptance Criteria
Phase 9.2A is complete only when all of the following are true.

## Persistence

- `application_planning_metadata` collection exists
- one metadata document per application is enforced
- metadata can be created and updated safely

## APIs

- GET planning metadata API works
- PUT planning metadata API works
- returned payloads are stable and usable

## UI

- Schedule tab has an Edit button
- user can enter/edit schedule metadata
- user can save and reload persisted metadata
- user can cancel edits
- schedule/planning/capacity defaults are reasonably surfaced

## Architecture

- core `applications` collection remains simple
- planning metadata is kept in a separate collection
- design is ready for Work Items auto-population in Phase 9.2B

## Testing

- new metadata persistence tests exist
- API tests exist
- `npm run test:api` passes

## Documentation

- Phase 9.2A spec exists and is accurate
- Applications and Work Items wiki docs are updated

---

# Out of Scope
Phase 9.2A does not include:

- actual Work Items intake auto-population
- advanced metadata governance workflows
- approval/version history
- application dependency redesign
- AI-assisted metadata entry

Those will be handled in later phases.

---

# Next Planned Phase
After this phase, the next planned work is:

## Phase 9.2B – Work Items Intake Auto-Population from Applications Metadata
That phase will:

- call the planning-context API
- pre-fill Generate Delivery Plan intake values
- reduce required manual entry
- keep user override capability

---

# Final Instruction to Codex
Implement Phase 9.2A according to this specification by creating a separate application planning metadata persistence model and collection, adding read/update APIs, and enhancing the Applications → Schedule tab with edit/save support for schedule, planning, and capacity defaults, while preserving the simplicity of the core `applications` collection.

## Implementation Status
Status: Completed

Validation:
- application planning metadata collection added
- planning metadata APIs added
- Applications Schedule tab supports edit/save
- metadata persistence tests added
- `npm run test:api` passes

Notes:
- planning metadata is stored separately from the core applications collection
- this metadata is intended to feed Work Items intake auto-population in Phase 9.2B
