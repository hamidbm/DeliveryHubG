

Please implement the following concrete backend + API changes to match the canonical spec and
our latest decisions.
A) Review lifecycle enforcement + auto
in_review
A1) Schema updates (reviews collection)
In reviews.cycles[] add:
•inReviewAt?: Date
•inReviewBy?: ActorRef
Ensure ActorRef is only:
{ userId: string; displayName: string; email?: string }
(Do not store role inside actor refs.)
Also maintain derived top-level fields on the ReviewRecord for inbox queries:
•currentCycleStatus
•currentReviewerUserIds
•currentDueAt
•currentRequestedAt
•currentRequestedByUserId
These must be updated whenever currentCycleId or current cycle status/reviewers/due
changes.
A2) Auto-transition logic to in_review
Add helper in DB/service layer:

ensureInReview(reviewId, cycleId, actor)
## Behavior:
•If cycle.status === 'requested', set:
## ◦
cycle.status = 'in_review'
## ◦
cycle.inReviewAt = now
## ◦
cycle.inReviewBy = actor
•Update top-level derived fields accordingly
## •
Emit event: review.cycle.in_review (optional, but recommended)
This helper must be invoked automatically when:
1.Reviewer opens the Review panel (GET state endpoint can do this if user is reviewer)
2.Reviewer uploads feedback (before saving attachment)
3.Reviewer creates first review-linked comment (before thread create)
4.Reviewer marks feedback sent (before feedback_sent update)
Importantly: we do NOT add a manual “Start review” button.
B) API Endpoints (exact contract)
B1) Submit review (create new cycle)
## Endpoint:
•POST /api/reviews/submit
## Body:
## {
"resourceType": "wiki.page",

"resourceId": "<id>",
"resourceTitle": "<title>",
"bundleId": "<optional>",
"applicationId": "<optional>",
"dueAt": "<iso date>",
## "notes": "<optional>",
"reviewerUserIds": ["..."] // if omitted, auto-populate
from bundle_assignments assigned_cmo
## }
## Behavior:
•Enforce resource “published” precondition (module canonical status)
•If no existing review record: create ReviewRecord
•If existing review record and current cycle is not closed: reject (409) OR show read-only
(UI prevents this)
•Create a new cycle with:
## ◦
status = 'requested'
## ◦
requestedAt/By set
## ◦
dueAt default now+5 days if missing
## ◦
reviewers[] stored as ActorRef[] (fetch user displayName/email)
## ◦
reviewerUserIds[] stored too
## ◦
correlationId = cycleId
## •
Set currentCycleId to new cycleId
•Update derived fields
## •
Emit event: review.cycle.requested
Return full review record.
B2) Review panel read (and auto in_review on open)
## Endpoint:

•GET /api/reviews/by-resource?
resourceType=...&resourceId=...
## Behavior:
•Return review record for resource or null if none
•If review exists AND user is a reviewer for current cycle AND current status is
## 'requested':
## ◦
call ensureInReview(...) to auto transition on open
(This is the simplest way to implement “auto in_review when reviewer opens panel”.)
B3) Mark feedback sent (reviewer-only)
## Endpoint:
•POST /api/reviews/:reviewId/cycles/:cycleId/feedback-
sent
## Authorization:
## •
Allowed only if actor.userId ∈ cycle.reviewerUserIds
## Behavior:
## •
Call ensureInReview() first if status == requested
•Set:
## ◦
cycle.status = 'feedback_sent'
## ◦
cycle.feedbackSentAt = now
## ◦
cycle.feedbackSentBy = actor
•Update derived fields
## •
Emit event: review.cycle.feedback_sent
B4) Vendor actions (requester-side)
Resubmit (creates new cycle, closes prior cycle)
## Endpoint:

•POST /api/reviews/:reviewId/cycles/:cycleId/resubmit
## Authorization:
## •
requester-side rules (at minimum: actor.userId ==
cycle.requestedBy.userId; later can expand to bundle_owner/svp mapping)
## Preconditions:
•Allowed only if cycle.status ∈ {'feedback_sent', 'vendor_addressing'}
## Behavior:
## •
Close current cycle:
## ◦
cycle.status = 'closed'
## ◦
cycle.closedAt/by
## •
Create new cycle (number+1) with status='requested'
## •
Set currentCycleId to new cycle
## •
## Emit:
## ◦
review.cycle.closed
## ◦
review.cycle.requested (for new cycle)
Close (closes the current cycle)
## Endpoint:
•POST /api/reviews/:reviewId/cycles/:cycleId/close
## Preconditions:
•Allowed only if cycle.status ∈ {'feedback_sent', 'vendor_addressing'}
## Behavior:
•Set cycle.status='closed' with closedAt/by
•Update derived fields
•If no other open cycle => review.status may remain 'active' but
currentCycleStatus='closed' (fine) OR set review.status='closed' (choose one consistent

rule; recommended: set review.status='closed' when current cycle closes and no open
cycles exist)
## •
Emit review.cycle.closed
B5) Upload feedback attachment (reviewer-only)
## Endpoint:
•POST /api/reviews/:reviewId/cycles/:cycleId/attachments
## Authorization:
## •
Allowed only if actor.userId ∈ cycle.reviewerUserIds
## Behavior:
## •
Call ensureInReview() first if status == requested
•Reuse existing asset upload mechanism to create an asset record
•Ensure asset metadata is set (see section C)
## •
Append AttachmentRef into cycle.feedbackAttachments[]
## •
Emit event: review.cycle.attachment_uploaded
C) Feedback assets classification (schema +
tree filter)
C1) Asset schema (wiki_assets or equivalent)
Add fields to the asset doc schema:
•artifactKind: 'primary' | 'feedback' (default 'primary')
•reviewContext?: { reviewId, cycleId,
reviewedResourceType, reviewedResourceId,
reviewedDocumentType? }
For feedback uploads:

## •
Set artifactKind = 'feedback'
## •
Set documentType = 'Feedback Document'
## •
Set reviewContext fields
•Keep bundle/application metadata same as reviewed resource
C2) Tree default behavior
Tree queries should exclude feedback by default:
## •
Default filter: artifactKind != 'feedback'
•Add UI toggle: “Include feedback”
## ◦
when enabled: include both primary + feedback
Add index:
•(artifactKind, bundleId, applicationId, documentType) as
appropriate for your tree queries.
D) Comments integration: review-linked
comments + drawer segmentation
D1) DB linking (threads)
When creating a “review feedback” thread, set on comment_threads:
•reviewId
•reviewCycleId
All messages stay in comment_messages. No duplication in reviews.
D2) “Add review comment” UX behavior
Clicking “Add review comment” should:
•Open comments drawer filtered to “Review Feedback (current cycle)”

•Focus the composer
•Do NOT create an empty thread upfront
•Create a thread only when first message is submitted, with
reviewCycleId=currentCycleId
## •
Before thread creation: call ensureInReview() (auto requested→in_review) if
reviewer and status==requested
D3) Comments drawer filters
Implement top tabs (segmented control):
•All
•Discussion (reviewCycleId is null)
•Review Feedback (reviewCycleId == currentCycleId)
•Past Reviews (reviewCycleId != null && reviewCycleId != currentCycleId)
Label each thread with a chip:
•“Discussion” OR “Review Cycle #N”
Add index:
•(resourceType, resourceId, reviewCycleId, createdAt)
E) Strict enforcement in UI + API
Enforce all gating in API (not just UI):
•Reviewer-only: attachments + feedback_sent
•Vendor/requester-side: resubmit + close
•Status preconditions as listed above
Return clear 403/409 errors with messages so UI can show helpful feedback.
F) Implementation order

1.ensureInReview helper + auto transitions
2.reviewer-only attachment + feedback_sent endpoints
3.vendor resubmit/close endpoints and strict gating
4.asset metadata for feedback + tree filter toggle
5.comments drawer segmentation + add-review-comment behavior
Proceed with this plan.
Quick notes (so you don’t get surprised)
## •
I intentionally made in_review automatic to avoid UX friction while keeping a clean
lifecycle.
•I tightened “resubmit creates a new cycle” to match our updated definition (cycle = one
pass).
## •
I made feedback assets first-class and filterable (artifactKind=feedback) so
search/tree stays clean.