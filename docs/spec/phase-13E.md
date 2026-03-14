Phase 13E Specification
=======================

AI-Driven Optimization & What-If Scenario Planning
--------------------------------------------------

* * * * *

1. Purpose
----------

Phase **13E** enables DeliveryHub users to explore **"what-if" scenarios** --- simulated alternate portfolio states based on hypothetical changes such as:

-   reassigning resources

-   delaying start dates

-   adjusting work priorities

-   changing milestone targets

-   altering team compositions

It also surfaces **optimization recommendations** based on these simulations, providing actionable strategic guidance.

This phase moves DeliveryHub from descriptive and predictive insights to **interactive, decision-support modeling**.

* * * * *

2. Goals
--------

### Functional Goals

1.  Implement a deterministic **Scenario Simulation Engine**.

2.  Provide an **API for what-if scenarios**.

3.  Generate **optimization recommendations** based on scenario outcomes.

4.  Integrate scenario planning into the **Strategic AI Advisor**.

5.  Extend strategic UI with scenario creation and comparison panels.

### Non-Functional Goals

-   Simulations remain explainable and grounded in actual portfolio data.

-   Avoid reliance on opaque AI predictions --- use LLM only for narrative summarization when appropriate.

-   Maintain performance and responsiveness.

-   Integrate into existing caching and analysis infrastructure.

* * * * *

3. Key Concepts
---------------

### Scenario

A representation of a hypothetical change applied to the portfolio snapshot, e.g.:

{\
  "description": "Reassign 3 engineers from Bundle A to Bundle B",\
  "changes": [\
    { "type": "workitems.reassign", "workItemIds": [...], "toOwner": "Team B" },\
    { "type": "milestone.adjustDate", "milestoneId": "...", "newDate": "2026-05-01" }\
  ]\
}

### Simulation Result

The output of running a scenario through forecasting, risk propagation, and trend analysis:

{\
  scenarioId,\
  alteredSnapshot,\
  forecastSignals,\
  riskPropagationSignals,\
  healthScore,\
  deltaMetrics,\
  recommendations\
}

* * * * *

4. Deterministic Scenario Simulation Engine
-------------------------------------------

### File

src/services/ai/scenarioEngine.ts

### Main Function

simulateScenario(\
  baseSnapshot: PortfolioSnapshot,\
  scenario: ScenarioDefinition\
): ScenarioResult

Inputs:

-   the current portfolio snapshot

-   scenario definition

Outputs:

-   simulated structure (snapshot + signals)

-   delta comparisons

-   optimization suggestions

* * * * *

5. Scenario Definition Contract
-------------------------------

Define types in `src/types/ai.ts`:

export type ScenarioChange =\
  | { type: "reassignWorkItems"; workItemIds: string[]; toOwner: string }\
  | { type: "adjustMilestoneDate"; milestoneId: string; newDate: string }\
  | { type: "adjustPriority"; workItemIds: string[]; newPriority: number }\
  | { type: "bundleResourceShift"; fromBundleId: string; toBundleId: string; count: number };

export interface ScenarioDefinition {\
  id: string;\
  description: string;\
  changes: ScenarioChange[];\
}

* * * * *

6. Simulation Logic
-------------------

For each scenario:

1.  **Clone snapshot** (pure deep clone; do not mutate base).

2.  Apply each change to the snapshot.

3.  Recompute:

    -   trend signals (if applicable)

    -   forecast signals

    -   risk propagation signals

    -   health score

4.  Capture **delta metrics**:

    -   differences between original and simulated values (e.g., healthScore over/under)

5.  Generate **optimization recommendations** based on deltas.

* * * * *

7. Scenario Result Contract
---------------------------

Add:

export interface ScenarioResult {\
  scenarioId: string;\
  description: string;\
  simulatedSnapshot: Partial<PortfolioSnapshot>;\
  forecastSignals: ForecastSignal[];\
  riskPropagationSignals: RiskPropagationSignal[];\
  healthScore: HealthScore;\
  metricDeltas: {\
    [metric: string]: number;\
  };\
  recommendations: string[];\
}

* * * * *

8. Optimization Recommendations
-------------------------------

### Purpose

For each scenario run, generate prioritized recommendations based on:

-   healthScore improvements or degradation

-   reduction or increase in forecast risks

-   weakened risk propagation paths

-   improved execution stability

Example triggers:

-   "Reassigning work from X to Y reduced overdue ratio by 12% → consider full reallocation"

-   "Delaying milestone A increases risk propagation to milestone B → avoid adjustment"

Recommendations include:

-   human-readable text

-   related entities

-   reasoning backed by delta metrics

* * * * *

9. Scenario Planning API
------------------------

### 9.1 Run Scenario

POST /api/ai/scenario

Body:

{\
  "scenario": { ...ScenarioDefinition... }\
}

Response:

{\
  "status": "success",\
  "scenarioResult": ScenarioResult\
}

* * * * *

### 9.2 List Saved Scenarios

GET /api/ai/scenarios

Response:

{\
  "status": "success",\
  "scenarios": ScenarioDefinition[]\
}

* * * * *

### 9.3 Save Scenario

POST /api/ai/scenarios

Body:

{\
  "scenario": ScenarioDefinition\
}

Response:

{ "status": "success", "scenarioId": "..." }

* * * * *

### 9.4 Delete Scenario

DELETE /api/ai/scenarios/:id

Response:

{ "status": "success" }

* * * * *

10. Scenario Result Caching
---------------------------

Scenario outcomes can be cached if scenario definition plus base snapshot hash matches a previous run.

Cache key:

scenarioHash = hash(snapshotHash + normalizedScenarioDefinition)

Store inside:

ai_analysis_cache\
reportType = "scenarioResult"

* * * * *

11. UI Integration: Scenario Planner
------------------------------------

### Components

src/components/ai/ScenarioPlannerPanel.tsx\
src/components/ai/ScenarioCard.tsx\
src/components/ai/ScenarioResultPanel.tsx

### Planner UI

Users can:

-   define scenario changes via form

-   save scenario

-   run simulation

-   compare results

### Scenario Form Elements

-   resource reassignment

-   milestone date adjustments

-   priority adjustments

-   bundle resource shifts

* * * * *

12. UI: Scenario Result Display
-------------------------------

Scenario Result Overview\
------------------------

Health Score\
Delta Metrics

Forecast Signals\
Risk Propagation

Recommendations

Use:

-   comparison tables

-   trend arrows (improved/worsened)

-   follow-up suggestions (e.g., "save as investigation")

* * * * *

13. Strategic Advisor Integration
---------------------------------

Add scenario support into Strategic AI Advisor:

-   strategic queries may reference scenarios

-   advisor can interpret scenario results

Examples:

-   "What happens if we delay Milestone X by 2 weeks?"

-   "Compare scenario A vs scenario B."

* * * * *

14. Strategic Suggestions
-------------------------

Extend `suggestionGenerator.ts` to include recommendations tied to scenario outcomes:

Examples:

-   "Consider scenario where workload is balanced across teams for moderated risk"

-   "Evaluate impact of delaying low-priority milestones"

* * * * *

15. Acceptance Criteria
-----------------------

1.  Scenario simulation engine runs deterministically.

2.  Forecast and risk propagation signals update based on scenario.

3.  Scenario results are exposed via API.

4.  UI supports scenario creation and result display.

5.  Optimization recommendations are meaningful and actionable.

6.  Scenario caching works correctly.

7.  Strategic Advisor can reference scenario outcomes.

8.  No regressions in existing system features.

9.  TypeScript compilation passes (`npx tsc --noEmit`).

* * * * *

16. Files to Create / Modify
----------------------------

### Backend

src/services/ai/scenarioEngine.ts\
src/app/api/ai/scenario/route.ts\
src/app/api/ai/scenarios/route.ts\
src/services/ai/queryEngine.ts (scenario support)\
src/services/ai/suggestionGenerator.ts

### Frontend

src/components/ai/ScenarioPlannerPanel.tsx\
src/components/ai/ScenarioCard.tsx\
src/components/ai/ScenarioResultPanel.tsx

### Types

src/types/ai.ts

* * * * *

17. Example Scenario Definition
-------------------------------

{\
  "id": "scenario-01",\
  "description": "Reassign 3 engineers from BundleA to BundleB and delay MilestoneM1 by 1 week",\
  "changes": [\
    {\
      "type": "reassignWorkItems",\
      "workItemIds": [ "wi-001", "wi-045", "wi-073" ],\
      "toOwner": "TeamB"\
    },\
    {\
      "type": "adjustMilestoneDate",\
      "milestoneId": "ms-100",\
      "newDate": "2026-05-15"\
    }\
  ]\
}

* * * * *

18. Deliverable Summary
-----------------------

Phase **13E** adds **scenario planning and optimization**, enabling users to:

-   model hypothetical changes

-   predict delivery impact

-   compare alternative states

-   generate optimization recommendations

-   integrate scenarios into strategic AI workflows

This turns DeliveryHub AI into a **decision-support system**, not just an observational analytics tool