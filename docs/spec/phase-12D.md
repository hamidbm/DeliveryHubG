Phase 12D Specification
=======================

Portfolio Trend Analysis and Temporal Intelligence
--------------------------------------------------

* * * * *

1. Purpose
==========

Phase **12D** adds **time-aware intelligence** to DeliveryHub AI Insights.

Up to Phase 12C, all insights are based on a **single snapshot of the portfolio**. Phase 12D introduces **historical snapshots and trend analysis**, allowing the system to detect:

-   delivery health trends

-   risk trajectories

-   workload changes

-   milestone exposure evolution

-   improvement or deterioration patterns

This phase enables DeliveryHub to answer questions such as:

-   Are delivery risks improving or worsening?

-   Is unassigned work increasing over time?

-   Are blocked tasks trending upward?

-   Which bundles are deteriorating?

-   Which teams are improving execution?

* * * * *

2. Objectives
=============

Phase 12D introduces:

1.  **Portfolio snapshot history**

2.  **Trend computation engine**

3.  **Trend-aware AI insights**

4.  **Trend queries in Ask DeliveryHub AI**

5.  **Optional early-warning signals**

* * * * *

3. Scope
========

In Scope
--------

-   periodic snapshot persistence

-   trend computation utilities

-   trend analysis in AI Insights

-   trend-aware query responses

-   trend-aware suggestions

-   trend signals in portfolio report

Out of Scope
------------

-   external analytics pipelines

-   BI dashboards

-   machine learning forecasting

-   predictive modeling beyond simple trends

-   notifications (optional in later phase)

* * * * *

4. High-Level Architecture
==========================

Phase 12D introduces a **temporal layer** between portfolio snapshots and AI Insights.

Portfolio Data\
      │\
Snapshot Builder\
      │\
Snapshot Store (Historical)\
      │\
Trend Analyzer\
      │\
AI Insights + Query Engine

Components introduced:

| Component | Purpose |
| --- | --- |
| Snapshot Store | persist historical portfolio snapshots |
| Trend Analyzer | compute deltas across time |
| Trend Signals | structured trend metrics |
| Trend Query Support | enable trend-based questions |

* * * * *

5. Snapshot History
===================

### New Collection

portfolio_snapshots

### Snapshot Schema

interface PortfolioSnapshotHistory {\
  id: string\
  createdAt: string\
  totalApplications: number\
  criticalApplications: number\
  totalWorkItems: number\
  unassignedWorkItems: number\
  blockedWorkItems: number\
  overdueWorkItems: number\
  activeWorkItems: number\
  openReviews: number\
  overdueMilestones: number\
}

### Snapshot Frequency

Snapshots are persisted:

-   whenever AI report generation occurs

-   optionally on scheduled intervals (future)

* * * * *

6. Snapshot Persistence Logic
=============================

Update `portfolioSnapshot.ts`.

After generating a snapshot for AI Insights:

persistSnapshot(snapshot)

Snapshots should store:

-   timestamp

-   summary metrics

-   optional entity references

To avoid database growth:

-   store **only summary signals**

-   limit to **last 90 days**

Retention logic:

delete snapshots older than 90 days

* * * * *

7. Trend Analyzer Service
=========================

Create new service:

src/services/ai/trendAnalyzer.ts

### Responsibilities

-   compute metric changes

-   compute rate of change

-   detect improving/worsening trends

-   generate structured trend signals

* * * * *

8. Trend Metrics
================

Compute trends across last **N snapshots** (default: last 7 snapshots).

Metrics:

| Metric | Trend |
| --- | --- |
| unassignedWorkItems | rising / stable / falling |
| blockedWorkItems | rising / stable / falling |
| overdueWorkItems | rising / stable / falling |
| activeWorkItems | rising / stable / falling |
| criticalApplications | rising / stable / falling |
| overdueMilestones | rising / stable / falling |

* * * * *

9. Trend Signal Object
======================

Trend analyzer produces:

interface PortfolioTrendSignal {\
  metric: string\
  direction: "rising" | "falling" | "stable"\
  delta: number\
  timeframeDays: number\
}

Example:

{\
  "metric": "unassignedWorkItems",\
  "direction": "rising",\
  "delta": 14,\
  "timeframeDays": 7\
}

* * * * *

10. Trend Signals in AI Insights
================================

Extend structured report with new section:

trendSignals: TrendSignal[]

Example signals:

Unassigned workload increased by 14 items over the last 7 days.\
Blocked tasks decreased by 5 items since last report.\
Milestone risk remained stable.

These signals appear below **Concentration Signals**.

* * * * *

11. Trend Analysis in Query Engine
==================================

Extend `queryEngine.ts`.

Support new query patterns:

### Example questions

Is delivery improving?\
Is risk increasing?\
Are blocked tasks increasing?\
Is the backlog growing?\
Are milestones getting healthier?

### Deterministic logic

Use:

current snapshot\
previous snapshot\
trend signals

Example answer:

Blocked tasks have decreased by 5 over the last 7 days,\
suggesting delivery execution is improving.

Evidence includes trend metrics.

* * * * *

12. Knowledge Extractor Extensions
==================================

Extend:

knowledgeExtractors.ts

Add functions:

extractTrendMetrics()\
extractRiskTrend()\
extractWorkloadTrend()\
extractMilestoneTrend()

These use snapshot history to compute metrics.

* * * * *

13. Trend-Aware Suggestions
===========================

Extend `suggestionGenerator.ts`.

If trends detected:

Example suggestions:

Why is unassigned work increasing?\
Which bundles caused the rise in blocked tasks?\
Which milestones are newly at risk?\
Which teams reduced overdue tasks?

These appear in **Quick Suggestions**.

* * * * *

14. UI Enhancements
===================

Update:

AIInsights.tsx

Add new section:

Portfolio Trends

Display signals as cards:

Example:

Portfolio Trends\
---------------------

Unassigned Workload ↑\
+14 items over last 7 days

Blocked Tasks ↓\
-5 items since previous snapshot

Milestone Risk → Stable

Use icons/arrows:

-   rising ↑

-   falling ↓

-   stable →

* * * * *

15. Query Result Trend Integration
==================================

If a query relates to a trend:

Example:

Is risk increasing?

Return:

Yes --- unassigned work has increased by 14 items in the past week.

Include evidence referencing snapshot history.

* * * * *

16. Performance Considerations
==============================

Trend analysis should:

-   use only snapshot history

-   avoid heavy queries

-   compute in memory after snapshot retrieval

Limit snapshots loaded to **last 14 entries**.

* * * * *

17. Acceptance Criteria
=======================

1.  Portfolio snapshots persist after report generation.

2.  Snapshot history stored for last 90 days.

3.  Trend analyzer computes correct trend metrics.

4.  Trend signals appear in AI Insights report.

5.  Trend queries return meaningful answers.

6.  Quick suggestions incorporate trend signals.

7.  No regression in existing AI Insights features.

8.  TypeScript compilation passes.

* * * * *

18. Files to Create or Modify
=============================

### Backend

src/services/ai/trendAnalyzer.ts\
src/services/ai/knowledgeExtractors.ts\
src/services/ai/suggestionGenerator.ts\
src/services/ai/queryEngine.ts

### Snapshot Layer

src/services/ai/portfolioSnapshot.ts

### API

src/app/api/ai/portfolio-summary/route.ts\
src/app/api/ai/portfolio-query/route.ts

### Frontend

src/components/AIInsights.tsx\
src/components/ui/TrendSignalCard.tsx

* * * * *

19. Deliverable Outcome
=======================

After Phase **12D**, DeliveryHub AI Insights gains **temporal intelligence**.

The system can now:

-   track portfolio evolution

-   detect emerging delivery risks

-   highlight improving or deteriorating execution

-   answer trend-based questions

-   suggest investigations based on change patterns

This moves AI Insights from **snapshot analysis → continuous portfolio intelligence**.

* * * * *

20. Future Extensions (12E)
===========================

After trend analysis, the natural next phases are:

| Phase | Feature |
| --- | --- |
| 12E.1 | Early warning alerts |
| 12E.2 | Portfolio health scoring |
| 12E.3 | Predictive milestone risk |
| 12E.4 | Cross-project risk propagation |

These build on the snapshot + trend infrastructure introduced in 12D.

* * * * *