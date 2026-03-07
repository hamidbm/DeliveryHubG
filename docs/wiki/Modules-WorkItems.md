# Work Items Module

The Work Items module is the execution system for DeliveryHub. It supports planning, tracking, and reporting for delivery work across milestones, bundles, and applications, and acts as the system of record for risks and dependencies.

## Work Item Types
- Epic
- Feature
- User Story
- Task
- Risk
- Dependency

Each item can have a parent and children to form a delivery hierarchy.

## Core Features
- Hierarchical work items with parent-child relationships
- Tree view, list view, board view (Kanban), backlog, roadmap, and milestone planning
- Drag-and-drop status and milestone changes on board/backlog
- Activity history per item (status changes, assignments, links)
- Priority, due dates, health, and metadata fields
- Attachments and comments
- Linked resources (e.g., wiki pages, architecture diagrams)
- Review-driven work items (auto-created from review requests)
- Governance-driven planning (readiness gates, capacity guardrails, and overrides)
- Ownership model: milestone owner + assignee consistency with suggestions
- Generate Delivery Plan wizard with preview and draft creation

## Ownership (RACI-lite)
- Milestones have an owner (accountable).
- Work items use assignee as responsible; `assignedAt` is tracked when set.
- Milestone Planning shows owner status with a “Set owner” control.
- Critical path actions suggest owners for unassigned items (bundle owners, recent assignees, watchers).

## Views

### Tree View
- Explore epics, features, stories, and tasks in hierarchy
- Expand and collapse to control scope
- Select an item to see details and activity
- Link badges show connected items and resources
- Progress bars are shown only for Epics and Features

### Board (Kanban)
- Drag-and-drop across status columns
- Visualize flow of work by phase
- Filter by bundle, application, milestone, and assignee

### Backlog
- Ranked list of work items
- Quick reprioritization
- Focus on upcoming milestones

### List View
- Flat list for search and filters
- Sort by status, owner, or priority
- Bulk selection and quick actions

### Roadmap View
- Multi-view roadmap with shared data (tabs):
  - Execution Board (default)
  - Timeline
  - Swimlane
  - Dependency
- Execution Board preserves the milestone intelligence row (capacity, readiness, blocked, risks)
- Timeline shows milestones on a calendar axis with readiness and capacity overlays
- Swimlane groups milestones by time buckets with readiness/capacity badges
- Dependency view aggregates cross‑milestone blockers at milestone level
- Milestone health indicators include utilization, risk level, blocked count, readiness, and confidence
- Drilldown modals for milestone and dependency details
- Commitment Drift chips for COMMITTED/IN_PROGRESS milestones with delta modal
- Lazy list fetching with list counts to keep performance responsive

## Generate Delivery Plan (Planning Mode)
The Planning toolbar includes **Generate Delivery Plan**, a guided wizard that creates a draft delivery structure.

Flow:
- Step 1: Intake (scope, dates, cadence, backlog shape, options, themes)
- Step 2: Preview (roadmap phases, milestone schedule, sprint schedule, artifact counts, warnings)
- Step 3: Create Draft Plan

Creates:
- Roadmap phases (`work_roadmap_phases`)
- Milestones (`milestones`, status = DRAFT)
- Sprints (`workitems_sprints`)
- Work items (epics, features, stories, optional tasks in `workitems`)
- Optional dependency skeleton (BLOCKS links between milestone epics)

Preview persistence:
- Stored in `work_plan_previews` with a 7-day TTL.

Events:
- `workitems.plan.previewed`
- `workitems.plan.created`

Generator markers:
- Generated items include `generator: { source: 'DELIVERY_PLAN_GENERATOR', runId }` for UX and governance rules.

## Simulation Engine (Phase 5)
The roadmap includes a Simulation button that allows “what‑if” scenarios against an existing plan preview.

Supported overrides:
- Capacity shift
- Scope growth
- Date shift (milestone-specific)
- Velocity adjustment

Simulation output shows:
- milestone slip count
- utilization deltas
- risk changes per milestone
- per‑milestone date delta (explicit slippage field)

## Work Item Details UX (Read‑First)
The Work Item details panel is now read‑first with explicit edit mode.

Header layout:
- Row 1: Back + key + type pill + title
- Row 2: Metadata strip (Parent, Milestone, Sprint, generator marker)
- Row 3: Actions (AI Actions, Snapshot, Archive, Edit, Quick Actions)

Tabs (renamed for clarity):
- Overview
- Execution Checklist
- Comments
- Links
- Files
- Activity
- AI

Overview layout:
- Compact core fields (Status, Priority, Due Date, Assignee)
- Relationships (Parent, Type, Milestone, Sprint)
- Description

Edit rules:
- Read-only by default
- Edit toggle applies to the whole screen
- Structural fields (Parent/Type/Milestone/Sprint) remain read-only for generator-created items

Sprint display:
- Sprint shows name with dates, e.g. `Sprint 3 (May 1 – May 14)`
- The sprint label links to the Sprint view

Quick Actions:
- Overflow menu provides common actions (Assign to me, Add dependency, Mark done)

### Milestone Planning
- Assign or move items between milestones
- Evaluate workload and sequencing
- Rollups show capacity, blocked items, risks, overdue, and slip
- COMMITTED enforcement (estimates required, capacity guardrails)
- Commitment Review gate for COMMITTED milestones (Monte Carlo + capacity + quality)
- Commitment Drift panel showing baseline + deltas and “Run re-review”
- Baseline & Scope Delta panel (added/removed/estimate changes since commit)
- Weekly Executive Brief panel (deterministic narrative for the milestone)
- Decisions panel (manual log + auto entries from overrides)
- Readiness gates (canStart/canComplete) with override + reason
- Sprint view for a milestone (sprint rollups tied to milestone scope)
- Burn-up table by sprint with cumulative and remaining points
- Velocity calibration hints based on recent sprint completion trends
- Activity feed for the selected milestone (governance, scope, dependency changes)

### QA Checklist (Manual)
1. Roadmap deep link restores expanded milestone + filters
2. Expand milestone lazy loads burn-up + sprint rollups
3. Add blocker from roadmap card (BLOCKS link created)
4. Inline edit story points on a card
5. Resolve blocker via “Mark DONE” in blockers modal
6. Scope request flow still works (create → approve/reject)
7. Data quality score shows and “Fix now” updates items

## Statuses
- TODO
- IN_PROGRESS
- REVIEW
- DONE
- BLOCKED

## Dependencies (Canonical Links)
- Canonical link types: BLOCKS, RELATES_TO, DUPLICATES
- Inverse links derived at read time (blockedBy, duplicatedBy, relatesTo)
- Cycle prevention for BLOCKS
- Derived isBlocked semantics based on link + target state

## Milestones + Governance
- Rollups: capacity, blocked, risks, overdue, slip
- Confidence scoring based on readiness + rollup signals
- COMMITTED enforcement: estimates required, capacity guardrails
- Commitment Review: P80 and hit probability gate with override + audit trail
- Commitment Drift: compares current rollup vs last PASS/OVERRIDDEN review and flags MAJOR/MINOR drift
- Baseline snapshots are created at commit time; deltas track scope added/removed and estimate changes
- Readiness gates: canStart/canComplete with override + reason
- Audit events emitted for milestone status/override/readiness and notifications sent
- COMMITTED scope changes require approval via scope change requests

## Data Quality (Planning Hygiene)
- Data quality score computed per milestone and sprint
- Issues include missing story points, due dates, assignees, and risk severity
- Scores <70 warn; <50 require override for governance transitions
- “Fix now” bulk edit flows for top issues

## Staleness Signals (v1)
- Stale thresholds:
  - Stale: no update > 7 days (not DONE)
  - Critical stale: critical path item no update > 3 days
  - Blocked stale: blocked item no update > 5 days
  - Unassigned stale: no assignee > 2 days since creation
  - GitHub stale: open PR inactive > 5 days (or IN_PROGRESS with no PR > 5 days)
- Roadmap + Milestone Planning surface a “Stale” chip with total and critical counts
- Drilldown list via `GET /api/work-items/stale`
- Stale list includes “Nudge owner” to notify assignees/owners/watchers
- Digest can include `workitem.stale.summary`

## Critical Path (Dependency-Aware)
- Computes critical path per milestone based on BLOCKS links + remaining estimates
- Highlights critical chain with remaining points and blocked items
- Surfaces top actions (unblock, estimate, assign) in Milestone Planning
- Roadmap shows critical path chip and critical badges on cards
- Optional cross-scope mode can include external blockers (bounded depth) for complex chains
- Actions: request estimate, set estimate, assign owner, notify external blocker owners
- Dependency graph view available in Milestone Planning (Graph tab)

## Sprints + Governance
- Sprint lifecycle: DRAFT → ACTIVE → CLOSED → ARCHIVED
- ACTIVE sprints enforce capacity on assignment (estimate required, over-capacity blocks unless override)
- Close readiness gates block close when scope remains, blocked items exist, or high/critical risks remain
- Admin/CMO can override close with a reason
- Events + notifications emitted for status changes, close blocks, and capacity overrides

## Roadmap Intelligence
- Milestone intelligence row aggregates capacity/readiness/risks
- Cross-milestone dependency indicators
- Drilldown modals for blockers and readiness
- Lazy list fetching and listCounts for performance

## Program Coordination + Portfolio Integration
- `/program` view summarizes at-risk bundles and cross-bundle blockers
- Bundle Profile “Delivery Intelligence” strip surfaces status and risks
- Dashboard “Program Health” widget shows program-level rollups

## Notifications + Preferences
- Notification types: milestone.status.changed, milestone.status.override, milestone.readiness.blocked, milestone.capacity.override, dependency.crossbundle.created, workitem.stale.nudge, workitem.stale.summary, digest.daily
- Admin policy: enable/disable types + routing (admins, bundle owners, actor on blocked)
- User preferences: mute types + digest opt-in
- Digest queue with manual send endpoint
- Watchers: users can subscribe to bundles and milestones; watchers receive relevant notifications

## RBAC + Audit
- Centralized policy functions for critical actions
- 403 error codes for forbidden updates (commit/start/complete, overrides, cross-bundle blockers, etc.)
- Admin audit console for events + notifications

## Reviews Integration
- Review requests (wiki or architecture) can generate user stories automatically.
- Review cycles can be synced back into the work item.
- Review attachments and reviewer responses are linked into the work item activity.
- See `docs/wiki/Reviews.md` for the shared workflow.

## Jira Integration (v1)
- Jira-linked work items show Jira key + link in the details panel.
- One-way sync is configured in Admin → Integrations → Jira.

## Activity and History
- Every update is logged as activity
- Status and assignment changes are tracked
- Snapshots are stored for historical reporting

## Filters
- Bundle
- Application
- Milestone
- Status
- Assignee
- My Issues (assigned to current user)

## AI Assistance
Work Items support AI-generated insights for planning and delivery management. AI is assistive only and requires explicit user action to apply results.

Supported AI workflows:
- Summarize work item or scope
- Suggest reassignment based on workload
- Standup digest
- Rationalize scope or priorities
- Refine task descriptions

## Data
- Stored in `workitems` collection
- Attachments stored in `workitems_attachments`
- Sprint planning in `workitems_sprints`
- Historical snapshots tracked alongside items
- Notifications stored in `notifications`
- Notification policy in `notification_settings`
- User notification prefs in `notification_user_prefs`
- Digest queue in `notification_digest_queue`
- Watchers stored in `notification_watchers`
- Decision log stored in `decision_log`

## Key APIs
- `GET /api/work-items`, `PATCH /api/work-items/:id`, `POST /api/work-items/bulk`
- `GET /api/work-items/stale`
- `GET /api/work-items/roadmap-intel`, `GET /api/work-items/roadmap-intel/lists`
- `GET /api/milestones/rollups`, `PATCH /api/milestones/:id`
- `GET /api/program/intel`
- `GET /api/decisions`, `POST /api/decisions`
- `GET /api/admin/events`, `GET /api/admin/notifications`
- `GET/PUT /api/admin/notification-settings`
- `GET/PUT /api/user/notification-prefs`
- `POST /api/notifications/digest/send`
