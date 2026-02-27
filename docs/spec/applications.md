> 1) Decisions (locked)
> =====================
>
> Editing permissions
> -------------------
>
> *   **Can edit bundle metadata:** Admin + Engineering Leaders + PM/management roles.
>
> *   Others: read-only.
>
>
> You already have a role/team concept on users (registration captures role + team), and you have role-group guidance in your Review spec (Engineering roles, Vendor roles, CMO, Business).
>
> Review\_Feature\_Final\_Design
>
> Milestones
> ----------
>
> *   Milestones are **bundle-level**, defined by SOW.
>
> *   Milestones include **status**.
>
> *   Apps inherit the bundle schedule (apps do not have their own milestone plan).
>
>
> Ownership assignment
> --------------------
>
> *   Ownership/associations are at the **bundle level**, via bundle\_assignments collection. Bundle\_Assignments\_Spec
>
>
> Planned vs actual dates
> -----------------------
>
> Best practice: track **both planned and actual** (it’s the only way dashboards and variance reporting become real).If you need a simpler v1 UI, show planned dates first and keep actual dates collapsible — but store both in the model.
>
> 2) What “Applications” module should do in v1
> =============================================
>
> A) Applications landing page (/applications)
> --------------------------------------------
>
> Purpose: browse apps, navigate to a bundle profile, see inherited metadata.
>
> **UI**
>
> *   Default = **Table view** (cards are optional later).
>
> *   Columns:
>
>     *   App Name
>
>     *   App ID
>
>     *   Bundle
>
>     *   Bundle Milestone (current)
>
>     *   Bundle Status (on\_track / at\_risk / blocked)
>
>     *   Planned Go-live (bundle)
>
>     *   Vendor Lead (derived from bundle\_assignments)
>
>     *   Engineering Owner (derived from bundle\_assignments)
>
>     *   Updated At (bundle profile)
>
>
> **Filters**
>
> *   Bundle (existing global filter)
>
> *   App (existing global filter)
>
> *   Milestone (existing global filter)
>
> *   Status (derived from bundle profile)
>
> *   Search (app name/id)
>
>
> **Row click**
>
> *   Goes to **Application Detail** (read-only summary + links), and a prominent link/button:
>
>     *   “Open Bundle Profile”
>
>
> B) Application detail (/applications/\[appId\])
> -----------------------------------------------
>
> Purpose: show app in context; metadata displayed is inherited from bundle.
>
> Sections:
>
> *   App identity (name/id)
>
> *   Bundle name + link to Bundle Profile
>
> *   “Bundle Schedule” summary
>
> *   “Bundle Ownership” summary
>
> *   Links to artifacts filtered by app (later): diagrams/wiki/work items
>
>
> No editing here in v1 (editing is bundle-level).
>
> C) Bundle profile editor (the real MVP) (/applications/bundles/\[bundleId\])
> ----------------------------------------------------------------------------
>
> Purpose: **edit the bundle schedule and team assignments** (or display them if assignments are managed elsewhere).
>
> Tabs:
>
> 1.  Overview
>
> 2.  Schedule (Milestones)
>
> 3.  Ownership (derived from bundle\_assignments + optional convenience editor)
>
> 4.  Notes
>
>
> ### Schedule tab (core)
>
> Milestone rows:
>
> *   Milestone name
>
> *   Planned start/end
>
> *   Actual start/end
>
> *   Status: not\_started / in\_progress / done / blocked
>
> *   Deliverables (optional text field per milestone; SOW summary)
>
>
> Bundle-level fields:
>
> *   UAT planned start/end
>
> *   UAT actual start/end
>
> *   Go-live planned
>
> *   Go-live actual
>
>
> Derived:
>
> *   Current milestone = first milestone with status != done (or last in\_progress)
>
>
> ### Ownership tab (bundle assignments)
>
> Read from bundle\_assignments with relevant assignmentTypes.
>
> Bundle\_Assignments\_Spec
>
> Show sections:
>
> *   Vendor team: svp (and optionally “SVP roles” shown from user.role)
>
> *   Engineering owners: bundle\_owner
>
> *   CMO: assigned\_cmo and cmo\_reviewer (optional to display here)
>
>
> **Edit behavior**You have two options:
>
> **Option 1 (recommended for v1):** Ownership is edited in Admin → Bundle Assignments only.Bundle Profile shows it read-only.
>
> **Option 2:** Allow editing in Bundle Profile for authorized users (same permissions), but it writes to bundle\_assignmentsendpoints.
>
> Given you already planned Admin governance for assignments, I’d start with Option 1.
>
> 3) Data model (Mongo)
> =====================
>
> Keep Admin “bundles/apps” as name registries. Add a new bundle metadata collection:
>
> bundle\_profiles (new)
> ----------------------

```typescript
type BundleProfile = {
  _id: ObjectId
  bundleId: string

  status: 'on_track' | 'at_risk' | 'blocked' | 'unknown'

  schedule: {
    milestones: Array<{
      key: string          // stable id, e.g., "m1", "uat", "cutover"
      name: string         // from SOW
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

>
> Indexes:
>
> *   unique { bundleId: 1 }
>
> *   { status: 1, updatedAt: -1 }
>
> *   { "schedule.goLivePlanned": 1 }
>
>
> Where milestone “definitions” live:
>
> *   For v1, store milestone list inside bundle\_profile (because SOW differs per bundle).
>
> *   Optional later: bundle\_milestones collection.
>
>
> 4) Permissions (Codex should implement)
> =======================================
>
> Implement centralized helper (similar to your review authz guidance) so UI and APIs don’t hardcode checks.
>
> Review\_Feature\_Final\_Design
>
> Add something like src/services/authz.ts:
>
> *   canEditBundleProfile(user): boolean
>
>     *   true if user is Admin OR role in management roles (Engineering leaders + PMs you define)
>
> *   Server-side enforcement in bundle profile routes is mandatory.
>
>
> You’ll need to define which roles count as “PM/management”; simplest v1:
>
> *   Admin always
>
> *   Any Engineering role containing Leader or PM
>
> *   Any Vendor role containing Project Manager or Delivery Lead
>
>
> (You can refine later; v1 heuristic is acceptable if your roles are consistent.)
>
> 5) Codex “build plan” (copy/paste)
> ==================================
>
> Implement Applications v1 as bundle-centric metadata.
>
> 1.  Add bundle\_profiles collection (schema above) and CRUD APIs:
>
>
> *   GET /api/bundles/\[bundleId\]/profile
>
> *   PUT /api/bundles/\[bundleId\]/profile (upsert)Enforce canEditBundleProfile on server.
>
>
> 1.  Applications UI:
>
>
> *   /applications shows apps table (from existing admin apps registry)
>
> *   join each app to its bundle profile (status, current milestone, go-live)
>
> *   join bundle\_assignments for owner display (read-only)
>
>
> 1.  Add bundle profile editor:
>
>
> *   /applications/bundles/\[bundleId\]
>
> *   tabs: Overview, Schedule, Ownership (read-only), Notes
>
> *   Schedule supports planned + actual + status per milestone
>
>
> 1.  Do not add per-app metadata in v1 (apps inherit bundle metadata).
>
> 2.  Optional: emit events when bundle profile changes (future dashboards):
>
>
> *   applications.bundle\_profile.updated
>
> *   applications.bundle\_schedule.updated
>
> *   applications.bundle\_status.updated
>

Canonical rule
A user can edit bundle-level metadata (Bundle Profile) if:
user.team === "Management" OR
user is Admin
(Optionally also allow user.role === "Admin" if you model Admin as a role rather than a separate flag.)
This avoids brittle matching on role strings.
What to tell Codex (paste-ready)
Use this verbatim:
Permissions update:
Editing bundle metadata (bundle profiles, milestones, schedule, go-live, UAT, notes) is allowed for:
Admin users
Users where user.team === "Management"
All other users are read-only in Applications module v1.
Implementation:
Add canEditBundleProfile(user) in src/services/authz.ts
Enforce on server-side in:
PUT /api/bundles/[bundleId]/profile
any future endpoints that mutate bundle metadata
UI should disable/hide edit controls unless canEditBundleProfile(user) is true, but server is authoritative.
Small follow-up recommendation (optional but valuable)
Also add read permissions (to avoid accidental data leakage later):
Everyone logged in can view bundle profiles (default), unless you later add bundle-based visibility.
You can keep it open for now.