

Things to verify / likely adjust
1) Naming mismatch: documentTypeLabel vs
documentType
Your spec used documentType="Feedback Document" (or at least “documentType”
as the taxonomy field). Codex implemented documentTypeLabel.
That might be fine, but it creates fragmentation:
## •
tree filters might use documentType
## •
search might use documentType
## •
UI may display documentTypeLabel
Recommendation: keep one canonical field for type (prefer documentType) and make
documentTypeLabel derived or UI-only.
## Tell Codex:
•unify and avoid parallel fields unless there’s an explicit reason
2) Vendor status endpoint included: vendor-
addressing
Good — but confirm the UI uses it correctly.
We want:
## •
After feedback_sent, vendor can optionally click “Start addressing” → sets status
vendor_addressing
•Then vendor can close or resubmit.
If the UI doesn’t expose vendor_addressing, it’s fine, but then close/resubmit gating should allow
feedback_sent too (which we agreed on).
3) Attachments endpoint is multipart and reviewer-only
Good — now ensure:

•UI shows upload progress + errors
•attachments list is visible after upload
## •
attachments are associated with the correct cycle and include reviewContext
What to do next (high ROI)
Priority 1 — Add explicit UI feedback for API errors (do
this)
Yes to Codex’s suggestion #1.
Right now users will perceive “nothing happened” unless:
•403/409 are surfaced clearly
•buttons show spinners
•success toast confirms changes
UX contract
•On submit/transition/upload:
## ◦
button shows loading
## ◦
on success → toast + refresh panel state
## ◦
on 403 → show “You are not a reviewer for this cycle”
## ◦
on 409 → show “A review is already active (Cycle #N). Open it instead.”
This will eliminate most user confusion.
Priority 2 — Hide feedback assets from global search
(probably yes)
I recommend yes, but with a toggle:
•Default search excludes feedback (like the tree)
•Add filter: “Include feedback”

Otherwise your search will get noisy.
Priority 3 — Reviewer selection UX improvements (optional)
“Select all / Clear” only matters if you expect large reviewer lists. Nice-to-have, not urgent.
Two additional enhancements I’d request
(not mentioned by Codex)
A) Make “Review Feedback” tab show Cycle #N label
In Comments drawer, rename:
## •
“Review Feedback” → “Review Feedback (Cycle #N)”
This prevents confusion when there are multiple cycles.
B) Past Reviews tab should group by cycle
In “Past Reviews”:
•group threads under headers like:
## ◦
“Cycle #1 (Closed)”
## ◦
“Cycle #2 (Closed)”
This makes navigation much easier.
Exactly what to send Codex (copy/paste)
Great — this looks aligned with the canonical spec. Please implement the following next
(priority order):
P1) UI feedback for API errors and success
•In Review panel + attachments upload:
## ◦
show loading spinners on actions

## ◦
show toast/snackbar on success
## ◦
surface API errors clearly:
## ▪
403: “You are not authorized for this action (not a reviewer / not
requester)”
## ▪
409: “A review cycle is already active for this resource”
## ▪
400: show validation message (e.g., “Must be published before submit”)
## •
After any action success, re-fetch /api/reviews/by-resource to refresh state.
P2) Normalize feedback document type field
## •
Currently feedback assets set documentTypeLabel="Feedback
Document". We need one canonical type field.
## •
Please align on documentType (preferred) and use label only for display if needed.
Avoid parallel documentType vs documentTypeLabel unless there’s a clear
separation.
P3) Global search behavior
•Hide feedback assets from global search results by default, consistent with the tree.
## •
Add a filter/toggle “Include feedback” to include artifactKind="feedback".
P4) Comments drawer clarity
•Rename “Review Feedback” tab to “Review Feedback (Cycle #N)” for the current cycle.
•In “Past Reviews”, group threads by cycle number (Cycle #1, Cycle #2, ...) so it’s
obvious which round they belong to.
(Select all/Clear for reviewers is optional; do after the above.)