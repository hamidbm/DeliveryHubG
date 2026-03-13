Structured AI Insights UI refinement and section quality
========================================================

12B.1 introduced the structured contract.\
12B.2 should make the structured experience feel polished, useful, and intentional.

Right now, even with the new schema, the UI can still feel like a raw contract dump unless we refine the presentation and section logic.

* * * * *

What 12B.2 should focus on
==========================

1. Turn sections into high-quality insight cards
------------------------------------------------

Improve presentation of:

-   `Top Risks`

-   `Recommended Actions`

-   `Concentration Signals`

-   `Questions to Ask`

Each section should look like product UI, not just serialized data.

### Example improvements

For risks:

-   severity badge

-   stronger title

-   concise summary

-   evidence list styled as supporting facts

For actions:

-   urgency badge

-   owner hint

-   why this action matters

For concentration signals:

-   concise title and impact text

-   evidence chips or mini bullet evidence

For questions:

-   cleaner prompt card style

-   rationale shown subtly underneath

* * * * *

2. Improve section empties and fallback states
----------------------------------------------

If a section has no items, it should not look broken or dead.

Examples:

-   `No major risks identified from the current portfolio snapshot.`

-   `No additional concentration concerns identified at this time.`

These should be deliberate empty states, not placeholders.

* * * * *

3. Make evidence more visible and readable
------------------------------------------

Evidence is important for trust.

Instead of burying it in paragraphs, render evidence as:

-   short bullets

-   compact evidence chips

-   supporting facts under each item

This will help the screen feel explainable.

* * * * *

4. Improve overall health presentation
--------------------------------------

The `Overall Health` badge should become a stronger headline signal.

For example:

-   show a colored pill or badge

-   include a short one-line interpretation:

    -   `Amber: delivery execution risk is elevated despite strong application health`

This gives the page a better top-level summary.

* * * * *

5. Add a stable section order and visual rhythm
-----------------------------------------------

The page should read naturally top-to-bottom:

1.  Overall health

2.  Executive summary

3.  Top risks

4.  Recommended actions

5.  Concentration signals

6.  Questions to ask

7.  Full narrative report

This order should become intentional and consistent.

* * * * *

What should stay out of 12B.2
=============================

Do **not** add yet:

-   clickable question actions

-   natural-language query submission

-   deep links into work items/apps/reviews

-   charts

-   AI chat

-   auto-generated quick suggestion interactions

Those should come later.

* * * * *

Recommended next instruction to Codex
=====================================

Phase 12B.2 objective:
Refine the structured AI Insights UI so it feels like a polished intelligence experience rather than a raw structured payload.

Scope:
- improve rendering of Top Risks, Recommended Actions, Concentration Signals, and Questions to Ask
- add better badges/labels for severity and urgency
- improve evidence presentation
- improve empty states for sections with no items
- strengthen the Overall Health presentation with a short interpretation line
- preserve current caching, exports, legacy fallback, and narrative report access
- keep TypeScript clean

Do not add yet:
- question click actions
- query box behavior
- charts
- deep links
- chat