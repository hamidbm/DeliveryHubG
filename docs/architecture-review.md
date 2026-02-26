the docs effectively **answer the big question**:

*   Yes, diagram reviews **should use the same cycle-based review model** as Wiki reviews. A ReviewRecord can have multiple cycles; **each back-and-forth loop is a new cycle**, not a loop inside a cycle. Review\_Feature\_Canonical\_Spec

*   And the **primary completion milestone is feedback\_sent** (CMO advisory checkpoint). Vendor addressing is secondary. Review\_Feature\_Final\_Design


What’s currently confusing you is really a **mapping problem**: _review cycle states → work item statuses_.

Below is a concrete lifecycle + mapping that will feel natural in DeliveryHub and stop the “why did it become In-Review?” confusion.

1) Diagram review lifecycle (recommended, consistent with canonical spec)
-------------------------------------------------------------------------

### Review cycle state machine (backend truth)

Use the canonical cycle statuses:

requested → in\_review → feedback\_sent → vendor\_addressing → closed

Review\_Feature\_Canonical\_Spec

**Resubmission = new cycle** (do not loop inside the same cycle).

Review\_Feature\_Canonical\_Spec

### Who can trigger what

*   Anyone can **submit for review** (your requirement) — but the canonical auth helper says canSubmitForReview includes Engineering/Vendor/CMO. If you truly want “any user”, you’ll extend that helper beyond the spec. Review\_Feature\_Final\_Design

*   CMO reviewers can **Mark feedback sent** (CMO-only). Review\_Feature\_Final\_Design

*   Vendor/Engineering can **Resubmit** (creates new cycle) and **Close** (when vendor\_addressing or later). Review\_Feature\_Canonical\_Spec


2) The Work Item question: 1 story or 2 stories?
------------------------------------------------

### Best option: **keep it 1 story per review cycle**

This is explicitly recommended: **one story per cycle**, not per reviewer, and it’s the measurable unit of review work.

delivery-intelligence-followup

You do **not** need a second vendor story if you map statuses correctly.

Why:

*   The cycle’s “work” spans two actor groups (CMO feedback, then vendor addressing).

*   The story is a tracking container with links to the diagram review context and comments.

*   Ownership can shift via status + reassignment, or remain multi-assignee if you add assigneeUserIds. delivery-intelligence-followup


**When to consider 2 stories (only if you insist):**If your Work Items UX is strict about “assignee must do the work” and you don’t want multi-assignee or reassignment, then split:

*   Story A (CMO): “Review diagram: …”

*   Story B (Vendor): “Address review feedback: …”But that’s extra complexity and not required by the canonical review-workitem guidance.


3) Correct Work Item status evolution (fix the “In-Review after feedback sent” issue)
-------------------------------------------------------------------------------------

### The bug you described

When reviewer clicks **Send feedback**, the Work Item becomes **In-Review**. That’s backwards: in the review spec, **feedback\_sent is the completion milestone for the reviewer side**.

Review\_Feature\_Final\_Design

### Recommended mapping (simple, intuitive)

Assuming Work Item statuses: TODO, IN\_PROGRESS, REVIEW, DONE, BLOCKED (from Work Items module).

Modules-WorkItems

Map _review cycle_ → _work item status_ like this:

1.  **Cycle created (requested)**


*   Work item status = **TODO**

*   Rationale: it’s been queued; reviewers haven’t started yet.


1.  **First reviewer action happens**Two ways to set cycle to in\_review:


*   Implicit: the first time a reviewer creates a review comment thread tagged with reviewCycleId, auto-transition to in\_review.

*   Or explicit: add a “Start review” button (you said you don’t have it; implicit is fine).


Then:

*   Work item status = **IN\_PROGRESS**

*   Rationale: the review is actively being worked.


1.  **Reviewer clicks “Send feedback” (feedback\_sent)**


*   Work item status = **REVIEW** _or_ **IN\_PROGRESS** depending on what you mean by REVIEW in your system.


Given your semantics (“vendor is addressing now”), the cleanest is:

*   Work item status = **REVIEW** (meaning “handoff state / waiting on vendor action”)

*   And set cycle status = vendor\_addressing either:

    *   immediately after feedback\_sent (automatic), or

    *   on first vendor response/comment/ack.


1.  **Vendor addressing (vendor\_addressing)**


*   Work item stays = **REVIEW** (still not done; feedback being processed).


1.  **Cycle closed (closed)**


*   Work item status = **DONE**


This aligns with: reviewer completion milestone is feedback\_sent, but the overall cycle isn’t “closed” until vendor closes.

Review\_Feature\_Canonical\_Spec

4) Do we need cycles for diagrams?
----------------------------------

Yes — **use cycles**, same as Wiki:

*   A ReviewRecord can contain multiple ReviewCycles.

*   Vendor resubmission creates a **new cycle**.

*   When a new cycle is created, the previous cycle’s story is marked closed/done and a new story is created for the new cycle. delivery-intelligence-followup


That model cleanly handles:

*   “vendor addressed comments, wants another pass”

*   “cycle N feedback threads should not leak into cycle N+1 threads” via reviewCycleId tagging Review\_Feature\_Canonical\_Spec


5) Practical recommendation for your specific UX (no “Start review” button)
---------------------------------------------------------------------------

You don’t need a new button. Use **implicit start**:

*   On first reviewer comment thread creation for the cycle (comment\_threads.reviewCycleId == currentCycleId), transition cycle requested → in\_review and set story TODO → IN\_PROGRESS. Review\_Feature\_Canonical\_Spec


Then “Send feedback” moves it forward (not backward).

6) What I’d implement next (minimal change, maximum clarity)
------------------------------------------------------------

1.  Fix the incorrect transition: **Send feedback must not set Work Item to In-Review**.

2.  Add implicit “start review” behavior when the first review comment is created.

3.  Map feedback\_sent → Work Item REVIEW (or keep IN\_PROGRESS if you don’t like REVIEW), and only closed → DONE.


If you tell me your exact Work Item status enum in code (or confirm it’s the same as the module doc: TODO/IN\_PROGRESS/REVIEW/DONE/BLOCKED

Modules-WorkItems

), I’ll give you a precise mapping table you can hand to Codex and a single “source of truth” function like:

mapReviewCycleToWorkItemStatus(cycleStatus, hasReviewerActivity, hasVendorActivity) -> WorkItemStatus

…but even without that, the lifecycle above will resolve the inconsistency you’re seeing today

# Questions and Answers

1) Work item status mapping: You want feedback_sent → REVIEW and vendor_addressing → REVIEW, and only closed → DONE, correct?

Yes.
feedback_sent → REVIEW
vendor_addressing → REVIEW
closed → DONE
Also:
requested → TODO
in_review → IN_PROGRESS
This removes the current backwards behavior where “send feedback” makes the story look less complete.

2) Implicit “start review”: Implicit “start review” Should we always auto‑transition requested → in_review when the first review comment thread is created, or only if the commenter is a reviewer?

Auto-transition requested → in_review only if the first comment/thread is created by a reviewer (i.e., the commenter is in currentReviewerUserIds for that cycle).
Reason: vendor/submitter or random users might add notes; that shouldn’t imply reviewers started.

3) Who can submit for review
Expand to any authenticated user (i.e., anyone who can view the diagram can submit it for review).
But keep guardrails:
They must have access to the diagram (bundle/app visibility).
Reviewer actions remain role-gated (CMO-only for “Mark feedback sent”).
So: update canSubmitForReview accordingly (or introduce canRequestReviewForResource(user, resource) that enforces visibility but not role).

4) Work item reassignment
Keep the original CMO reviewers as assignees for the cycle’s story (do not auto-reassign to vendor).
Rationale:
The story is the “review cycle tracker” and originates as reviewer-owned work.
Reassigning would break accountability/ownership and notifications for the reviewer group.
Vendor addressing can be tracked via status = REVIEW and comments on the diagram review threads.
Optional enhancement (not required now): add “participants/watchers” for vendor users or show vendor CTA in the linked review panel.