Phase 12 Recommendation: AI Insights
====================================

Based on the current screen and the code behind it, Phase 12 should be the release where **AI Insights becomes a real product feature instead of a placeholder summary box**.

Right now the page is visually good, but functionally still thin:

-   The main report depends on a single `POST /api/ai/portfolio-summary` call.

-   The page shows `AI response unavailable.` because the API is failing or returning no usable content.

-   The "Ask DeliveryHub AI" panel is only UI chrome at the moment.

-   The "Quick Suggestions" panel is static text.

-   The current summary prompt only looks at applications and bundles, which is too shallow for delivery intelligence.

So the right Phase 12 is not "make the box call AI again." It should be:

Phase 12 Theme
--------------

**Operationalize AI Insights as Delivery Intelligence**

That means this feature should become a governed, explainable, data-backed assistant for portfolio and delivery management.

* * * * *

What is broken today
====================

From the current implementation, these are the practical gaps:

1. The page fails silently
--------------------------

The component only sets:

-   `data.summary`

-   or `"Analysis unavailable."`

But the API can return structured errors such as:

-   no configured default provider

-   missing API key

-   rate limit exceeded

-   provider request failure

The UI is collapsing all of that into a dead panel.

2. The AI context is too narrow
-------------------------------

The portfolio summary route currently feeds the model only:

-   applications

-   bundles

That is not enough for meaningful delivery analysis.

A real delivery intelligence report should also include:

-   work items

-   milestones

-   sprints

-   review cycles

-   architecture review status

-   overdue items

-   blocked items

-   health distribution

-   critical apps

-   ownership concentration

-   vendor concentration

-   aging work

-   schedule variance

3. The page has no deterministic metrics
----------------------------------------

Everything is framed as generated text. That is risky.

AI Insights should combine:

-   **deterministic portfolio metrics**

-   **AI narrative interpretation**

The executive report should never be pure LLM prose without source numbers.

4. Natural-language query is not implemented
--------------------------------------------

The right-side "Ask DeliveryHub AI" card is currently a visual stub.

5. Suggestions are not actionable
---------------------------------

The current suggestions are hardcoded strings, not derived from the actual portfolio state.

* * * * *

What Phase 12 should deliver
============================

I would define Phase 12 as four concrete tracks.

Track A: Make AI Insights reliable
----------------------------------

This is the minimum bar.

### Deliverables

-   Proper loading, empty, error, and success states

-   Explicit error messages on the page

-   Detection of common admin misconfiguration:

    -   no default provider configured

    -   missing provider credentials

    -   rate limit hit

-   "Last generated at" metadata

-   Provider/model metadata shown in a subtle footer

-   Retry behavior that preserves the last good report until a new one succeeds

### Why this matters

The current `AI response unavailable.` state feels broken and gives no remediation path. This needs to be admin-operable.

### Recommended UI behavior

Replace the blank report state with something like:

-   **Configuration issue**: no AI provider is configured

-   **Provider unavailable**: request failed against configured provider

-   **Rate limited**: try again later

-   **No portfolio data**: not enough portfolio data to synthesize insights

Also add an admin link or hint:

-   "Configure AI provider in Admin > AI Settings"

* * * * *

Track B: Introduce a deterministic Delivery Intelligence dataset
----------------------------------------------------------------

Before asking the model anything, compute a structured portfolio snapshot server-side.

### Add a new server-side aggregator

For example:

-   `buildPortfolioIntelligenceSnapshot()`

This should summarize:

Portfolio metrics
-----------------

-   total applications

-   total bundles

-   total epics / features / stories / tasks

-   work items by status

-   work items by priority

-   overdue count

-   blocked count

-   items with no owner

-   items due in next 7 / 14 / 30 days

-   milestone completion distribution

-   sprint load and slippage

-   apps by health

-   critical apps without active mitigation

-   review cycles open / overdue / resubmitted

-   architecture approvals pending

-   vendor concentration

-   owner concentration

-   bundle concentration

Risk signals
------------

Examples:

-   high overdue ratio

-   too many critical apps in one bundle

-   reviews pending close to go-live

-   many blocked stories in one milestone

-   no active work for an app near target date

-   resource concentration on one owner/vendor

-   stale milestones

-   large amount of unassigned work

### Why this matters

This becomes the canonical dataset for:

-   the executive AI report

-   quick suggestions

-   future charts

-   natural-language queries

-   explainability

Without this layer, AI Insights stays vague.

* * * * *

Track C: Make the AI output structured and explainable
------------------------------------------------------

Do not ask the model for one free-form blob. Ask for structured output.

Recommended response contract
-----------------------------

Instead of only returning:

{ "summary": "..." }

Return something closer to:

{\
  "generatedAt": "2026-03-12T08:15:00Z",\
  "provider": "OPENAI",\
  "model": "gpt-5.2",\
  "snapshot": {\
    "applicationCount": 42,\
    "bundleCount": 8,\
    "criticalHealthApps": 5,\
    "overdueWorkItems": 19,\
    "openReviewCycles": 7\
  },\
  "report": {\
    "overallHealth": "Amber",\
    "executiveSummary": "...",\
    "topRisks": [\
      {\
        "title": "...",\
        "severity": "high",\
        "rationale": "...",\
        "evidence": ["..."]\
      }\
    ],\
    "recommendedActions": [\
      {\
        "title": "...",\
        "ownerHint": "...",\
        "timeHorizon": "7d"\
      }\
    ],\
    "concentrations": [\
      {\
        "type": "owner",\
        "name": "...",\
        "impact": "..."\
      }\
    ],\
    "questionsToAsk": [\
      "..."\
    ]\
  }\
}

UI sections for the main panel
------------------------------

The main report should be split into cards/sections:

-   Overall portfolio signal

-   Executive summary

-   Top risks

-   Recommended actions

-   Concentration points

-   Why the model said this

Explainability
--------------

For each risk or recommendation, add evidence chips such as:

-   `12 overdue items in Milestone 3`

-   `3 critical apps owned by same delivery lead`

-   `4 review cycles past due`

This is essential. AI Insights should not feel like opaque management theater.

* * * * *

Track D: Implement Ask DeliveryHub AI properly
----------------------------------------------

This is the part that will make the page feel alive.

### Phase 12 scope for NLQ

Do not build open-ended chat yet. Build a controlled question-answer layer over the portfolio snapshot.

Good Phase 12 pattern
---------------------

User asks:

-   How many apps are at critical health?

-   Which bundles have the most overdue work?

-   What reviews are overdue?

-   Which milestones are most at risk?

-   Which applications have no active stories but are near go-live?

The backend should:

1.  Build the deterministic intelligence snapshot

2.  Route the question to an AI or hybrid answer service

3.  Return:

    -   direct answer

    -   short explanation

    -   evidence rows

    -   suggested follow-up questions

Recommended API
---------------

Something like:

-   `POST /api/ai/portfolio-query`

Request:

{\
  "question": "How many apps are at critical health?"\
}

Response:

{\
  "answer": "5 applications are currently at critical health.",\
  "explanation": "These are the apps with health = critical in the current registry snapshot.",\
  "evidence": [\
    { "type": "application", "id": "app-1", "name": "MemberPortal" },\
    { "type": "application", "id": "app-2", "name": "ClaimsAPI" }\
  ],\
  "followUps": [\
    "Which bundle contains the most critical applications?",\
    "Which critical applications are closest to go-live?"\
  ]\
}

Important design choice
-----------------------

For many queries, answer should be **deterministic first**, AI second.

For example:

-   counts

-   lists

-   grouping

-   top-N

-   overdue sets

These should come from code, not LLM inference.

Use AI only for:

-   phrasing

-   synthesis

-   summarization

-   prioritization

-   cross-signal reasoning

* * * * *

What the AI Insights page should look like after Phase 12
=========================================================

I would evolve the screen into this structure.

Left column
-----------

### 1. Executive Intelligence Report

Narrative summary with explicit health signal.

### 2. Top Risks

A ranked list with severity and evidence.

### 3. Recommended Actions

Action-oriented recommendations with ownership hints and urgency.

### 4. Concentration and Dependency Watch

Owner, vendor, bundle, milestone, and review bottlenecks.

Right column
------------

### 1. Ask DeliveryHub AI

Natural-language query box with real responses.

### 2. Quick Suggestions

Generated from actual data, not hardcoded.

Examples:

-   Show overdue review cycles due within 7 days

-   Which bundles have the most blocked stories?

-   Which critical apps have no mitigation work?

-   What approvals are pending for go-live candidates?

### 3. Portfolio Snapshot

Small deterministic tiles:

-   Critical apps

-   Overdue work

-   Blocked stories

-   Open reviews

-   Pending architecture approvals

### 4. Last Analysis Metadata

Generated time, provider, model, and data freshness.

* * * * *

What should be in scope for Phase 12 specifically
=================================================

Here is the scope I would recommend shipping now.

Phase 12 scope
--------------

### 1. Reliability and admin clarity

-   Add full error-state handling on the AI Insights page

-   Show provider/configuration problems clearly

-   Preserve last successful report

-   Show generated timestamp and provider/model metadata

### 2. Portfolio intelligence snapshot service

-   Build one server-side aggregator that computes deterministic metrics

-   Use it as the basis for all AI Insights outputs

### 3. Better executive report

-   Expand summary input beyond applications and bundles

-   Return structured output, not only free text

-   Render risks, actions, and concentrations as separate sections

### 4. Real Quick Suggestions

-   Generate suggestions from actual snapshot conditions

-   Clicking a suggestion should populate and submit the query box

### 5. Implement Ask DeliveryHub AI v1

-   Add `portfolio-query` API

-   Support a curated set of natural-language questions

-   Return answer + evidence + follow-ups

### 6. Audit and governance

-   Continue audit logging

-   Log question type, provider, model, latency, success/failure

-   Respect existing rate limiting and provider routing

* * * * *

What should stay out of scope for Phase 12
==========================================

To keep the phase tight, I would avoid these for now:

-   full conversational memory

-   autonomous actions

-   auto-writing back to work items

-   multi-turn AI planning workflows

-   complex chart generation

-   cross-page AI copilot that edits data

-   automatic recommendations that mutate portfolio state

Those belong in a later phase.

* * * * *

Why the screenshot currently shows no result
============================================

Most likely one of these is happening:

Most likely causes
------------------

-   No effective default AI provider is configured

-   Required API key is missing

-   Provider request failed

-   API returned `{ error: ... }` and the frontend ignored it

-   The model returned empty text and the UI fell back to "Analysis unavailable."

The current component does not display the actual error body from the API, so the page looks dead instead of diagnosable.

That should be the first thing fixed.

* * * * *

My recommended Phase 12 statement
=================================

If you want a crisp definition for the phase, I would frame it like this:

Phase 12
--------

**Transform AI Insights into a governed delivery intelligence console with deterministic portfolio metrics, structured executive reporting, actionable AI Q&A, and full operational error handling.**

* * * * *

Recommended implementation order
================================

Step 1
------

Fix AI Insights frontend states and expose real backend errors.

Step 2
------

Create the portfolio intelligence snapshot service.

Step 3
------

Upgrade `/api/ai/portfolio-summary` to use that snapshot and return structured output.

Step 4
------

Replace static quick suggestions with data-driven suggestions.

Step 5
------

Implement `/api/ai/portfolio-query` and connect the query box.

Step 6
------

Add evidence rendering and explainability to answers and risks.

* * * * *

Bottom line
===========

Phase 12 should not just "improve the AI summary."

It should make **AI Insights** into a real management feature with:

-   trustworthy numbers

-   explainable AI conclusions

-   actionable recommendations

-   natural-language portfolio querying

-   operational clarity when AI is unavailable

