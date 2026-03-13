Phase 12C.1 Specification
=========================

Evidence Exploration and Entity Drill-Down for AI Insights
----------------------------------------------------------

* * * * *

1. Purpose
----------

Phase **12C.1** makes AI Insights **operationally actionable** by connecting the structured elements of an AI report --- especially risks, actions, concentration signals, and query answers --- to the **actual underlying domain entities** in the DeliveryHub database. The goal is to let users explore, inspect, and act on insights, rather than only read text about them.

This phase targets the **content-to-entity mapping layer** and corresponding UI enhancements to display **related entity lists and drill-down navigation**.

* * * * *

2. Goals
--------

### Functional goals

1.  Represent evidence items with **typed, referential entity descriptors** (not plain text).

2.  Add entity lists under risks, actions, signals, and query answers that map to actual data records.

3.  Enable entities (work items, applications, bundles, milestones, reviews) to be **clickable links** that open existing DeliveryHub pages for those records.

4.  Ensure entity lists are **evidence-anchored**, meaning each evidence item references at least one entity.

5.  Preserve structured report contract and UI from 12B.

### Non-functional goals

-   Do not change existing navigation patterns radically

-   Do not require backend rewrite; augment existing APIs

-   Keep type safety and TypeScript validation

-   Maintain responsive presentation and accessibility

* * * * *

3. Scope
--------

### In scope

-   Enhance structured report and query results with **typed entity references**

-   Persist entity references in cache

-   Add new types to shared AI types

-   Modify normalization to split text evidence into entity references

-   UI entity lists / drill-down lists

-   Clickable links to work item, review, milestone, bundle, application pages

### Out of scope

-   Automated correction of data relationships

-   New entity editors

-   Analytics or charts

-   AI-driven entity fetches outside the portfolio context

* * * * *

4. Definitions
--------------

### Domain Entities

| Entity | Collection | UI Route |
| --- | --- | --- |
| Work item | `workitems` | `/workitems/[id]` |
| Application | `applications` | `/applications/[id]` |
| Bundle | `bundles` | `/bundles/[id]` |
| Milestone | `milestones` | `/milestones/[id]` |
| Review cycle | `reviewCycles` | `/reviews/[id]` |

*(Adjust UI routes to match your actual app routing.)*

* * * * *

5. Contract Enhancements
------------------------

### 5.1 Shared Types

Modify `src/types/ai.ts` to add entity reference shapes:

export type EntityType =\
  | "workitem"\
  | "application"\
  | "bundle"\
  | "milestone"\
  | "review";

export interface EntityReference {\
  type: EntityType;\
  id: string;\
  label: string;\
  secondary?: string; // optional subtitle or detail\
}

export interface EvidenceItem {\
  text: string; // original human-readable text\
  entities: EntityReference[]; // zero or more referenced entities\
  provenance?: "ai" | "deterministic" | "legacy";\
}

### 5.2 Structured Report Elements

Update structured report sections to use `EvidenceItem[]`:

export interface StructuredRiskItem {\
  id: string;\
  title: string;\
  severity: PortfolioRiskSeverity;\
  summary: string;\
  evidence: EvidenceItem[];\
  provenance: string;\
}

Apply analogous changes for:

-   `StructuredActionItem`

-   `StructuredConcentrationSignal`

-   `StructuredQuestionItem` (if evidence used here)

-   Query answer response (`answer`, `explanation`, `evidence` array)

* * * * *

6. Backend Enhancements
-----------------------

### 6.1 Normalization Layer

Enhance `normalizePortfolioReport.ts` to process evidence strings like:

> "80 out of 89 work items are unassigned"

into 1--2 `EntityReference` objects:

{\
  text: "80 out of 89 work items are unassigned",\
  entities: [\
    { type: "workitem", id: "status-unassigned", label: "Unassigned Work Items" }\
  ],\
}

Rules:

1.  If evidence text mentions a specific entity ID (e.g., `wi-12345`), link exact ID.

2.  If evidence refers to a group (e.g., "work items unassigned"), generate a group entity reference with:

    -   type: `workitem`

    -   id: `unassigned`

    -   label: `Unassigned Work Items`

    -   secondary: count and filters (optional)

3.  For applications or bundles in evidence text, link to exact IDs or group references similarly.

4.  If the evidence string mentions a milestone, map to a named group or single entity.

5.  Review cycles: map to review IDs or a group reference.

*Note:* This is a best-effort mapping and may require regex rules or heuristics to detect mentions. When ambiguity exists, prioritize exact ID matches.

### 6.2 Deterministic Signal Entities

In cases where deterministic fallback synthesizes evidence items, it should include entity references wherever possible.

Example:

{\
  text: "5 unassigned work items are overdue",\
  entities: [\
    { type: "workitem", id: "unassigned", label: "Unassigned Work Items" },\
    { type: "workitem", id: "overdue", label: "Overdue Work Items" }\
  ]\
}

### 6.3 Query Engine Enhancements

Modify the query engine (`queryEngine.ts`) to return `evidence: EvidenceItem[]` where each evidence also includes entities.

Example:

{\
  answer: "5 work items are overdue",\
  evidence: [\
    {\
      text: "Overdue work item: Payment API blocking",\
      entities: [\
        { type: "workitem", id: "wi-98765", label: "Payment API blocking" }\
      ]\
    }\
  ],\
  followUps: [...]\
}

* * * * *

7. API Changes
--------------

### 7.1 Report API (`/api/ai/portfolio-summary`)

Structured report already includes evidence arrays. Update normalization and persistence so that:

-   each `evidence` array is persisted with entity references

-   responses use the updated evidence shape

### 7.2 Query API (`/api/ai/portfolio-query`)

Extend response to include richer evidence:

{\
  answer: string;\
  explanation: string;\
  evidence: EvidenceItem[];\
  followUps: string[];\
}

Persist and normalize entity references within this API as well.

* * * * *

8. UI Enhancements
------------------

### 8.1 Evidence Rendering

Replace plain text evidence list with an **EntityEvidenceList** that renders:

-   entity label as a link/button

-   optional secondary description

-   fallback to plain text if no entities

Example (pseudo-JSX):

{evidence.map(item => (\
  <div key={item.text}>\
    {item.entities.length > 0 ? (\
      <ul>\
        {item.entities.map(entity => (\
          <li key={entity.id}>\
            <Link to={`/${entity.type}/${entity.id}`}>\
              {entity.label}\
            </Link>\
            {entity.secondary && <span> --- {entity.secondary}</span>}\
          </li>\
        ))}\
      </ul>\
    ) : (\
      <p>{item.text}</p>\
    )}\
  </div>\
))}

Compatible with existing `SectionCard` layout.

* * * * *

### 8.2 Drill-down Lists

Under sections that have evidence with entity references (e.g., `Top Risks`, `Recommended Actions`, `Concentration Signals`, and query answers), display a **Related Entities** subsection.

Example pattern:

Related Entities\
- Work Items\
  -- Payment API block (clickable)\
  -- Feature backlog item (clickable)\
- Applications\
  -- MemberPortal

Prefer grouping by entity type.

* * * * *

### 8.3 Navigation

Clicking a related entity should:

-   navigate to its existing page (e.g., `/workitems/:id`)

-   preserve app routing and layout

-   not trigger AI regeneration

* * * * *

### 8.4 Legacy Narrative

If a legacy narrative contains text referencing entities, retain plain text but do not attempt entity parsing here; this is only for structured sections.

* * * * *

9. Fallback UI Behavior
-----------------------

If an evidence item has **no entity references**, render it as plain text within that section's evidence list.

If a query answer has **no entities**, still render answer and explanation normally.

* * * * *

10. Performance Considerations
------------------------------

-   Entity extraction should be cached along with the report to avoid repeated normalization.

-   UI lists should paginate or limit lists if entity counts exceed reasonable UI size (e.g., > 20).

* * * * *

11. Acceptance Criteria
-----------------------

1.  All evidence lists under structured sections show **entity links or grouped entity references** if available.

2.  Drilling down into an entity opens the correct existing DeliveryHub page.

3.  Evidence items without entity references still render as text.

4.  Query answer evidence lists show clickable entities where applicable.

5.  No regressions in existing features:

    -   caching/freshness

    -   export

    -   manual regenerate

    -   legacy narrative

6.  TypeScript validates without errors (`npx tsc --noEmit`).

* * * * *

12. Files to Create or Modify
-----------------------------

### Services / Types

src/types/ai.ts\
src/services/ai/normalizePortfolioReport.ts\
src/services/ai/queryEngine.ts\
src/services/ai/suggestionGenerator.ts

### API Routes

src/app/api/ai/portfolio-summary/route.ts\
src/app/api/ai/portfolio-query/route.ts

### Components / UI

src/components/ui/EntityEvidenceList.tsx\
src/components/AIInsightsEnhancements.tsx (optional helper)\
src/components/AIInsights.tsx (updated evidence rendering)

* * * * *

13. Implementation Notes
------------------------

-   **Entity Reference Labels:** Prefer human-friendly labels ("Payment API blocking task") over raw IDs.

-   **Legacy Handling:** Keep legacy normalization flags and preserve narrative without removing content.

-   **Deterministic Signals:** Use signal ratios to generate entity references for groups (e.g., "overdue work items").

-   **Query Enhancements:** Make query answers evidence-rich with entity references wherever possible.

* * * * *

14. Example Output (Structured Section with Entities)
-----------------------------------------------------

{\
  "topRisks": [\
    {\
      "id": "risk-unassigned",\
      "title": "High Unassigned Workload",\
      "severity": "critical",\
      "summary": "A large proportion of work remains unassigned.",\
      "evidence": [\
        {\
          "text": "80 out of 89 work items are unassigned",\
          "entities": [\
            {\
              "type": "workitem",\
              "id": "unassigned",\
              "label": "Unassigned Work Items",\
              "secondary": "80 of 89"\
            }\
          ],\
          "provenance": "deterministic"\
        }\
      ],\
      "provenance": "deterministic"\
    }\
  ]\
}

* * * * *

15. Deliverable Summary
-----------------------

Phase 12C.1 delivers:

-   entity-typed evidence linking insights to actual data

-   UI drill-down lists for risks, actions, signals, and query answers

-   clickable links and navigable evidence

-   graceful fallback when entities are absent

This enables users to move from *insight reading* to *action and exploration*, completing the transition from report to interactive intelligence.