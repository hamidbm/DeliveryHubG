Phase 12B.3 Specification
=========================

Evidence-Backed Intelligence and Deterministic Fallback Enrichment
------------------------------------------------------------------

* * * * *

1. Purpose
----------

Phase **12B.3** improves the *quality, trustworthiness, and explainability* of structured AI Insights by ensuring that each report section is:

-   grounded in **deterministic portfolio signals**

-   backed by explicit **evidence items**

-   robust against malformed or weak AI output

-   supported by stronger **fallback report generation**

This phase targets the *content layer*, not new UI interaction or query features.

* * * * *

2. Motivation
-------------

After 12B.2, the UI is visually polished, but:

-   some AI-generated risks are generic

-   recommended actions may be weak or missing

-   concentration signals are underused

-   fallback behavior may be too sparse

12B.3 ensures that sections are **data-anchored** and **explainable**, increasing trust for end users.

* * * * *

3. Goals
--------

### Functional Goals

1.  Enforce that every **Top Risk** includes:

    -   a risk title

    -   a severity

    -   a concise summary

    -   an explicit list of evidence strings with deterministic grounding

2.  Enforce that every **Recommended Action** includes:

    -   a title

    -   urgency

    -   a summary

    -   a traceable relation to specific risk or signal evidence

3.  Enforce that every **Concentration Signal**:

    -   has a title and summary

    -   includes evidence context

4.  Improve **Questions to Ask** to be:

    -   relevant to actual gaps in snapshot

    -   actionable and specific

5.  Provide strong **deterministic fallback logic** when AI output is incomplete, malformed, or too generic.

6.  Add **provenance metadata** indicating whether a section is:

    -   native structured AI output

    -   inferred from older markdown

    -   synthesized deterministically

### Non-Functional Goals

-   Preserve structured report contract from 12B.1

-   Do not change UI structure/design from 12B.2

-   Maintain caching/freshness/legacy behavior

-   Keep TypeScript validation clean

* * * * *

4. Report Section Anchor Rules
------------------------------

### 4.1 Deterministic Signal Layer

Before calling the AI provider, derive and expose a set of **core deterministic signals**:

#### Required Deterministic Signals

| Signal | Explanation |
| --- | --- |
| totalApps | Total applications |
| criticalApps | Apps with critical health |
| unassignedWorkItems | Count of unassigned work items |
| overdueWorkItems | Count of overdue tasks |
| blockedWorkItems | Count of blocked tasks |
| inProgressWorkItems | Count of items with `IN_PROGRESS` status |
| reviewsOpen | Count of open review cycles |
| milestonesOverdue | Count of overdue milestones |

#### Derived Ratios/Percentages

-   unassignedRatio = `unassignedWorkItems / totalWorkItems`

-   blockedRatio = `blockedWorkItems / totalWorkItems`

-   overdueRatio = `overdueWorkItems / totalWorkItems`

-   activeWorkRatio = `inProgressWorkItems / totalWorkItems`

These signals will be used in evidence and fallback logic.

* * * * *

5. Section Quality Enforcement
------------------------------

### 5.1 Top Risks

#### Output Contract

Each risk item must include:

{\
  id: string\
  title: string\
  severity: "critical" | "high" | "medium" | "low"\
  summary: string\
  evidence: string[]\
  provenance: "ai" | "deterministic" | "legacy"\
}

#### Evidence Requirements

-   Each risk item must include at least **2 evidence strings**.

-   Evidence must reflect observable portfolio patterns or quantifiable signals.

-   Example evidence:

    -   `"80 out of 89 work items are unassigned"`

    -   `"Only 3 work items (11%) are in progress"`

    -   `"3 work items currently blocked"`

#### Severity Normalization

Severity must be consistently mapped using these rules:

| Condition | Severity |
| --- | --- |
| unassignedRatio ≥ 0.75 | critical |
| overdueRatio ≥ 0.15 | high |
| blockedRatio ≥ 0.10 | medium |
| none of above | low |

(Wrap these thresholds as deterministic fallback logic if AI severity differs.)

* * * * *

### 5.2 Recommended Actions

Each action must include:

{\
  id: string\
  title: string\
  urgency: "now" | "7d" | "30d" | "later"\
  summary: string\
  ownerHint?: string\
  evidence: string[]\
  provenance: "ai" | "deterministic" | "legacy"\
}

#### Evidence Requirements

-   Must reference specific risk evidence where possible:

    -   e.g., `evidence: ["80 unassigned tasks suggest assignment prioritization"]`

#### Urgency Mapping

Recommended urgency defaults:

| Severity | Default Urgency |
| --- | --- |
| critical | now |
| high | 7d |
| medium | 30d |
| low | later |

If AI suggests a different urgency, backend may enforce this mapping unless overridden by strong evidence.

* * * * *

### 5.3 Concentration Signals

Each item:

{\
  id: string\
  title: string\
  summary: string\
  evidence: string[]\
  provenance: "ai" | "deterministic" | "legacy"\
}

Examples:

-   `"Workload heavily concentrated in unassigned work items"`

-   `"Blocked work suggests systemic impediments"`

Evidence requirements similar to risks.

* * * * *

### 5.4 Questions to Ask

Each question:

{\
  id: string\
  question: string\
  rationale: string\
  provenance: "ai" | "deterministic" | "legacy"\
}

Questions should be specific and tie back to signals or gaps in data.

* * * * *

6. Fallback Policy
------------------

If AI output is incomplete or malformed, the system should apply **deterministic fallback rules** before showing weak or generic content.

### 6.1 Fallback for Top Risks

If fewer than 1 risk items from AI:

-   Generate risks deterministically using:

    -   unassignedRatio ≥ threshold

    -   overdueRatio ≥ threshold

    -   blockedRatio ≥ threshold

Examples:

{\
  id: "risk-unassigned",\
  title: "High Unassigned Workload",\
  severity: "critical",\
  summary: "A large majority of work items are currently unassigned.",\
  evidence: [\
    `${unassignedWorkItems} out of ${totalWorkItems} work items are unassigned`,\
    `Unassigned ratio of ${(unassignedRatio*100).toFixed(1)}%`\
  ],\
  provenance: "deterministic"\
}

* * * * *

### 6.2 Fallback for Recommended Actions

If no actions from AI:

-   For each deterministic risk, synthesize an action such as:

{\
  id: "act-assign-unassigned",\
  title: "Assign owners to unassigned work",\
  urgency: "7d",\
  summary: "Reduce unassigned workload by assigning work items to appropriate delivery leads.",\
  ownerHint: "Delivery Leads",\
  evidence: [\
    `High unassigned workload (${unassignedRatio*100}%)`\
  ],\
  provenance: "deterministic"\
}

* * * * *

### 6.3 Fallback for Concentration Signals

If AI returns none:

-   Synthesize basic patterns:

{\
  id: "signal-workload-concentration",\
  title: "Workload Concentration in Unassigned Queue",\
  summary: "Most of the work capacity is unassigned, indicating execution risk.",\
  evidence: [\
    `Unassigned work items: ${unassignedWorkItems}/${totalWorkItems}`\
  ],\
  provenance: "deterministic"\
}

* * * * *

### 6.4 Fallback for Questions to Ask

If none provided:

-   Generate questions using deterministic logic:

Examples:

-   "Which bundles contain the largest share of unassigned work?"

-   "Which blocked work items threaten near-term milestones?"

-   "Which applications have no active stories but are near target dates?"

Evidence/rationale should reference snapshot signals.

* * * * *

7. Normalization Requirements
-----------------------------

### 7.1 AI JSON Enforcement

After receiving structured AI output:

-   Validate keys

-   Enforce severity/urgency enums

-   Trim arrays to max length (e.g., 5 risks, 5 actions)

-   Ensure each item has explicit evidence

-   Assign stable IDs if missing

Invalid sections fallback to deterministic or synthesized content.

### 7.2 Field Fallback Priorities

For any field:

AI structured value > deterministic fallback > legacy extraction > empty placeholder

* * * * *

8. Provenance Metadata
----------------------

Add `provenance` field to each item:

-   `"ai"` --- item driven primarily by AI output

-   `"deterministic"` --- synthesised by rules

-   `"legacy"` --- extracted from older markdown report

This metadata is for internal/telemetry use and optional display (not required to blur UI).

* * * * *

9. Backend Implementation Files
-------------------------------

### Primary areas to modify

src/services/ai/normalizePortfolioReport.ts\
src/services/ai/portfolioSignals.ts\
src/services/ai/formatPortfolioReportAsMarkdown.ts\
src/app/api/ai/portfolio-summary/route.ts

* * * * *

10. UI Considerations (no new UX)
---------------------------------

Codex **should not change UI structure for this phase**.\
UI component files remain:

src/components/AIInsights.tsx\
src/components/ui/SeverityBadge.tsx\
src/components/ui/UrgencyBadge.tsx\
src/components/ui/EvidenceList.tsx

UI will now render based on the enriched structured report.

* * * * *

11. Logging & Telemetry
-----------------------

Add optional section metadata flags:

normalizationFallbackUsed: boolean\
sectionsSynthesized: {\
  risks: boolean\
  actions: boolean\
  signals: boolean\
  questions: boolean\
}

Log when a section uses deterministic fallback.

This does not require UI display.

* * * * *

12. Acceptance Criteria
-----------------------

1.  All structured risks include:

    -   title

    -   severity

    -   summary

    -   evidence array

    -   provenance

2.  All actions include:

    -   urgency

    -   title

    -   summary

    -   evidence

    -   provenance

3.  Concentration signals include:

    -   title

    -   summary

    -   evidence

    -   provenance

4.  Questions to ask include:

    -   question

    -   rationale

    -   provenance

5.  Deterministic fallback produces high-quality content when AI output is thin.

6.  UI renders evidence items clearly under each structured section.

7.  Legacy narrative remains accessible if available.

8.  No regressions in caching, freshness, export, or manual regenerate.

9.  TypeScript compiles cleanly.

* * * * *

13. Example Structured Report (Post-12B.3)
------------------------------------------

{\
  "overallHealth": "amber",\
  "executiveSummary": "The portfolio shows strong technical health but execution risks remain due to unassigned work.",\
  "topRisks": [\
    {\
      "id": "risk-unassigned",\
      "title": "High unassigned workload",\
      "severity": "critical",\
      "summary": "A large majority of work items are currently unassigned, increasing execution risk.",\
      "evidence": [\
        "80 out of 89 work items are unassigned",\
        "Unassigned ratio = 90%"\
      ],\
      "provenance": "deterministic"\
    }\
  ],\
  "recommendedActions": [\
    {\
      "id": "act-assign-unassigned",\
      "title": "Assign owners to high-priority unassigned work",\
      "urgency": "7d",\
      "summary": "Reduce execution risk by assigning ownership.",\
      "ownerHint": "Delivery leads",\
      "evidence": ["High unassigned workload"],\
      "provenance": "deterministic"\
    }\
  ],\
  "concentrationSignals": [\
    {\
      "id": "signal-workload-concentration",\
      "title": "Workload concentrated in unassigned queue",\
      "summary": "Execution capacity is concentrated in too few active items.",\
      "evidence": ["Unassigned ratio = 90%"],\
      "provenance": "deterministic"\
    }\
  ],\
  "questionsToAsk": [\
    {\
      "id": "q-which-bundles-unassigned",\
      "question": "Which bundles contain the largest share of unassigned work?",\
      "rationale": "To identify which areas of the portfolio require immediate assignment action.",\
      "provenance": "deterministic"\
    }\
  ],\
  "markdownReport": "..."\
}

* * * * *

14. Deliverable Summary
-----------------------

Phase 12B.3 delivers:

-   evidence-anchored structured sections

-   deterministic fallback generation

-   severity/urgency normalization

-   provenance metadata

-   stronger trust and explainability

This sets up later phases for actionable quick suggestions and natural-language portfolio query experiences.