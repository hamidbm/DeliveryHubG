Reviews Dashboard + Review Details (Timeline + Swimlanes)
=========================================================

Goal
----

Implement a **Reviews Dashboard** (Activities → Reviews) and a **Review Details** page with two views:

*   **Option A:** Vertical Timeline (default)

*   **Option B:** Swimlanes (CMO/Reviewers vs Vendor/Requester)


No graph/mind-map for now.

1) Activities → Reviews Dashboard
=================================

1.1 Navigation
--------------

*   Add top nav item under Activities:

    *   Activities → Reviews

*   Route: /activities/reviews (or /reviews if you prefer consistent top-level routing)


1.2 Data source (API)
---------------------

Create API endpoint:

### GET /api/reviews

Query params:

*   bundleId?: string (single or comma-separated multi)

*   status?: string (maps to currentCycleStatus)

*   assignedToMe?: boolean (reviewer contains current user)

*   requestedByMe?: boolean

*   overdue?: boolean

*   q?: string (search in resource.title; optional)

*   page?: number

*   pageSize?: number

*   sort?: 'updatedAt' | 'dueAt' | 'requestedAt'

*   dir?: 'asc' | 'desc'


Backend query uses **derived fields** already present on ReviewRecord:

*   resource.bundleId

*   currentCycleStatus

*   currentReviewerUserIds

*   currentDueAt

*   currentRequestedAt

*   currentRequestedByUserId

*   updatedAt

*   resource.title


Return:

```typescript
{
  items: Array<{
    reviewId: string,
    resource: { type, id, title, bundleId },
    currentCycle: { number, status, dueAt, requestedAt },
    reviewersPreview: Array<{ displayName, userId }>,
    cycleCount: number,
    updatedAt: string
  }>,
  total: number,
  page: number,
  pageSize: number
}
```
1.3 Dashboard UI layout (Table-first)
-------------------------------------

Default = **table** (not cards). Optional view toggle later.

Columns:

*   Resource (icon + title; clickable)

*   Bundle

*   Status (pill from currentCycleStatus)

*   Cycle # (current cycle number)

*   Requested (date)

*   Due (date + “Overdue” badge)

*   Reviewers (first 2 chips + “+N”)

*   Updated


Row click → Review Details page (see section 2).

Filters above table (left-to-right):

*   Bundle (dropdown/multi-select)

*   Status dropdown

*   Assigned to me (toggle)

*   Requested by me (toggle)

*   Overdue only (toggle)

*   Search box (q)


Sorting:

*   default sort: updatedAt desc

*   allow due date sort


1.4 Indexes to ensure list performance
--------------------------------------

Ensure these exist on reviews:

*   index (resource.bundleId, currentCycleStatus, updatedAt)

*   index (currentReviewerUserIds, currentCycleStatus, currentDueAt)

*   index (currentRequestedByUserId, currentRequestedAt)

*   optional text index on resource.title (or regex search if small dataset)


2) Review Details Page (Option A + B)
=====================================

2.1 Routing
-----------

Create page:

*   /reviews/:reviewId (preferred)or

*   /activities/reviews/:reviewId


Also add deep link from wiki Review Panel:

*   “Open review details” → routes to this page.


2.2 Data API (single endpoint)
------------------------------

Create:

### GET /api/reviews/:reviewId/details

It should return:

*   full ReviewRecord

*   plus computed per-cycle aggregates needed for visualization:

    *   comment thread count per cycle

    *   message count per cycle (optional)

    *   attachment count per cycle (already exists)

    *   flags: hasReviewerNote, hasVendorResponse


Recommended response shape:

```typescript
{
  review: ReviewRecord,
  cycleSummaries: Array<{
    cycleId: string,
    number: number,
    status: string,
    requestedAt?: string,
    inReviewAt?: string,
    feedbackSentAt?: string,
    closedAt?: string,
    dueAt?: string,
    reviewers: ActorRef[],
    feedbackAttachmentCount: number,
    hasReviewerNote: boolean,
    hasVendorResponse: boolean,
    reviewCommentThreadCount: number,
    reviewCommentMessageCount?: number
  }>
}
```   `

### How to compute comment counts

Query comment\_threads by reviewCycleId (and maybe resourceType/resourceId as secondary guard):

*   count threads where reviewCycleId == cycleId

*   For message count (optional), either:

    *   store messageCount on thread, or

    *   count comment\_messages by threadIds (ok for small scale)


Indexes needed:

*   comment\_threads index (reviewCycleId)

*   comment\_threads index (resourceType, resourceId, reviewCycleId)


2.3 Review Details page layout
------------------------------

Top header:

*   Resource title (link to open resource)

*   Bundle label

*   Review status (review.status)

*   Cycle count

*   “Back to Reviews”


Below header: tab switcher:

*   **Timeline** (default)

*   **Swimlanes**


Right side (optional, recommended):

*   “Details drawer” panel that opens when clicking a timeline node/lane event

    *   shows attachments list, reviewer note, vendor response, and “Open review comments for this cycle”


3) Option A: Vertical Timeline View (default)
=============================================

3.1 Structure
-------------

Render cycles in order:

*   **Newest first** (Cycle N at top), or oldest first (choose one—recommend newest first).


Each cycle renders as a collapsible “Cycle Card”:

*   Latest cycle expanded by default

*   Others collapsed


Cycle header row:

*   Cycle #N

*   Status pill

*   RequestedAt, DueAt

*   Reviewers chips

*   Quick indicators:

    *   📎 attachments count

    *   💬 review thread count

    *   📝 reviewer note exists

    *   🧾 vendor response exists


Cycle body shows timeline nodes (only those that exist):

1.  Requested (requestedAt/by)

2.  In Review (inReviewAt/by) if present

3.  Feedback Sent (feedbackSentAt/by) if present

4.  Vendor Addressing (if you store timestamp; optional)

5.  Closed (closedAt/by) if present


Between nodes show duration labels (computed):

*   inReviewAt - requestedAt

*   feedbackSentAt - inReviewAt (or requestedAt if inReview missing)

*   closedAt - feedbackSentAt


Under “Feedback Sent” node show **payload summary**:

*   Attachments list (click to open asset)

*   Reviewer note (rendered markdown)

*   “Open review comments” button → opens wiki resource with comments drawer filtered to that cycle (or open a modal listing the threads)


Under “Vendor Response” show vendorResponse markdown.

3.2 Click behavior
------------------

Clicking a node opens details drawer:

*   Node metadata

*   Related artifacts

*   link actions


4) Option B: Swimlanes View (CMO vs Vendor)
===========================================

4.1 Lane definition
-------------------

Two vertical lanes:

**Lane 1: Reviewers (CMO)**

*   In Review

*   Feedback Sent

*   Reviewer Note

*   Review Comments

*   Feedback Attachments upload events (optional)


**Lane 2: Vendor/Requester**

*   Requested

*   Vendor Response

*   Close

*   Resubmit (creates new cycle) (show as “Cycle #N Requested” event)


4.2 Rendering
-------------

For each cycle:

*   Show a compact cycle header row

*   Then render lane events as cards aligned in their lane.


Do not attempt perfect timestamp alignment initially; just keep ordering per cycle.

Swimlane events should still open the same right-side details drawer.

5) Deep links back into Wiki / Comments
=======================================

5.1 “Open resource”
-------------------

From Review Details:

*   “Open Resource” button navigates to wiki page/asset/diagram.


5.2 “Open review comments”
--------------------------

When user clicks “Open review comments (Cycle #N)”:

*   navigate to resource page and open Comments drawer on:

    *   tab = Review Feedback

    *   cycleId = selected cycleId


Implementation:

*   support query param, e.g.:

    *   ?comments=1&tab=review&cycleId=...

*   Wiki page reads query params and opens drawer accordingly.


6) Implementation Order (recommended)
=====================================

1.  Build GET /api/reviews + Reviews Dashboard table + filters

2.  Build GET /api/reviews/:reviewId/details

3.  Build Review Details page with Timeline tab

4.  Add Swimlanes tab (reuse same cycleSummaries)

5.  Add “Open review comments” deep link support


7) Acceptance Criteria
======================

Dashboard:

*   Filter by bundle works

*   Assigned-to-me works

*   Overdue works

*   Row opens review details


Review Details:

*   Timeline shows all cycles

*   Each cycle shows attachments, reviewer note, vendor response in the correct cycle

*   Click node opens drawer with details

*   Swimlanes show same information organized by actor group

*   Links to open resource and open review comments work