Phase 13B Specification
=======================

Portfolio Forecasting & Predictive Delivery Signals
---------------------------------------------------

* * * * *

1. Purpose
==========

Phase **13B** introduces **forward-looking delivery intelligence** by generating **forecast signals** based on portfolio trends, workload ratios, milestone pressure, and execution stability.

While previous phases analyzed the **current and historical state**, this phase estimates **near-term outcomes** such as:

-   milestone slip probability

-   delivery throughput slowdown

-   backlog growth trajectory

-   execution instability signals

The forecasts remain **deterministic heuristic models**, not ML models.

* * * * *

2. Goals
========

### Functional Goals

1.  Implement a **Forecast Engine** generating predictive signals.

2.  Provide a **Forecast API**.

3.  Display forecast signals in the **Executive Insights page**.

4.  Enable **forecast-aware AI queries**.

### Non-Functional Goals

-   deterministic logic for explainability

-   reuse snapshot/trend infrastructure

-   minimal compute cost

-   avoid excessive AI provider usage

* * * * *

3. Forecast Signal Types
========================

Define the following forecast categories:

| Signal | Meaning |
| --- | --- |
| Milestone Slip Risk | milestone may miss expected delivery |
| Execution Slowdown | throughput trending downward |
| Backlog Growth | backlog expanding faster than completion |
| Ownership Risk | large amount of unassigned work |
| Review Bottleneck | review cycle delays increasing |

* * * * *

4. Forecast Signal Data Contract
================================

Add new type in `src/types/ai.ts`:

export interface ForecastSignal {\
  id: string;\
  title: string;\
  category:\
    | "milestone_risk"\
    | "execution_slowdown"\
    | "backlog_growth"\
    | "ownership_risk"\
    | "review_bottleneck";\
  severity: "low" | "medium" | "high";\
  confidence: number; // 0--1 scale\
  summary: string;\
  evidence: EvidenceItem[];\
  relatedEntities?: EntityReference[];\
}

* * * * *

5. Backend Forecast Engine
==========================

### File

src/services/ai/forecastEngine.ts

### Main Function

generateForecastSignals(snapshot, report, trends)

Inputs:

-   latest portfolio snapshot

-   structured portfolio report

-   trend signals

Output:

ForecastSignal[]

* * * * *

6. Forecast Heuristics
======================

### 6.1 Milestone Slip Risk

Conditions:

if milestone.overdueTasksRatio > 0.3\
AND milestone.remainingTasks > threshold

Severity mapping:

| Ratio | Severity |
| --- | --- |
| 0.2--0.3 | medium |

> 0.3 | high |

Evidence:

-   overdue tasks count

-   milestone task completion ratio

-   related bundles

* * * * *

### 6.2 Execution Slowdown

Conditions:

blockedWork increasing\
AND activeWorkRatio decreasing

Severity mapping:

| Blocked Growth | Severity |
| --- | --- |
| small | medium |
| large | high |

* * * * *

### 6.3 Backlog Growth

Conditions:

unassignedRatio rising\
AND activeWorkRatio stable

Meaning: backlog increasing without execution capacity.

* * * * *

### 6.4 Ownership Risk

Conditions:

unassignedRatio > 0.25

Severity:

| Ratio | Severity |
| --- | --- |

> 0.25 | medium |\
> 0.4 | high |

* * * * *

### 6.5 Review Bottleneck

Conditions:

openReviews rising\
AND overdueReviews > threshold

* * * * *

7. Forecast Confidence Calculation
==================================

Confidence score formula:

confidence =\
  trendStrength * 0.5\
  + dataCompleteness * 0.3\
  + signalConsistency * 0.2

Clamp between 0 and 1.

* * * * *

8. Forecast API
===============

Create endpoint:

GET /api/ai/portfolio-forecast

Behavior:

1.  Require authentication.

2.  Load latest structured portfolio report.

3.  Load trend signals.

4.  Generate forecast signals.

5.  Return structured result.

Response:

{\
  status: "success",\
  forecastSignals: ForecastSignal[]\
}

* * * * *

9. Forecast Caching
===================

Reuse `ai_analysis_cache`.

Cache key:

reportType = "portfolio-forecast"

Cache TTL:

24 hours

POST endpoint for regeneration:

POST /api/ai/portfolio-forecast

* * * * *

10. UI Integration
==================

Add **Forecast Panel** to Executive Insights page.

File:

src/components/ai/ForecastPanel.tsx

Props:

{\
  signals: ForecastSignal[]\
}

* * * * *

11. Forecast Panel Layout
=========================

Forecast Signals\
---------------------------

Milestone Risk\
- Payments API milestone may slip\
- Evidence\
- Confidence score

Execution Slowdown\
- Throughput trending downward

Backlog Growth\
- Unassigned work growing

Each signal card shows:

-   title

-   severity badge

-   confidence score

-   evidence list

-   related entity chips

* * * * *

12. UI Component
================

### ForecastSignalCard.tsx

Fields:

title\
severity badge\
confidence indicator\
summary\
evidence\
related entities

Color mapping:

| Severity | Color |
| --- | --- |
| low | neutral |
| medium | amber |
| high | red |

* * * * *

13. Strategic Suggestions
=========================

Update:

suggestionGenerator.ts

Add suggestions when forecast signals exist:

Examples:

Investigate milestone slip risk\
Review backlog growth causes\
Analyze execution slowdown

* * * * *

14. Query Engine Integration
============================

Extend `queryEngine.ts`.

Add new intents:

"What risks may impact delivery soon?"\
"Which milestones are likely to slip?"\
"Is execution slowing down?"\
"Which areas show growing backlog?"

Deterministic response uses forecast signals.

* * * * *

15. Acceptance Criteria
=======================

1.  Forecast engine generates signals deterministically.

2.  Signals include severity, confidence, and evidence.

3.  Forecast API returns expected results.

4.  Forecast signals appear on Executive Insights page.

5.  Query engine answers forecast-related questions.

6.  Forecast signals cached properly.

7.  Suggestions updated with forecast context.

8.  No regression in AI Insights or Phase 13A features.

9.  `npx tsc --noEmit` passes.

* * * * *

16. Files to Create
===================

Backend:

src/services/ai/forecastEngine.ts\
src/app/api/ai/portfolio-forecast/route.ts

Frontend:

src/components/ai/ForecastPanel.tsx\
src/components/ai/ForecastSignalCard.tsx

Updates:

src/services/ai/queryEngine.ts\
src/services/ai/suggestionGenerator.ts\
src/types/ai.ts

* * * * *

17. Example Forecast Output
===========================

{\
  "forecastSignals": [\
    {\
      "id": "milestone-risk-payments-api",\
      "title": "Payments API milestone may slip",\
      "category": "milestone_risk",\
      "severity": "high",\
      "confidence": 0.78,\
      "summary": "Overdue tasks and low completion ratio indicate risk of delay.",\
      "evidence": [\
        { "text": "7 tasks overdue in milestone" },\
        { "text": "Completion ratio only 42%" }\
      ],\
      "relatedEntities": [\
        { "type": "milestone", "id": "payments-api" }\
      ]\
    }\
  ]\
}

* * * * *

18. Deliverable Summary
=======================

Phase **13B introduces predictive portfolio intelligence** by adding:

-   deterministic forecast engine

-   milestone risk prediction

-   execution slowdown detection

-   backlog growth forecasting

-   forecast UI panel

-   forecast-aware AI queries

This enables DeliveryHub to move from **reactive monitoring → proactive delivery risk detection**.