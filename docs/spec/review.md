#  1️⃣ Confirm + freeze (important)
You should explicitly tell Codex that the following is now canonical:
  - Review is cycle-based
  - Primary completion milestone = feedback_sent
  - CMO is advisory only
  - Vendor/Engineering acknowledgment is optional and secondary
  - reviewCycleId on comment_threads is correct and required
  - Review emits events but has no UI yet

  - This prevents future “helpful” refactors that break intent.
#  2️⃣ Explicitly do NOT add these yet
You are at a very tempting point where teams often overbuild. Avoid that.

Tell Codex not to add yet:
  - ❌ Review UI
  - ❌ Review routes / mutations
  - ❌ Blocking publish / enforcement
  - ❌ Notifications outside Activities
  - ❌ Anchors (inline comments)
  - ❌ Attachments inside reviews

All of those depend on usage patterns, which you don’t have yet.

# 3️⃣ What should be done next (highest ROI, lowest risk)
✅ Next Priority: Minimal Review UX (read-only + light actions)
You now have:
  - Comments
  - Mentions
  - Events
  - Review cycles

The next logical step is visibility, not more backend.
Goal of next step
Allow users to:
  - See that a document is under review
  - See the current review cycle status
  - See which cycle comments belong to
  - Trigger start review / feedback sent transitions

👉 This is not a “full review system” yet — it’s a thin UI wrapper over the model you already have.

# 4️⃣ What that “minimal Review UI” should include (scope control)
On an artifact page (Wiki / Diagram)
Add a Review panel or section (similar to Comments):
Read-only at first
  - Current review status (Active / Closed)
  - Current cycle number + status
  - Reviewers (CMO members)
  - Due date (if set)
  - Timeline of cycles (collapsed)

Minimal actions
  - Vendor: “Submit for review” (creates new cycle)
  - CMO: “Mark feedback sent” (cycle → feedback_sent)
  - Vendor: “Resubmit” (cycle → resubmitted)

No permissions complexity yet — just basic role checks.
**Comments integration**
  - When review is active:
    - New comment threads auto-tagged with reviewCycleId
  - Display a small chip on threads:
    - Review Cycle #2

This alone will make the system feel real and useful.

# 5️⃣ EXACT message to send Codex (copy/paste)
Send this verbatim:

Great — the Review data model is now correct and should be considered stable.

Please do not add new review fields or change semantics unless discussed.

Next step: implement a minimal Review UI (visibility-first) with very limited actions.

Scope:
  - Add a Review panel/section on resource pages (Wiki / Architecture) that:
    - Displays current review status (active/closed)
    - Displays current cycle number and cycle status
    - Lists reviewers and optional due date
    - Shows a simple cycle timeline (read-only)
  - Add minimal actions (no complex permissions yet):
    - Vendor: “Submit for review” → creates new review cycle (requested)
    - CMO: “Mark feedback sent” → cycle → feedback_sent
    - Vendor: “Resubmit” → cycle → resubmitted
  - When a review cycle is active:
    - Automatically associate new comment threads with reviewCycleId
    - Display a small “Review Cycle #N” chip on comment threads

Out of scope for this step:
  - No blocking publish
  - No email/Teams notifications
  - No anchors
  - No attachments
  - No advanced permissions

Focus on visibility and light interaction, not governance enforcement.
