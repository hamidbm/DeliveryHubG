# Review Feature – Canonical Design & Implementation Specification

Version: 1.0  
Scope: Internal Web App (Wiki + Architecture + Work Items)  
Audience: Engineering Team + Codex CLI Implementation

---

# 1. Purpose

This document defines the canonical design of the **Review Feature**.

It serves three purposes:

1. Functional documentation of how Reviews work (business logic + workflow).
2. Architectural documentation (data model, collections, indexes, cross‑feature linkage).
3. Detailed implementation instructions for Codex.

This spec is authoritative.

---

# 2. Core Concepts

## 2.1 ReviewRecord

There is **exactly one ReviewRecord per resource** (wiki page, diagram, etc.).

A ReviewRecord may contain multiple **ReviewCycles**.

Collection name: `reviews`

Unique index:
```
(resource.type, resource.id)
```

---

## 2.2 ReviewCycle (Canonical Definition)

A ReviewCycle represents **one discrete review pass**:

Submission → Review → Feedback Sent → Vendor Addressing → Closed

If vendor resubmits after changes, that creates a **new cycle**.

This is critical.

A cycle does NOT contain multiple back-and-forth loops.

Each loop = new cycle.

---

# 3. Review Lifecycle (State Machine)

## 3.1 Review-level Status

`reviews.status`:
- active
- closed

A review remains active as long as at least one cycle is open.

---

## 3.2 Cycle-level Status

`ReviewCycle.status`:

- requested
- in_review
- feedback_sent
- vendor_addressing
- closed

Allowed transitions:

requested → in_review  
in_review → feedback_sent  
feedback_sent → vendor_addressing  
vendor_addressing → closed  

If vendor wants re-review:
closed → (new cycle created with status=requested)

No backward transitions inside a cycle.

---

# 4. Database Schema

## 4.1 reviews Collection

```ts
type ReviewRecord = {
  _id: ObjectId;

  resource: {
    type: string;
    id: string;
    title?: string;
    bundleId?: string;
    applicationId?: string;
  };

  status: 'active' | 'closed';

  createdBy: ActorRef;
  createdAt: Date;
  updatedAt: Date;

  currentCycleId: string;

  // Derived fields for indexing / inbox queries
  currentCycleStatus: string;
  currentReviewerUserIds: string[];
  currentDueAt?: Date;
  currentRequestedAt?: Date;
  currentRequestedByUserId?: string;

  cycles: ReviewCycle[];

  resourceVersion?: {
    resourceUpdatedAtAtSubmission?: Date;
    versionId?: string;
  };
};

type ReviewCycle = {
  cycleId: string;
  number: number;
  status: string;

  requestedBy: ActorRef;
  requestedAt: Date;

  dueAt?: Date;
  notes?: string;

  reviewers: ActorRef[];
  reviewerUserIds: string[];

  feedbackAttachments?: AttachmentRef[];

  feedbackSentAt?: Date;
  feedbackSentBy?: ActorRef;

  closedAt?: Date;
  closedBy?: ActorRef;

  correlationId: string;
};

type ActorRef = {
  userId: string;
  displayName: string;
  email?: string;
};

type AttachmentRef = {
  assetId: string;
  filename: string;
  mimeType: string;
  sizeBytes?: number;
};
```

---

## 4.2 Required Indexes

### reviews

```
unique: (resource.type, resource.id)
index: (status, updatedAt)
index: (currentReviewerUserIds, currentCycleStatus, currentDueAt)
```

### comment_threads

Ensure index on:
```
(resourceType, resourceId, reviewCycleId)
```

### events

Indexes:
```
(ts)
(resource.type, resource.id, ts)
(actorUserId, ts)
```

TTL already configured.

---

# 5. Comments Integration

All comments (review + non-review) are stored in:

- `comment_threads`
- `comment_messages`

## 5.1 Linking Comments to Review

`comment_threads` must contain:

```
reviewId?: string
reviewCycleId?: string
```

A comment belongs to review feedback ONLY if:

```
thread.reviewCycleId == currentCycle.cycleId
```

Do NOT duplicate comments inside `reviews`.

FeedbackData is computed dynamically:

```
feedbackAttachments
+ threads where reviewCycleId == cycleId
+ cycle.notes
+ feedbackSentAt / feedbackSentBy
```

---

# 6. Feedback Artifacts (Wiki Integration)

Feedback documents should:

- Be stored as assets (existing upload system).
- Have metadata:
  - artifactKind = "feedback"
  - documentType = "Feedback Document"
  - Same bundle/application as reviewed resource.
- Include:
  ```
  reviewContext: {
    reviewId,
    cycleId,
    reviewedResourceType,
    reviewedResourceId,
    reviewedDocumentType?
  }
  ```

Feedback documents should be hidden in tree by default.

Add filter: "Show feedback documents".

---

# 7. Review Panel UX Specification

The Review Panel must be state-driven and role-relative.

## 7.1 Case A – No Active Review

Show only:

- Due date (default today + 5 days)
- Reviewers (auto-populated from bundle_assignments)
- Optional notes
- Button: Submit for review

Do NOT show cycle history or feedback sections.

---

## 7.2 Case B – Active Review – Logged-in user is Reviewer

Condition:
```
userId ∈ currentCycle.reviewerUserIds
```

Show:

Compact summary row:
```
Cycle #N · Status · RequestedAt · DueAt · Reviewers
```

Below:
- Upload feedback
- Add review comment
- Mark feedback sent

Hide:
- Submit
- Resubmit
- Close

---

## 7.3 Case C – Active Review – Vendor/Submitter

If user is requestedBy OR associated Vendor/Engineering:

Show:
- Compact summary row
- Resubmit (only if status=feedback_sent)
- Close (only if status=vendor_addressing or later)

Hide reviewer actions.

---

## 7.4 Case D – Other Users

Read-only compact summary only.

No action buttons.

---

# 8. Comments Drawer UX

Sticky header "Comments" opens unified drawer.

Add segmented control:

- All
- Discussion
- Review Feedback (current cycle)
- Past Reviews

Label threads with chips:
- Discussion
- Review Cycle #N

Review panel "Add review comment" should:

- Create thread with reviewCycleId=currentCycleId
- Open drawer filtered to Review Feedback

---

# 9. Events

Emit events on:

- review.cycle.requested
- review.cycle.feedback_sent
- review.cycle.closed
- review.cycle.resubmitted
- review.cycle.attachment_uploaded

Events complement state. They are not source of truth.

---

# 10. Activities → Reviews Dashboard

Add top-nav:

Activities → Reviews

Review tile shows:

- Resource title
- Bundle
- Current status
- Reviewers
- RequestedAt
- DueAt
- Cycle count
- Overdue indicator

Filters:
- Assigned to me
- Created by me
- Bundle
- Status
- Date range

Review detail page should include optional graphical workflow representation.

---

# 11. Codex Implementation Checklist

1. Ensure reviews schema matches section 4.
2. Remove role from ActorRef.
3. Ensure reviewers stored as ActorRef[].
4. Maintain derived currentCycle fields.
5. Update Review panel rendering logic per section 7.
6. Update Comments drawer filtering per section 8.
7. Implement artifactKind="feedback".
8. Ensure proper indexes are created.
9. Ensure events emitted on state transitions.
10. Add Reviews dashboard page under Activities.

---

# 12. Non-Goals

- No admin override actions in v1.
- No implicit reviewer permissions from bundle assignment after cycle creation.
- No duplication of comments inside reviews.

---

# 13. Design Principles

- Explicit linkage > inferred linkage
- One source of truth per concept
- State machine clarity
- Role-relative UI
- Progressive disclosure
- Auditability first

---

End of Specification
