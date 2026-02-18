
# Review Feature – Final Design Decisions & Implementation Instructions

This document consolidates the **final design decisions** and **implementation instructions** for the Review feature, including:
- Role-based identification (Vendor vs Engineering vs CMO)
- Review lifecycle semantics
- Default due date policy
- Historical feedback import mechanism

This file is intended to be passed directly to **OpenAI Codex (CLI)** as authoritative guidance.

---

## 1. Role-Based Identification & Authorization

User identity and permissions are determined by the **role attribute** on the user record.

### 1.1 Role groups (already implemented)

Each user has a "role" attribute, and a "team" attribute 

**Engineering Team roles**
- Engg Leader
- App Leader
- OT PM
- App SME
- EA Leader
- Engineering EA (or App EA)
- Engineering DBA (or App DBA)
- Engineering IT OPs
- Engineering EA (or App EA)

**Vendor Team roles**
- SVP Delivery Lead
- SVP Project Manager
- SVP Tech Lead
- SVP Architect
- SVP Infra Lead
- SVP SME

**CMO**
- Treated as a separate group (existing role in system as "CMO Member")

**Business**
- Treated as a separate group (existing role in system as "Business")

### 1.2 Authorization helpers (must be centralized)

Implement a single authorization helper module (e.g. `src/services/authz.ts`) exposing:

```ts
isEngineeringRole(role): boolean
isVendorRole(role): boolean

canSubmitForReview(user): boolean        // Engineering, Vendor, CMO
canMarkFeedbackSent(user): boolean       // CMO only
canResubmit(user): boolean               // Engineering or Vendor
canCloseCycle(user): boolean             // Engineering, Vendor, Admin
```

Rules:
- Do NOT hard-code role checks in UI or API routes.
- All permission checks must use these helpers.
- Server-side enforcement is mandatory (UI enable/disable is not sufficient).

---

## 2. Review Completion Semantics (Locked)

- Reviews are **cycle-based**.
- **Primary review completion milestone** = `feedback_sent` (CMO advisory checkpoint).
- Vendor/Engineering acknowledgment is **secondary and optional**.
- CMO has **no approval or rejection authority**.

### Review Cycle Statuses (canonical)

```ts
requested          // submitted for review
in_review          // CMO actively reviewing
feedback_sent      // CMO feedback provided (primary milestone)
vendor_addressing  // vendor working on feedback
resubmitted        // vendor requests another pass
closed             // cycle closed by vendor/engineering/admin
```

---

## 3. Default Due Date Policy

- When a review cycle is created:
  - Default `dueAt = now + 5 calendar days`
- Allow submitter to override the due date in the UI.
- Store both:
  - `requestedAt`
  - `dueAt`

No business-day logic required for v1.

---

## 4. Review vs Artifact Lifecycle

- Artifact lifecycle remains unchanged (e.g. `draft → published`).
- Reviews are **separate** from artifact lifecycle.
- Do NOT introduce `feedback_sent` or similar as an artifact state.

UI guidance:
- Show review status as a **banner or status pill** derived from review/feedback state.
- Artifacts must be **published** before they can be submitted for review.

---

## 5. Historical Feedback Import (Minimal Mechanism)

Old reviews cannot be represented as review cycles (dates are in the past).
Instead, historical feedback must be attached as **feedback packages**.

### 5.1 New collection: `feedback_packages`

```ts
{
  _id,
  resource: { type, id, title? },
  createdAt: Date,            // import timestamp (now)
  importedBy: ActorRef,
  source: 'historical_import',
  effectiveAt?: Date,         // optional real historical date
  summary?: string,
  attachments: AttachmentRef[],
  status: 'feedback_sent'     // fixed for imported feedback
}
```

### 5.2 Behavior

- UI action on resource page: **“Attach historical feedback”**
- Upload documents (PDF/Word) or register file references.
- Display a banner on the resource:
  - “Historical feedback attached – Feedback provided”
- Allow **Vendor / Engineering / Admin** to close the feedback package.

### 5.3 Events

Emit events:
- `feedback.imported`
- `feedback.closed`

Use:
- `correlationId = feedbackPackageId`

---

## 6. Review + Comments Integration

- `comment_threads.reviewId` remains required for review-linked comments.
- `comment_threads.reviewCycleId` must be set for threads created during an active review cycle.
- Comments created outside review cycles remain unlinked.

---

## 7. What NOT to Implement Yet (Explicitly Out of Scope)

- No approval / rejection logic
- No publish blocking
- No email, Teams, or external notifications
- No inline anchors
- No advanced permissions beyond role-based helpers
- No automatic creation of review cycles for historical data

---

## 8. Implementation Order (Strict)

1. Role-based authorization helpers
2. Default due date logic on review submission
3. Historical feedback import (`feedback_packages`)
4. Minimal Review UI (visibility + light actions only)

---

## 9. Summary

- Reviews are advisory, cycle-based, and repeatable.
- CMO provides feedback; vendors and engineering decide outcomes.
- Historical feedback is modeled separately to preserve timeline integrity.
- Role-based authorization is centralized and enforced server-side.

This document should be treated as **authoritative** for Review feature implementation.
