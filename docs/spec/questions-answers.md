# 1) Core intent and scope
What is a “review” in your org?
  - Advisory feedback cycle only, or includes decision recording? Advisory feedback cycle only
  - Output expectation: comments only, or formal deliverable (PDF/Word) too? It can be both or either one.

What artifacts are reviewable (v1)?
  - Wiki docs, Architecture diagrams, Work Items (yes they are all reviewable)
  - Are these equal, or do diagrams need different feedback primitives? Everythig is equal, maybe just the language would differe when reviewing.

What is the primary success metric?
  - “All feedback centralized”? Yes
  - “Shorter review turnaround”? Yes
  - “Visibility into vendor progress”? Yes
  - This determines UX emphasis.

# 2) Submission mechanics (how reviews start)
Who can submit for review?
  - Vendor only? Anyone? CMO too? Monstly either Engineering Team, Vendor, or CMO members
  - Can an artifact be submitted by someone who isn’t the author? Yes

What triggers submission?
  - Manual “Submit for review” button (Yes)
  - Or “Publish” auto-creates a review request? (Yes)
  - Or both? (yes both)

What gets submitted—an artifact version or “latest”?
  - If the artifact changes after submission, does the review attach to:
    - a frozen snapshot/contentHash/versionId, or
    - the latest living document? (latest only)
  - This is the most important technical question for later auditability.

What metadata is required at submission?
  - Review type/category (Architecture, Security, Cloud readiness etc.) Yes
  - Due date / priority: yes
  - Owner engineering team and Vendor Team
  - Suggested reviewers (default CMO group vs subset): yes

How are reviewers selected?
  - Always all 13 CMO members?
  - Or subset by domain (networking, data, security)? Every CMO member is expert in one domain (architcture, security, DevOps, HA/DR, Networking, etc...) and would review the aspect he is expert in.
  - Is there a default rule by bundle/application/docType? Usually, each CMO member is associated with one or two bundles (sometimes 3 bundles) and he would only review artificats produced by the bundle the CMO architect is responsible for.

# 3) Reviewer discovery (how reviewers know what to review)
Where do reviewers see “work to do”?
  - Dedicated top-nav: Reviews (Yes)
  - Plus: Activities feed entries
  - Plus: per-module review status indicators (Yes)

Do reviewers need an “Inbox” vs “Backlog”?
  - Inbox: assigned to me, mentioned me, due soon (inbox is better)
  - Backlog: all reviews in the system

What is the assignment model?
  - Assigned reviewers (explicit) (either explicittly or using the mapping between BUndle and CMO members. To each bundle, there could be one, two, or three CMO members assigned to it. The automatic assignment would be for all the CMO members associated with a given bundle.
  - Or “CMO pool” where anyone can pick up?

What are the escalation rules?
  - Due date missed (Yes)
  - No reviewer activity after N days (Yes)
  - This can start as “flagging” only (no email).

# 4) Lifecycle semantics (this is where systems go wrong)
You already have cycle-based review statuses, which is correct. Now decide how that maps to the artifact lifecycle, without pretending CMO approves.

Artifact lifecycle vs Review lifecycle
  - Artifact: draft → published
  - Review: requested → feedback_sent → vendor_addressing → resubmitted → …
  - Question: do you show both to users or unify into one “status”? Only "published" status can be reviewed or assigned for review. The status to show would be the status of the review cycle

What does “approved” mean in your policy?
  - Since CMO doesn’t approve, “approved” should be replaced with:
    - “Feedback provided” (CMO milestone)
    - “Acknowledged” (vendor/engineering decision)
  - Decide the language now to avoid political trouble. Choose the language you see fit and correct. You are right to combine "feedback provided" with "acknowledgement "

When is a review cycle considered done?
  - Primary milestone = feedback_sent (as you decided)
  - Closure = optional acknowledgment + closed (this is the meeaing of done)
  - Question: who can close a cycle? Vendor? Engineering? Admin? Only concerned Engineering Team, concerned Vendor Team or Admin can close a cycle.

Can multiple review cycles exist concurrently?
  - Strong recommendation: No (only one active cycle per resource). Yes only one cycle for a given resource.
  - Otherwise, chaos.

What happens if the vendor changes the artifact mid-review?
  - Allowed, but the UI must show “artifact changed since submission”. This is allowed and the reviewer's document should immediately be updated and web app shows the info that a document was updated.
  - Or disallow edits while in_review (probably too strict for your context)

# 5) Feedback primitives (how review feedback is captured)
Are comments the primary feedback mechanism?
  - If yes: threads + resolve + mentions is your core.
  - If no: you need structured feedback forms.
A review can be resolved only with comments. But we need to allow for other types of review closure besides using comments only.

Do you need “vendor response state” per thread?
  - Example states on a thread:
    - open
    - vendor_acknowledged
    - addressed
    - disputed
  -This is extremely valuable in vendor negotiations, but also adds complexity.
  - Likely a phase-2 feature.
Yes having venodr state per thread would be nice.

Do you need formal feedback attachments (PDF/Word)?
  - Your process currently uses email/Teams with attached docs.
  - If the app replaces that, you need:
    - upload feedback doc to review cycle
    - versioning of those attachments
    - visibility + download
Sometimes we need formal feedback attachments but not always.

Do you need a review summary?
  - Manual or AI-generated “review summary”
  - This becomes your executive-friendly record.
Yes we need an AI-generated review summary

# 6) UI surfaces (where reviews live in the product)
This is the second biggest decision after versioning.

Where is “Review” initiated?
  - On the artifact page only (recommended)
  - Also on list pages (bulk submit?) (future)
Both: every resource (wiki reource, architecture resource, work item resource) can initiate a review. Doing a bulk submit on list pages is good too but can be for the future (or next phase).

Where is “Review status” visible?
  - On artifact page header: status pill
  - In module list view rows
  - In global Reviews page
It shuold be visible in both artifact header and global Reviews page.

Do you need a dedicated top-nav “Reviews” page?
  - Recommended: yes, for reviewer discovery and vendor visibility.
  - Minimal: “Assigned to me”, “Open”, “Due soon”
Yes for the first option (dedicated top-nav "Reviews" page)

How should the Review panel look on the artifact page?
  - Same pattern as Comments drawer:
    - status, cycle timeline, reviewers, actions
I don't know the answer to this question. You are the expert in UX design and you can make the best decision.

What is the minimal “Review inbox” UI?
  - Table or list with:
    - artifact title
    - bundle/app
    - cycle status
    - due date
    - last activity
    - assigned reviewers
we can have a tile view, or table/list view as well. The link to acces the artifact should also be there.

# 7) Data and integration questions (architecture)
How do reviews relate to events and Activities feed?
  - Review lifecycle events should show in Activities (Yes)
  - Comments created during cycles should carry reviewCycleId (Yes)


How do you handle identity and org structure?
  - Teams, vendors, engineering groups
  - Needed for filtering and default reviewer assignment rules
I am not sure I understand this question.

Permissions
  - Who can see reviews? (likely all internal users)
  - Who can comment? (likely most)
  - Who can mark feedback_sent? (CMO only)
  - Who can resubmit? (vendor only)

Anyone can see reviews, anyone can comment. Only CMO can mark "feedback-sent". Vendor or Enginering Team (who owns the product) can resubmit.

Auditability
  - Do you need immutable record of what was reviewed?
  - If yes, store resourceVersion.contentHash per cycle request.
Yes immutable record of what was reviewed.

# 8) Operational questions (often missed)
How will you prevent review overload?
  - Default assignment rules
  - Limit who can submit
  - Priority field + due date
all of the above.

How will you migrate email-based reviews into the system?
  - Will you import old feedback PDFs?
  - Or start fresh going forward?
we should be able to import old feedback documents.

What happens when CMO membership changes?
  - Reviewer identity should remain stable via userId
  - Past reviews still show historical participants
both of the above.

What is the “happy path” you want in 90 seconds?
  - Vendor submits → CMO comments → feedback sent → vendor addresses → resubmits → CMO verifies → feedback sent → close
Yes that is the happy path, and if the path is shorter that is even better: Vendor submits → CMO comments → feedback sent → vendor acknowledge to address -> close


The 5 decisions I’d make first (to unblock UI)
If you want the most leverage quickly, answer these first:
  - Is review attached to a snapshot/version or “latest”? (review is always done on the latest, but the review is attached to the docment regardless of its various versions. If you can track the version on which the review was done, that would be very good to have)
  - Do we add a global “Reviews” inbox page in top nav (yes/no)? (It is good to have a global "Reviews" in the top nav so that upper managment and many other stakeholders can see who reviewed what and was the review given to the Vendor. But within that screen, we should have some button called "My Inbox" or "Inbox" or "My assigned reviews" so that the user can click it to see the tasks assigned to him in his Inbox)
  - Who can set cycle status transitions (feedback_sent, resubmitted, closed)? Feedbac_sent can ony be set by the reviewer (CMO Member), "resubmitted" can be done by either Vendor or Enginering Team, "Closed" can be done either by Engineering Team who own the bundle or by Vendor Team who is implementing it.
  - Do we require assigned reviewers or is CMO pool enough? Assigned reviewers can be either assigned manually or derived by the mapping between bundle and CMO members (each bundle has one, two, or three CMO members assigned to it)
  - Do we need vendor response states per thread now, or later? If that is possible to have, that would be good, if not, vendor state can be at the bundle or app level 
