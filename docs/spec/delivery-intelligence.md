- My suggestion to ChatGPT: Here are two big features I am thinking about (and you can suggest more): (1) "automatic creation of a set of relate work items". What do I mean by that? In the old days (before AI), we used to create all the items manually by hand using the UI: the admin/project manager would first create an Epic, then he creates many Features under the epic, and then other people (like engineers) create User Stories under features, etc... Every creation is manual (including creating milestones, roadmaps and kanban ....). In this modern time, we need to automate as much as possible. For example, using AI, with a prompt we can tell the UI to create all the work item artifacts (including milestones, roadmap, sprints, ...). And this can also be done without even using AI: for example, when a user clicks on a specific icon, a form could be displayed to ask the user to fill in the minimum quantity of information and from that information the UI would create all the necessary artifacts (Epic, set of features, User Stories under features, a roadmap, milestones, and sprints) all at once without any manual creation (the user could customize the User Stories later specifying more info in them like adding attachments, comments and description). The minimum info the form could ask the user could be things like: name of the bundle (or app if there is no bundle), go live date for production (and other dates such as when UAT starts and finishes, when dev environment starts and finishes), how many milestones will be, what is on average the duration of each milestone in weeks, and maybe mention a list of big features in each milestone). This automatic creation of a set of related artifacts (milestones, roadmap, sprints, user stories, features, epic) can reduce the need for manually creating every artifact. (2) Another similar feature: brainstorm on a good and solid choice of what epic, features should be when things are created in an automatic way (not manually by a user). Consider the following use-case as just one example: an SVP architect publishes a design document in the Wiki and immediately creates a "Review Request". This should automatically trigger the creation of a User Story assigned to the reviewers to complete the review. The reason for creating a user story for this is that all the work done by anybody could be recorded by some user story and as a consequence of that, graphical dashboards and notifications would be able to see every work that is happening, delayed, blocked, on-time, etc... and generate all types of reports. To automatically create a user store (when someone creates a "Review Request"), this means we already have some convention on what an Epic is and what a Feature is. For example, one convention is to decide that each "Bundle" represents an Epic and the epic name would be the bundle name + "Epic" (if the bundle is called "GPS" as an example, then the corresponding epic would be called "GPS Epic"), and if there is no bundle but just an app, then app becomes an Epic, and milestones become features, and the features mentioned in each milestone (in the intake form) could become User Stories, and Engineers can simply create "tasks" later under the user stories when they have more details. The important question is to choose the best convention so that we can start creating user stories in an automatic way when any piece of work is created (such as creating a "Review Request" as an example).

- ChatGPT's response: ou are thinking in exactly the right direction. What you’re proposing is the shift from:

> ❌ manual ticket factoryto✅ **work orchestration system**

This is how Jira-like tools evolve into **delivery intelligence platforms**.

I’ll structure this brainstorming at an architectural level so you can give Codex something solid and future-proof.

🔥 First: Quick evaluation of Codex’s suggestions
=================================================

Codex suggested:

1.  Show archived toggle

2.  Indexes on attachments

3.  Bulk reparenting

4.  Per-item delete permissions


### Verdict

These are **good hygiene**, not strategic differentiation.

*   ✅ Keep them

*   ❌ They won’t move the product forward


Your two ideas **are the real leverage**.

🚀 Your Feature #1: Automatic Work Structure Creation
=====================================================

This is extremely high value.

What you are describing is essentially:

> **Project scaffolding / delivery bootstrapping**

Modern platforms that do this well:

*   Azure DevOps (process templates)

*   Linear (issue templates)

*   GitHub Projects (auto workflows)

*   But **none** do it intelligently with AI the way you can.


🧠 Two complementary modes (you correctly identified)
-----------------------------------------------------

You should support BOTH:

### Mode A — Structured intake (non-AI deterministic)

User fills minimal form → system generates full structure.

### Mode B — AI-generated plan

User gives intent → AI proposes structure → user confirms → system creates.

**Do not pick one. You need both.**

🏗️ Recommended Architecture: Work Blueprint Engine
===================================================

Instead of ad-hoc automation, create a first-class concept:

> **Work Blueprint**

This will pay massive dividends later.

New Concept: work\_blueprints collection
----------------------------------------

This defines how to auto-create structures.

Example:

```typescript
work_blueprints {
  _id
  name: "Cloud Migration Standard"
  scope: "bundle" | "application"
  version
  template: {
    epicStrategy
    milestoneStrategy
    sprintStrategy
    featureStrategy
    storyStrategy
  }
  createdAt
}
```

🧭 Your Convention Question (VERY IMPORTANT)
============================================

You asked the right architectural question:

> What should Epic / Feature / Story map to?

Let’s evaluate your proposal.

Your proposed convention
------------------------

You suggested:

*   Bundle → Epic

*   Milestone → Feature

*   Feature list → Stories

*   Engineers → Tasks


### 👍 What’s good

*   Deterministic

*   Easy to explain

*   Works for migration programs

*   Scales across bundles


### ⚠️ Hidden risks

This model **can become too rigid**.

Why?

Because not all work fits milestone-driven structure.

Examples that will break:

*   Hotfix work

*   Tech debt

*   Research spikes

*   Security remediations

*   Cross-bundle initiatives


✅ Recommended Canonical Mapping (future-proof)
==============================================

This is what I strongly recommend.

Primary hierarchy (semantic)
----------------------------

```code
Epic = Delivery Objective (usually Bundle or major initiative)
Feature = Capability or Milestone slice
Story = Executable unit of work
Task = Engineering steps
```

BUT introduce an abstraction layer
----------------------------------

Instead of hardcoding:

> Bundle == Epic

Use:

> **Epic is derived from Scope**

### Rule engine

```code
IF bundle exists → epic per bundle
ELSE IF application exists → epic per application
ELSE → epic per initiative
```

This keeps flexibility.

🧠 Your Feature #2: Event-Driven Work Creation (THIS IS GOLD)
=============================================================

Your review-triggered story idea is **exactly right**.

This is the beginning of:

> **Work telemetry**

You want every meaningful activity to optionally spawn trackable work.

This is powerful.

Introduce: Work Generators (event-driven)
-----------------------------------------

Create a new system concept:

```code
work_generators
```

Example:

```typescript
work_generators {
  eventType: "review.requested"
  enabled: true
  blueprintId
  assignmentStrategy
  priorityStrategy
}
```

Example flows you should support
--------------------------------

### ✅ Review Request → Review Story

When:

```code
review.requested
```

System auto-creates:

```code
Story: "Review <artifact name>"
Assigned to: reviewers
Due date: review due
Parent: derived feature/epic
```

### ✅ Wiki publish → Implementation backlog (optional)

When:

```code
wiki.article.published
```

AI suggests:

*   Implementation stories

*   Follow-ups

*   Risks


User confirms → stories created.

### ✅ Architecture diagram approved → tasks created

Future but powerful.

🎯 The Minimum Intake Form (your idea)
======================================

Your instinct is correct: ask **minimal structured inputs**.

I recommend this exact v1 intake.

Required fields
---------------

*   Scope (Bundle or App)

*   Go-live date

*   Environment timeline:

    *   Dev start

    *   UAT window

    *   Prod date

*   Number of milestones

*   Average milestone duration

*   Optional: major capability list


Optional AI assist button
-------------------------

```code
✨ Generate plan with AI
```

AI fills:

*   milestones

*   features

*   stories


User edits → confirms → create.

🚀 High-impact additional features you should strongly consider
===============================================================

These are the features that will make your Work Items module feel **next generation**.

🔥 Feature: Smart Work Health Engine
------------------------------------

You already hinted at this.

Every story/feature/epic should compute:

*   schedule risk

*   dependency risk

*   scope risk

*   staffing risk


Displayed as:

```code
🟢 On track
🟡 At risk
🔴 Blocked
```

This is extremely valuable for executives.

🔥 Feature: Focus Modes in Work Items
-------------------------------------

Add quick filters:

*   My Work

*   At Risk

*   Blocked

*   Due Soon

*   Needs Review


This dramatically improves usability.

🔥 Feature: AI Backlog Grooming Assistant
-----------------------------------------

Very high ROI.

User clicks:

```code
✨ Groom backlog
```

AI suggests:

*   split oversized stories

*   merge duplicates

*   add missing acceptance criteria

*   detect vague descriptions


🔥 Feature: Dependency Graph (future but powerful)
--------------------------------------------------

Visualize:

```code
Story A → Story B → Story C
```

This becomes huge for migration programs.

🔥 Feature: Work from Reviews Dashboard
---------------------------------------

You already started this path.

Eventually you want:

> Reviews ↔ Work Items ↔ Wiki ↔ Architecture

Fully cross-linked.

You are on the right trajectory.

🧭 Recommended Implementation Order (very important)
====================================================

If you want maximum impact with minimal risk:

### Phase 1 (do next)

*   Work Blueprint engine

*   Review → Story generator

*   Intake auto-structure (non-AI)

*   Archived toggle (quick win)

*   Attachment indexes (quick win)


### Phase 2

*   AI structure generator

*   Health engine

*   Focus modes

*   Bulk reparent drag


### Phase 3

*   AI backlog grooming

*   Dependency graph

*   Predictive delivery risk

*   Cross-module orchestration


✅ Bottom line
=============

Your two proposed features are **strategically excellent**.

The key architectural move is:

> **Do not implement one-off automation.**Build a reusable **Work Blueprint + Work Generator engine**.

That will unlock:

*   automatic story creation

*   review-driven work

*   AI planning

*   portfolio intelligence


Below is a complete, Codex-ready package: **decision matrix**, **AI plan prompt design**, **Mongo schemas**, **event→work mapping**, and **implementation spec**, including **how blueprints work**, **where they’re defined**, and **how to ship with preloaded defaults**.

1) Canonical Epic / Feature / Story / Task Decision Matrix
==========================================================

### Core semantic meaning (keep stable)

*   **Epic** = delivery objective / initiative container (scope-based)

*   **Feature** = coherent slice of value or milestone slice (timebox or capability)

*   **Story** = executable unit of work that delivers measurable outcome

*   **Task** = implementation steps under a story


### Decision matrix (how to derive hierarchy)

|Input context|Epic rule|Feature rule|Story rule|Notes|
|:---|---|---|---|---:|
|Bundle exists1| Epic per Bundle (default)|Features = Milestones OR Capability slices (blueprint chooses)|Stories = work items generated under features|Default for migration programs|
|No Bundle, App exists|1 Epic per App|Features = Milestones or Capabilities|Stories under features|App-level initiative|
|Cross-bundle initiative|1 Epic per Initiative|Features = Workstreams|Stories = deliverables|Allows non-bundle work|
|Review request (Wiki/Architecture)|Epic derived from resource scope (bundle/app)|Feature derived from “Governance / Reviews” or current milestone|Story = “Review artifactId”|Review work becomes trackable|
|Operational/tech debt|Epic derived from bundle/app OR “Ops & Hygiene” epic|Feature = workstream (e.g., Security)|Story = actionable chunk|Avoid polluting milestone features|
|Release / go-live planning|Epic = bundle/app delivery|Feature = milestone/timebox|Stories = tasks for release readiness|Timeline-driven blueprint|
| | | | | |

### Two approved feature strategies (blueprint parameter)

*   **Timebox strategy**: Feature = Milestone (Milestone 1..N)

*   **Capability strategy**: Feature = Capability slice (Auth, Networking, Data, Observability, etc.)

*   Hybrids are allowed but start with one.


2) Blueprint System Concept
===========================

What is a Blueprint?
--------------------

A **Blueprint** is a reusable “project scaffolding recipe” that defines:

1.  how to derive Epic/Feature structure from context

2.  how to create milestones/sprints (optional)

3.  how to generate initial stories/tasks

4.  how event-triggered work is attached into that structure


Blueprints support both:

*   **Deterministic intake** (non-AI): form → create structure

*   **AI-assisted plan**: AI proposes structure → user edits → create


Where blueprints are defined
----------------------------

### Admin module (recommended)

Add an **Admin → Blueprints** screen:

*   list blueprints

*   set default blueprint per org (or per bundle type)

*   enable/disable a blueprint

*   edit blueprint parameters (durations, naming, strategies)

*   “Reset to factory defaults” button


### Non-admin users

Users can only **choose** among enabled blueprints when creating a plan (if allowed), but cannot edit.

How to ship with predefined blueprints (no admin work required)
---------------------------------------------------------------

On app startup (or first admin visit), run a **seed** routine:

*   if work\_blueprints is empty → insert built-in blueprints

*   if not empty → do nothing (don’t overwrite admin changes)

*   version built-ins, but do not auto-migrate without explicit action


3) MongoDB Schemas
==================

3.1 work\_blueprints collection
-------------------------------

```JavaScript
work_blueprints: {
  _id: ObjectId,
  key: "migration_standard_v1",          // stable id
  name: "Cloud Migration Standard",
  description: "Bundle→Epic, Milestones→Features, Stories from intake/AI.",
  version: 1,
  enabled: true,
  isBuiltIn: true,

  // Which contexts can use this blueprint
  scopeTypes: ["bundle", "application", "initiative"],

  // Hierarchy mapping rules
  mapping: {
    epic: {
      strategy: "per_scope",             // per_scope | per_initiative
      nameTemplate: "{scopeName} Epic"
    },
    feature: {
      strategy: "milestones",            // milestones | capabilities
      nameTemplate: "Milestone {n}: {label}",
      includeGovernanceFeature: true,    // creates a "Governance / Reviews" feature
      governanceFeatureName: "Governance & Reviews"
    },
    story: {
      defaultType: "story",
      naming: {
        reviewStoryTemplate: "Review: {resourceTitle}",
        genericTemplate: "{verb}: {noun}"
      }
    }
  },

  // Default planning parameters
  planningDefaults: {
    milestoneCount: 4,
    milestoneDurationWeeks: 3,
    sprintDurationWeeks: 2,
    defaultDueDateDays: 5
  },

  // Which artifacts to create from intake
  generators: {
    createMilestones: true,
    createSprints: true,
    createRoadmap: true
  },

  createdAt: Date,
  updatedAt: Date
}
```

**Indexes**

*   { key: 1 } unique

*   { enabled: 1, isBuiltIn: 1 }


3.2 work\_generators collection (event-driven automation)
---------------------------------------------------------

```javascript
work_generators: {
  _id: ObjectId,
  eventType: "reviews.cycle.requested",      // must match event naming standard
  enabled: true,
  blueprintKey: "migration_standard_v1",

  // Derive where to attach the work item
  attach: {
    epicStrategy: "from_resource_scope",      // from_resource_scope | explicit
    featureStrategy: "governance_feature",    // governance_feature | current_milestone | explicit
  },

  // What to create when event occurs
  output: {
    createWorkItem: true,
    type: "story",
    titleTemplate: "Review: {resourceTitle}",
    descriptionTemplateMd:
      "Please review [{resourceTitle}]({resourceUrl}).\\n\\nReview Cycle: {cycleNumber}\\nDue: {dueAt}",
    priority: "p1",
    status: "todo"
  },

  // Assignments
  assignment: {
    strategy: "reviewers",                    // reviewers | requester | explicit_users
    explicitUserIds: []
  },

  // Dedup rules
  dedup: {
    strategy: "one_per_cycle",                // one_per_cycle | one_per_resource_active
    keyTemplate: "{eventType}:{reviewId}:{cycleId}"
  },

  createdAt: Date,
  updatedAt: Date
}
```

**Indexes**

*   { eventType: 1 } unique

*   { enabled: 1 }


3.3 work\_plans collection (optional but strongly recommended)
--------------------------------------------------------------

This stores each “scaffolded plan” created by intake or AI, and links created objects.

```javascript
work_plans: {
  _id: ObjectId,
  scope: { type: "bundle"|"application"|"initiative", id: ObjectId, name: string },
  blueprintKey: "migration_standard_v1",
  mode: "intake"|"ai",
  input: { ... },                       // intake fields or AI prompt summary
  output: {
    epicId: ObjectId,
    featureIds: ObjectId[],
    milestoneIds: ObjectId[],
    sprintIds: ObjectId[],
    storyIds: ObjectId[]
  },
  createdBy: ActorRef,
  createdAt: Date
}
```

**Indexes**

*   { "scope.type": 1, "scope.id": 1, createdAt: -1 }


4) Event → Work Mapping Table (v1)
==================================

|Event type|What triggers|Output work item|Attach location|Assignee|Dedup|
|:---|---|---|---|---|---|
|reviews.cycle.requested|Review submitted|Story “Review: \<resource\>”|Epic from resource scope; Feature = Governance & Reviews (or current milestone)|reviewers\[\]|one\_per\_cycle|
|reviews.cycle.resubmitted|Vendor resubmit|Story “Re-review: (Cycle N)”|same|reviewers\[\]|one\_per\_cycle|
|wiki.page.published(optional)|Page published|Task/Story “Implement next steps from ” OR none by default|Epic from scope; Feature = current milestone|requester|one\_per\_resource\_active|
|architecture.diagram.created(optional)|Diagram created|Story “Review diagram: \<title\>”|governance feature|assigned\_cmo / reviewers|one\_per\_resource\_active|
|comments.mention.created(optional)|Mention event|Task “Respond to mention”|attach to epic from scope|mentioned user|one\_per\_event|
| | | | | | |

<p class="slate-paragraph">Recommendation: start only with <strong class="slate-bold">reviews.cycle.requested</strong> and <strong class="slate-bold">reviews.cycle.resubmitted</strong> in v1.</p>

# 5) AI Plan Generation Prompt Design
## 5.1 Inputs to AI (structured, not raw)

Provide AI a JSON “planning input” object:

```json
{
  "scope": { "type": "bundle", "name": "GPS", "bundleId": "..." },
  "dates": {
    "devStart": "2026-03-01",
    "uatStart": "2026-04-01",
    "uatEnd": "2026-04-20",
    "goLive": "2026-05-01"
  },
  "milestones": {
    "count": 4,
    "avgDurationWeeks": 3,
    "optionalThemes": [
      { "milestone": 1, "themes": ["Network setup", "Landing zone"] },
      { "milestone": 2, "themes": ["App refactor", "CI/CD"] }
    ]
  },
  "constraints": {
    "sprintDurationWeeks": 2,
    "defaultReviewDueDays": 5
  },
  "blueprintKey": "migration_standard_v1"
}
```

Return JSON only:

```json
{
  "epic": { "title": "GPS Epic", "descriptionMd": "..." },
  "features": [
    {
      "title": "Milestone 1: Foundation",
      "start": "2026-03-01",
      "end": "2026-03-21",
      "stories": [
        { "title": "Create Landing Zone", "type": "story", "descriptionMd": "...", "acceptanceCriteria": ["..."] },
        { "title": "Set up Network Baseline", "type": "story", "descriptionMd": "...", "acceptanceCriteria": ["..."] }
      ]
    }
  ],
  "sprints": [
    { "name": "Sprint 1", "start": "2026-03-01", "end": "2026-03-14" }
  ],
  "assumptions": ["..."],
  "risks": ["..."]
}
```

## 5.3 Prompt template (Codex can embed)

<p class="slate-paragraph">System prompt (internal):</p><ul class="slate-ul"><li class="slate-li"><div style="position:relative">“You are a delivery planner for cloud migration…”</div></li><li class="slate-li"><div style="position:relative">“Return valid JSON matching schema…”</div></li></ul><p class="slate-paragraph">User prompt:</p><ul class="slate-ul"><li class="slate-li"><div style="position:relative">include planning input JSON</div></li><li class="slate-li"><div style="position:relative">instruct to map to blueprint strategy</div></li><li class="slate-li"><div style="position:relative">keep story count reasonable (e.g., 6–12 per milestone)</div></li></ul>

# 6) How Blueprint Derivation Works (Mechanics)
## 6.1 Derive scope
<p class="slate-paragraph">From user selection or from resource metadata:</p><ul class="slate-ul"><li class="slate-li"><div style="position:relative">if resource.bundleId exists → scope=bundle</div></li><li class="slate-li"><div style="position:relative">else if resource.applicationId exists → scope=application</div></li><li class="slate-li"><div style="position:relative">else scope=initiative (manual)</div></li></ul>

## 6.2 Locate or create Epic

<p class="slate-paragraph">Rule: “Epic per scope”</p><ul class="slate-ul"><li class="slate-li"><div style="position:relative">Query for existing Epic with scopeRef = {type, id} and blueprintKey</div></li><li class="slate-li"><div style="position:relative">If exists: reuse</div></li><li class="slate-li"><div style="position:relative">Else: create epic using nameTemplate</div></li></ul>

Store scopeRef in work item:

```javascript
scopeRef: { type: "bundle", id: bundleId }
blueprintKey: "migration_standard_v1"
```

##  6.3 Locate or create Feature
<p class="slate-paragraph">Based on blueprint feature strategy:</p><ul class="slate-ul"><li class="slate-li"><div style="position:relative">milestones: create Feature per Milestone record</div></li><li class="slate-li"><div style="position:relative">governance feature: ensure there is a governance feature under the epic</div></li></ul>

## 6.4 Attach auto-generated stories
<ul class="slate-ul"><li class="slate-li"><div style="position:relative">Review stories attach under governance feature (default)</div></li><li class="slate-li"><div style="position:relative">Planning stories attach under milestone features (default)</div></li></ul>

# 7) Predefined Built-in Blueprints (ship with app)
<h2 class="slate-h2">Blueprint A: migration\_standard\_v1 (default)</h2><ul class="slate-ul"><li class="slate-li"><div style="position:relative">Epic: per bundle/app</div></li><li class="slate-li"><div style="position:relative">Features: milestones + governance feature</div></li><li class="slate-li"><div style="position:relative">Stories: by intake or AI</div></li><li class="slate-li"><div style="position:relative">Sprints: auto-created (optional)</div></li></ul>

<h2 class="slate-h2">Blueprint B: lightweight\_delivery\_v1</h2><ul class="slate-ul"><li class="slate-li"><div style="position:relative">Epic: per app</div></li><li class="slate-li"><div style="position:relative">Features: capabilities (Auth/Data/Infra/Observability)</div></li><li class="slate-li"><div style="position:relative">No milestones/sprints by default</div></li><li class="slate-li"><div style="position:relative">Great for smaller teams</div></li></ul>

<h2 class="slate-h2">Blueprint C: governance\_only\_v1</h2><ul class="slate-ul"><li class="slate-li"><div style="position:relative">Epic: per bundle/app</div></li><li class="slate-li"><div style="position:relative">Feature: governance only</div></li><li class="slate-li"><div style="position:relative">Only review/task generation, no roadmap</div></li></ul>

# Codex-ready Implementation Spec
<h2 class="slate-h2">Phase 1 — Data + seeding + admin UI</h2><ol class="slate-ol"><li class="slate-li"><div style="position:relative">Create collections + types:</div></li></ol><ul class="slate-ul"><li class="slate-li"><div style="position:relative">work\_blueprints</div></li><li class="slate-li"><div style="position:relative">work\_generators</div></li><li class="slate-li"><div style="position:relative">(optional) work\_plans</div></li></ul><ol class="slate-ol"><li class="slate-li"><div style="position:relative">Add seed routine:</div></li></ol><ul class="slate-ul"><li class="slate-li"><div style="position:relative">On app start (or Admin page load), call ensureBuiltInBlueprints()</div></li><li class="slate-li"><div style="position:relative">Insert built-ins if missing by key</div></li></ul><ol class="slate-ol"><li class="slate-li"><div style="position:relative">Add Admin screen:</div></li></ol><ul class="slate-ul"><li class="slate-li"><div style="position:relative">list blueprints</div></li><li class="slate-li"><div style="position:relative">toggle enabled</div></li><li class="slate-li"><div style="position:relative">set default blueprint key (store in config collection or env)</div></li><li class="slate-li"><div style="position:relative">list generators per event type; enable/disable</div></li></ul>

<h2 class="slate-h2">Phase 2 — Intake-based plan creation (no AI)</h2><ol class="slate-ol"><li class="slate-li"><div style="position:relative">Add “Create Plan” action in Work Items module</div></li><li class="slate-li"><div style="position:relative">Intake form fields:</div></li></ol><ul class="slate-ul"><li class="slate-li"><div style="position:relative">scope (bundle/app)</div></li><li class="slate-li"><div style="position:relative">go-live + dev/uat dates</div></li><li class="slate-li"><div style="position:relative">milestone count + duration</div></li><li class="slate-li"><div style="position:relative">optional milestone themes</div></li></ul><ol class="slate-ol"><li class="slate-li"><div style="position:relative">Backend endpoint:</div></li></ol><ul class="slate-ul"><li class="slate-li"><div style="position:relative">POST /api/work-plans/create → returns created IDs</div></li></ul><ol class="slate-ol"><li class="slate-li"><div style="position:relative">Create:</div></li></ol><ul class="slate-ul"><li class="slate-li"><div style="position:relative">epic (if missing)</div></li><li class="slate-li"><div style="position:relative">milestone features</div></li><li class="slate-li"><div style="position:relative">sprints (optional)</div></li><li class="slate-li"><div style="position:relative">baseline stories (minimal placeholders)</div></li></ul>

<h2 class="slate-h2">Phase 3 — AI plan proposal + confirm</h2><ol class="slate-ol"><li class="slate-li"><div style="position:relative">POST /api/work-plans/propose calls AI and returns JSON plan</div></li><li class="slate-li"><div style="position:relative">UI shows editable proposed structure</div></li><li class="slate-li"><div style="position:relative">User clicks “Create” → POST /api/work-plans/create-from-proposal</div></li></ol>

<h2 class="slate-h2">Phase 4 — Event-driven generator (Review → Story)</h2><ol class="slate-ol"><li class="slate-li"><div style="position:relative">Add server-side handler when emitting review events:</div></li></ol><ul class="slate-ul"><li class="slate-li"><div style="position:relative">when reviews.cycle.requested emitted, also call runWorkGeneratorsForEvent(event)</div></li></ul><ol class="slate-ol"><li class="slate-li"><div style="position:relative">Generator logic:</div></li></ol><ul class="slate-ul"><li class="slate-li"><div style="position:relative">find enabled generator by eventType</div></li><li class="slate-li"><div style="position:relative">derive epic/feature per blueprint</div></li><li class="slate-li"><div style="position:relative">create story with dedup key</div></li><li class="slate-li"><div style="position:relative">assign to reviewers</div></li><li class="slate-li"><div style="position:relative">emit workitems.item.created event</div></li></ul>

<h2 class="slate-h2">Required indexes (minimum)</h2>
<ul class="slate-ul"><li class="slate-li"><div style="position:relative">work\_items: { scopeRef.type: 1, scopeRef.id: 1, type: 1 }</div></li><li class="slate-li"><div style="position:relative">work\_items: { parentId: 1, type: 1 }</div></li><li class="slate-li"><div style="position:relative">work\_generators: { eventType: 1 } unique</div></li><li class="slate-li"><div style="position:relative">work\_blueprints: { key: 1 } unique</div></li></ul>

<h1 class="slate-h1">9) Product Defaults (so admin does nothing)</h1><p class="slate-paragraph">On first run:</p><ul class="slate-ul"><li class="slate-li"><div style="position:relative">Insert built-in blueprints A/B/C</div></li><li class="slate-li"><div style="position:relative">Set default blueprint to <strong class="slate-bold">migration\_standard\_v1</strong></div></li><li class="slate-li"><div style="position:relative">Insert generator:</div><ul class="slate-ul"><li class="slate-li"><div style="position:relative">reviews.cycle.requested → create review story</div></li><li class="slate-li"><div style="position:relative">reviews.cycle.resubmitted → create re-review story</div></li></ul></li></ul><p class="slate-paragraph">Admin can later:</p><ul class="slate-ul"><li class="slate-li"><div style="position:relative">disable generators</div></li><li class="slate-li"><div style="position:relative">pick different default blueprint</div></li><li class="slate-li"><div style="position:relative">edit durations/labels/templates</div></li></ul></x-turndown>