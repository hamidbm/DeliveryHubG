The next step should be Phase 12A.3
===================================

Phase 12A.3
-----------

AI Insights persistence, freshness policy, and regeneration control
===================================================================

This phase should make AI Insights behave like a cached executive report with explicit refresh semantics.

* * * * *

Why this is the right next step
===============================

Right now, even with 12A and 12A.1 in place, the feature still has a major product flaw:

-   page visit triggers live AI generation

-   generation cost is incurred repeatedly

-   users can get a different answer every time for the same underlying data

-   performance is worse than necessary

-   there is no stable "latest report" concept

For an executive reporting feature, the correct behavior is:

1.  load the latest cached report first

2.  display its age and metadata

3.  regenerate only when:

    -   user explicitly requests it, or

    -   cache is stale by policy, and regeneration is allowed

That makes the feature cheaper, faster, and more operationally sane.

* * * * *

The target behavior
===================

On page load
------------

When the user opens **AI Insights**:

1.  fetch the latest cached report from DB

2.  if cached report exists and is still fresh:

    -   display it immediately

    -   do **not** call any AI provider

3.  if cached report exists but is stale:

    -   still display it immediately

    -   show that it is stale

    -   optionally allow manual regeneration

4.  if no cached report exists:

    -   show empty first-run state

    -   allow user to generate the first report

On user clicking "Regenerate Analysis"
--------------------------------------

1.  call AI provider

2.  build new report

3.  persist new report and metadata

4.  replace the displayed report

* * * * *

What this phase should add
==========================

1. Separate read vs generate flows
----------------------------------

Right now the summary endpoint appears to behave like:

-   "get report" means "generate report"

That should be split.

### Add two distinct API responsibilities

Read current cached report
--------------------------

Example:

GET /api/ai/portfolio-summary

Returns the latest persisted report plus freshness info.

Generate or refresh report
--------------------------

Example:

POST /api/ai/portfolio-summary

Generates a fresh report, persists it, and returns it.

This is the cleanest contract.

* * * * *

2. Persist AI reports as first-class records
--------------------------------------------

The response should not just be a transient cache blob. It should be a persisted analysis artifact with metadata.

You already have `ai_analysis_cache`; now make it operationally meaningful.

### Suggested stored shape

{\
  _id: "portfolio-summary",\
  reportType: "portfolio-summary",\
  status: "success",\
  metadata: {\
    generatedAt: "2026-03-12T19:35:37.551Z",\
    provider: "OPEN_ROUTER",\
    model: "qwen/qwen3-coder",\
    cached: false,\
    snapshotHash: "...",\
    freshnessStatus: "fresh"\
  },\
  snapshot: { ... },\
  report: {\
    executiveSummary: "..."\
  },\
  updatedAt: ISODate("...")\
}

### Add freshness fields

At minimum include:

-   `generatedAt`

-   `updatedAt`

-   `snapshotHash`

-   `freshnessStatus`

The `snapshotHash` is useful because later you can detect whether the underlying deterministic portfolio snapshot actually changed.

* * * * *

3. Introduce a freshness policy
-------------------------------

The system needs a rule for when cached analysis is still acceptable.

### Recommended initial policy

For **Phase 12A.3**, keep it simple:

-   Fresh: generated within last **24 hours**

-   Stale: older than **24 hours**

-   Expired: optional later state, older than **7 days**

For now, these are enough:

-   `fresh`

-   `stale`

### Behavior

-   `fresh`:

    -   show cached report

    -   no auto-regeneration

-   `stale`:

    -   show cached report

    -   display stale banner

    -   user may manually regenerate

Do **not** auto-regenerate on load in 12A.3.

That avoids surprise cost.

* * * * *

4. First-load behavior must change
----------------------------------

Right now it sounds like entering the AI Insights screen automatically hits the provider.

That should stop.

### New behavior

On mount:

GET /api/ai/portfolio-summary

Only.

### Do not auto-call

POST /api/ai/portfolio-summary

unless one of these is true:

-   user clicks regenerate

-   there is no cached report and product explicitly allows first-run auto-generation

My recommendation: even on first run, use an explicit button:

-   `Generate Analysis`

That keeps cost and intent clear.

If you want a softer first-run experience, you can auto-generate only when there is no cache at all, but I would still prefer explicit action.

* * * * *

5. Improve report metadata on screen
------------------------------------

Since cached reports become the default mode, the screen should display report metadata clearly.

### Add a metadata bar

Show:

-   Generated at

-   Provider

-   Model

-   Freshness status

-   Cached/live source

Example copy:

-   `Generated 2 hours ago`

-   `Fresh`

-   `Provider: OPEN_ROUTER`

-   `Model: qwen/qwen3-coder`

If stale:

-   `Generated 3 days ago`

-   `Stale analysis`

-   `Regenerate to refresh`

* * * * *

6. Add a proper stale-state UX
------------------------------

If the report is stale, do not hide it.

Show it with a subtle banner above the report:

> This analysis is older than the current freshness window and may not reflect the latest portfolio state.

Then keep the regenerate button visible.

* * * * *

7. Fix PDF export properly
--------------------------

What you described means the current implementation is likely trying one of these bad patterns:

-   `window.open(...)` with generated content

-   a blob URL that is not written correctly

-   printing a blank container

-   using a viewer route that receives empty content

### Correct requirement

The action should trigger an actual file download, such as:

deliveryhub-ai-insights-2026-03-12-19-35.pdf

### Better implementation direction

Generate the PDF into a `Blob`, then download via an anchor with `download=...`.

Do not rely on opening a viewer tab unless the user explicitly asked for preview.

* * * * *

What Phase 12B should be after that
===================================

Once 12A.3 is done, then the feature foundation is strong enough for the real analytical upgrade.

Phase 12B should focus on report structure
------------------------------------------

That means:

-   structured AI output schema

-   top risks

-   recommended actions

-   concentration signals

-   evidence-backed claims

-   data-driven quick suggestions

So the sequence should be:

-   12A: reliability

-   12A.1: provider normalization fixes

-   12A.2: markdown rendering and export

-   12A.3: persistence, freshness, regeneration control

-   12B: analytical richness

* * * * *

What I recommend you tell Codex next
====================================

Use this as the next instruction.

Proceed with the next subphase: Phase 12A.3 - AI Insights persistence, freshness policy, and regeneration control.

Goals:\
- AI Insights must not call an AI provider automatically on every page visit\
- page load should fetch the latest persisted report from DB first\
- only manual regenerate should trigger live AI generation\
- cached report should include metadata and freshness state\
- stale cached reports should still display, with a stale banner\
- if no cached report exists, show a first-run empty state with a Generate Analysis action\
- PDF export must download an actual PDF file, not open a blank viewer\
- Markdown styling should reuse the same markdown presentation layer/CSS as the Wiki

Implementation requirements:

1\. Split read and generate behaviors\
- GET /api/ai/portfolio-summary => return cached persisted report + freshness info\
- POST /api/ai/portfolio-summary => generate fresh report, persist it, return it

2\. Persist report as first-class stored analysis\
Use ai_analysis_cache and store:\
- reportType\
- status\
- metadata.generatedAt\
- metadata.provider\
- metadata.model\
- metadata.cached\
- metadata.freshnessStatus\
- metadata.snapshotHash if feasible\
- snapshot\
- report\
- updatedAt

3\. Freshness policy\
- fresh if generated within 24 hours\
- stale if older than 24 hours\
- do not auto-regenerate on load when stale\
- show stale banner and allow manual regenerate

4\. UI behavior in AIInsights.tsx\
- on mount call GET only\
- do not POST on mount\
- show first-run empty state when no cached report exists\
- manual Regenerate Analysis triggers POST\
- display freshness metadata clearly

5\. PDF export fix\
- make PDF action download a real file\
- do not open blank viewer tabs/windows\
- use filename deliveryhub-ai-insights-YYYY-MM-DD-HH-mm.pdf

6\. Keep existing 12A behavior intact\
- preserve provider error classification\
- preserve fallback behavior on POST\
- preserve TypeScript cleanliness

Acceptance:\
- revisiting AI Insights uses cached DB report without calling provider\
- POST only happens on explicit regenerate\
- stale report displays with stale banner\
- first-run state works\
- PDF downloads as a file\
- npx tsc --noEmit passes

* * * * *

One design recommendation
=========================

I strongly recommend that **stale cache still renders by default** rather than blocking the user with a forced refresh. For an executive report, "slightly old but available" is usually much better than "fresh but expensive and slow every time."

* * * * *

Bottom line
===========

The next move is not 12B yet.

It is **12A.3: persistence, freshness, and controlled regeneration**.

That will turn AI Insights from a costly live-generation screen into a stable reporting feature. After that, we can write the full **12B spec** for structured risks, recommendations, and explainability.