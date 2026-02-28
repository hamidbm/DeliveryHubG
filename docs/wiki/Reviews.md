# Reviews

DeliveryHub includes a shared review system used by Wiki documents and Architecture diagrams. Reviews are tracked as cycles with assigned reviewers, feedback, and vendor responses. Review requests also create linked Work Items to ensure execution tracking.

## Where Reviews Live
- **Wiki**: Pages and uploaded assets can be submitted for review.
- **Architecture**: Diagrams can be submitted for review from the diagram drawer.

## Roles
- **Requester/Vendor**: submits the artifact for review and responds to feedback.
- **Reviewer**: provides comments and submits feedback.
- **Admin/CMO**: reviewer eligibility and governance.

## Review Lifecycle (High-Level)
1. **Submit for Review** — creates or reuses a review record and opens a new review cycle.
2. **Reviewer Feedback** — reviewers add comments and submit feedback.
3. **Vendor Response** — vendor responds to feedback and closes the cycle.
4. **Reopen or Start New Cycle** — optional if additional review is required.

## Review Cycles
Each review can contain multiple cycles. A cycle captures:
- reviewers assigned
- requests and due dates
- reviewer feedback and attachments
- vendor response and close state

## Work Items Integration
When a review request is submitted:
- A **User Story** is created in Work Items.
- The story is assigned to the reviewers.
- The story includes a link back to the artifact (wiki or diagram).
- Reviewer feedback and vendor responses are mirrored in the Work Item activity.

## Comments
There are two comment flows:
- **Review comments**: part of the review cycle and linked to the Work Item.
- **General comments**: standard artifact comments (not part of a review).

## Notifications and Activity
- Review events emit activity entries and appear in Activities feeds.
- Review-related updates can drive status changes in Work Items.

## Data Model
- Reviews: `reviews`
- Review comments: `comment_threads`, `comment_messages`
- Reviewer feedback packages: `feedback_packages`
- Linked Work Items: `workitems`

## Related Docs
- Wiki module: `docs/wiki/Modules-Wiki.md`
- Architecture module: `docs/wiki/Modules-Architecture.md`
- Work Items module: `docs/wiki/Modules-WorkItems.md`
