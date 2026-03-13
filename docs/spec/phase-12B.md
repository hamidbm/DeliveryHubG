Phase 12B
=========

Structured AI Intelligence Report
---------------------------------

This is where AI Insights stops being "well-rendered markdown" and becomes a more productized analytical feature.

* * * * *

What 12B should focus on
========================

Phase 12B should upgrade the output from a single narrative document into a **structured intelligence view** with explicit sections and evidence.

Recommended 12B goals
---------------------

-   structured report schema instead of one markdown blob

-   top risks section as data objects

-   recommended actions section

-   concentration signals

-   evidence-backed claims

-   data-driven quick suggestions

-   cleaner UI composition with report cards/sections

* * * * *

Suggested 12B structure
=======================

The backend should return something more like:

{\
  "status": "success",\
  "metadata": {\
    "generatedAt": "2026-03-12T20:28:16.333Z",\
    "provider": "OPEN_ROUTER",\
    "model": "qwen/qwen3-coder",\
    "cached": true,\
    "freshnessStatus": "fresh"\
  },\
  "snapshot": {\
    "...": "..."\
  },\
  "report": {\
    "overallHealth": "amber",\
    "executiveSummary": "....",\
    "topRisks": [\
      {\
        "title": "Resource allocation crisis",\
        "severity": "high",\
        "summary": "80 of 89 work items are unassigned.",\
        "evidence": [\
          "80 unassigned work items",\
          "Only 3 active in-progress items"\
        ]\
      }\
    ],\
    "recommendedActions": [\
      {\
        "title": "Assign ownership to top-priority unassigned work",\
        "urgency": "7d",\
        "ownerHint": "Delivery leads"\
      }\
    ],\
    "concentrationSignals": [\
      {\
        "title": "Workload concentration risk",\
        "summary": "Delivery throughput is too dependent on a very small active set."\
      }\
    ],\
    "questionsToAsk": [\
      "Which bundles contain the highest share of unassigned work?",\
      "Which milestones are most exposed to staffing gaps?"\
    ]\
  }\
}

* * * * *

My recommendation to Codex next
===============================

You can send this:

Phase 12A.4 is accepted pending one final verification:\
- confirm long lines wrap correctly in exported PDF\
- confirm no right-edge clipping\
- confirm multi-page pagination is clean

If that passes, proceed to Phase 12B.

Phase 12B objective:\
Transform AI Insights from a single markdown executive report into a structured intelligence experience.

Initial 12B scope:\
- return structured report data from /api/ai/portfolio-summary\
- add overall health signal\
- add top risks array with severity and evidence\
- add recommended actions array\
- add concentration signals\
- add suggested follow-up questions\
- keep markdown export compatibility if needed, but drive the UI from structured sections first\
- preserve current caching/freshness behavior\
- preserve TypeScript cleanliness

# Full detailed spec for Phase 12B
================================

What I gave above was a **directional outline**, not a full Codex-ready implementation spec.

For Phase 12B, we should do the same thing we did for 12A and its follow-up parts:

-   define the exact objective

-   define scope and non-scope

-   define backend contracts

-   define UI behavior

-   define data structures

-   define acceptance criteria

-   define files to create/modify

-   define implementation rules so Codex does not improvise in the wrong places

That will make the work much cleaner and reduce back-and-forth.

* * * * *

Recommendation
==============

I recommend we do **Phase 12B as a full formal spec**.

Given the size of the feature, I also recommend splitting 12B into subparts from the start, for example:

Suggested 12B breakdown
-----------------------

-   **12B.1** Structured report schema and backend response redesign

-   **12B.2** AI Insights UI redesign for structured sections

-   **12B.3** Evidence-backed risks and recommendations

-   **12B.4** Data-driven quick suggestions

-   **12B.5** Ask DeliveryHub AI query experience

That said, if you want to move incrementally like before, the best next step is:

Start with **Phase 12B.1**
==========================

Structured Intelligence Report Contract
---------------------------------------

This should be the foundation for everything else in 12B.

* * * * *

What 12B.1 should cover
=======================

It should specify in detail:

Backend
-------

-   new structured `report` schema

-   LLM prompt redesign

-   strict JSON output contract

-   validation and fallback behavior

-   mapping snapshot data into structured report sections

Report sections
---------------

-   `overallHealth`

-   `executiveSummary`

-   `topRisks`

-   `recommendedActions`

-   `concentrationSignals`

-   `questionsToAsk`

UI
--

-   consume structured sections instead of one markdown blob

-   still preserve markdown export compatibility if needed

-   keep cached/freshness behavior from 12A.3

Acceptance
----------

-   API returns structured data

-   UI renders structured sections

-   no regression in caching/persistence/export

* * * * *