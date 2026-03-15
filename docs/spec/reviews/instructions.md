Now let's implement review feature for the Architcure diagrams. In the "Architecture" --> "Diagrams" we have many diagrams and we need to be able to:

  - (1) submit a diagram for review (the default reviwers are the CMO members assigned to the Bundle that is associated with the diagram, the submitter should be able to add more reviewers manually),
  - (2) when a review request is submitted, a corresponding user story should be created and assigned to the reviewers in the review request,
  - (3) Reviewers will add comments and then submit the review back to the Vendor to respond and close the comments.

# ) Target UI surface (Architecture → Diagrams)

In **Architecture → Diagrams**, for each diagram details view, add a **Review panel/section** (similar in spirit to Wiki) that supports:

1.  **Submit diagram for review**


*   Default reviewers = **CMO members assigned to the diagram’s bundle**:

    *   Use bundle\_assignments where:

        *   bundleId == diagram.bundleId

        *   active == true

        *   assignmentType == 'assigned\_cmo'

*   Optionally include cmo\_reviewer as secondary reviewers if desired/configured.

*   Do **NOT** auto-assign observer, svp, bundle\_owner as reviewers. Bundle\_Assignments\_Spec

*   Submitter can **add additional reviewers manually** (user picker).

*   Due date:

    *   default dueAt = now + 5 calendar days

    *   allow override in UI at submit time. Review\_Feature\_Final\_Design


1.  **Reviewers add comments + send feedback**


*   Reviewers (CMO) will create **review comments** (comment threads tagged with reviewCycleId).

*   Reviewer action: **“Mark feedback sent”** transitions cycle to feedback\_sent. Review\_Feature\_Final\_Design


1.  **Vendor/Engineering responds + closes**


*   Vendor/Engineering can:

    *   **Resubmit** (creates a **new cycle**)

    *   **Close** the cycle when appropriate


# 2) Review data model (Mongo)

Implement/align with the canonical model:

*   Collection: reviews

*   Unique index: (resource.type, resource.id)

*   ReviewRecord stores:

    *   resource: { type, id, title?, bundleId?, applicationId? }

    *   status: active|closed

    *   currentCycleId

    *   derived fields: currentCycleStatus, currentReviewerUserIds, currentDueAt, currentRequestedAt, currentRequestedByUserId

    *   cycles: ReviewCycle\[\] (cycleId, number, status, requestedAt/by, dueAt, reviewers, etc.) Review\_Feature\_Canonical\_Spec


**Resource typing for diagrams**

*   Use a stable resource type string like: architecture\_diagram

*   resource.id = diagram \_id

*   resource.title = diagram title

*   resource.bundleId = diagram bundle association (required for default reviewers)


### 3) Review cycle statuses + transitions

Use these canonical cycle statuses (and do not invent new ones):

*   requested

*   in\_review

*   feedback\_sent

*   vendor\_addressing

*   resubmitted

*   closed Review\_Feature\_Final\_Design


Implement allowed transitions consistent with the spec (cycle-based; resubmit creates new cycle).

Review\_Feature\_Final\_Design

# 4) Authorization (centralize in authz helper; server-side enforcement required)

Create/ensure src/services/authz.ts provides (and use everywhere):

*   isEngineeringRole(role)

*   isVendorRole(role)

*   canSubmitForReview(user) // Engineering, Vendor, CMO

*   canMarkFeedbackSent(user) // CMO only

*   canResubmit(user) // Engineering or Vendor

*   canCloseCycle(user) // Engineering, Vendor, Admin Review\_Feature\_Final\_Design


Do **not** hard-code role checks in UI or API routes; enforce server-side.

Review\_Feature\_Final\_Design

# 5) Comments integration for diagram reviews

When a review is active for a diagram:

*   New review comment threads must be created with:

    *   reviewId = reviews.\_id

    *   reviewCycleId = reviews.currentCycleId Review\_Feature\_Canonical\_Spec

*   Show a chip on threads like **“Review Cycle #N”**. review

*   The review panel action “Add review comment” should open the Comments drawer filtered to “Review Feedback (current cycle)”. Review\_Feature\_Canonical\_Spec


Ensure indexes support this:

*   comment\_threads (resourceType, resourceId, reviewCycleId) Review\_Feature\_Canonical\_Spec

# 6) Work Items integration (auto-create a “Review story” when review cycle is submitted)

When a diagram review cycle is created (and also when resubmitted), auto-create a **Work Item user story**:

Triggers:

*   On reviews.cycle.requested → create story “Review: ”

*   On reviews.cycle.resubmitted → create story “Re-review: (Cycle #N)” delivery-intelligence-followup


Placement rules:

*   Parent epic = derived from scope (bundle/app/initiative)

*   Ensure a Feature exists named **“Governance & Reviews”**

*   Put the review story under that feature (NOT directly under epic). delivery-intelligence-followup


Assignment:

*   Create **one story per cycle** (not one per reviewer).

*   Prefer multi-assignee assigneeUserIds = reviewerUserIds\[\]

    *   If only single assignee supported, set assignee = first reviewer and store full list as watchers/participants. delivery-intelligence-followup

*   Set story due date = cycle.dueAt (fallback now+5d). delivery-intelligence-followup


Linkage requirements:

*   Store linkedResource = { type: architecture\_diagram, id, title } on the story.

*   Store reviewContext = { reviewId, cycleId, cycleNumber } on the story so it can deep-link back to the review panel and comments for that cycle.

*   Any review comments + feedback attachments should be discoverable from the story via this linkage (at minimum: links in UI). delivery-intelligence-followup


Lifecycle coupling:

*   When a new cycle is created via resubmission, mark the previous cycle’s story as **closed/done**.

*   When the review cycle is closed, mark the corresponding story as **completed/closed**. delivery-intelligence-followup


Dedup:

*   Ensure dedup key is stable so replays don’t create duplicates:

    *   reviews.cycle.requested:{reviewId}:{cycleId}

    *   reviews.cycle.resubmitted:{reviewId}:{cycleId} delivery-intelligence-followup


# 7) Minimal UX states (role-relative)

Implement role-relative Review panel states:

*   **No active review**:

    *   show reviewers (auto-populated), due date, notes, “Submit for review” Review\_Feature\_Canonical\_Spec

*   **Active review + user is a reviewer**:

    *   show cycle summary, upload feedback (if implemented), add review comment, “Mark feedback sent” Review\_Feature\_Canonical\_Spec

*   **Active review + user is vendor/submitter**:

    *   show cycle summary, “Resubmit” (only when status allows), “Close” (when status allows) Review\_Feature\_Canonical\_Spec

*   **Other users**:

    *   read-only summary


# 8) Out of scope (do NOT build now)

Do not add:

*   Approval/rejection (CMO has no approval authority)

*   Blocking publish / enforcement (reviews are separate from artifact lifecycle) Review\_Feature\_Final\_Design

*   External notifications (email/Teams)

*   Inline anchors for comments

*   “Full review governance” complexity beyond the authz helpers above


# 9) Acceptance criteria

*   Diagram page shows Review panel with correct state and role-relative actions.

*   Submitting a review:

    *   creates/updates reviews record + new cycle

    *   assigns default reviewers from bundle\_assignments plus manual additions Bundle\_Assignments\_Spec

    *   emits reviews.cycle.requested

    *   auto-creates a Work Item story linked to the cycle

*   Reviewer can add review comments (threads tagged with reviewCycleId) and “Mark feedback sent”

*   Vendor/Engineering can resubmit (new cycle) and close; corresponding Work Item stories transition to closed appropriately.

*   Comment threads display “Review Cycle #N” chip and are filterable by cycle.


# Clarifications for possible questions:

## 1) Default reviewers (bundle assignments)

Include **only**:

*   assignmentType == "assigned\_cmo"

*   active == true

*   bundleId == diagram.bundleId


Do **not** include cmo\_reviewer in the default set for this implementation. Treat cmo\_reviewer as **optional / future** (we can add a toggle later).

## 2) Manual reviewer picker UI

Allow the submitter to add **only CMO-role users** (and Admin if needed for edge cases), not “any user”.

Reason: reviewers are expected to use the reviewer-only action **“Mark feedback sent”**, and that should remain CMO-scoped. Also avoids introducing review cycles assigned to non-review-capable roles.

So: **picker filter = users where role in { CMO, ADMIN }** (ADMIN optional; OK to include).

## 3) Where to show the Review panel

Do **not** add a new modal.

Use the **existing diagram details surface** (whatever currently renders title/metadata/content for a selected diagram). If it already uses a right-side details panel/drawer pattern, embed the Review panel there.

If Architecture → Diagrams currently has no details panel pattern:

*   add a **right-side drawer** (consistent with Work Items/Wiki UX patterns), and place Review + Comments access there.


## 4) Comment threads UI

Use the **existing Comments drawer** and open it **filtered** to:

*   resourceType = "architecture\_diagram"

*   resourceId = diagramId

*   reviewCycleId = reviews.currentCycleId


Do **not** build a dedicated comment area inside the Review panel in this pass. The Review panel should only provide entry points + status/controls.

## 5) Work Item linkage / deep-linking

Don’t rely on / ?tab=architecture&diagramId=... unless that is already a stable route in the app.

Implement a **canonical deep link** from Work Item → Diagram review cycle as:

*   Diagram route: the existing diagram details route (whatever it is today)

*   Add query params:

    *   reviewId=

    *   cycleId=

    *   optional: focus=review (to auto-expand the Review panel)


So the link format is:?focus=review&reviewId=...&cycleId=...

If there is no dedicated diagram details route yet and it’s only list selection-based, then you should add **diagram deep-link support** (diagramId in query string) and then append the review params.