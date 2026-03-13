Phase 12C.4 Specification
=========================

Saved Investigations, Query History, and Pinned Insights
--------------------------------------------------------

* * * * *

1. Purpose
==========

Phase **12C.4** transforms the Ask DeliveryHub AI experience from a **session-based investigation tool** into a **persistent investigation workspace**.

Currently, users can ask powerful questions about the portfolio, but once the page refreshes or the session ends, those investigations disappear.

This phase introduces:

-   saved investigations (persisted queries)

-   recent query history

-   pinned insights

-   manual refresh of saved investigations

These features allow users to build a **stable working set of portfolio intelligence questions**.

* * * * *

2. Goals
========

### Functional Goals

1.  Allow users to **save a query investigation**.

2.  Provide **recent query history** for the current user session.

3.  Allow investigations to be **pinned** to the AI Insights page.

4.  Allow saved investigations to be **refreshed manually**.

5.  Persist saved investigations in the database.

### Non-Functional Goals

-   preserve current query performance

-   avoid additional AI provider calls unless necessary

-   maintain deterministic-first answer generation

-   keep UI lightweight and unobtrusive

* * * * *

3. Scope
========

In Scope
--------

-   saved query persistence

-   query history

-   pinned investigations

-   refresh saved investigation results

-   UI panels for saved investigations

Out of Scope
------------

-   cross-user sharing

-   automatic scheduled refresh

-   push notifications

-   long-term analytics tracking

-   chat history beyond query records

* * * * *

4. Terminology
==============

| Term | Meaning |
| --- | --- |
| Query | a user question submitted to Ask DeliveryHub AI |
| Investigation | a saved query with stored answer snapshot |
| Query History | recent queries from the current user |
| Pinned Investigation | a saved investigation marked as important |

* * * * *

5. Data Model
=============

Create a new collection:

ai_saved_queries

### Document Schema

interface SavedInvestigation {\
  id: string\
  userId: string\
  question: string\
  normalizedIntent?: string\
  answer: string\
  explanation: string\
  evidence: EvidenceItem[]\
  entities: EntityReference[]\
  followUps: string[]\
  pinned: boolean\
  createdAt: string\
  updatedAt: string\
}

### Notes

-   `normalizedIntent` optional but helpful for refresh routing.

-   Evidence and entities are stored exactly as returned by query engine.

-   `pinned` determines UI placement.

* * * * *

6. Backend APIs
===============

6.1 Save Investigation
----------------------

### Endpoint

POST /api/ai/investigations

### Request

{\
  "question": "Which bundles have the most unassigned work?",\
  "queryResult": {\
    "answer": "...",\
    "explanation": "...",\
    "evidence": [...],\
    "entities": [...],\
    "followUps": [...]\
  }\
}

### Behavior

-   persist investigation record

-   default `pinned = false`

### Response

{\
  "status": "success",\
  "investigationId": "..."\
}

* * * * *

6.2 Get Saved Investigations
----------------------------

### Endpoint

GET /api/ai/investigations

### Behavior

Return investigations belonging to authenticated user.

### Response

{\
  "status": "success",\
  "items": SavedInvestigation[]\
}

* * * * *

6.3 Pin / Unpin Investigation
-----------------------------

### Endpoint

PATCH /api/ai/investigations/:id

### Request

{\
  "pinned": true\
}

### Behavior

Update pinned status.

* * * * *

6.4 Delete Investigation
------------------------

### Endpoint

DELETE /api/ai/investigations/:id

### Behavior

Remove saved investigation.

* * * * *

6.5 Refresh Investigation
-------------------------

### Endpoint

POST /api/ai/investigations/:id/refresh

### Behavior

1.  Load saved investigation.

2.  Re-run deterministic query engine using stored question.

3.  Replace stored answer snapshot.

### Response

{\
  "status": "success",\
  "investigation": SavedInvestigation\
}

* * * * *

7. Query Engine Integration
===========================

Saved investigations reuse existing deterministic query engine.

Refresh behavior:

savedQuestion\
→ queryEngine.run(savedQuestion)\
→ update stored result

AI refinement remains optional.

* * * * *

8. UI Changes
=============

Modify:

AIInsights.tsx

Add three new panels.

* * * * *

9. Query History Panel
======================

Behavior
--------

Display last **10--20 recent queries** in current session.

Each item shows:

Question\
Answer summary\
Timestamp

Actions:

-   Run again

-   Save investigation

History is stored **client-side only**.

* * * * *

10. Saved Investigations Panel
==============================

Add a section:

Saved Investigations

Display saved queries for the current user.

Each item shows:

Question\
Answer summary\
Last updated timestamp

Actions:

-   Run investigation

-   Refresh investigation

-   Pin / Unpin

-   Delete

* * * * *

11. Pinned Insights Panel
=========================

Pinned investigations appear at top of AI Insights page.

Section title:

Pinned Insights

Display pinned items in compact cards.

Each card shows:

Question\
Answer summary\
Last updated

Actions:

-   View full result

-   Refresh

-   Unpin

Pinned insights should be limited to **max 6** to avoid clutter.

* * * * *

12. UI Interaction Flow
=======================

### Saving Investigation

User clicks:

Save Investigation

Under query result.

Backend persists investigation.

Investigation appears in Saved Investigations.

* * * * *

### Pinning Investigation

User clicks:

Pin

Investigation moves to pinned section.

* * * * *

### Refresh Investigation

User clicks:

Refresh

System re-runs query engine and updates answer.

* * * * *

### Running Saved Investigation

User clicks saved question.

System runs deterministic query engine again.

* * * * *

13. UI Layout Changes
=====================

AI Insights page layout becomes:

Pinned Insights\
---------------------------------

AI Portfolio Report

Top Risks\
Recommended Actions\
Concentration Signals

Ask DeliveryHub AI\
---------------------------------

Query Input

Quick Suggestions

Query Results

Query History\
Saved Investigations

* * * * *

14. Performance Considerations
==============================

Saved investigations should:

-   avoid triggering AI provider calls unless AI refinement enabled

-   rely primarily on deterministic engine

-   store snapshot answer to reduce recomputation

Database queries must be indexed by:

userId\
createdAt\
pinned

* * * * *

15. Security
============

Ensure:

-   investigations only visible to owner (`userId`)

-   endpoints require authentication

-   deletion limited to owner

* * * * *

16. Acceptance Criteria
=======================

1.  Users can save query results as investigations.

2.  Saved investigations persist in DB.

3.  Investigations can be pinned.

4.  Pinned investigations appear in pinned panel.

5.  Investigations can be refreshed.

6.  Query history works for current session.

7.  No regression in query engine behavior.

8.  TypeScript builds successfully.

* * * * *

17. Files to Create or Modify
=============================

### Backend

src/app/api/ai/investigations/route.ts\
src/app/api/ai/investigations/[id]/route.ts\
src/app/api/ai/investigations/[id]/refresh/route.ts

### Services

src/services/ai/investigationService.ts

### Database

db.ts

Add helpers:

saveInvestigation()\
getInvestigations()\
updateInvestigation()\
deleteInvestigation()

### Frontend

src/components/AIInsights.tsx\
src/components/ai/InvestigationPanel.tsx\
src/components/ai/PinnedInsightsPanel.tsx\
src/components/ai/QueryHistoryPanel.tsx

* * * * *

18. Deliverable Outcome
=======================

After Phase **12C.4**, AI Insights becomes a **persistent portfolio investigation workspace**.

Users can:

-   save important questions

-   revisit prior analyses

-   pin key insights

-   refresh investigations as the portfolio changes

This prepares the platform for future phases such as:

-   portfolio trend analysis

-   proactive risk alerts

-   collaborative investigations.

* * * * *