Phase 12C.3 Specification
Expanded Portfolio Query Intents and Knowledge Extraction
1. Purpose
Phase 12C.3 expands the Ask DeliveryHub AI query system introduced in Phase 12B.5 by improving the deterministic query engine and knowledge extraction layer so it can answer a broader set of portfolio questions.
The goal is to make AI Insights capable of responding to operational, analytical, and investigative queries about the DeliveryHub portfolio without relying heavily on LLM reasoning.
This phase strengthens:
query intent detection
deterministic answer generation
entity-backed evidence
structured list answers
contextual follow-up questions
2. Objectives
Phase 12C.3 will:
Expand supported query intents.
Improve deterministic knowledge extraction from portfolio snapshot.
Support ranking and list-style responses.
Add entity-rich evidence for answers.
Generate context-aware follow-up questions.
Improve intent detection and routing.
Maintain AI refinement as optional.
3. Scope
In Scope
expanded deterministic query intent coverage
knowledge extraction helpers
entity-backed answer generation
ranking queries
list queries
aggregation queries
contextual follow-up questions
Out of Scope
semantic vector search
conversational memory
full natural language reasoning
chart generation
cross-project queries
4. Current Query Engine Limitations
Current deterministic query engine handles basic queries such as:
unassigned work
overdue work
blockers
overdue reviews
general risk
This phase expands that coverage to include portfolio structure queries, ranking queries, and ownership/exposure queries.
5. Query Intent Categories
Add deterministic handling for the following categories.
5.1 Work Item Queries
Supported questions
Examples:
Which work items are overdue?
Which work items are blocked?
Which work items are unassigned?
Which work items are most urgent?
Which work items threaten milestones?
Show me overdue work items.
Deterministic logic
Use snapshot fields:
status
assignedTo
blocked
dueDate
milestoneId
Output
Answer includes:
count
short explanation
evidence list with entity references
Example answer:
5 work items are overdue.
Evidence:
• Payment API Integration – overdue since Mar 10
• Member onboarding update – overdue since Mar 12
5.2 Bundle Analysis Queries
Supported questions
Which bundles have the most unassigned work?
Which bundles contain the highest risk?
Which bundles are behind schedule?
Which bundles have the most blocked tasks?
Deterministic logic
Aggregate by bundle:
bundleId
workItemCount
unassignedCount
blockedCount
overdueCount
Output
Rank bundles by metric.
Example:
The bundles with the highest unassigned workload are:
1. Payments Platform (18 items)
2. Member Experience (11 items)
Evidence references:
bundleId
5.3 Application Health Queries
Supported questions
Which applications are unhealthy?
Which applications are critical?
Which applications have delivery risk?
Which applications have overdue work?
Deterministic logic
Use application fields:
health
workItemAssociations
reviewAssociations
milestones
Output
Answer includes:
application list
health summary
Evidence includes application entity references.
5.4 Milestone Exposure Queries
Supported questions
Which milestones are at risk?
Which milestones are overdue?
Which milestones depend on blocked work?
Which milestones have no active work?
Deterministic logic
Aggregate milestone state using:
milestone.targetDate
milestone.status
associatedWorkItems
blockedWorkItems
overdueWorkItems
Output
Answer includes milestone list.
Evidence includes milestone entity references.
5.5 Review Cycle Queries
Supported questions
Which review cycles are overdue?
Which applications have open reviews?
Which reviews are blocking release?
Deterministic logic
Use review fields:
review.status
review.dueDate
review.applicationId
Output
Answer includes review entities.
5.6 Owner / Capacity Queries
Supported questions
Which owners have the most work items?
Which owners have blocked tasks?
Who owns overdue work?
Deterministic logic
Aggregate:
assignedTo
workItemCount
blockedCount
overdueCount
Output
Answer includes owner ranking.
Evidence references work items.
5.7 Risk Ranking Queries
Supported questions
What is the biggest delivery risk?
Which areas have the most risk?
What should I fix first?
Deterministic logic
Combine:
unassigned ratio
blocked ratio
overdue ratio
milestone exposure
Return highest weighted signal.
6. Intent Detection Improvements
Improve intent routing inside queryEngine.ts.
Current behavior
Likely keyword matching.
New behavior
Use weighted keyword detection.
Example mapping:
Keyword	Intent
unassigned	workitem-unassigned
overdue	workitem-overdue
blocked	workitem-blocked
bundle	bundle-analysis
milestone	milestone-risk
review	review-status
owner	owner-workload
Allow multiple keywords to combine.
Example:
"Which bundles have blocked work?"
→ bundle-analysis + blocked filter.
7. Knowledge Extraction Helpers
Add helper module:
src/services/ai/knowledgeExtractors.ts
Functions:
extractWorkItemStats()
extractBundleStats()
extractMilestoneStats()
extractApplicationStats()
extractReviewStats()
extractOwnerStats()
These functions should produce reusable metrics.
Example:
{
  bundleId,
  totalWorkItems,
  unassignedCount,
  blockedCount,
  overdueCount
}
These metrics are reused across query intents.
8. Evidence Generation
Evidence items should reference entities.
Example:
{
  text: "Payment API Integration – overdue since Mar 10",
  entities: [
    { type: "workitem", id: "wi-123", label: "Payment API Integration" }
  ]
}
For ranking queries:
{
  text: "Payments Platform bundle contains 18 unassigned tasks",
  entities: [
    { type: "bundle", id: "bundle-10", label: "Payments Platform" }
  ]
}
9. Follow-Up Question Generation
Each query answer should generate 2–4 follow-ups.
Example:
Query:
Which bundles have the most unassigned work?
Follow-ups:
Which work items in Payments Platform are unassigned?
Which milestones depend on those work items?
Who should own the unassigned work?
Follow-ups must remain deterministic.
10. Query API Enhancements
Extend response shape:
{
  answer: string,
  explanation: string,
  evidence: EvidenceItem[],
  followUps: string[],
  entities?: EntityReference[]
}
Entities can optionally be included to drive drill-down panels.
11. UI Behavior
In AI Insights query panel:
When a query result appears:
Show answer
Show explanation
Show evidence list
Show related entities panel
Show follow-up suggestion chips
Clicking a follow-up:
triggers new query automatically.
12. Performance Considerations
Query engine should operate only on:
portfolioSnapshot
portfolioSignals
structuredReport
No additional database reads should be required.
13. Acceptance Criteria
Query engine supports expanded intent categories.
Ranking queries return deterministic results.
Evidence includes entity references.
Follow-up questions are context-aware.
Query answers include relevant entity lists.
Query results remain fast (< 100ms deterministic path).
AI refinement remains optional.
TypeScript compilation passes.
14. Files to Modify
src/services/ai/queryEngine.ts
src/services/ai/knowledgeExtractors.ts (new)
src/services/ai/suggestionGenerator.ts
src/app/api/ai/portfolio-query/route.ts
src/components/AIInsights.tsx
src/types/ai.ts
15. Deliverable Outcome
After Phase 12C.3, AI Insights will support:
operational delivery questions
ranked portfolio analysis
bundle/application/milestone risk detection
ownership workload analysis
entity-backed evidence
contextual follow-up investigation paths
This makes the Ask DeliveryHub AI system a true portfolio investigation tool rather than just a report viewer.