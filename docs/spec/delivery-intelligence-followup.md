1.  **Canonical mapping**Yes — adopt the “Epic derived from scope” rule now:


*   If bundleId exists → **Epic per bundle**

*   Else if applicationId exists → **Epic per app**

*   Else → **Epic per initiative** (initiative is manually created/selected in v1; keep simple)


Also: store scopeRef on work items as { type: 'bundle'|'application'|'initiative', id, name } so lookup is deterministic.

1.  **Blueprint storage**Yes, add a new collection.


Name it: **work\_blueprints** (match your prefix rule / module namespace). I prefer the shorter prefix "work_" over "workitems_"

*   Use a stable key field (migration\_standard\_v1) as unique identifier.

*   Include enabled, isBuiltIn, version.

*   Add seed routine: insert built-ins only if missing by key (never overwrite).


1.  **Generator storage**Yes, add a new collection.


Name it: **work\_generators**.

Same pattern:

*   eventType unique

*   enabled flag

*   blueprintKey reference

*   seed built-ins if missing


1.  **Event trigger for Review Story**Use the existing emitted event type for review submission. We will standardize it to:


✅ **reviews.cycle.requested**

If current code emits something slightly different (e.g. review.cycle.requested), update emission to the canonical naming. We already enforce .. format; so reviews.cycle.requested fits perfectly.

Whatever comments and feedback attachments are done by the reviewer, those artifacts (comments and attachments) should also be visible (attached to) to the corresponding User Story. If the Vendor resubmits (that implies a new cycle gets created, then old user story corresonding to the previous cycle should be marked as closed. Similarly when the Vendor closes a review requiest, the corresponding user story should also be marked as completed or closed)

Also create review story on:

✅ **reviews.cycle.resubmitted** (re-review scenario)

1.  **Story placement**Auto-created review story should attach under a dedicated feature, not directly under the epic.


Rule:

*   Parent epic = derived from scope (bundle/app/initiative)

*   Ensure a feature exists under epic named:


✅ **“Governance & Reviews”** (feature type)

Then:

*   Parent feature = “Governance & Reviews”

*   Review story goes under that feature


This keeps milestones/features clean and makes review work measurable.

1.  **Assignee strategy**v1: create **one story per review cycle**, not per reviewer.


Assignment model:

*   assigneeUserIds: \[reviewer1, reviewer2, ...\] (multi-assignee field)OR if you currently only support single assignee:

    *   set assigneeUserId = first reviewer and store full list in watcherUserIds (or participantUserIds)

    *   but **preferred** is adding assigneeUserIds for review-story type items.


Reason: one cycle = one unit of review work, and discussion happens inside that story/comments.

Also set:

*   dueAt = review.cycle.dueAt (fallback: now+5 days)


1.  **Minimum intake form fields (v1)**Confirm v1 fields as:


Required:

*   scopeType: bundle | application

*   scopeId

*   goLiveDate


Optional but recommended:

*   devStartDate

*   uatStartDate

*   uatEndDate

*   milestoneCount (default 4)

*   milestoneDurationWeeks (default 3)

*   sprintDurationWeeks (default 2)

*   milestoneThemes\[\] (array of { milestoneNumber, themes\[\] }) optional


v1 behavior:

*   Create epic if missing

*   Create milestone features (Milestone 1..N)

*   Create Governance & Reviews feature

*   Optionally create sprints (can be phase 2 if you prefer)

*   Create placeholder stories under each milestone feature using themes if provided


Small but important extra constraints (tell Codex too)
------------------------------------------------------

*   **Dedup**: review story dedup key must be reviews.cycle.requested:{reviewId}:{cycleId} so reloading events never creates duplicates.

*   **Links**: store linkedResource = { type, id, title } on the review story so you can deep-link back to the wiki/diagram.

*   **Emit events** when stories are created automatically:

    *   workitems.item.created

    *   workitems.generator.applied (optional)