Phase 12B.2 Specification
=========================

UI Refinement for Structured AI Insights
----------------------------------------

* * * * *

1. Purpose
----------

Phase 12B.2 refines the user experience for **Structured AI Insights** by transforming raw structured data into a polished, explainable executive intelligence dashboard.

Prior subphases introduced structured report data and basic rendering. This phase upgrades:

-   visual presentation quality

-   perception of trust and insight

-   clarity of risk/action content

-   readability and section semantics

-   empty/fallback states

This is *not* about adding new AI capabilities or client-side interactivity beyond presentation building blocks.

* * * * *

2. Goals
--------

### Functional Goals

1.  Render structured report sections in a **design-cohesive, visually rich** format.

2.  Improve **Top Risks**, **Recommended Actions**, **Concentration Signals**, and **Questions to Ask** into card-style lists with badges and hierarchies.

3.  Enhance **Overall Health** into a clearer summary widget with contextual color/label.

4.  Make evidence items clearly visible and readable.

5.  Improve empty states with meaningful placeholder content.

6.  Preserve existing behaviors:

    -   cache/freshness banners

    -   markdown/PDF export

    -   manual regeneration

    -   legacy narrative report access

7.  Maintain accessibility and layout responsiveness.

### Non-Functional Goals

-   aesthetically align with the rest of DeliveryHub UI

-   avoid layout breakage with long text

-   avoid regression on legacy compatibility

-   keep behavior predictable for later phases

* * * * *

3. Scope
--------

### In Scope

-   UI rendering improvements for structured report

-   stylistic upgrades for section cards

-   evidence visualization (bulleted lists or chips)

-   enhanced section headings and labels

-   placeholder empty states

-   mild UX enhancements (e.g., collapsible narrative section)

### Out of Scope

-   interactive AI chat / query input

-   drill-down to work items, applications, or reviews

-   analytics charts

-   export format changes

-   backend contract changes

-   real-time or auto regeneration triggers

These belong to later 12B subphases.

* * * * *

4. Report Screen Layout
-----------------------

The AI Insights page should be visually structured with these major vertical sections:

Overall Health\
Executive Summary\
Top Risks\
Recommended Actions\
Concentration Signals\
Questions to Ask\
(Optional) Full Narrative Report

Each section becomes a card or grouped panel with a clear heading and content area.

* * * * *

5. UI Section Specifications
----------------------------

### 5.1 Overall Health Widget

**Position:** Immediate top of report content, beneath metrics bar.

**Content:**

-   Health label tag (colored pill)

-   Optional one-sentence interpretation

**Allowed values:**

-   Green → low risk

-   Amber → elevated risk

-   Red → high risk

-   Unknown → insufficient data

**Design notes:**

-   Tag color maps directly to health level (green/yellow/red/gray)

-   If available, include a short interpretive sentence (derived from executiveSummary or deterministic signals)

**Example:**

Overall Health: Amber\
Delivery execution risk is elevated due to large unassigned workload.

* * * * *

### 5.2 Executive Summary Panel

**Purpose:** concise narrative overview.

**Content:**

-   Styled paragraph(s)

-   no raw markdown shown

-   properly wrapped text

**Design:**

-   Use existing card or section container

-   consistent with Wiki prose patterns

* * * * *

### 5.3 Top Risks Panel

**Purpose:** highlight highest-priority risk signals.

**Behavior:**

-   render each risk item as a distinct subcard or row

-   order by descending severity

**For each risk:**

-   badge for severity

-   title

-   summary

-   evidence list (bullets or chips)

**Severity badges:**

-   Critical → red

-   High → red/orange

-   Medium → amber

-   Low → gray/blue

**Empty state text:**

No major risks identified at this time.

* * * * *

### 5.4 Recommended Actions Panel

**Purpose:** show prioritized next steps.

**Behavior:**

-   each action as a subcard or row

-   urgency badge

-   title

-   summary

-   optional owner hint

-   optional evidence

**Urgency badges:**

-   Now (red)

-   Next 7d (orange)

-   Next 30d (yellow)

-   Later (blue/gray)

**Empty state:**

No recommended actions available.

* * * * *

### 5.5 Concentration Signals Panel

**Purpose:** surface patterns where workload, risk, or dependencies are concentrated.

**Behavior:**

-   subcards or rows

-   title

-   summary

-   optional evidence

**Empty state:**

No concentration signals identified.

* * * * *

### 5.6 Questions to Ask Panel

**Purpose:** show follow-up analytical prompts.

**Behavior:**

-   list of question rows

-   include rationale text beneath each question if present

**Empty state (rare):**

No follow-up questions suggested.

* * * * *

### 5.7 Full Narrative Report (Legacy/Optional)

**Purpose:** preserve the original narrative report.

**Behavior:**

-   provide a collapsible UI block labeled:

    Full Narrative Report

-   render the old markdown format here (if stored)

-   keep it collapsed by default, users can expand to read

* * * * *

6. Section Layout and Styling Rules
-----------------------------------

### 6.1 Consistency

-   Headings use consistent typography scale

-   Card containers have consistent padding and margin

-   Evidence lists use bullet formatting

-   Badges have consistent color semantics

### 6.2 Responsiveness

-   Text should wrap gracefully on narrow screens

-   Cards stack vertically on mobile

### 6.3 Overflow & Pagination

-   Long lists should scroll within a container limit or paginate if necessary

-   Avoid clipping text

### 6.4 Accessibility

-   All headings use appropriate semantic elements

-   Badge color is paired with text label for clarity

* * * * *

7. Behavior for Partial or Missing Data
---------------------------------------

### 7.1 No Structured Items

If a structured section array is empty:

-   show a friendly placeholder message

-   do **not** leave a blank box

### 7.2 Legacy Normalization Fallback

If a section cannot be extracted from old markdown or structured output:

-   display fallback message

-   allow viewing legacy narrative

### 7.3 Evidence Only

If a risk/action contains only evidence without summary:

-   synthesize a human-readable summary using the first evidence item

* * * * *

8. Integration with Existing Features
-------------------------------------

### 8.1 Caching & Regeneration

-   Maintain manual regeneration button

-   Maintain stale/fresh banners

### 8.2 Markdown/PDF Export

-   Structured UI does **not** replace export

-   Export still uses markdownReport from structured schema or structured→markdown formatter

### 8.3 Legacy Compatibility

-   If cached legacy report is normalized, show legacy narrative below structured UI or as fallback

* * * * *

9. UI Component Design Guidelines
---------------------------------

These are Codex recommendations for implementation patterns:

### 9.1 Section Containers

Use a reusable card component with:

-   title bar with icon + label

-   optional header actions

-   body area for content

### 9.2 Badge Components

Create shared badges for:

-   severity

-   urgency

-   health

Example props:

<Badge type="severity" level="high" />\
<Badge type="urgency" level="7d" />\
<Badge type="health" level="amber" />

### 9.3 Evidence List

Render as:

-   bullet list (`<ul><li>...</li></ul>`)

-   or chips (`<Chip text="evidence here" />`)

### 9.4 Question Rows

Each question row has:

-   question text in bold

-   optional rationale below in smaller font

* * * * *

10. Files to Modify
-------------------

At minimum:

src/components/AIInsights.tsx\
src/components/ai-insights/*.tsx (if broken into subcomponents)

Potential new UI modules:

src/components/ui/Badge.tsx\
src/components/ui/RiskCard.tsx\
src/components/ui/ActionCard.tsx\
src/components/ui/ConcentrationCard.tsx\
src/components/ui/QuestionRow.tsx

If the app uses styled systems or tailwind, follow that pattern.

* * * * *

11. Acceptance Criteria
-----------------------

### UI Rendering

-   Structured sections render in the order: Health, Summary, Risks, Actions, Concentration, Questions, Narrative

-   Each structured array is visually presented

-   Empty states are friendly and informative

### Evidence Formatting

-   Evidence lists/chips display clearly beneath titles/summaries

### Badges

-   Health, Severity, Urgency badges use consistent visual style

### Legacy Report

-   Original narrative report accessible in a collapsible section

### Export

-   Markdown/PDF export unchanged and works as before

### Cross-Device

-   UI renders correctly on narrow and wide viewports

### Stability

-   No new errors

-   TypeScript building clean

* * * * *

12. Example Section Rendering (Illustrative)
--------------------------------------------

Overall Health   [ AMBER badge ]\
Deliver execution risk is elevated due to workload imbalances.

Executive Summary\
The portfolio shows strong...

Top Risks\
[CRITICAL badge] Resource Allocation Crisis\
- Summary: 90% of work items unassigned...\
- Evidence:\
   - 80 of 89 items unassigned\
   - Only 3 items in progress

Recommended Actions\
[7d badge] Assign owners to high-priority items\
- Summary: Ownership gap delaying progress\
- Owner: Delivery leads

Concentration Signals\
- Workload concentrated in unassigned queue

Questions to Ask\
- Which bundles contain the largest...\
   Rationale: identify workload hotspots

* * * * *

13. Implementation Guidance for Codex
-------------------------------------

### Reuse first

Reuse existing list/card UI patterns in the app before introducing new styles.

### Keep it composable

Break UI into small components (Card, Badge, List, Row).

### Avoid premature interaction

12B.2 is about display; do *not* add click actions or routing in this phase.

### Make empty placeholders intentional

Empty states should feel like valid content, not errors.

* * * * *

14. Deliverable Summary
-----------------------

Phase 12B.2 delivers:

-   UI refinement for structured AI Insights

-   polished section rendering

-   clear badges and evidence presentation

-   better empty states

-   legacy narrative accessibility

-   no regressions in export or caching

This prepares the UI for subsequent analytical and interactive subphases.