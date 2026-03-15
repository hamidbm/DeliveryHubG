We are adding structured notes to the Review cycle to capture lightweight guidance and vendor responses.
>
> 1\. Data model changes (ReviewCycle)
> ------------------------------------
>
> Add two optional fields to each cycle:
>
```typescript
reviewerNote?: {
  body: string
  createdAt: Date
  createdBy: ActorRef
}

vendorResponse?: {
  body: string
  submittedAt: Date
  submittedBy: ActorRef
}
```
>
> Notes:
>
> *   reviewerNote is part of FeedbackData.
>
> *   vendorResponse is part of vendor addressing (not feedback).
>
> *   These must remain separate objects.
>
>
> 2\. Reviewer UX
> ---------------
>
> When cycle.status is in\_review:
>
> *   Show editable multiline field: “Reviewer Note”.
>
> *   Save into reviewerNote.
>
>
> When status ≥ feedback\_sent:
>
> *   Render reviewerNote read-only.
>
>
> Reviewer must NOT be able to edit after feedback\_sent.
>
> 3\. Vendor UX
> -------------
>
> When cycle.status is vendor\_addressing:
>
> *   Show editable multiline field: “Vendor Response”.
>
> *   Save into vendorResponse.
>
>
> Vendor must NOT be able to modify reviewerNote.
>
> 4\. Rendering
> -------------
>
> Notes should support markdown rendering (same renderer used in comments/wiki).
>
> Goal: capture structured lightweight feedback and vendor response without polluting comments or attachments.

🎯 Why this feature is valuable (you’re thinking correctly)
Your scenario is very real:
“I don’t want to upload a document, and I don’t want to start a long thread — I just want to give structured guidance with a link.”
Notes solve:
✅ quick reviewer guidance
✅ cross-linking to existing wiki knowledge
✅ executive summary style feedback
✅ structured vendor response context
✅ cleaner review history
Without notes, users misuse:
comments (too noisy)
attachments (too heavy)
So conceptually, this is a strong addition.
🚨 The critical design rule (do NOT skip this)
You already hinted at the most important insight:
Reviewer note ≠ Vendor note
They serve different semantic purposes.
If you mix them, the review timeline becomes ambiguous.
✅ Correct conceptual model
Each cycle should support two different note channels:
1. Reviewer Note (part of feedback)
This belongs to the CMO/reviewer phase.
Purpose:
guidance
summary
references
links to wiki docs
architectural remarks
This is part of FeedbackData.
2. Vendor Response Note (intake side)
This belongs to the vendor when resubmitting.
Purpose:
what we changed
what we accepted/rejected
implementation notes
negotiation context
This is NOT feedback.
This is part of Vendor addressing context.

🗄️ Recommended DB schema change
Inside each cycle:
Add reviewer note
reviewerNote?: {
  body: string
  createdAt: Date
  createdBy: ActorRef
}
Add vendor response note
vendorResponse?: {
  body: string
  submittedAt: Date
  submittedBy: ActorRef
}
Why separate objects (very important)
Because they answer different questions:
Question	Field
What guidance did CMO give?	reviewerNote
What did vendor say back?	vendorResponse
This separation becomes extremely valuable in:
audits
dashboards
analytics
your future graphical workflow view
🎨 UX Design (keep it clean)
For reviewers (when in_review)
Show under attachments:
Reviewer Note
[ multiline text area ]

(optional but powerful)
Supports markdown + internal wiki links
After feedback_sent
Render read-only:
Reviewer Note
──────────────
<rendered markdown>
For vendor (when vendor_addressing)
Show:
Vendor Response
[ multiline text area ]
Only visible/editable to requester/vendor roles.
⚠️ Important guardrails
Do NOT
❌ merge notes into comments
❌ store note as generic string without metadata
❌ allow editing after feedback_sent (reviewer note)
❌ allow reviewer to overwrite vendor response
❌ allow vendor to overwrite reviewer note