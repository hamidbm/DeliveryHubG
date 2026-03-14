The current codebase is already partway there:

-   `src/components/AdminSamples.tsx` still renders the old **collection-checkbox** style UI.

-   `src/lib/bootstrap/seed.ts` no longer really imports arbitrary sample collections for the main scenario; it already creates demo bundles/apps/users and then calls:

    -   `previewDeliveryPlan(...)`

    -   `createDeliveryPlan(...)`

-   The delivery engine currently generates the plan correctly, but the **sample installer is still hard-coded around static blueprints** (`DEMO_BUNDLE_BLUEPRINTS`, `DEMO_USERS`) instead of a rich editable admin-facing intake model.

What I recommend
----------------

Treat **Sample Data Generation** as a specialized wrapper around the existing **Delivery Plan Engine**.

That means:

-   Keep the Delivery Plan Engine as the system of record for generating:

    -   roadmap phases

    -   milestones

    -   sprints

    -   epics

    -   features

    -   stories

    -   tasks

-   Replace the Admin Sample screen with a **Demo Scenario Builder**

-   Persist a **demo scenario payload** that contains:

    -   bundles

    -   apps under each bundle

    -   demo users

    -   team structure

    -   environment dates

    -   planning parameters

    -   assignment behavior

    -   demo tagging rules

Best architecture
-----------------

Use a 3-layer model.

### 1. Demo Scenario Definition

Create a new type, separate from `DeliveryPlanInput`, for example:

`DemoScenario`

This should model the editable admin form.

Suggested structure:

type DemoScenario = {\
  name: string;\
  demoTag: string;\
  bundles: Array<{\
    tempKey: string;\
    name: string;\
    description?: string;\
    applications: Array<{\
      tempKey: string;\
      name: string;\
      aid?: string;\
      status?: {\
        phase?: string;\
        health?: 'Healthy' | 'Risk' | 'Critical';\
      };\
    }>;\
    planning: {\
      plannedStartDate?: string;\
      devStartDate: string;\
      integrationStartDate?: string;\
      uatStartDate: string;\
      stagingStartDate?: string;\
      prodStartDate?: string;\
      goLiveDate: string;\
      stabilizationEndDate?: string;\
      milestoneCount: number;\
      sprintDurationWeeks: number;\
      milestoneDurationStrategy: 'AUTO_DISTRIBUTE' | 'FIXED_WEEKS';\
      milestoneDurationWeeks?: number;\
      deliveryPattern: 'STANDARD_PHASED' | 'PRODUCT_INCREMENT' | 'MIGRATION' | 'COMPLIANCE';\
      backlogShape: 'LIGHT' | 'STANDARD' | 'DETAILED';\
      projectSize?: 'SMALL' | 'MEDIUM' | 'LARGE' | 'ENTERPRISE';\
      capacityMode?: 'TEAM_VELOCITY' | 'DIRECT_SPRINT_CAPACITY';\
      deliveryTeams?: number;\
      sprintVelocityPerTeam?: number;\
      directSprintCapacity?: number;\
      createTasksUnderStories?: boolean;\
      environmentFlow?: 'DEV_UAT_PROD' | 'DEV_SIT_UAT_PROD' | 'CUSTOM';\
      releaseType?: 'BIG_BANG' | 'PHASED' | 'INCREMENTAL';\
      suggestMilestoneOwners?: boolean;\
      suggestWorkItemOwners?: boolean;\
      createDependencySkeleton?: boolean;\
      preallocateStoriesToSprints?: boolean;\
      autoLinkMilestonesToRoadmap?: boolean;\
      themesByMilestone?: Array<{ milestoneIndex: number; themes: string[] }>;\
    };\
    teams: Array<{\
      name: string;\
      size: number;\
      users: Array<{\
        name: string;\
        email: string;\
        username?: string;\
        role: string;\
        team: string;\
        assignmentIntent?: 'PRIMARY' | 'SECONDARY' | 'NONE';\
      }>;\
    }>;\
    assignmentRules?: {\
      assignSomeToSVP?: boolean;\
      leaveSomeUnassigned?: boolean;\
      unassignedPercentage?: number;\
      svpAssignmentPercentage?: number;\
    };\
  }>;\
};

### 2. Scenario Provisioning Layer

This layer should:

-   create/update demo users

-   create/update bundles

-   create/update applications

-   create bundle assignments if needed

-   create planning metadata needed by the engine

-   convert each bundle's `planning` section into `DeliveryPlanInput`

-   call `previewDeliveryPlan`

-   call `createDeliveryPlan`

-   post-process generated artifacts for demo realism

This should replace the current hardcoded logic in:

-   `ensureDemoUsers`

-   `ensureDemoBundlesAndApps`

-   `runGeneratedSampleBootstrap`

### 3. Post-Generation Demo Enrichment

The Delivery Plan Engine should remain generic.

Do **not** pollute the core engine with demo-only behavior like "leave some tasks unassigned" or "assign some items to SVPs".

Instead, after `createDeliveryPlan(...)`, run a **demo enrichment pass** that:

-   tags all generated artifacts with `demoTag`

-   assigns a controlled subset of stories/tasks to:

    -   engineering users

    -   PM users

    -   some SVP users

-   leaves a controlled subset unassigned

-   optionally adjusts statuses across artifacts for dashboard realism

-   optionally seeds comments, activity, risk/dependency links, and review state later

That gives you realistic demo data without turning the generator into demo-specific logic.

Why this separation matters
---------------------------

The Delivery Plan Engine currently assumes neutral plan generation. That is correct.

The "demo realism" requirements are not planning rules. They are presentation and test-data rules.

So the right split is:

-   **planning engine** = generates structurally correct delivery plan

-   **demo scenario builder** = provides prefilled editable intake

-   **demo enrichment service** = shapes final artifacts for demo dashboards and AI insights

UI change I would make
----------------------

Replace the current `AdminSamples` checkbox page entirely.

New Admin screen behavior
-------------------------

### Header

-   Demo Scenario Builder

-   Actions:

    -   Reset Demo Data

    -   Load Default Scenario

    -   Save Scenario Template

    -   Preview Plan

    -   Generate Sample Data

### Main layout

Use expandable bundle cards.

Each bundle card contains:

#### Bundle section

-   Bundle name

-   Bundle key

-   Description

-   Add Bundle

-   Remove Bundle

#### Applications section

-   List of app rows under the bundle

-   Each row editable:

    -   app name

    -   optional app key / aid

    -   health

    -   phase

-   Add App

-   Remove App

#### Delivery planning section

This is effectively a nicer version of the delivery intake form:

-   planned start

-   dev

-   SIT

-   UAT

-   staging

-   prod

-   go-live

-   stabilization end

-   milestone count

-   sprint duration

-   delivery pattern

-   backlog shape

-   project size

-   team count

-   sprint velocity

-   environment flow

-   release type

-   toggles for dependency skeleton, sprint preallocation, milestone owner suggestions, etc.

#### Team and users section

-   Add team

-   Set team size

-   Add/remove demo users

-   Edit:

    -   name

    -   email

    -   role

    -   team

-   Mark some users as:

    -   engineering

    -   PM

    -   CMO

    -   SVP

    -   bundle owner

    -   observer

#### Demo behavior section

-   Assign some stories/tasks to SVP members

-   Leave some stories/tasks unassigned

-   Unassigned ratio

-   SVP assignment ratio

-   Mark scenario as demo-tagged

Implementation approach in this codebase
----------------------------------------

I would make these concrete changes.

### 1. Add new sample scenario types

Create something like:

-   `src/types/demoScenario.ts`

-   or add to `src/types.ts` if you want to stay consistent with the existing project style

### 2. Add a dedicated service

Create:

-   `src/services/sampleScenarioService.ts`

This service should expose:

-   `getDefaultDemoScenario()`

-   `validateDemoScenario(input)`

-   `installDemoScenario(input, actor)`

-   `resetDemoScenario(demoTag?)`

-   `enrichGeneratedDemoArtifacts(...)`

### 3. Move hardcoded demo blueprints out of `seed.ts`

Right now `seed.ts` contains:

-   `DEMO_USERS`

-   `DEMO_BUNDLE_BLUEPRINTS`

Those should become defaults returned by `getDefaultDemoScenario()`.

### 4. Simplify `runSampleBootstrap`

Instead of directly owning the whole flow, it should delegate:

const scenario = getDefaultDemoScenario();\
return await installDemoScenario(scenario, actor);

### 5. Replace `AdminSamples.tsx`

The current component is still built around manifest collections and checkboxes.

That should be replaced by a stateful editable scenario form.

### 6. Add new API routes

Suggested endpoints:

-   `GET /api/admin/sample/scenario/default`

-   `POST /api/admin/sample/scenario/preview`

-   `POST /api/admin/sample/scenario/install`

-   `POST /api/admin/sample/reset`

### 7. Add preview support before install

This is important.

The admin should be able to preview what will be generated before writing anything.

Flow:

1.  admin edits demo scenario

2.  click `Preview`

3.  server converts scenario bundle planning into `DeliveryPlanInput`

4.  call `previewDeliveryPlan(...)`

5.  return counts:

    -   milestones

    -   sprints

    -   epics

    -   features

    -   stories

    -   tasks

6.  show preview summary per bundle

7.  admin clicks `Generate Sample Data`

That will make the feature feel much more deliberate and aligned with the actual Delivery Engine.

Important design decision: bundle scope vs app scope
----------------------------------------------------

For demo generation, I recommend you keep plan generation primarily at **bundle scope**, because that matches the current sample bootstrap and the existing delivery plan flow more naturally.

Apps should still be created under the bundle and shown in the UI, but the plan generation should continue to target:

-   `scopeType: 'BUNDLE'`

unless you explicitly want one separate plan per app.

Important design decision: tagging
----------------------------------

Continue using `demoTag`, but improve it.

Right now it is a single hardcoded value:

-   `sample-v1`

That is too rigid.

Use either:

-   scenario-specific tag, for example `demo-payments-q2`

-   or generated install tag, for example `sample-2026-03-14T...`

Best option:

-   `scenarioKey` for logical identity

-   `demoTag` for install instance

Example:

{\
  scenarioKey: 'default-demo',\
  demoTag: 'default-demo-2026-03-14-153000'\
}

Then reset can support:

-   reset all demo data

-   reset one scenario

-   reset one install batch

Important design decision: idempotency
--------------------------------------

You have two valid choices.

### Option A: destructive reinstall

-   reset old demo data first

-   install the current scenario fresh

This is easiest and matches current behavior.

### Option B: scenario upsert

-   reuse existing bundles/users when keys match

-   remove only artifacts from the prior run for that scenario

For now, I recommend **Option A**. It is safer for demo data and simpler.

What I would not do
-------------------

I would not make the delivery engine itself aware of:

-   demo users

-   SVP-specific demo assignment behavior

-   intentionally unassigned work for dashboard demos

-   seeded comments or fake statuses

All of that belongs in the sample layer after generation.

Recommended execution order
---------------------------

1.  Introduce `DemoScenario` model

2.  Extract hardcoded sample config from `seed.ts`

3.  Build `sampleScenarioService.ts`

4.  Replace `AdminSamples.tsx` with editable scenario form

5.  Add preview/install APIs

6.  Add post-generation assignment enrichment

7.  Add optional save/load scenario templates later

My recommendation for the next implementation task
--------------------------------------------------

Start with this slice:

-   replace the current Sample Data admin page with the new editable scenario form

-   back it with a default scenario derived from today's hardcoded demo blueprint

-   wire `Generate Sample Data` to a new install endpoint that:

    -   provisions bundles/apps/users

    -   calls the Delivery Plan Engine

    -   tags everything with `demoTag`

Then, in a second pass, add:

-   preview

-   advanced assignment controls

-   scenario template persistence

-   intentional unassigned/SVP allocation rules

This is a clean refactor and fits the current codebase well