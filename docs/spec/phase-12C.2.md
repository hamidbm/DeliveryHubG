Phase 12C.2 Specification
Contextual Related-Entity Panels with Filtering, Grouping, and Limits
1. Purpose
Phase 12C.2 enhances the entity drill-down experience introduced in Phase 12C.1 by making related-entity lists:
contextually grouped by type
presented in bounded panels
sortable/filtered for relevance
easier to scan and action
This phase does not add full filter widgets, cross-page filters, or data grid complexity. It improves the display and relevance ordering of related entities under AI Insights sections.
2. Background
Phase 12C.1 introduced:
EntityReference types
EvidenceItem enriched with entities
UI rendering of entity-aware evidence
Entity drill-down links
Those allowed navigation to underlying domain entities. However, long lists are still raw and hard to act on.
This phase turns those lists into organized, context-sensitive entity panels.
3. High-Level Scope
In Scope
Group related entities by type:
Work items
Applications
Bundles
Milestones
Review cycles
Add secondary metadata (e.g., status, priority, due date)
Provide display limits and expand/collapse
Provide contextual relevance ordering
Integrate into existing UI for:
Top Risks
Recommended Actions
Concentration Signals
Query Answers
Out of Scope
Full search/filter widgets
Data grid or spreadsheet-like tables
Export from related-entity panels
Global cross-list filters
Bulk actions
Visual charts
4. Entity Panels in AI Insights
For each AI Insight section with entity references — such as:
Top Risks
Recommended Actions
Concentration Signals
Query Answers
display a Related Entities panel that groups entities by type and shows:
entity label (as clickable navigation)
secondary text (metadata)
optional context summary
display limit with expand/collapse
Example grouping:
Related Work Items
- WI-12345 • Blocked • Unassigned • Due Mar 20
- WI-98765 • Overdue • CI Critical • Due Mar 18
View all (4 more)

Related Milestones
- MS-100 • Overdue • Target Mar 15
View all (2 more)

Related Applications
- App-CRM • Health: Warning
5. Display Rules & UX Behavior
5.1 Grouping Order
When multiple entity types are present, prioritize grouping order by relevance to context:
Work items
Milestones
Reviews
Applications
Bundles
This order assumes work item–centric evidence is usually most actionable.
5.2 Panel Collapsing / Limits
Default display up to 5 entities per group
If group size exceeds limit:
show first 5 by relevance
show a “View all” toggle
on “View all”, expand to full group list (up to a reasonable upper bound like 50)
collapse button returns to 5
5.3 Secondary Metadata
For each entity type:
Work items
Include:
current status
blocked flag
unassigned status
due date
Example secondary text:
Blocked • Unassigned • Due Mar 20
Milestones
Include:
overdue status
target date
Example:
Overdue • Target Apr 15
Review cycles
Include:
status (Open/Closed)
overdue flag
due date
Example:
Open • Overdue • Due Mar 22
Applications
Include:
health value
Example:
Health: Warning
Bundles
Include:
number of apps in bundle
health summary
Example:
8 Apps • 2 Critical
5.4 Sorting / Relevance
Default ordering within each group should be by contextual relevance:
Work items
blocked
overdue
unassigned
nearest due date
Milestones
overdue
nearest target date
Reviews
overdue
open
nearest due date
Applications
critical health
warning health
healthy
Bundles
bundles containing critical apps
bundles with the most unassigned work
5.5 Panel Titles
Each group should have a clear title, e.g.:
Related Work Items (7)
Related Milestones (3)
The number indicates total items (not just shown items).
5.6 Interactivity
Clicking an entity navigates to its existing page:
Work items → /workitems/[id]
Applications → /applications/[id]
Bundles → /bundles/[id]
Milestones → /milestones/[id]
Review cycles → /reviews/[id]
UI should not block navigation on entity click
No modal spinners unless necessary
6. UI Component Specifications
6.1 EntityGroupPanel Component
Purpose: render a group of entities by type
Props:
type EntityGroupPanelProps = {
  entityType: EntityType;        // e.g., "workitem"
  entities: EntityReference[];    // full list
  secondaryMeta: Record<string,string>; // entityId → secondary text
}
Behavior:
Groups by entity type
Shows up to 5 entities by default
Shows “View all” toggle when length > 5
Uses relevance sort
6.2 RelatedEntitiesSection Component
Purpose: group multiple EntityGroupPanel(s) under a section
Props:
type RelatedEntitiesSectionProps = {
  title: string;
  groups: Array<{
    type: EntityType;
    entities: EntityReference[];
    secondaryMeta: Record<string,string>;
  }>;
}
Behavior:
Renders multiple groups
Ensures consistent ordering (workitems → milestones → reviews → applications → bundles)
7. Backend Enhancements
7.1 Secondary Metadata Fetching
The backend should provide secondary metadata for entities passed to the UI. Two implementation options:
Option A (preferred)
Extend API responses to include the secondary metadata map:
secondaryMeta: {
  [entityId: string]: string;
}
This can be included in:
/api/ai/portfolio-summary
/api/ai/portfolio-query
The resolver should fetch entity summaries for involved IDs.
Option B
Do not fetch on backend; make the frontend fetch secondary metadata via separate endpoints.
Both options are acceptable but Option A is preferred for simplicity.
8. API Contract Changes
Modify the existing structured report and query API responses to include:
{
  report: StructuredPortfolioReport,
  relatedEntitiesMeta: {
    [entityType in EntityType]?: {
      [entityId: string]: string; // secondary metadata
    }
  }
}
Example:
{
  "report": { ... },
  "relatedEntitiesMeta": {
    "workitem": {
      "wi-123": "Blocked • Unassigned • Due Mar 20",
      "wi-456": "Overdue • Due Mar 18"
    },
    "milestone": {
      "ms-001": "Overdue • Target Apr 01"
    }
  }
}
Both structured report and query API endpoints should include this field when entities are present.
9. UI Integration
In AIInsights.tsx (or related components):
For Top Risks
Under each risk card:
Related Work Items (N)
- entity cards (clickable)
View all
For Recommended Actions
Under each action card:
Related Entities
- Work items
- Applications
- Milestones
For Concentration Signals
Under each signal:
Items of Interest
- Work items
- Bundles
For Query Answers
Under answer box:
Related Entities (from evidence)
- Work items
- Reviews
- Milestones
10. Empty & Edge States
10.1 No Entities
If a section has no entity references:
hide the related entity panel
do not show empty “Related …” headers
10.2 Small Lists
If group size ≤ 5:
show full list
do not show “View all”
10.3 Very Large Lists
If entities > 50:
show first 15
show “View all”
clicking “View all” expands to full list
(This keeps UI manageable.)
11. Styling and Layout
Follow existing DeliveryHub standards:
panel padding
consistent spacing
readable secondary text
underlined clickable links
responsive wrap for narrow screens
grouping headers in bold
Do not use emojis/icons unless already in UI system.
12. Acceptance Criteria
Grouped entity panels appear under each relevant insight section.
Entity groups ordered by relevance and type.
Entities display secondary metadata.
Clicking an entity navigates to its page.
Default display limited, with “View all” when applicable.
RelatedEntities metadata flows correctly from backend to frontend.
No regressions in existing avoidable behavior (export, caching, query answers).
UI remains responsive and readable.
npx tsc --noEmit passes.
13. Files to Create or Modify
Backend
src/app/api/ai/portfolio-summary/route.ts
src/app/api/ai/portfolio-query/route.ts
src/services/entityMetaResolver.ts
Services
src/services/ai/normalizePortfolioReport.ts
src/services/ai/queryEngine.ts
Types
src/types/ai.ts
Frontend Components
src/components/ui/EntityGroupPanel.tsx
src/components/ui/RelatedEntitiesSection.tsx
src/components/AIInsights.tsx (update)
14. Example Sections (Illustrative)
Top Risk Example
Top Risks
-----------
1) High Unassigned Workload
Summary: ...
Evidence:
  • 80/89 unassigned work items

Related Work Items (7)
- WI-12345 • Blocked • Unassigned • Due Mar 20
- WI-98765 • Overdue • Unassigned • Due Mar 18
- WI-45678 • Unassigned • Due Apr 05
View all

Related Milestones (2)
- MS-001 • Overdue • Target Mar 15
View all
15. Implementation Guidance for Codex
Rules
Do not build full filter widgets — keep simple context ordering.
Secondary metadata must be human-friendly strings.
Respect grouping priority.
Maintain separation between evidence rendering and related entity panels.
Avoid
full feature tables
heavy client-side sorting widgets
real-time large data fetches
Focus on exploration, context, readability, and navigation.
16. Deliverable Summary
Phase 12C.2 delivers:
related entity panels grouped by type
contextual ordering
secondary metadata
expand/collapse support
manageable display limits
integration with existing UI
This makes AI Insights actionable and explorable rather than just informative