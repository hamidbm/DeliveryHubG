Below is a **complete, structured Phase 12B program specification** written for Codex. It defines the entire **12B series**(12B.1 → 12B.5) so the roadmap is clear and each subphase has defined responsibilities.

This document can be stored as something like:

docs/implementation/phase-12B-ai-insights.md

* * * * *

Phase 12B Specification
=======================

DeliveryHub AI Insights -- Structured Intelligence Expansion
-----------------------------------------------------------

* * * * *

1. Overview
===========

Phase **12B** transforms AI Insights from a generated narrative report into a **structured delivery intelligence system** that supports:

-   evidence-backed portfolio analysis

-   deterministic + AI hybrid reasoning

-   contextual quick suggestions

-   guided investigation prompts

-   natural language portfolio querying

The goal is to evolve AI Insights into a **decision-support console** for delivery management.

* * * * *

2. Phase 12B Objectives
=======================

The 12B program will:

1.  Replace narrative-only analysis with **structured intelligence objects**.

2.  Ensure insights are **evidence-backed and deterministic-aware**.

3.  Provide **context-aware next steps** via quick suggestions.

4.  Introduce **interactive AI querying** of the portfolio.

5.  Preserve reliability, explainability, and caching introduced in Phase 12A.

* * * * *

3. Subphase Breakdown
=====================

Phase 12B consists of the following subphases:

| Phase | Name | Purpose |
| --- | --- | --- |
| 12B.1 | Structured Intelligence Report Contract | Convert AI output to structured report schema |
| 12B.2 | Structured AI Insights UI Refinement | Render structured sections cleanly |
| 12B.3 | Evidence-backed Intelligence | Strengthen deterministic grounding and fallback |
| 12B.4 | Data-driven Quick Suggestions | Generate contextual investigation prompts |
| 12B.5 | Ask DeliveryHub AI Query System | Enable natural-language portfolio querying |

* * * * *

4. Phase 12B.1
==============

Structured Intelligence Report Contract
---------------------------------------

### Purpose

Move from markdown-based AI summaries to a **typed report contract**.

### Backend Responsibilities

Define a structured report schema:

StructuredPortfolioReport

Required sections:

-   overallHealth

-   executiveSummary

-   topRisks

-   recommendedActions

-   concentrationSignals

-   questionsToAsk

-   markdownReport (export compatibility)

### Deterministic Signal Layer

Create deterministic signals derived from snapshot:

portfolioSignals.ts

Signals include:

-   total applications

-   critical apps

-   total work items

-   unassigned work

-   overdue work

-   blocked work

-   active work ratio

-   open reviews

-   overdue milestones

These signals support AI reasoning and fallback logic.

### Normalization Pipeline

AI responses must be normalized using:

normalizePortfolioReport.ts

Responsibilities:

-   validate schema

-   enforce enum values

-   generate stable IDs

-   synthesize missing sections

-   fallback to deterministic logic if needed

### Persistence

Structured report stored in:

ai_analysis_cache

Schema:

reportType\
status\
metadata\
snapshot\
report\
updatedAt

* * * * *

5. Phase 12B.2
==============

Structured AI Insights UI Refinement
------------------------------------

### Purpose

Render structured intelligence sections as polished UI components.

### Sections Rendered

1.  Overall Health

2.  Executive Summary

3.  Top Risks

4.  Recommended Actions

5.  Concentration Signals

6.  Questions to Ask

7.  Full Narrative Report

### UI Enhancements

Add reusable components:

SectionCard\
HealthBadge\
SeverityBadge\
UrgencyBadge\
EvidenceList

### Presentation Rules

-   risks sorted by severity

-   urgency badges on actions

-   evidence displayed clearly

-   friendly empty states

-   collapsible narrative report

### Non-goals

-   no navigation actions

-   no query execution

-   no charts

* * * * *

6. Phase 12B.3
==============

Evidence-backed Intelligence
----------------------------

### Purpose

Strengthen report quality using deterministic signals.

### Key Improvements

1.  Risks must include **minimum two evidence strings**.

2.  Severity normalized using deterministic thresholds.

3.  Actions must reference risk evidence.

4.  Concentration signals must include evidence.

5.  Questions must include rationale.

### Deterministic Thresholds

Example:

| Condition | Severity |
| --- | --- |
| unassignedRatio ≥ 0.75 | critical |
| overdueRatio ≥ 0.15 | high |
| blockedRatio ≥ 0.10 | medium |

### Fallback Generation

If AI output is weak:

-   synthesize risks

-   synthesize actions

-   synthesize signals

-   synthesize questions

### Provenance Tracking

Each structured item includes:

provenance: "ai" | "deterministic" | "legacy"

### Telemetry

Add logs:

sectionsSynthesized\
normalizationFallbackUsed

* * * * *

7. Phase 12B.4
==============

Data-driven Quick Suggestions
-----------------------------

### Purpose

Replace static suggestion prompts with **context-aware suggestions**.

### Input Sources

Suggestions generated from:

-   topRisks

-   recommendedActions

-   concentrationSignals

-   questionsToAsk

-   deterministic signals

### Suggestion Object

Define suggestion schema:

interface PortfolioSuggestion {\
  id: string\
  label: string\
  prompt: string\
  category: "risk" | "delivery" | "capacity" | "review"\
  provenance: "deterministic" | "ai"\
}

### Example Suggestions

If unassigned workload high:

Which bundles contain the most unassigned work?\
Which milestones are affected by unassigned tasks?

If blocked work high:

Which blocked work items threaten milestones?\
Which teams own the blocked tasks?

If reviews overdue:

Which review cycles are overdue?\
Which applications have pending reviews?

### Behavior

Suggestions appear in Quick Suggestions panel.

Each suggestion:

-   structured prompt

-   one-click ready for query execution (future phase)

### UI Rules

-   suggestions appear as clickable chips/cards

-   limited to ~6 suggestions

-   responsive layout

* * * * *

8. Phase 12B.5
==============

Ask DeliveryHub AI Query System
-------------------------------

### Purpose

Enable users to query the portfolio using natural language.

### Example Queries

Users can ask:

-   Which bundles contain the most unassigned work?

-   Which milestones are at highest risk?

-   Which applications have overdue reviews?

-   What is blocking delivery progress?

### Query API

New endpoint:

POST /api/ai/portfolio-query

Request:

{\
  question: string\
}

Response:

{\
  answer: string\
  explanation: string\
  evidence: EvidenceItem[]\
  followUps: string[]\
}

### Answer Strategy

Prefer deterministic-first answers:

-   counts

-   lists

-   rankings

Use AI only for:

-   interpretation

-   narrative

-   follow-up question generation

### Query Context

Inputs include:

-   portfolio snapshot

-   deterministic signals

-   structured report

-   user question

### Follow-up Questions

Each answer returns:

followUps: string[]

These populate Quick Suggestions dynamically.

* * * * *

9. Architectural Principles
===========================

### Deterministic-first

Always prefer deterministic computation over LLM inference.

### Explainability

Every insight must reference evidence.

### Reliability

AI failures should degrade gracefully.

### Cost Control

Use caching and avoid unnecessary provider calls.

### Traceability

Track provenance of generated content.

* * * * *

10. Files Introduced or Modified
================================

### Services

src/services/ai/portfolioSignals.ts\
src/services/ai/normalizePortfolioReport.ts\
src/services/ai/formatPortfolioReportAsMarkdown.ts\
src/services/ai/suggestionGenerator.ts\
src/services/ai/queryEngine.ts

### API Routes

src/app/api/ai/portfolio-summary/route.ts\
src/app/api/ai/portfolio-query/route.ts

### Components

src/components/AIInsights.tsx\
src/components/ui/SectionCard.tsx\
src/components/ui/HealthBadge.tsx\
src/components/ui/SeverityBadge.tsx\
src/components/ui/UrgencyBadge.tsx\
src/components/ui/EvidenceList.tsx\
src/components/ui/SuggestionChip.tsx

* * * * *

11. Acceptance Criteria
=======================

### Structured Report

-   report includes all required sections

-   deterministic fallback works when AI output weak

### Evidence

-   risks, actions, and signals include evidence

-   provenance tracked

### Quick Suggestions

-   suggestions generated dynamically

-   suggestions reflect report signals

### Query System

-   user can submit questions

-   answers include explanation and evidence

-   follow-up suggestions generated

### Stability

-   no regression in caching

-   exports still work

-   legacy report compatibility preserved

-   TypeScript builds clean

* * * * *

12. Deliverable Outcome
=======================

After Phase 12B completes, AI Insights will function as a **delivery intelligence assistant** capable of:

-   structured portfolio analysis

-   evidence-backed risk identification

-   contextual recommendations

-   guided investigation prompts

-   interactive natural language querying

This transforms AI Insights from a reporting feature into a **decision-support system for delivery management**.