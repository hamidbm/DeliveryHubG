# Codex Implementation Spec: Refactor Sample Data Generation to Reuse the Delivery Plan Engine

## Goal

Replace the current Admin Sample Data flow with a **Demo Scenario Builder** that:

- uses the existing **Delivery Plan Engine** as the source of truth for plan generation
- lets an admin edit a pre-populated demo scenario before generation
- provisions demo bundles, applications, users, team structure, and assignments
- generates delivery artifacts through:
  - `previewDeliveryPlan(...)`
  - `createDeliveryPlan(...)`
- applies demo-specific post-processing so the generated dataset is useful for demos:
  - some work assigned
  - some work intentionally left unassigned
  - some work assigned to SVP users
  - all demo-created records tagged so they can be safely reset later

This must replace the old checkbox-based sample import UX and remove the assumption that sample data is a static manifest import.

---

## Current State in the Codebase

Codex should assume the following baseline.

### Existing UI

- `src/components/AdminSamples.tsx`
  - currently renders a checkbox list of sample collections
  - currently calls:
    - `GET /api/admin/sample/status`
    - `POST /api/admin/sample/install`
    - `POST /api/admin/sample/reset`

### Existing sample bootstrap

- `src/lib/bootstrap/seed.ts`
  - contains hardcoded:
    - `DEMO_USERS`
    - `DEMO_BUNDLE_BLUEPRINTS`
  - currently uses:
    - `ensureDemoUsers(...)`
    - `ensureDemoBundlesAndApps(...)`
    - `runGeneratedSampleBootstrap(...)`
  - already calls:
    - `previewDeliveryPlan(...)`
    - `createDeliveryPlan(...)`
  - currently uses a hardcoded demo tag such as:
    - `sample-v1`

### Existing delivery plan engine

- `src/services/deliveryPlanGenerator.ts`
  - `previewDeliveryPlan(input, user)`
  - `createDeliveryPlan(previewId, user)`

### Existing input model

- `src/types.ts`
  - `DeliveryPlanInput`

### Existing admin sample endpoints

- `src/app/api/admin/sample/install/route.ts`
- `src/app/api/admin/sample/reset/route.ts`
- `src/app/api/admin/sample/status/route.ts`

---

## High-Level Refactor

Implement the sample-data feature as a thin orchestration layer on top of the delivery plan engine.

The new flow must be:

1. Admin opens the **Sample Data** tile.
2. Admin sees a **pre-populated editable demo scenario form**, not a checkbox list.
3. Admin can:
   - edit bundle names
   - add/remove bundles
   - edit app names
   - add/remove apps per bundle
   - edit demo users
   - add/remove teams and users
   - set environment dates
   - set milestone/team/capacity settings
   - set demo assignment behavior
4. Admin clicks **Preview**.
5. Server converts scenario input into `DeliveryPlanInput` per bundle and calls `previewDeliveryPlan(...)`.
6. UI shows counts and validation.
7. Admin clicks **Generate Sample Data**.
8. Server:
   - resets prior sample data if requested or required
   - provisions demo users, bundles, and apps
   - runs delivery plan generation
   - tags generated records
   - performs demo enrichment
9. Admin can later click **Reset Sample Data** to remove all demo-tagged records.

---

## Functional Requirements

### 1. Replace the old sample checkbox UI

The checkbox-based collections UI in `src/components/AdminSamples.tsx` must be fully replaced.

Do not preserve the old collection-selection UX.

The new page must be a scenario editor for generated demo content.

### 2. Add an explicit editable demo scenario model

Create a new type model specifically for sample scenario editing.

Do not overload `DeliveryPlanInput` to carry bundle, app, user, or demo metadata.

#### New type file

Create:

- `src/types/demoScenario.ts`

If project convention strongly prefers centralizing types in `src/types.ts`, it may be added there, but a separate file is preferred.

#### Required top-level type

```ts
export type DemoScenario = {
  scenarioKey: string;
  scenarioName: string;
  demoTag?: string;
  resetBeforeInstall: boolean;
  bundles: DemoScenarioBundle[];
  defaults?: DemoScenarioDefaults;
};
```

#### Bundle type

```ts
export type DemoScenarioBundle = {
  tempId: string;
  key?: string;
  name: string;
  description?: string;
  applications: DemoScenarioApplication[];
  planning: DemoScenarioPlanning;
  teams: DemoScenarioTeam[];
  assignmentRules: DemoScenarioAssignmentRules;
};
```

#### Application type

```ts
export type DemoScenarioApplication = {
  tempId: string;
  aid?: string;
  key?: string;
  name: string;
  isActive?: boolean;
  status?: {
    phase?: string;
    health?: 'Healthy' | 'Risk' | 'Critical';
  };
};
```

#### Planning type

This should mirror `DeliveryPlanInput`, except for `scopeType` and `scopeId`.

```ts
export type DemoScenarioPlanning = {
  plannedStartDate?: string;
  devStartDate: string;
  integrationStartDate?: string;
  uatStartDate: string;
  goLiveDate: string;
  stabilizationEndDate?: string;
  milestoneCount: number;
  sprintDurationWeeks: number;
  milestoneDurationStrategy: 'AUTO_DISTRIBUTE' | 'FIXED_WEEKS';
  milestoneDurationWeeks?: number;
  deliveryPattern: 'STANDARD_PHASED' | 'PRODUCT_INCREMENT' | 'MIGRATION' | 'COMPLIANCE';
  backlogShape: 'LIGHT' | 'STANDARD' | 'DETAILED';
  storiesPerFeatureTarget?: number;
  featuresPerMilestoneTarget?: number;
  tasksPerStoryTarget?: number;
  projectSize?: 'SMALL' | 'MEDIUM' | 'LARGE' | 'ENTERPRISE';
  capacityMode?: 'TEAM_VELOCITY' | 'DIRECT_SPRINT_CAPACITY';
  deliveryTeams?: number;
  sprintVelocityPerTeam?: number;
  directSprintCapacity?: number;
  createTasksUnderStories?: boolean;
  environmentFlow?: 'DEV_UAT_PROD' | 'DEV_SIT_UAT_PROD' | 'CUSTOM';
  releaseType?: 'BIG_BANG' | 'PHASED' | 'INCREMENTAL';
  suggestMilestoneOwners?: boolean;
  suggestWorkItemOwners?: boolean;
  createDependencySkeleton?: boolean;
  preallocateStoriesToSprints?: boolean;
  autoLinkMilestonesToRoadmap?: boolean;
  generateDraftOnly?: boolean;
  themesByMilestone?: Array<{ milestoneIndex: number; themes: string[] }>;
};
```

#### Team type

```ts
export type DemoScenarioTeam = {
  tempId: string;
  name: string;
  size?: number;
  users: DemoScenarioUser[];
};
```

#### User type

```ts
export type DemoScenarioUser = {
  tempId: string;
  name: string;
  username?: string;
  email: string;
  team: string;
  role: string;
  isActive?: boolean;
  assignmentIntent?: 'PRIMARY' | 'SECONDARY' | 'NONE';
  isSvpCandidate?: boolean;
  isBundleOwnerCandidate?: boolean;
};
```

#### Assignment rules type

```ts
export type DemoScenarioAssignmentRules = {
  assignSomeToSvp: boolean;
  leaveSomeUnassigned: boolean;
  unassignedPercentage: number;
  svpAssignmentPercentage: number;
  assignEpicsAndFeaturesToOwners: boolean;
  assignStoriesAndTasksToTeamMembers: boolean;
};
```

#### Defaults type

```ts
export type DemoScenarioDefaults = {
  defaultPassword?: string;
};
```

### 3. Create a dedicated sample scenario service

Create a new orchestration service:

- `src/services/sampleScenarioService.ts`

This service will be the main implementation location for the new feature.

Do not keep the main orchestration buried inside `src/lib/bootstrap/seed.ts`.

---

## Service API Requirements

`sampleScenarioService.ts` must export the following functions.

### 3.1 `getDefaultDemoScenario()`

Returns the default editable pre-populated scenario used by the admin UI.

It must replace the old hardcoded use of `DEMO_USERS` and `DEMO_BUNDLE_BLUEPRINTS`.

The default scenario must contain at least:

- 2 bundles
- applications under each bundle
- realistic demo users
- team structure
- delivery planning defaults

This default data can be derived from the current blueprints in `src/lib/bootstrap/seed.ts`.

#### Requirement

The returned object must already be UI-editable and complete enough to generate without further changes.

### 3.2 `validateDemoScenario(input)`

Must validate the scenario and return structured errors.

#### Return shape

```ts
type DemoScenarioValidationResult = {
  valid: boolean;
  errors: Array<{
    path: string;
    code: string;
    message: string;
  }>;
};
```

#### Required validations

- scenario name not empty
- at least 1 bundle
- bundle names required
- no duplicate bundle names within scenario
- at least 1 application per bundle
- app names required
- no duplicate app names within the same bundle
- valid emails for all users
- no duplicate user emails across the scenario
- `devStartDate`, `uatStartDate`, and `goLiveDate` required
- `milestoneCount >= 1`
- `sprintDurationWeeks >= 1`
- if `capacityMode === 'TEAM_VELOCITY'`, require:
  - `deliveryTeams >= 1`
  - `sprintVelocityPerTeam >= 1`
- if `capacityMode === 'DIRECT_SPRINT_CAPACITY'`, require:
  - `directSprintCapacity >= 1`
- percentages must satisfy:
  - `0 <= unassignedPercentage <= 100`
  - `0 <= svpAssignmentPercentage <= 100`

#### Additional validation

If `team.size` is provided and does not match `team.users.length`, do not fail hard. Either normalize or emit a warning. The service may choose to recompute size from users.

### 3.3 `buildDeliveryPlanInputsFromScenario(input)`

Create one `DeliveryPlanInput` per bundle.

#### Rules

- generation scope remains **bundle-scoped**
- each bundle becomes one `DeliveryPlanInput`
- use:
  - `scopeType: 'BUNDLE'`
  - `scopeId: persisted bundle id`
- planning fields are copied from `bundle.planning`

#### Return shape

```ts
type BuiltBundlePlanInput = {
  bundleTempId: string;
  bundleName: string;
  bundleId: string;
  input: DeliveryPlanInput;
};
```

### 3.4 `previewDemoScenario(input, actor)`

Must:

1. validate the scenario
2. perform any temporary normalization
3. avoid mutating work-item data
4. simulate bundle-level planning preview by using the existing delivery engine

#### Important implementation rule

Because `previewDeliveryPlan(...)` resolves actual scope entities via `resolveScope(...)`, the service needs a valid `scopeId` for each bundle preview.

Therefore preview may provision bundles and apps first, as long as:

- they are marked with `demoTag`
- preview does not create work items
- provisioning is treated as idempotent setup for both preview and install

That is acceptable because bundles, apps, and users are part of sample data anyway.

#### Preview response shape

```ts
type DemoScenarioPreviewResponse = {
  scenarioKey: string;
  scenarioName: string;
  bundlePreviews: Array<{
    bundleTempId: string;
    bundleId: string;
    bundleName: string;
    previewId: string;
    milestoneCount: number;
    sprintCount: number;
    roadmapPhaseCount: number;
    epicCount: number;
    featureCount: number;
    storyCount: number;
    taskCount: number;
  }>;
  totals: {
    bundles: number;
    applications: number;
    users: number;
    milestones: number;
    sprints: number;
    roadmapPhases: number;
    epics: number;
    features: number;
    stories: number;
    tasks: number;
  };
  warnings?: string[];
};
```

#### Counting requirement

Counts must be computed from preview output, not guessed.

### 3.5 `installDemoScenario(input, actor)`

This is the main generation path.

#### Required behavior

1. validate the scenario
2. optionally reset existing sample data if `resetBeforeInstall === true`
3. compute final `demoTag`
4. provision users
5. provision bundles
6. provision applications
7. optionally provision bundle assignments if needed
8. build bundle-level `DeliveryPlanInput`s
9. call `previewDeliveryPlan(...)`
10. call `createDeliveryPlan(...)`
11. tag all generated artifacts with `demoTag`
12. run demo enrichment
13. return install summary

#### Return shape

```ts
type DemoScenarioInstallResponse = {
  scenarioKey: string;
  scenarioName: string;
  demoTag: string;
  bundlesCreatedOrUpdated: number;
  applicationsCreatedOrUpdated: number;
  usersCreatedOrUpdated: number;
  planRuns: Array<{
    bundleId: string;
    bundleName: string;
    previewId: string;
    runId: string;
    milestoneCount: number;
    sprintCount: number;
    roadmapPhaseCount: number;
    workItemCount: number;
  }>;
  totals: {
    milestones: number;
    sprints: number;
    roadmapPhases: number;
    workItems: number;
  };
};
```

### 3.6 `resetDemoScenarioData(...)`

This replaces the current simplistic reset behavior.

#### Required behavior

Delete all records tagged with the target demo tag, or all sample/demo-tagged records when resetting globally.

#### Must support

- reset all sample/demo data
- optional reset by `demoTag`

#### Minimum supported collections

- `users`
- `bundles`
- `applications`
- `workitems`
- `milestones`
- `workitems_sprints`
- `work_roadmap_phases`
- `work_delivery_plan_runs`
- `work_plan_previews`
- `bundle_assignments` if sample-created
- any future sample-generated collections created by this feature

#### Important

Only delete sample/demo-tagged documents.

Never delete baseline data.

### 3.7 `enrichGeneratedDemoArtifacts(...)`

This function applies demo-only shaping after plan creation.

Do not move demo logic into `deliveryPlanGenerator.ts`.

---

## Data Persistence Rules

### 4. Demo tagging

Every created or updated sample entity must carry demo metadata.

#### Required fields

Every sample-created document must include:

- `demoTag`
- `demoScenarioKey`

Whenever practical, also include:

- `updatedAt`
- `createdAt`
- `updatedBy`
- `createdBy`

#### Demo tag generation

Do not hardcode `sample-v1`.

Use:

- `demoScenarioKey`: logical scenario identity
- `demoTag`: install instance identity

#### Recommended format

- `demoScenarioKey`: `default-demo`
- `demoTag`: `default-demo-2026-03-14T16-30-12-123Z`

Use a filesystem-safe or normalized ISO suffix.

#### Reset compatibility

The reset API should be able to:

- wipe all demo-tagged docs
- optionally wipe a single scenario
- optionally wipe a specific install tag

For the first implementation, wiping all demo-tagged data is sufficient if the API contract already anticipates future narrowing.

### 5. User provisioning rules

Provision scenario users into the `users` collection.

#### Upsert key

Use normalized lowercase email as the unique match key.

#### Required fields

- `name`
- `username`
- `email`
- `team`
- `role`
- `isActive`
- `demoTag`
- `demoScenarioKey`
- `updatedAt`

#### On insert

- `createdAt`
- `password`

#### Password handling

Use the scenario default password or fall back to:

```ts
'DemoUser!123'
```

Hash with bcrypt exactly like the current `ensureDemoUsers(...)`.

#### Important

Do not overwrite passwords on update.

### 6. Bundle provisioning rules

Provision bundles into `bundles`.

#### Upsert rule

If bundle `key` is present, upsert by `key`. Otherwise upsert by normalized name.

#### Required fields

- `key` if provided or generated
- `name`
- `description`
- `demoTag`
- `demoScenarioKey`
- `updatedAt`

#### On insert

- `createdAt`

#### Key generation

If missing, generate a stable bundle key from the bundle name.

Recommended helper:

- uppercase slug
- strip punctuation
- prefix with `DEMO-`

Example:

- `Payments Platform` -> `DEMO-PAYMENTS-PLATFORM`

### 7. Application provisioning rules

Provision applications into `applications`.

#### Upsert rule

Use `aid` if present. Otherwise use `(bundleId + normalized app name)` as the logical identity.

#### Required fields

- `aid`
- `key`
- `name`
- `bundleId`
- `isActive`
- `status`
- `demoTag`
- `demoScenarioKey`
- `updatedAt`

#### On insert

- `createdAt`

#### Aid generation

If not supplied, generate deterministic aid from bundle key + app name.

Example:

- `APP-DEMO-PAYMENTS-PLATFORM-CUSTOMER-API`

### 8. Bundle assignment provisioning

If the scenario indicates bundle-owner candidates, optionally write sample bundle assignments.

#### Collection

- `bundle_assignments`

#### Assignment type

Use the current assignment model conventions already present in the codebase, specifically:

- `bundle_owner`

#### Recommended behavior

For each bundle:

- assign one or more users marked `isBundleOwnerCandidate === true`
- mark those assignments with:
  - `demoTag`
  - `demoScenarioKey`

This improves owner suggestion behavior in the delivery engine and downstream UI.

---

## Demo Enrichment Rules

### 9. Demo-specific assignment strategy

This is a post-generation pass.

Do not implement this in the planning engine.

#### Inputs

- generated work item ids
- persisted scenario users
- assignment rules per bundle

#### Goal

Produce a realistic demo dataset where:

- some items are assigned
- some items are intentionally unassigned
- some items are assigned to SVP users
- some items are assigned to regular delivery users
- assignments vary enough to make dashboards useful

### 10. Assignment algorithm

For each generated bundle run:

#### 10.1 Partition users

Partition persisted scenario users into:

- bundle owners
- SVP candidates
- primary delivery users
- secondary delivery users
- unassignable users where `assignmentIntent === 'NONE'`

#### 10.2 Work item handling rules

##### Epics

If `assignEpicsAndFeaturesToOwners === true`:

- assign epics to:
  - bundle owners first
  - otherwise primary PM, Director, Architect, or Admin candidate
- if no candidates exist, leave unassigned

##### Features

If `assignEpicsAndFeaturesToOwners === true`:

- assign features similarly to epics
- distribute round-robin among bundle owners or PM-like users

##### Stories

If `assignStoriesAndTasksToTeamMembers === true`:

- stories go primarily to:
  - primary delivery users
  - secondarily to secondary users
- a percentage determined by `svpAssignmentPercentage` may go to SVP candidates
- a percentage determined by `unassignedPercentage` must remain unassigned if `leaveSomeUnassigned === true`

##### Tasks

Tasks should usually follow their parent story assignee unless overridden by demo rules.

Recommended rule:

- 70% inherit story assignee
- 15% may go to a different delivery user
- 15% remain unassigned when unassigned mode is enabled

This may be simplified if necessary, but the dataset must not end up fully assigned.

### 11. Assignment field updates

When assigning a work item, update:

- `assignedTo`
- `assigneeUserIds`

Use the user record’s email for `assignedTo` and actual user `_id` for `assigneeUserIds`.

When intentionally leaving unassigned:

- unset or clear `assignedTo`
- remove `assigneeUserIds`

Be consistent across all updated items.

### 12. Optional demo realism updates

Implement assignment enrichment now.

These are optional but recommended if low risk:

- mark a small subset of stories/tasks as `IN_PROGRESS`
- leave some as `TODO`
- mark a very small number as `DONE`
- optionally set `isFlagged` on a tiny subset
- optionally add labels like `demo`

Do not fabricate extensive comment or activity data in this phase unless it is trivial.

---

## UI Specification

### 13. Replace `AdminSamples.tsx`

`src/components/AdminSamples.tsx` must be rewritten as a scenario editor.

It must no longer render:

- collection checkboxes
- import-selected or import-all semantics

It must instead render a structured form.

### 14. Required page structure

#### Header area

Display:

- title: `Demo Scenario Builder`
- subtitle explaining that sample data is generated through the Delivery Plan Engine

#### Top action buttons

Required buttons:

- `Load Default Scenario`
- `Preview`
- `Generate Sample Data`
- `Reset Sample Data`
- `Refresh`

Optional:

- `Add Bundle`

### 15. Page state model

The component should keep:

- `scenario`
- `loading`
- `previewing`
- `installing`
- `resetting`
- `validationErrors`
- `previewResult`
- `installResult`
- `message`

#### Load flow

On mount:

- call `GET /api/admin/sample/scenario/default`
- populate local state with the returned scenario

Do not fetch sample collections anymore.

### 16. Bundle editor UI

For each bundle, render a card or panel.

#### Bundle section fields

- bundle name
- bundle key
- description
- remove bundle button

#### Applications section

Each app row should allow editing of:

- app name
- app aid
- phase
- health
- remove button

Buttons:

- add app

#### Planning section

Expose all planning fields relevant to `DeliveryPlanInput`:

- planned start date
- dev start date
- integration start date
- uat start date
- go-live date
- stabilization end date
- milestone count
- sprint duration weeks
- milestone duration strategy
- milestone duration weeks
- delivery pattern
- backlog shape
- stories per feature target
- features per milestone target
- tasks per story target
- project size
- capacity mode
- delivery teams
- sprint velocity per team
- direct sprint capacity
- create tasks under stories
- environment flow
- release type
- suggest milestone owners
- suggest work item owners
- create dependency skeleton
- preallocate stories to sprints
- auto link milestones to roadmap
- generate draft only

#### Teams section

For each team:

- team name
- team size display
- remove team button

For each user:

- name
- username
- email
- role
- team
- assignment intent
- SVP candidate toggle
- bundle owner candidate toggle
- remove user button

Buttons:

- add team
- add user

#### Demo assignment rules section

Per bundle:

- assign some to SVP
- leave some unassigned
- unassigned percentage
- SVP assignment percentage
- assign epics and features to owners
- assign stories and tasks to team members

### 17. Editing ergonomics

The form must support:

- adding/removing bundles
- adding/removing apps
- adding/removing teams
- adding/removing users
- editing all names and emails inline

All edits should remain in local client state until preview or install.

No autosave is required.

### 18. Preview UI

After `Preview`, display:

#### Per bundle

- milestone count
- sprint count
- roadmap phase count
- epic count
- feature count
- story count
- task count

#### Overall totals

- bundle count
- application count
- user count
- milestone count
- sprint count
- roadmap phase count
- epic count
- feature count
- story count
- task count

If validation fails, show actionable errors.

### 19. Install result UI

After install, show:

- generated demo tag
- per-bundle plan run summary
- totals
- success message

Raw JSON output is acceptable as a fallback, but a structured summary is preferred.

---

## API Specification

### 20. New endpoints

Add the following routes.

#### 20.1 `GET /api/admin/sample/scenario/default`

Returns the default editable scenario.

##### Response

```json
{
  "scenario": {}
}
```

#### 20.2 `POST /api/admin/sample/scenario/preview`

Preview the scenario.

##### Request body

```json
{
  "scenario": {}
}
```

##### Response

```json
{
  "success": true,
  "preview": {}
}
```

##### Error cases

- `400` validation errors
- `401` unauthenticated
- `403` unauthorized
- `500` unexpected failure

#### 20.3 `POST /api/admin/sample/scenario/install`

Install the scenario.

##### Request body

```json
{
  "scenario": {}
}
```

##### Response

```json
{
  "success": true,
  "result": {}
}
```

#### 20.4 `POST /api/admin/sample/reset`

Keep this route, but update it.

##### Request body

Support optional:

```json
{
  "demoTag": "optional-install-tag"
}
```

##### Behavior

If omitted, reset all sample/demo-tagged data.

### 21. Existing routes to deprecate

Deprecate or stop using:

- `GET /api/admin/sample/status`
- `POST /api/admin/sample/install` with the old collections payload

These may remain temporarily for compatibility, but the new UI must not depend on them.

### 22. Admin auth requirement

All new admin sample endpoints must keep the existing admin gate pattern:

- resolve current user from JWT cookie
- verify `isAdmin(userId)`

Reuse the existing route style in the current admin sample endpoints.

---

## Seed and Bootstrap Refactor Requirements

### 23. Move orchestration out of `seed.ts`

`src/lib/bootstrap/seed.ts` currently owns too much.

Refactor it so that:

- default demo scenario data lives in `sampleScenarioService.ts` or a dedicated constants file
- install and reset logic delegate to the new service

#### Allowed transitional state

`runSampleBootstrap(...)` may remain as a thin wrapper if needed for startup hooks or script compatibility, but it must call the new scenario service.

### 24. Preserve script compatibility

Existing scripts such as:

- `scripts/bootstrap-sample.ts`
- `scripts/reset-sample.ts`

must continue to work.

#### New behavior

They should use the default demo scenario and the new service.

---

## File-by-File Implementation Plan

### 25. Create new files

#### Required

- `src/types/demoScenario.ts`
- `src/services/sampleScenarioService.ts`
- `src/app/api/admin/sample/scenario/default/route.ts`
- `src/app/api/admin/sample/scenario/preview/route.ts`
- `src/app/api/admin/sample/scenario/install/route.ts`

#### Optional helpers if needed

- `src/lib/demoScenario/defaults.ts`
- `src/lib/demoScenario/helpers.ts`

### 26. Modify existing files

- `src/components/AdminSamples.tsx`
  - rewrite completely
- `src/lib/bootstrap/seed.ts`
  - remove hardcoded orchestration responsibility
  - use the new service
  - keep reset compatibility
- `src/app/api/admin/sample/reset/route.ts`
  - update to use the new reset service
- `src/app/api/admin/sample/install/route.ts`
  - may remain as a compatibility route, but should delegate to the new installer or default-scenario install path

---

## Implementation Constraints

### 27. Do not modify `deliveryPlanGenerator.ts` for demo logic

This is a strict rule.

The generator should remain generic.

Allowed changes there are only:

- small helper extraction if absolutely necessary
- no demo-specific branching
- no knowledge of SVP assignment, intentionally unassigned demo work, or sample scenario semantics

### 28. Scope type must remain `BUNDLE`

Even though the UI edits applications under bundles, plan generation must remain bundle-scoped for now.

Do not generate one plan per application.

### 29. Do not bring back static collection import behavior

The goal is generated sample data, not importing hand-authored manifest collections.

Static sample seed files may remain in the repo, but this feature must no longer center on them.

### 30. Idempotency expectations

For install:

- users, bundles, and apps must be upsert-safe
- work items are generated fresh per install
- reset-before-install is the default-safe path

#### Recommended first-version strategy

Use destructive reinstall semantics:

1. reset demo data
2. recreate it from the scenario

This is safer than trying to intelligently diff old and new generated plans.

### 31. Preview persistence tradeoff

Because the current preview API stores previews in the database and depends on resolvable scope, the preview step is allowed to provision demo bundles, apps, and users first.

That is acceptable.

However:

- preview must not create work items
- preview must not run `createDeliveryPlan(...)`
- preview-created bundles, apps, and users must still be demo-tagged so reset remains safe

### 32. Duplicate handling rules

#### Users

Match by normalized email.

#### Bundles

Prefer `key`; fallback to normalized name.

#### Apps

Prefer `aid`; fallback to `(bundleId + normalized name)`.

#### Teams and temp IDs

These are UI-level only and do not need to persist.

### 33. Utility helpers

Codex should implement helpers for:

- normalize email
- slugify bundle and app names into keys
- generate `demoTag`
- build delivery inputs
- summarize preview counts
- summarize created run counts
- partition users by role and assignment intent

---

## Acceptance Criteria

### 34. UI acceptance

- Opening Admin > Sample Data shows a pre-populated editable scenario form.
- No checkbox collection-import UI remains.
- Admin can add/remove bundles.
- Admin can add/remove apps under a bundle.
- Admin can edit users, emails, roles, and teams.
- Admin can adjust planning fields.
- Admin can preview before install.
- Admin can generate sample data.
- Admin can reset sample data.

### 35. Backend acceptance

- Sample generation calls `previewDeliveryPlan(...)` and `createDeliveryPlan(...)`.
- The delivery engine remains generic.
- Users, bundles, and apps are upserted from scenario input.
- Generated artifacts are tagged with `demoTag` and `demoScenarioKey`.
- Reset deletes only demo/sample-tagged records.

### 36. Demo realism acceptance

- At least some generated stories/tasks are assigned.
- At least some generated stories/tasks are left unassigned when configured.
- At least some generated stories/tasks can be assigned to SVP candidates when configured.
- The dataset is useful for dashboards and AI insights.

### 37. Compatibility acceptance

- Existing sample reset still works.
- Existing sample bootstrap scripts still work, using the new scenario service under the hood.

---

## Testing Requirements

### 38. Unit tests or functional checks

At minimum, Codex should verify these scenarios manually or with tests.

#### Validation

- invalid duplicate bundle names are rejected
- invalid duplicate app names within a bundle are rejected
- invalid user email is rejected
- invalid percentage is rejected

#### Preview

- preview returns per-bundle counts
- preview does not create work items
- preview-created setup data can be reset cleanly

#### Install

- install creates or upserts users
- install creates or upserts bundles and apps
- install generates milestones, sprints, and work items
- generated records contain `demoTag`

#### Enrichment

- some stories/tasks are assigned
- some remain unassigned when configured
- some can be assigned to SVP users when enabled

#### Reset

- reset removes demo-tagged sample entities
- baseline entities remain untouched

---

## Suggested Default Scenario Content

### 39. Minimum default scenario

Ship with 2 bundles.

#### Bundle 1

- Payments platform
- 2 or 3 apps
- migration-style delivery settings
- 2 to 3 teams
- mixed PM, engineering, architect, and SVP demo users

#### Bundle 2

- Customer engagement or reporting platform
- 2 or 3 apps
- different planning profile to make the demo richer
- separate team composition

This ensures dashboards show cross-bundle variety.

---

## Codex Notes on Existing Code Migration

### 40. What to delete or reduce

In `src/lib/bootstrap/seed.ts`, reduce direct ownership of:

- `DEMO_USERS`
- `DEMO_BUNDLE_BLUEPRINTS`
- `ensureDemoUsers(...)`
- `ensureDemoBundlesAndApps(...)`
- `runGeneratedSampleBootstrap(...)`

These may temporarily remain as wrappers around the new service during the refactor, but the new service must become the source of truth.

### 41. What to preserve

Keep:

- current admin auth route patterns
- the current reset-safe tagging concept
- use of bcrypt for demo user password hashing
- use of existing `previewDeliveryPlan(...)`
- use of existing `createDeliveryPlan(...)`

---

## Final Instruction to Codex

Implement this as a clean refactor, not as an additive side path.

The new **Demo Scenario Builder** must become the canonical sample-data experience in the Admin module, and all generated planning artifacts must come from the existing Delivery Plan Engine plus a demo-only enrichment pass.
