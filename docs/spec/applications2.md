> Implement Applications v1 (Bundle-centric metadata)
> ---------------------------------------------------
>
> We need to implement the **Applications** module as a **Planview-lite APM registry**, but **metadata is bundle-level** (not app-level). Apps are already defined in Admin (names + bundle membership). Bundles are sets of apps deployed together and owned by one team.
>
> ### Goal (v1)
>
> Turn Apps/Bundles from “names only” into **operational portfolio records** by introducing a **Bundle Profile** that stores:
>
> *   Milestones (from SOW) with **planned + actual dates** and **status**
>
> *   UAT planned/actual date ranges
>
> *   Go-live planned/actual dates
>
> *   Bundle health/status (on\_track / at\_risk / blocked / unknown)
>
> *   Notes
>
>
> Apps inherit these bundle-level attributes.
>
> 1) Permissions (canonical)
> --------------------------
>
> Editing bundle metadata is allowed only for:
>
> *   Admin users **OR**
>
> *   users where user.team === "Management"
>
>
> All other users are **read-only**.
>
> Implementation:
>
> *   Add canEditBundleProfile(user) helper (server authoritative)
>
> *   UI hides/disables edit controls if false, but API must enforce.
>
>
> 2) Data model (Mongo)
> ---------------------
>
> ### New collection: bundle\_profiles (upsert by bundleId)


```typescript
type BundleProfile = {
  _id: ObjectId
  bundleId: string

  status: 'on_track' | 'at_risk' | 'blocked' | 'unknown'

  schedule: {
    milestones: Array<{
      key: string
      name: string
      plannedStart?: Date
      plannedEnd?: Date
      actualStart?: Date
      actualEnd?: Date
      status: 'not_started' | 'in_progress' | 'done' | 'blocked'
      deliverables?: string
    }>

    uatPlannedStart?: Date
    uatPlannedEnd?: Date
    uatActualStart?: Date
    uatActualEnd?: Date

    goLivePlanned?: Date
    goLiveActual?: Date
  }

  notes?: string

  createdAt: Date
  updatedAt: Date
  updatedBy: { userId: string, name: string }
}
```

> Indexes:
>
> *   unique { bundleId: 1 }
>
> *   { status: 1, updatedAt: -1 }
>
> *   { "schedule.goLivePlanned": 1 }
>
>
> ### Ownership data source (already exists)
>
> Use existing bundle\_assignments for vendor/engineering/CMO assignments (bundle-level). For v1:
>
> *   Display ownership in Applications UI as **read-only** (edited in Admin).
>
> *   Do not create a new ownership store in bundle\_profiles.
>
>
> 3) API routes
> -------------
>
> ### Bundle profile APIs (new)
>
> *   GET /api/bundles/\[bundleId\]/profile
>
>     *   returns profile if exists, else returns a default empty structure
>
> *   PUT /api/bundles/\[bundleId\]/profile
>
>     *   upsert profile
>
>     *   enforce canEditBundleProfile(user) server-side
>
>     *   set updatedAt, updatedBy
>
>
> ### Notes on milestone handling
>
> Milestones are **bundle-specific** (SOW differs by bundle). So the milestones list lives inside each bundle profile (v1). No global milestone template needed yet.
>
> 4) Applications UI (routes + behavior)
> --------------------------------------
>
> ### A) Applications list
>
> Route: /applications
>
> Default view: **table** (cards optional later)
>
> Data sources:
>
> *   Apps list from existing Admin registry (apps + bundle membership)
>
> *   Join bundle profile by bundleId (status, schedule summary)
>
> *   Join bundle\_assignments by bundleId for owner display (read-only)
>
>
> Columns (v1):
>
> *   App Name
>
> *   App ID (if available)
>
> *   Bundle (name)
>
> *   Bundle Status (chip)
>
> *   Current Milestone (derived from bundle profile schedule)
>
> *   Go-live planned (bundle)
>
> *   Vendor lead (derived)
>
> *   Engineering owner (derived)
>
> *   Updated At (bundle profile)
>
>
> Filters:
>
> *   Bundle (existing global filter)
>
> *   App (existing global filter)
>
> *   Milestone (existing global filter)
>
> *   Status
>
> *   Search (app name/id)
>
>
> Row click:
>
> *   goes to Application detail: /applications/\[appId\]
>
>
> ### B) Application detail
>
> Route: /applications/\[appId\]
>
> Read-only summary:
>
> *   App identity (name/id)
>
> *   Bundle link to bundle profile
>
> *   Bundle schedule summary (current milestone, go-live planned/actual, UAT dates)
>
> *   Bundle ownership summary (from bundle\_assignments; read-only)
>
>
> CTA:
>
> *   “Open Bundle Profile” (primary link)
>
>
> ### C) Bundle profile editor (core feature)
>
> Route: /applications/bundles/\[bundleId\]
>
> Tabs (v1):
>
> 1.  Overview
>
> 2.  Schedule
>
> 3.  Ownership (read-only)
>
> 4.  Notes
>
>
> Schedule tab:
>
> *   Editable milestones table (name, planned start/end, actual start/end, status, deliverables)
>
> *   Editable UAT planned/actual start/end
>
> *   Editable Go-live planned/actual
>
> *   Editable bundle status (on\_track/at\_risk/blocked/unknown)
>
>
> Derived fields:
>
> *   Current milestone: first milestone not done; if none, show “Complete”
>
> *   Variance display is optional (nice-to-have)
>
>
> Ownership tab:
>
> *   Read-only view of bundle assignments:
>
>     *   Vendor team members + roles
>
>     *   Engineering owners + roles
>
>     *   CMO assignments if present
>
>
> 5) Material UX rules
> --------------------
>
> *   Bundle Profile is the only editable metadata in v1 (apps inherit).
>
> *   No per-app metadata editing in v1.
>
> *   Ensure top-level Bundle/App/Milestone filters continue to work and can scope the Applications list.
>
>
> 6) Optional: events (nice-to-have, not required)
> ------------------------------------------------
>
> If easy, emit on PUT bundle profile:
>
> *   applications.bundle\_profile.updatedInclude context { bundleId }.
>
>
> But do not block v1 on events.
>
> 7) Acceptance criteria
> ----------------------
>
> 1.  Management users can edit bundle profile schedule/status/notes; non-management cannot.
>
> 2.  Bundle profile persists in Mongo and loads correctly.
>
> 3.  Applications list shows apps joined to bundle profile data + assignments.
>
> 4.  “Current milestone” is derived consistently from milestones list.
>
> 5.  Application detail shows bundle-derived metadata and links to bundle profile.
>
> 6.  Ownership displayed from bundle\_assignments (read-only in v1).
>