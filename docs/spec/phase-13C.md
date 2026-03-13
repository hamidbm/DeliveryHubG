Phase 13C Specification
Cross-Project Risk Propagation and Dependency Intelligence
1. Purpose
Phase 13C introduces a Cross-Project Risk Propagation Engine that identifies and explains how delivery issues in one project, bundle, or application may propagate to others due to dependencies.
This phase enables DeliveryHub to answer strategic questions such as:
“Which bundles’ issues have ripple effects?”
“What delivery risks stem from dependencies between teams?”
“How might a delay in one area impact other milestones/applications?”
Cross-project risk propagation transforms AI Insights from isolated signals to interconnected portfolio intelligence.
2. Goals
Functional Goals
Identify dependency relationships among work items, applications, bundles, and milestones.
Compute propagation risk signals based on dependency exposure and upstream issues.
Provide structured output describing propagation chains, risk severity, and evidence.
Expose via API and UI for strategic analysis.
Integrate with query engine for strategic queries about propagation.
Non-Functional Goals
Maintain deterministic first principles where possible.
Supplement with AI refinement only where needed for explanation.
Preserve auditability and evidence-centric output.
3. Inputs & Data Sources
Cross-project risk propagation depends on:
Portfolio snapshot (work items, statuses, assignments)
Work item dependencies (links between work items)
Application associations
Milestone associations
Bundle groupings
Review cycle associations
Trend signals
Active alerts/forecast signals
4. Conceptual Model
Propagation emerges when:
A work item/blocker has dependents in other components
A critical app’s delay affects multiple bundles
Milestone slip risk upstream cascades downstream
Review delays block dependent integrations
We capture:
Source risk entity
Affected entities
Paths of influence
Severity & confidence
5. Risk Propagation Output Contract
Add type in src/types/ai.ts:
export interface RiskPropagationSignal {
  id: string;
  title: string;
  severity: "low" | "medium" | "high";
  summary: string;
  paths: PropagationPath[];
  evidence: EvidenceItem[];
  relatedEntities: EntityReference[];
}

export interface PropagationPath {
  from: EntityReference;
  to: EntityReference;
  linkType: "dependency" | "shared_resource" | "milestone_sequence";
}
6. Dependency Extractor Layer
File
src/services/ai/dependencyExtractor.ts
Responsibilities
Extract dependency edges between:
work items
milestones
bundles
applications
Dependency Types
WorkItem → WorkItem (task dependency)
WorkItem → Milestone (delivery target)
Application → Application (component dependency)
Bundle → Bundle (release grouping)
WorkItem → Application (ownership)
Review → WorkItem/Milestone (gating)
Use existing snapshot fields:
explicit dependency fields
milestone associations
application linkages
bundle groupings
7. Risk Propagation Engine
File
src/services/ai/riskPropagation.ts
Main Function
generateRiskPropagationSignals(
  snapshot: PortfolioSnapshot,
  report: StructuredPortfolioReport,
  forecast: ForecastSignal[]
): RiskPropagationSignal[]
High-Level Logic
Identify source risks:
Active critical alerts
Forecast signals (e.g., milestone risk)
Traverse dependency graph to find propagation paths:
Follow task dependencies
Identify milestone sequences
Identify shared application resources
Assess impact severity based on:
number of downstream entities
proximity in dependency graph
severity of source risk
Construct propagation signal with:
title
summary
paths
evidence
8. Evidence & Explanation
Each propagation signal includes:
Evidence item for each path:
text
entity references
provenance (“deterministic” | “AI”)
Support narrative explaining how upstream issues affect downstream systems.
Example evidence text:
“Work item WI-123 (blocked) blocks WI-456 in MemberPortal → delays Milestone MS-003”
9. API Endpoint
Route
GET /api/ai/risk-propagation
Behavior
Require authentication.
Load latest snapshot, report, forecast signals.
Call generateRiskPropagationSignals.
Return:
{
  "status": "success",
  "riskPropagationSignals": RiskPropagationSignal[]
}
Add cache with:
reportType = "risk-propagation"
TTL: 24h
10. UI Integration
Add panel to Executive Insights page:
Cross-Project Risk Propagation
------------------------------
<PropagationSignalCard /> …
Components
src/components/ai/RiskPropagationPanel.tsx
src/components/ai/PropagationSignalCard.tsx
Each card shows:
title
summary
severity badge
propagation paths
evidence list
related entities chips
Paths can be rendered:
From → To via linkType
Example:
Payment API Milestone (MS-011)
  ⟶ blocks →
Checkout Feature Bundle
  ⟶ impacts →
Billing Milestone (MS-017)
11. Strategic Queries Integration
Extend queryEngine.ts:
Add intents like:
Which delivery risks cascade into other areas?
Show me dependencies contributing to delivery risk.
Identify cross-project risk paths.
Deterministic fallback:
list riskPropagationSignals
answer description summary
evidence + entities
12. Caching & Freshness
Reuse ai_analysis_cache with:
reportType = "risk-propagation"
Stale after 24h.
Manual regenerate via:
POST /api/ai/risk-propagation
13. Acceptance Criteria
Dependency extractor correctly builds dependency graph.
Risk propagation engine identifies meaningful paths.
Signals include severity, evidence, related entities, path list.
API returns structured output.
UI panels display propagation signals clearly.
Query engine responds to related intents.
Caching works and doesn’t regress existing features.
UI renders entities as links to drill-down pages.
TypeScript builds without errors (npx tsc --noEmit).
14. Files to Create / Modify
Backend
src/services/ai/dependencyExtractor.ts
src/services/ai/riskPropagation.ts
src/app/api/ai/risk-propagation/route.ts
Types
src/types/ai.ts
Frontend
src/components/ai/RiskPropagationPanel.tsx
src/components/ai/PropagationSignalCard.tsx
Services Integration
src/services/ai/queryEngine.ts
src/services/ai/suggestionGenerator.ts
15. Example Output
{
  "riskPropagationSignals": [
    {
      "id": "prop_001",
      "title": "Blocked Work in Payment API Impacts Checkout Milestone",
      "severity": "high",
      "summary": "Blocked tasks in Payment API cause delays cascading to Checkout milestone.",
      "paths": [
        {
          "from": { "type": "workitem", "id": "wi-123", "label": "Payment API Blocker" },
          "to": { "type": "workitem", "id": "wi-456", "label": "Checkout Task" },
          "linkType": "dependency"
        },
        {
          "from": { "type": "workitem", "id": "wi-456", "label": "Checkout Task" },
          "to": { "type": "milestone", "id": "ms-017", "label": "Checkout Milestone" },
          "linkType": "milestone_sequence"
        }
      ],
      "evidence": [
        {
          "text": "WI-123 blocks WI-456",
          "entities": [
            { "type": "workitem", "id": "wi-123", "label": "Payment API Blocker" },
            { "type": "workitem", "id": "wi-456", "label": "Checkout Task" }
          ]
        }
      ],
      "relatedEntities": [
        { "type": "workitem", "id": "wi-123", "label": "Payment API Blocker" },
        { "type": "milestone", "id": "ms-017", "label": "Checkout Milestone" }
      ]
    }
  ]
}
16. Deliverable Summary
Phase 13C adds Cross-Project Risk Propagation Intelligence to DeliveryHub AI.
This enables the system to:
detect and explain risk cascades
support strategic decision-making
connect delivery issues across boundaries
answer strategic interdependency questions